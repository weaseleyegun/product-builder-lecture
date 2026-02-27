// quiz.js - Handle YouTube IFrame API and Quiz game logic

// Read quiz ID from URL
var urlParams = new URLSearchParams(window.location.search);
var rawQuizId = urlParams.get('id');
var quizId = rawQuizId ? rawQuizId : 1;

var allQuizQuestions = []; // All fetched questions
var activeQuizData = []; // Questions for current round
var player;
var currentQuestionIndex = 0;
var score = 0;
var playTimer;
var quizTitle = '';

// Fetch quiz data from backend API (called on page load)
async function fetchQuizData() {
    try {
        var response = await fetch(API_BASE_URL + '/api/quiz-play?id=' + quizId + '&limit=100');
        if (!response.ok) throw new Error('API request failed');

        var data = await response.json();
        quizTitle = data.quiz.title || '노래 맞추기 퀴즈';

        // Map backend data to frontend format
        allQuizQuestions = data.questions.map(function (q, index) {
            var options = q.options;
            if (typeof options === 'string') {
                options = JSON.parse(options);
            }
            return {
                id: q.id,
                quizId: quizId,
                title: quizTitle + ' (' + (index + 1) + '번 문제)',
                videoId: q.video_id,
                startSeconds: q.start_time,
                endSeconds: q.end_time || (q.start_time + 5),
                options: options
            };
        });
        console.log('✅ API에서 퀴즈 데이터 로드 성공:', allQuizQuestions.length, '문제');

        // Update round selection screen
        document.getElementById('round-quiz-title').innerText = quizTitle + ' (' + allQuizQuestions.length + '문제 보유)';
        document.getElementById('round-available').innerText = '현재 ' + allQuizQuestions.length + '문제를 사용할 수 있습니다.';

        // Disable round buttons that exceed available questions
        var roundBtns = document.querySelectorAll('.round-btn');
        roundBtns.forEach(function (btn) {
            var count = parseInt(btn.getAttribute('data-count'));
            if (count > allQuizQuestions.length) {
                btn.classList.add('disabled');
                btn.title = '문제 수가 부족합니다 (' + allQuizQuestions.length + '문제 보유)';
            }
        });

    } catch (error) {
        console.error('퀴즈 데이터 로드 실패:', error);
        document.getElementById('round-quiz-title').innerText = '⚠️ 서버에서 데이터를 불러올 수 없습니다.';
    }
}

// User selects a round count
function selectRound(count) {
    if (allQuizQuestions.length === 0) {
        alert('퀴즈 데이터가 아직 로드되지 않았습니다.');
        return;
    }

    // Shuffle and slice questions
    var shuffled = allQuizQuestions.slice().sort(function () { return Math.random() - 0.5; });
    activeQuizData = shuffled.slice(0, Math.min(count, shuffled.length));

    // Reset state
    currentQuestionIndex = 0;
    score = 0;

    // Switch views
    document.getElementById('round-select').style.display = 'none';
    document.getElementById('quiz-wrapper').style.display = 'block';

    // Start quiz
    loadQuestion(0);
}

// YouTube IFrame API callback
function onYouTubeIframeAPIReady() {
    fetchQuizData();
}

// Display a quiz question and set up the YouTube player
function loadQuestion(index) {
    var question = activeQuizData[index];

    // Update UI headers
    document.getElementById('question-counter').innerText = 'Question ' + (index + 1) + ' / ' + activeQuizData.length;
    document.getElementById('question-title').innerText = question.title;
    document.getElementById('next-btn').style.display = 'none';

    // Apply blind mode filter on video
    var playerDiv = document.getElementById('player');
    if (playerDiv) {
        playerDiv.style.filter = 'blur(100px) brightness(0)';
        playerDiv.style.opacity = '1';
        playerDiv.style.pointerEvents = 'none';

        var existingLink = document.querySelector('.youtube-link-reveal');
        if (existingLink) existingLink.remove();
    }

    // Render answer options
    var optionsContainer = document.getElementById('options-container');
    optionsContainer.innerHTML = '';

    question.options.forEach(function (opt) {
        var btn = document.createElement('button');
        btn.className = 'btn-option';
        btn.innerText = opt.text;
        btn.onclick = function () { handleAnswer(btn, opt.isCorrect); };
        optionsContainer.appendChild(btn);
    });

    // Load or cue YouTube video
    if (!player) {
        player = new YT.Player('player', {
            height: '360',
            width: '640',
            videoId: question.videoId,
            playerVars: {
                'playsinline': 1,
                'controls': 0,
                'disablekb': 1,
                'fs': 0,
                'rel': 0,
                'start': question.startSeconds,
                'end': question.endSeconds,
                'origin': window.location.origin
            },
            events: {
                'onReady': onPlayerReady,
                'onStateChange': onPlayerStateChange,
                'onError': onPlayerError
            }
        });
    } else {
        player.loadVideoById({
            videoId: question.videoId,
            startSeconds: question.startSeconds,
            endSeconds: question.endSeconds
        });
    }
}

