// quiz-create.js - Manage user-created quiz logic UX and submissions

let questionCount = 0;
let hashtags = [];

function addQuestion() {
    questionCount++;
    const container = document.getElementById('questions-container');
    const qDiv = document.createElement('div');
    qDiv.className = 'form-group question-card';
    qDiv.innerHTML = `
        <div class="question-number">문제 ${questionCount}번</div>
        <button class="remove-btn" onclick="removeQuestion(this)">삭제</button>
        <div class="form-group">
            <label class="form-label">📹 미디어 (유튜브 영상 주소 또는 이미지 URL)</label>
            <input type="text" class="form-input q-media" oninput="validateUrl(this)" placeholder="예: https://www.youtube.com/watch?v=XXXXX 또는 https://.../image.png">
            <div class="url-status">유효한 URL입니다.</div>
        </div>
        <div class="form-group" style="display: flex; gap: 1rem;">
            <div style="flex: 1;">
                <label class="form-label">정답 (보기용 1)</label>
                <input type="text" class="form-input q-ans" placeholder="정확한 정답 입력">
            </div>
            <div style="flex: 1;">
                <label class="form-label">오답 보기 2</label>
                <input type="text" class="form-input q-wr1" placeholder="오답 입력">
            </div>
            <div style="flex: 1;">
                <label class="form-label">오답 보기 3</label>
                <input type="text" class="form-input q-wr2" placeholder="오답 입력">
            </div>
            <div style="flex: 1;">
                <label class="form-label">오답 보기 4</label>
                <input type="text" class="form-input q-wr3" placeholder="오답 입력">
            </div>
        </div>
    `;
    container.appendChild(qDiv);
}

function removeQuestion(btn) {
    btn.parentElement.remove();
}

// URL Validation
function validateUrl(input) {
    const val = input.value.trim();
    const status = input.nextElementSibling;
    const card = input.closest('.question-card');

    const isYoutube = val.includes('youtube.com/') || val.includes('youtu.be/');
    const isImage = /\.(jpg|jpeg|png|webp|gif|svg)$/i.test(val);

    if (!val) {
        status.className = 'url-status';
        card.classList.remove('invalid-url');
        return;
    }

    if (isYoutube || isImage) {
        status.textContent = isYoutube ? "✅ 유튜브 영상이 확인되었습니다." : "✅ 이미지 링크가 확인되었습니다.";
        status.className = 'url-status success';
        card.classList.remove('invalid-url');
    } else {
        status.textContent = "❌ 유효하지 않은 URL입니다. (유튜브 또는 이미지 링크 필요)";
        status.className = 'url-status error';
        card.classList.add('invalid-url');
    }
}

// Hashtag Management
const hashtagInput = document.getElementById('hashtag-input');
const hashtagList = document.getElementById('hashtag-list');

if (hashtagInput) {
    hashtagInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            let val = this.value.trim().replace(/#/g, '');
            if (val && !hashtags.includes(val)) {
                if (hashtags.length >= 5) {
                    alert('해시태그는 최대 5개까지 등록 가능합니다.');
                    return;
                }
                hashtags.push(val);
                renderHashtags();
            }
            this.value = '';
        }
    });
}

function renderHashtags() {
    hashtagList.innerHTML = hashtags.map(tag => `
        <span class="hashtag-badge">#${tag} <span class="remove" onclick="removeHashtag('${tag}')">&times;</span></span>
    `).join('');

    const counter = document.getElementById('hashtag-count');
    if (counter) {
        counter.textContent = `${hashtags.length} / 5`;
        counter.style.color = hashtags.length >= 5 ? '#ff4757' : 'rgba(255,255,255,0.5)';
    }
}

function removeHashtag(tag) {
    hashtags = hashtags.filter(t => t !== tag);
    renderHashtags();
}

// Drag & Drop for Thumbnail
const dropZone = document.getElementById('thumb-drop-zone');
const fileInput = document.getElementById('thumb-file-input');
const urlInput = document.getElementById('quiz-thumbnail-url');

