// create.js - Handle Tier Maker & Worldcup Creation Logic

var uploadedItems = [];
var draggedItem = null;

// Handle file input and render previews
window.handleFileUpload = function (event) {
    var files = event.target.files;
    var previewContainer = document.getElementById('preview-container');
    var itemsBank = document.getElementById('items-bank');

    document.getElementById('tier-maker-section').style.display = 'block';

    for (var i = 0; i < files.length; i++) {
        var file = files[i];
        if (!file.type.startsWith('image/')) continue;

        var reader = new FileReader();
        reader.onload = (function (currentFile, currentIndex) {
            return function (e) {
                var imgUrl = e.target.result;
                var itemId = 'item-' + Date.now() + '-' + currentIndex;

                uploadedItems.push({ id: itemId, url: imgUrl, file: currentFile });

                // Add to preview section
                var previewItem = document.createElement('div');
                previewItem.className = 'preview-item';
                previewItem.id = 'preview-' + itemId;
                var defaultName = (currentFile && currentFile.name) ? currentFile.name.split('.')[0] : 'Item ' + (currentIndex + 1);
                previewItem.innerHTML =
                    '<img src="' + imgUrl + '" alt="Preview">' +
                    '<input type="text" class="item-name-input" id="input-' + itemId + '" value="' + defaultName + '" placeholder="이름/설명 입력">' +
                    '<button class="delete-btn" onclick="removeItem(\'' + itemId + '\')">❌</button>';
                previewContainer.appendChild(previewItem);

                // Add to tier maker bank (draggable)
                var dragImg = document.createElement('img');
                dragImg.src = imgUrl;
                dragImg.className = 'draggable';
                dragImg.id = itemId;
                dragImg.draggable = true;
                dragImg.addEventListener('dragstart', handleDragStart);
                dragImg.addEventListener('dragend', handleDragEnd);
                itemsBank.appendChild(dragImg);
            };
        })(file, i);

        reader.readAsDataURL(file);
    }
};

// Remove an uploaded item
window.removeItem = function (id) {
    uploadedItems = uploadedItems.filter(function (item) { return item.id !== id; });
    var previewEl = document.getElementById('preview-' + id);
    if (previewEl) previewEl.remove();
    var dragEl = document.getElementById(id);
    if (dragEl) dragEl.remove();

    if (uploadedItems.length === 0) {
        document.getElementById('tier-maker-section').style.display = 'none';
    }
};

// --- Drag and Drop Logic ---

function handleDragStart(e) {
    draggedItem = this;
    setTimeout(function () { draggedItem.style.opacity = '0.5'; }, 0);
    e.dataTransfer.effectAllowed = 'move';
}

function handleDragEnd() {
    this.style.opacity = '1';
    draggedItem = null;
}

// Initialize dropzones and Auth check
document.addEventListener('DOMContentLoaded', function () {
    const token = sessionStorage.getItem('sb_access_token');
    if (!token) {
        alert('회원 가입 후 이용할 수 있습니다.');
        window.location.href = 'login.html';
        return;
    }

    var dropzones = document.querySelectorAll('.dropzone');
    dropzones.forEach(function (zone) {
        zone.addEventListener('dragover', function (e) {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            this.style.background = 'rgba(76, 110, 245, 0.2)';
        });
        zone.addEventListener('dragleave', function () {
            this.style.background = '';
        });
        zone.addEventListener('drop', function (e) {
            e.preventDefault();
            this.style.background = '';
            if (draggedItem) {
                this.appendChild(draggedItem);
            }
        });
    });
});

// ── 이미지 업로드 헬퍼 ─────────────────────────────────────
function userIdFromToken(token) {
    try {
        var payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
        return typeof payload.sub === 'string' ? payload.sub : null;
    } catch (e) { return null; }
}

// 긴 변이 maxSide 이하가 되도록 줄여 JPEG로 다시 인코딩한다 (용량 제한 1MB, 메타데이터 제거, GIF는 첫 프레임)
function resizeToJpeg(file, maxSide) {
    return new Promise(function (resolve, reject) {
        var url = URL.createObjectURL(file);
        var img = new Image();
        img.onload = function () {
            var scale = Math.min(1, maxSide / Math.max(img.width, img.height));
            var canvas = document.createElement('canvas');
            canvas.width = Math.max(1, Math.round(img.width * scale));
            canvas.height = Math.max(1, Math.round(img.height * scale));
            var ctx = canvas.getContext('2d');
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            URL.revokeObjectURL(url);
            canvas.toBlob(function (blob) {
                if (!blob) return reject(new Error('이미지를 변환하지 못했습니다.'));
                if (blob.size > 1024 * 1024) return reject(new Error('이미지가 너무 큽니다. 더 작은 이미지를 사용해 주세요.'));
                resolve(blob);
            }, 'image/jpeg', 0.85);
        };
        img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('이미지를 읽을 수 없습니다.')); };
        img.src = url;
    });
}