// Handle YouTube player errors (embed blocked, deleted, etc.)
function onPlayerError(event) {
    var errorCode = event.data;
    var errorMessages = {
        2: '잘못된 영상 ID입니다.',
        5: '이 영상은 HTML5 플레이어를 지원하지 않습니다.',
        100: '이 영상은 삭제되었거나 비공개입니다.',
        101: '이 영상은 외부 재생이 차단되어 있습니다.',
        150: '이 영상은 외부 재생이 차단되어 있습니다.'
    };
    var msg = errorMessages[errorCode] || '알 수 없는 재생 오류입니다.';
    console.warn('⚠️ YouTube 에러 (코드: ' + errorCode + '):', msg);

    // Show error message and auto-skip to next question after 2 seconds
    document.getElementById('question-title').innerText = '⚠️ ' + msg + ' 다음 문제로 넘어갑니다...';

    setTimeout(function () {
        currentQuestionIndex++;
        if (currentQuestionIndex < activeQuizData.length) {
            loadQuestion(currentQuestionIndex);
        } else {
            showResult();
        }
    }, 2000);
}

// Auto-play video when ready
function onPlayerReady(event) {
    event.target.playVideo();
}

// Auto-pause when segment ends
function onPlayerStateChange(event) {
    var question = activeQuizData[currentQuestionIndex];
    if (event.data == YT.PlayerState.PLAYING) {
        var duration = question.endSeconds - question.startSeconds;
        clearTimeout(playTimer);
        playTimer = setTimeout(function () {
            player.pauseVideo();
        }, duration * 1000);
    }
}

// Handle user answer selection
function handleAnswer(btnElement, isCorrect) {
    var allBtns = document.querySelectorAll('.btn-option');
    allBtns.forEach(function (b) { b.disabled = true; });

    if (isCorrect) {
        btnElement.classList.add('correct');
        score += 100;
        document.getElementById('score-display').innerText = 'Score: ' + score;
    } else {
        btnElement.classList.add('wrong');
        var question = activeQuizData[currentQuestionIndex];
        var correctIdx = question.options.findIndex(function (o) { return o.isCorrect; });
        if (correctIdx !== -1) {
            allBtns[correctIdx].classList.add('correct');
        }
    }

    clearTimeout(playTimer);

    // Reveal video after answering
    var playerDiv = document.getElementById('player');
    if (playerDiv) {
        playerDiv.style.opacity = '1';
        playerDiv.style.filter = 'none';
        playerDiv.style.pointerEvents = 'auto';
    }

    // Add direct YouTube link below video
    var currentQuestion = activeQuizData[currentQuestionIndex];
    var linkDiv = document.createElement('div');
    linkDiv.className = 'youtube-link-reveal';
    linkDiv.innerHTML = '<a href="https://www.youtube.com/watch?v=' + currentQuestion.videoId + '&t=' + currentQuestion.startSeconds + 's" target="_blank" style="color: var(--primary-color); font-weight: bold; text-decoration: underline; margin-top: 1rem; display: block;">🔗 유튜브 원본 영상 보러가기</a>';
    document.querySelector('.yt-placeholder').appendChild(linkDiv);

    // Show next question button
    var nextBtn = document.getElementById('next-btn');
    nextBtn.style.display = 'inline-block';
    nextBtn.onclick = function () {
        try {
            if (playerDiv) {
                playerDiv.style.opacity = '0';
                playerDiv.style.pointerEvents = 'none';
            }
            if (linkDiv && linkDiv.parentNode) {
                linkDiv.parentNode.removeChild(linkDiv);
            }
            if (player && typeof player.stopVideo === 'function') {
                player.stopVideo();
            }

            currentQuestionIndex++;
            if (currentQuestionIndex < activeQuizData.length) {
                loadQuestion(currentQuestionIndex);
            } else {
                showResult();
            }
        } catch (err) {
            console.error('다음 문제 이동 중 에러:', err);
            alert('다음 문제 로딩 중 오류가 발생했습니다.');
        }
    };
}

// Show final score result
function showResult() {
    document.getElementById('quiz-wrapper').style.display = 'none';
    var resultDiv = document.getElementById('quiz-result');
    resultDiv.style.display = 'block';
    document.getElementById('final-score').innerText = score;
}

// Audio controller global functions
window.playAudio = function () {
    if (player && typeof player.playVideo === 'function') {
        player.playVideo();
    }
};

window.pauseAudio = function () {
    if (player && typeof player.pauseVideo === 'function') {
        player.pauseVideo();
    }
};

window.replayAudio = function () {
    if (player && typeof player.seekTo === 'function' && activeQuizData[currentQuestionIndex]) {
        player.seekTo(activeQuizData[currentQuestionIndex].startSeconds, true);
        player.playVideo();
    }
};
