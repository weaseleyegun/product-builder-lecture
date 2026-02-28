// quiz-create.js - Manage user-created quiz logic UX and submissions

let questionCount = 0;

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
            <input type="text" class="form-input q-media" placeholder="예: https://www.youtube.com/watch?v=XXXXX 또는 https://.../image.png">
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

// Add 1st question by default
window.onload = function () {
    addQuestion();
};

async function submitQuiz() {
    const title = document.getElementById('quiz-title').value;
    const desc = document.getElementById('quiz-desc').value;

    if (!title) return alert("퀴즈 제목을 입력해주세요!");

    const questions = [];
    const blocks = document.querySelectorAll('.question-card');
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
        try {
            if (media.includes('youtube.com') || media.includes('youtu.be')) {
                let url = new URL(media);
                videoId = url.searchParams.get('v') || url.pathname.slice(1);
            }
        } catch (e) { }

        questions.push({
            media_id: videoId,
            answer: ans,
            wrongs: [w1, w2, w3]
        });
    }

    if (questions.length === 0) return alert("최소 1개 이상의 문제를 추가하세요.");

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
