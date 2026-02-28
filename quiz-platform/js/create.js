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
                previewItem.innerHTML =
                    '<img src="' + imgUrl + '" alt="Preview">' +
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

// Initialize dropzones
document.addEventListener('DOMContentLoaded', function () {
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

    if (!title || uploadedItems.length < 2) {
        alert('제목을 입력하고 최소 2개의 이미지를 업로드해주세요!');
        return;
    }

    var items = uploadedItems.map(function (item, index) {
        return {
            name: (item.file && item.file.name) ? item.file.name.split('.')[0] : 'Item ' + (index + 1),
            image_url: item.url
        };
    });

    var payload = {
        title: title,
        description: document.getElementById('create-desc').value,
        maxRounds: document.getElementById('create-rounds').value,
        type: 'worldcup',
        items: items
    };

    try {
        var response = await fetch(API_BASE_URL + '/api/user-created-content', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            alert('성공적으로 만들어졌습니다!');
            window.location.href = 'index.html';
        } else {
            var errorText = await response.text();
            alert('저장에 실패했습니다. 관리자에게 문의하세요.\n\n오류: ' + errorText);
        }
    } catch (e) {
        console.error('Submission failed', e);
        alert('서버 연결에 실패했습니다. 로컬 서버(wrangler dev) 상태를 확인하세요.');
    }
};
