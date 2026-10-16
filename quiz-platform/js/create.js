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
            image_url: item.url
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

    // 파일 업로드(data: 주소)는 서버가 받지 않는다 — 이미지 저장소가 준비되기 전까지 제출할 수 없다
    if (items.some(function (it) { return /^data:/i.test(it.image_url); })) {
        alert('이미지 파일 업로드로 만든 월드컵은 아직 제출할 수 없습니다. (이미지 업로드 기능 준비 중)');
        return;
    }
    if ([8, 16, 32, 64].indexOf(items.length) === -1) {
        alert('후보는 8, 16, 32, 64개 중 하나여야 합니다. (현재 ' + items.length + '개)');
        return;
    }

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
