// multiplayer.js - Handles Supabase Realtime multiplayer logic

var supabaseClient = null;
var myUser = { id: '', nickname: 'Guest' + Math.floor(Math.random() * 9000 + 1000), score: 0 };
var roomCode = '';
var roomChannel = null;
var isHost = false;
var players = {};
var multiplayerEnabled = false;
var answersThisRound = new Set();
// Pre-fill nickname if available
document.addEventListener('DOMContentLoaded', () => {
    var nickInput = document.getElementById('multi-nickname');
    if (nickInput && nickInput.value === '') {
        nickInput.value = myUser.nickname;
    }

    // Check if URL has ?room= parameter
    const urlParams = new URLSearchParams(window.location.search);
    const joinCode = urlParams.get('room');
    if (joinCode) {
        setGameMode('multi');
        document.getElementById('mode-multi').click(); // visual toggle
        roomCode = joinCode;

        // 바로 대기실로 자동 입장
        joinMultiplayerRoom();
    }
});

function setGameMode(mode) {
    if (mode === 'single') {
        document.getElementById('multi-settings').style.display = 'none';

        document.getElementById('mode-single').style.backgroundColor = 'var(--primary-color)';
        document.getElementById('mode-single').style.color = '#fff';
        document.getElementById('mode-single').style.border = '2px solid var(--primary-color)';
        document.getElementById('mode-multi').style.backgroundColor = 'var(--card-bg)';
        document.getElementById('mode-multi').style.color = 'var(--text-color)';
        document.getElementById('mode-multi').style.border = '2px solid var(--primary-color)';
        multiplayerEnabled = false;

        // Restore round buttons if hidden
        document.getElementById('round-buttons').style.display = 'grid';
        var promptEl = document.getElementById('round-prompt');
        if (promptEl) promptEl.style.display = 'block';
    } else {
        document.getElementById('multi-settings').style.display = 'block';

        document.getElementById('mode-multi').style.backgroundColor = 'var(--primary-color)';
        document.getElementById('mode-multi').style.color = '#fff';
        document.getElementById('mode-multi').style.border = '2px solid var(--primary-color)';
        document.getElementById('mode-single').style.backgroundColor = 'var(--card-bg)';
        document.getElementById('mode-single').style.color = 'var(--text-color)';
        document.getElementById('mode-single').style.border = '2px solid var(--primary-color)';
        multiplayerEnabled = true;

        if (!roomCode) {
            document.getElementById('round-buttons').style.display = 'grid';
            var promptEl = document.getElementById('round-prompt');
            if (promptEl) promptEl.innerText = "🏆 방을 먼저 생성할까요? 몇 문제에 도전할지 골라주세요!";
        }
    }
}

window.isMultiplayerActive = function () {
    return multiplayerEnabled && !!roomCode;
};

async function initSupabase() {
    if (supabaseClient) return true;
    try {
        const res = await fetch(API_BASE_URL + '/api/config');
        const config = await res.json();
        // Uses global supabase from CDN
        supabaseClient = supabase.createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY);
        myUser.id = 'usr_' + Math.random().toString(36).substr(2, 9);
        myUser.nickname = document.getElementById('multi-nickname').value.trim() || myUser.nickname;
        return true;
    } catch (e) {
        console.error("Failed to init supabase", e);
        alert('멀티플레이 서버에 접속할 수 없습니다.');
        return false;
    }
}

// Host creates room by selecting round length (hijacks selectRound in quiz.js)
window.createMultiplayerRoom = async function (count) {
    await initSupabase();
    isHost = true;
    roomCode = Math.floor(1000 + Math.random() * 9000).toString();

    // Hide standard round UI and show Lobby
    document.getElementById('round-select').style.display = 'none';
    document.getElementById('multiplayer-lobby').style.display = 'block';
    document.getElementById('lobby-room-code').innerText = roomCode;
    document.getElementById('btn-start-multi').style.display = 'block';

    // Formulate a link
    var qId = typeof quizId !== 'undefined' ? quizId : new URLSearchParams(window.location.search).get('id');
    window.history.replaceState({}, '', window.location.pathname + '?id=' + qId + '&room=' + roomCode);

    setupRoomChannel();
};

