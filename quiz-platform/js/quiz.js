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
var currentMode = 'multiple'; // default quiz mode
var correctCount = 0;   // correct answers in current game
var incorrectCount = 0; // incorrect answers in current game

// Returns the title without the artist name (Artist - Title -> Title)
function extractTitle(text) {
    if (!text) return '';
    const clean = text.trim();
    if (clean.includes(' - ')) {
        return clean.split(' - ').slice(1).join(' - ').trim();
    }
    return clean;
}

// Normalize title to ignore case and whitespaces for subjective matching
function normalizeTitle(title) {
    if (!title) return '';
    return title.toLowerCase().replace(/\s+/g, '');
}

// Fetch quiz data from backend API (called on page load)
async function fetchQuizData() {
    try {
        var response = await fetch(API_BASE_URL + '/api/quiz-play?id=' + rawQuizId + '&limit=100');
        if (!response.ok) throw new Error('API request failed');

        var data = await response.json();
        quizTitle = data.quiz.title || '노래 맞추기 퀴즈';

        // SEO: Update Meta Tags
        if (typeof updateSEOMeta === 'function') {
            updateSEOMeta(quizTitle, data.quiz.description, data.quiz.thumbnail_url);
        }

        var allAnswers = Array.from(new Set(data.questions.map(function (q) {
            return extractTitle(q.answer);
        }).filter(Boolean)));

        // Map backend data to frontend format
        allQuizQuestions = data.questions.map(function (q, index) {
            var options = q.options;
            if (typeof options === 'string') {
                options = JSON.parse(options);
            }

            // 하드코딩 필터가 아닌, 길이가 1~2자인 영단어(A, B, C, D, Ad 등)가 많이 섞여있는지 검증
            var isBadOption = false;
            if (!Array.isArray(options) || options.length < 2) {
                isBadOption = true;
            } else {
                var badCount = options.filter(function (o) {
                    return /^[A-Za-z]{1,2}$/.test(extractTitle(o.text));
                }).length;
                if (badCount >= 2) isBadOption = true;
            }

            // 올바르지 않은 보기인 경우 현재 퀴즈의 다른 풀에서 정답 포함 동적 보기 생성
            if (isBadOption && q.answer && allAnswers.length > 3) {
                var correctAnswer = extractTitle(q.answer);
                var wrongs = allAnswers.filter(function (a) { return a !== correctAnswer; })
                    .sort(function () { return Math.random() - 0.5; })
                    .slice(0, 3);
                var newOpts = [correctAnswer].concat(wrongs).sort(function () { return Math.random() - 0.5; });
                options = newOpts.map(function (text, i) {
                    return {
                        id: ['A', 'B', 'C', 'D'][i],
                        text: text,
                        isCorrect: text === correctAnswer
                    };
                });
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

    // currentMode determines if we use multiple or text input

    // Shuffle and slice questions
    var shuffled = allQuizQuestions.slice().sort(function () { return Math.random() - 0.5; });
    activeQuizData = shuffled.slice(0, Math.min(count, shuffled.length));

    if (typeof multiplayerEnabled !== 'undefined' && multiplayerEnabled) {
        if (typeof createMultiplayerRoom === 'function') {
            createMultiplayerRoom(count);
            return; // Wait for room code and lobby to be shown
        }
    }

    // Reset state
    currentQuestionIndex = 0;
    score = 0;
    correctCount = 0;
    incorrectCount = 0;

    // Switch views
    document.getElementById('round-select').style.display = 'none';
    document.getElementById('quiz-wrapper').style.display = 'block';

    // Start quiz
    loadQuestion(0);
}

// Fetch data immediately when the script executes (do not wait for YouTube API)
fetchQuizData();

// YouTube IFrame API callback (just to set a flag or can be left empty if not strictly needed)
window.onYouTubeIframeAPIReady = function () {
    console.log('YouTube API Ready');
};

// Display a quiz question and set up the YouTube player
function loadQuestion(index) {
    if (typeof resetMultiplayerRound === 'function') resetMultiplayerRound();
    var waitHostText = document.getElementById('wait-multi-next');
    if (waitHostText) waitHostText.style.display = 'none';

    var question = activeQuizData[index];

    // Update UI headers
    document.getElementById('question-counter').innerText = 'Question ' + (index + 1) + ' / ' + activeQuizData.length;
    document.getElementById('question-title').innerText = question.title;
    document.getElementById('next-btn').style.display = 'none';

    var isImage = question.videoId.startsWith('http');
    document.getElementById('question-title').innerText = isImage ? '사진을 보고 누군지 맞혀보세요!' : '노래의 이 부분을 듣고 제목을 맞혀보세요!';

    // SECURITY: Hide song title from Chrome Media Hub / Lock screen to prevent spoilers
    if ('mediaSession' in navigator && !isImage) {
        navigator.mediaSession.metadata = new MediaMetadata({
            title: '❓ 노래 제목을 맞춰보세요!',
            artist: 'Quiz-Rank.com',
            album: '힌트를 확인하려면 정답을 선택하세요',
            artwork: [{ src: 'https://quizrank.pages.dev/favicon.ico', sizes: '128x128', type: 'image/x-icon' }]
        });
    }

    // Apply blind mode filter
    var playerDiv = document.getElementById('player');
    var imagePlayer = document.getElementById('image-player');
    var mediaControls = document.querySelector('.media-controls');

    if (playerDiv) {
        if (!imagePlayer) {
            imagePlayer = document.createElement('img');
            imagePlayer.id = 'image-player';
            imagePlayer.style = 'display: none; max-width: 100%; max-height: 400px; border-radius: 12px; margin: 0 auto; object-fit: contain; width: 100%; padding: 1rem;';
            playerDiv.parentNode.insertBefore(imagePlayer, playerDiv.nextSibling);
        }

        if (isImage) {
            playerDiv.style.display = 'none';
            imagePlayer.style.display = 'block';
            imagePlayer.src = question.videoId;
            imagePlayer.style.filter = 'none'; // Blur removed at user request
            imagePlayer.style.transition = 'filter 0.5s ease';
            if (mediaControls) mediaControls.style.display = 'none';
        } else {
            playerDiv.style.display = 'block';
            imagePlayer.style.display = 'none';
            if (mediaControls) mediaControls.style.display = 'flex';

            playerDiv.style.filter = 'blur(100px) brightness(0)';
            playerDiv.style.opacity = '1';
            playerDiv.style.pointerEvents = 'none';
        }

        var existingLink = document.querySelector('.youtube-link-reveal');
        if (existingLink) existingLink.remove();
    }

    // Render answer options
    var optionsContainer = document.getElementById('options-container');
    optionsContainer.innerHTML = '';

    if (currentMode === 'multiple') {
        optionsContainer.style.display = 'grid';
        question.options.forEach(function (opt) {
            var btn = document.createElement('button');
            btn.className = 'btn-option';
            btn.innerText = extractTitle(opt.text);
            btn.onclick = function () { handleAnswer(btn, opt.isCorrect); };
            optionsContainer.appendChild(btn);
        });
    } else {
        // Text Input subjective mode
        optionsContainer.style.display = 'block';

        var inputHtml = '<div style="display: flex; gap: 1rem; max-width: 500px; margin: 0 auto; flex-direction: column;">';
        inputHtml += '<input type="text" id="subjective-input" placeholder="정식 발매명(한국어)으로 입력해 주세요" style="padding: 1rem; font-size: 1.2rem; border-radius: 12px; border: 2px solid var(--border-color); background: var(--card-bg); color: var(--text-color); outline: none;" onkeydown="if(event.key===\\\'Enter\\\') checkSubjectiveAnswer()">';
        inputHtml += '<button id="submit-subjective" class="btn-primary large" onclick="checkSubjectiveAnswer()">정답 제출</button>';
        inputHtml += '<p id="subjective-feedback" style="display: none; font-size: 1.2rem; font-weight: 800; margin-top: 1rem;"></p>';
        inputHtml += '</div>';
        optionsContainer.innerHTML = inputHtml;
    }

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
    console.warn('⚠️ YouTube 외부 재생 차단 또는 삭제됨 (코드: ' + errorCode + '). 스킵 처리합니다.');

    // 사용자 화면에 에러를 띄우지 않고, 몰래 현재 문제를 배열에서 삭제한 뒤 다음 문제를 즉시 불러옵니다.
    activeQuizData.splice(currentQuestionIndex, 1);

    if (activeQuizData.length === 0) {
        document.getElementById('question-title').innerText = '모든 비디오가 재생 불가능합니다.';
        return;
    }

    if (currentQuestionIndex < activeQuizData.length) {
        // 이미 렌더링된 컴포넌트들을 다음 문제로 덮어씌움
        loadQuestion(currentQuestionIndex);
    } else {
        showResult();
    }
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

// Common logic after user answers (either multiple choice or subjective)
function showAnswerResult(isCorrect) {
    if (isCorrect) {
        score += 100;
        document.getElementById('score-display').innerText = 'Score: ' + score;
    }

    clearTimeout(playTimer);

    // Reveal video or image after answering
    var currentQuestion = activeQuizData[currentQuestionIndex];
    var isImage = currentQuestion.videoId.startsWith('http');
    var playerDiv = document.getElementById('player');
    var imagePlayer = document.getElementById('image-player');

    if (isImage && imagePlayer) {
        imagePlayer.style.filter = 'none';
    } else if (playerDiv) {
        playerDiv.style.opacity = '1';
        playerDiv.style.filter = 'none';
        playerDiv.style.pointerEvents = 'auto';
    }

    // Reveal actual metadata to Media Session after answering
    if ('mediaSession' in navigator && !isImage) {
        navigator.mediaSession.metadata = new MediaMetadata({
            title: extractTitle(currentQuestion.answer),
            artist: '정답 확인 완료',
            artwork: [{ src: 'https://quizrank.pages.dev/favicon.ico', sizes: '128x128', type: 'image/x-icon' }]
        });
    }

    // Add direct YouTube link below video (only if not image)
    var ytPlaceholder = document.querySelector('.yt-placeholder');
    var existingLink = document.querySelector('.youtube-link-reveal');
    if (!isImage && !existingLink && ytPlaceholder) {
        var linkDiv = document.createElement('div');
        linkDiv.className = 'youtube-link-reveal';
        linkDiv.innerHTML = '<a href="https://www.youtube.com/watch?v=' + currentQuestion.videoId + '&t=' + currentQuestion.startSeconds + 's" target="_blank" style="color: var(--primary-color); font-weight: bold; text-decoration: underline; margin-top: 0.5rem; font-size: 0.9rem; display: block;">🔗 유튜브 원본 영상 보러가기</a>';
        ytPlaceholder.appendChild(linkDiv);
    }

    // Show next question button
    var nextBtn = document.getElementById('next-btn');

    if (typeof isMultiplayerActive === 'function' && isMultiplayerActive() && typeof isHost !== 'undefined' && !isHost) {
        nextBtn.style.display = 'none';
        var waitHostText = document.getElementById('wait-multi-next');
        if (!waitHostText) {
            waitHostText = document.createElement('p');
            waitHostText.id = 'wait-multi-next';
            waitHostText.innerText = '방장이 다음 문제를 시작할 때까지 대기해 주세요...';
            waitHostText.style = 'color: var(--accent); font-weight: bold; margin-top: 1rem; text-align: center;';
            nextBtn.parentNode.insertBefore(waitHostText, nextBtn);
        } else {
            waitHostText.style.display = 'block';
        }
    } else {
        nextBtn.style.display = 'inline-block';

        // UX IMPROVEMENT: Auto-scroll to the next button so the user doesn't have to scroll manually
        setTimeout(function () {
            nextBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100);

        nextBtn.onclick = function () {
            try {
                if (typeof isMultiplayerActive === 'function' && isMultiplayerActive() && typeof multiplayerSendNext === 'function') {
                    multiplayerSendNext(currentQuestionIndex + 1);
                }

                if (playerDiv) {
                    playerDiv.style.opacity = '0';
                    playerDiv.style.pointerEvents = 'none';
                }
                var lDiv = document.querySelector('.youtube-link-reveal');
                if (lDiv && lDiv.parentNode) {
                    lDiv.parentNode.removeChild(lDiv);
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
}

// Handle user answer selection (Multiple Choice)
function handleAnswer(btnElement, isCorrect) {
    var allBtns = document.querySelectorAll('.btn-option');
    allBtns.forEach(function (b) { b.disabled = true; });

    if (isCorrect) {
        btnElement.classList.add('correct');
        correctCount++;
    } else {
        btnElement.classList.add('wrong');
        incorrectCount++;
        var question = activeQuizData[currentQuestionIndex];
        var correctIdx = question.options.findIndex(function (o) { return o.isCorrect; });
        if (correctIdx !== -1) {
            allBtns[correctIdx].classList.add('correct');
        }
    }

    if (typeof multiplayerSendAnswer === 'function') {
        multiplayerSendAnswer(isCorrect);
    }
    showAnswerResult(isCorrect);
}

// Handle Subjective Answer check
window.checkSubjectiveAnswer = function () {
    var inputEl = document.getElementById('subjective-input');
    var btnEl = document.getElementById('submit-subjective');
    if (!inputEl) return;

    var userAnswer = inputEl.value;
    if (!userAnswer.trim()) {
        alert("정답을 입력해주세요!");
        return;
    }

    inputEl.disabled = true;
    if (btnEl) btnEl.disabled = true;

    var question = activeQuizData[currentQuestionIndex];
    var correctOption = question.options.find(function (o) { return o.isCorrect; });
    var correctTitle = extractTitle(correctOption.text);

    var normalizedUser = normalizeTitle(userAnswer);
    var normalizedCorrect = normalizeTitle(correctTitle);

    var isCorrect = false;

    // Fuzzy matching logic
    if (normalizedUser === normalizedCorrect) {
        isCorrect = true;
    } else {
        var correctTitleNoParens = correctTitle.replace(/\(.*?\)/g, '').replace(/\[.*?\]/g, '');
        var normCorrectNoParens = normalizeTitle(correctTitleNoParens);
        // If it matches exactly without parens, or if the correct answer contains the user's input (length >= 2)
        if (normCorrectNoParens === normalizedUser ||
            (normalizedUser.length >= 2 && normalizedCorrect.includes(normalizedUser))) {
            isCorrect = true;
        }
    }

    var feedbackEl = document.getElementById('subjective-feedback');
    feedbackEl.style.display = 'block';

    if (isCorrect) {
        feedbackEl.innerText = '✅ 정답입니다!';
        feedbackEl.style.color = 'var(--accent)';
        correctCount++;
    } else {
        feedbackEl.innerText = '❌ 아쉽습니다! 정답: ' + correctTitle;
        feedbackEl.style.color = 'var(--secondary-color)';
        incorrectCount++;
    }

    if (typeof multiplayerSendAnswer === 'function') {
        multiplayerSendAnswer(isCorrect);
    }
    showAnswerResult(isCorrect);
};

// Show final score result & send stats to backend
function showResult() {
    document.getElementById('quiz-wrapper').style.display = 'none';
    var resultDiv = document.getElementById('quiz-result');
    resultDiv.style.display = 'block';
    document.getElementById('final-score').innerText = score;

    // Show correct/incorrect summary
    var totalAnswered = correctCount + incorrectCount;
    var rateText = totalAnswered > 0
        ? '정답률: ' + Math.round((correctCount / totalAnswered) * 100) + '% (' + correctCount + '/' + totalAnswered + ')'
        : '';
    var rateEl = document.getElementById('result-rate');
    if (rateEl) rateEl.innerText = rateText;

    // Send result to backend
    if (quizId && totalAnswered > 0) {
        fetch(API_BASE_URL + '/api/quiz-result', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ quizId: quizId, correctCount: correctCount, incorrectCount: incorrectCount })
        }).catch(function (e) { console.warn('결과 전송 실패:', e); });
    }
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