// Supabase Storage(ugc-images)에 내 폴더(<user id>/)로 업로드하고 공개 https 주소를 돌려준다
async function uploadImage(cfg, token, uid, blob) {
    var name = uid + '/' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10) + '.jpg';
    var res = await fetch(cfg.SUPABASE_URL + '/storage/v1/object/ugc-images/' + name, {
        method: 'POST',
        headers: { apikey: cfg.SUPABASE_ANON_KEY, Authorization: 'Bearer ' + token, 'Content-Type': 'image/jpeg', 'x-upsert': 'false' },
        body: blob
    });
    if (!res.ok) {
        var msg = '';
        try { msg = (await res.json()).message || ''; } catch (e) { /* 본문 없음 */ }
        throw new Error(msg || ('저장소 오류 ' + res.status));
    }
    return cfg.SUPABASE_URL + '/storage/v1/object/public/ugc-images/' + name;
}

// Submit creation to API
window.submitCreation = async function () {
    var title = document.getElementById('create-title').value;

    if (!title) {
        alert('티어 리스트 제목을 입력해주세요!');
        return;
    }

    // items: uploaded images + their names (can be empty array if no images)
    var items = uploadedItems.map(function (item, index) {
        var nameInput = document.getElementById('input-' + item.id);
        var itemName = nameInput ? nameInput.value.trim() : '';
        if (!itemName) itemName = 'Item ' + (index + 1);

        return {
            name: itemName,
            image_url: item.url,
            _file: item.file
        };
    });

    var desc = document.getElementById('create-desc').value;
    var thumb = document.getElementById('create-thumbnail').value.trim();

    if (thumb) {
        desc += '\n[THUMBNAIL_URL:' + thumb + ']';
    }

    var payload = {
        title: title,
        description: desc,
        maxRounds: document.getElementById('create-rounds').value,
        type: 'worldcup',
        items: items
    };

    if ([8, 16, 32, 64].indexOf(items.length) === -1) {
        alert('후보는 8, 16, 32, 64개 중 하나여야 합니다. (현재 ' + items.length + '개)');
        return;
    }

    // 이미지 파일은 먼저 이미지 저장소(Supabase Storage)에 올리고, 서버에는 https 주소만 보낸다
    var submitBtn = document.querySelector('[onclick="submitCreation()"]');
    var originalLabel = submitBtn ? submitBtn.textContent : '';
    var setProgress = function (text) { if (submitBtn) { submitBtn.textContent = text; submitBtn.disabled = !!text; } };
    try {
        var needUpload = items.some(function (it) { return /^data:/i.test(it.image_url); });
        if (needUpload) {
            var token0 = sessionStorage.getItem('sb_access_token');
            if (!token0) { alert('로그인이 필요합니다.'); return; }
            var cfg = await (await fetch(API_BASE_URL + '/api/config')).json();
            var uid = userIdFromToken(token0);
            if (!uid) { alert('로그인 정보가 올바르지 않습니다. 다시 로그인해 주세요.'); return; }
            for (var i = 0; i < items.length; i++) {
                if (!/^data:/i.test(items[i].image_url)) continue;
                setProgress('이미지 업로드 중... (' + (i + 1) + '/' + items.length + ')');
                var blob = await resizeToJpeg(items[i]._file, 1000);
                items[i].image_url = await uploadImage(cfg, token0, uid, blob);
            }
        }
    } catch (e) {
        setProgress('');
        if (submitBtn) submitBtn.textContent = originalLabel;
        alert('이미지 업로드에 실패했습니다: ' + (e && e.message ? e.message : e));
        return;
    }
    setProgress('');
    if (submitBtn) submitBtn.textContent = originalLabel;
    items = items.map(function (it) { return { name: it.name, image_url: it.image_url }; });

    try {
        const token = sessionStorage.getItem('sb_access_token');
        var response = await fetch(API_BASE_URL + '/api/user-created-content', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + token
            },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            alert('제출되었습니다! 관리자 검수 후 공개됩니다.');
            window.location.href = 'index.html';
        } else {
            var errorText = await response.text();
            try { errorText = JSON.parse(errorText).error || errorText; } catch (e) { /* 텍스트 그대로 */ }
            alert('저장에 실패했습니다.\n\n' + errorText);
        }
    } catch (e) {
        console.error('Submission failed', e);
        alert('서버 연결에 실패했습니다. 로컬 서버(wrangler dev) 상태를 확인하세요.');
    }
};