window.manualJoinRoom = async function () {
    var code = document.getElementById('multi-room-code').value.trim();
    if (!code) {
        alert('방 코드를 입력해주세요!');
        return;
    }
    var qId = typeof quizId !== 'undefined' ? quizId : new URLSearchParams(window.location.search).get('id');
    window.history.replaceState({}, '', window.location.pathname + '?id=' + qId + '&room=' + code);

    roomCode = code;
    await joinMultiplayerRoom();
};

window.joinMultiplayerRoom = async function () {
    await initSupabase();
    isHost = false;

    document.getElementById('round-select').style.display = 'none';
    document.getElementById('multiplayer-lobby').style.display = 'block';
    document.getElementById('lobby-room-code').innerText = roomCode;
    document.getElementById('wait-host-msg').style.display = 'block';

    setupRoomChannel();
};

function setupRoomChannel() {
    roomChannel = supabaseClient.channel('room:' + roomCode, {
        config: {
            presence: { key: myUser.id },
            broadcast: { self: true }
        }
    });

    roomChannel
        .on('presence', { event: 'sync' }, () => {
            const newState = roomChannel.presenceState();
            players = {};
            for (const id in newState) {
                players[id] = newState[id][0]; // get the first connection state
            }
            updatePlayerList();
        })
        .on('broadcast', { event: 'START_GAME' }, payload => {
            // Host sent start signal with questions data
            activeQuizData = payload.payload.questions;
            if (payload.payload.mode && typeof currentMode !== 'undefined') {
                currentMode = payload.payload.mode;
            }
            document.getElementById('multiplayer-lobby').style.display = 'none';
            document.getElementById('quiz-wrapper').style.display = 'block';
            if (typeof loadQuestion === 'function') loadQuestion(0); // fixes empty array index start
        })
        .on('broadcast', { event: 'NEXT_QUESTION' }, payload => {
            var idx = payload.payload.index;
            var nextBtn = document.getElementById('next-btn');
            if (nextBtn) nextBtn.style.display = 'none';
            var lDiv = document.querySelector('.youtube-link-reveal');
            if (lDiv && lDiv.parentNode) {
                lDiv.parentNode.removeChild(lDiv);
            }
            if (typeof player !== 'undefined' && player && typeof player.stopVideo === 'function') {
                player.stopVideo();
            }
            if (typeof currentQuestionIndex !== 'undefined') currentQuestionIndex = idx;
            if (typeof loadQuestion === 'function') {
                if (idx < activeQuizData.length) loadQuestion(idx);
                else { if (typeof showResult === 'function') showResult(); }
            }
        })
        .on('broadcast', { event: 'ANSWER' }, payload => {
            // Someone answered. Display their result.
            let p = payload.payload;
            handleOpponentAnswer(p.userId, p.isCorrect, p.score);
        })
        .subscribe(async (status) => {
            if (status === 'SUBSCRIBED') {
                await roomChannel.track({
                    nickname: myUser.nickname,
                    score: myUser.score,
                    isHost: isHost
                });
            }
        });
}

function updatePlayerList() {
    const list = document.getElementById('player-list');
    list.innerHTML = '';
    let count = 0;
    for (const id in players) {
        count++;
        const li = document.createElement('li');
        li.style.padding = '0.5rem 0';
        li.style.borderBottom = '1px solid rgba(255,255,255,0.1)';
        li.innerHTML = `
            <span style="font-size:1.2rem; margin-right:0.5rem;">${players[id].isHost ? '👑' : '👤'}</span> 
            <span style="font-weight:600;">${players[id].nickname}</span> 
            ${id === myUser.id ? '<span style="color:var(--text-muted); font-size:0.8rem;">(나)</span>' : ''}
            <span style="float:right; color:var(--accent); font-weight:800;">${players[id].score}점</span>
        `;
        list.appendChild(li);
    }
    document.getElementById('player-count').innerText = count;
}