if (dropZone) {
    dropZone.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', (e) => {
        if (fileInput.files.length) {
            updateThumbnailPreview(fileInput.files[0]);
        }
    });

    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('drop-zone--over');
    });

    ['dragleave', 'dragend'].forEach(type => {
        dropZone.addEventListener(type, () => {
            dropZone.classList.remove('drop-zone--over');
        });
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        if (e.dataTransfer.files.length) {
            fileInput.files = e.dataTransfer.files;
            updateThumbnailPreview(e.dataTransfer.files[0]);
        }
        dropZone.classList.remove('drop-zone--over');
    });
}

function updateThumbnailPreview(file) {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
        let thumbElement = dropZone.querySelector('.drop-zone__thumb');
        if (!thumbElement) {
            thumbElement = document.createElement('div');
            thumbElement.className = 'drop-zone__thumb';
            dropZone.appendChild(thumbElement);
        }
        thumbElement.style.backgroundImage = `url('${reader.result}')`;
        // urlInput.value = reader.result; // We could use dataURL but it's large for DB
        // For now, let's keep the file in fileInput or if it's a URL we use urlInput
    };
}

// Add 1st question by default
window.onload = function () {
    addQuestion();
};

async function submitQuiz() {
    const title = document.getElementById('quiz-title').value;
    let desc = document.getElementById('quiz-desc').value;
    let thumb = document.getElementById('quiz-thumbnail-url').value.trim();

    const questions = [];
    const blocks = document.querySelectorAll('.question-card');

    if (!title) return alert("퀴즈 제목을 입력해주세요!");

    for (let block of blocks) {
        let media = block.querySelector('.q-media').value.trim();
        let ans = block.querySelector('.q-ans').value.trim();
        let w1 = block.querySelector('.q-wr1').value.trim();
        let w2 = block.querySelector('.q-wr2').value.trim();
        let w3 = block.querySelector('.q-wr3').value.trim();

        if (!media || !ans || !w1 || !w2 || !w3) {
            return alert("모든 문제의 미디어와 정답/오답 보기를 입력해주세요.");
        }

        // if youtube, extract video ID
        let videoId = media;
        let isYoutube = false;
        try {
            if (media.includes('youtube.com') || media.includes('youtu.be')) {
                let url = new URL(media);
                videoId = url.searchParams.get('v') || url.pathname.slice(1);
                isYoutube = true;
            }
        } catch (e) { }

        questions.push({
            media_id: videoId,
            answer: ans,
            wrongs: [w1, w2, w3],
            full_media: media,
            is_youtube: isYoutube
        });
    }

    if (questions.length === 0) return alert("최소 1개 이상의 문제를 추가하세요.");

    // Fallback thumbnail: If no thumb, use Question 1
    if (!thumb && questions.length > 0) {
        const firstMedia = questions[0].full_media;
        if (questions[0].is_youtube) {
            thumb = `https://img.youtube.com/vi/${questions[0].media_id}/mqdefault.jpg`;
        } else {
            thumb = firstMedia; // Image URL
        }
    }

    if (thumb) {
        desc += '\n[THUMBNAIL_URL:' + thumb + ']';
    }

    // Add hashtags to description or a dedicated metadata field
    if (hashtags.length > 0) {
        desc += '\n[HASHTAGS:' + hashtags.join(',') + ']';
    }

    try {
        const res = await fetch(API_BASE_URL + '/api/user-created-quiz', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: title, description: desc, questions: questions })
        });
        const data = await res.json();

        if (data.success) {
            alert('성공적으로 퀴즈가 생성되었습니다!');
            location.href = 'quiz-play.html?id=' + (data.quizId || data.mockId);
        } else {
            alert('오류 발생: ' + data.error);
        }
    } catch (err) {
        alert('서버 연결 중 오류가 발생했습니다.');
    }
}