window.copyLobbyLink = function () {
    const url = window.location.href;
    navigator.clipboard.writeText(url).then(() => {
        alert('초대 링크가 복사되었습니다!');
    });
};

window.startMultiplayerGame = function () {
    if (!isHost) return;
    // Host already fetched 'activeQuizData' via selectRound -> fetchQuizData -> startQuiz -> hijacked
    roomChannel.send({
        type: 'broadcast',
        event: 'START_GAME',
        payload: {
            questions: activeQuizData,
            mode: typeof currentMode !== 'undefined' ? currentMode : 'multiple'
        }
    });
};

var roundWinnerDetected = false;

// Integrate with quiz.js: Send answer result over socket
window.multiplayerSendAnswer = function (isCorrect) {
    if (!multiplayerEnabled) return true;

    if (isCorrect && !roundWinnerDetected) {
        myUser.score += 10;
        // Update presence score
        roomChannel.track({ nickname: myUser.nickname, score: myUser.score, isHost: isHost });
    }

    answersThisRound.add(myUser.id);
    if (typeof checkAllReadyForNext === 'function') checkAllReadyForNext();

    roomChannel.send({
        type: 'broadcast',
        event: 'ANSWER',
        payload: {
            userId: myUser.id,
            isCorrect: isCorrect,
            score: myUser.score
        }
    });

    return true; // proceed with local visuals
};

function handleOpponentAnswer(userId, isCorrect, score) {
    if (players[userId]) {
        players[userId].score = score;
        updatePlayerList();
    }

    answersThisRound.add(userId);
    if (typeof checkAllReadyForNext === 'function') checkAllReadyForNext();

    if (isCorrect && !roundWinnerDetected) {
        roundWinnerDetected = true;

        // Show winner floating UI
        const name = players[userId] ? players[userId].nickname : '누군가';
        const modal = document.createElement('div');
        modal.innerText = `가장 먼저 맞혔습니다: ${name}!`;
        modal.style = "position:absolute; top:20px; left:50%; transform:translateX(-50%); background:var(--accent); color:#fff; padding:10px 20px; border-radius:20px; font-weight:bold; z-index:999; box-shadow:0 10px 20px rgba(0,0,0,0.5);";
        document.getElementById('quiz-wrapper').appendChild(modal);
        setTimeout(() => modal.remove(), 2500);

        // If not me, color layout to indicate round is over
        if (userId !== myUser.id) {
            clearTimeout(playTimer);
            showAnswerResult(null); // Force show answer in quiz.js
        }
    }
}

window.multiplayerSendNext = function (nextIndex) {
    if (!multiplayerEnabled) return;
    roomChannel.send({
        type: 'broadcast',
        event: 'NEXT_QUESTION',
        payload: { index: nextIndex }
    });
};

window.resetMultiplayerRound = function () {
    roundWinnerDetected = false;
    answersThisRound.clear();
    if (typeof checkAllReadyForNext === 'function') checkAllReadyForNext();
};

window.checkAllReadyForNext = function () {
    if (!isHost || !multiplayerEnabled) return;
    var nextBtn = document.getElementById('next-btn');
    if (!nextBtn) return;

    var totalPlayers = Object.keys(players).length || 1;

    if (answersThisRound.size >= totalPlayers || roundWinnerDetected) {
        nextBtn.classList.remove('disabled');
        nextBtn.style.opacity = '1';
        nextBtn.style.pointerEvents = 'auto';
        nextBtn.innerText = '다음 문제로';
    } else {
        nextBtn.classList.add('disabled');
        nextBtn.style.opacity = '0.5';
        nextBtn.style.pointerEvents = 'none';
        nextBtn.innerText = '모든 플레이어 응답 대기중... (' + answersThisRound.size + '/' + totalPlayers + ')';
    }
};
