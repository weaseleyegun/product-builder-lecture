// worldcup.js - Handle Ideal Type Worldcup Tournament Logic

// Get Worldcup ID from URL
var urlParams = new URLSearchParams(window.location.search);
var worldcupId = urlParams.get('id');

var fetchedDataset = [];
var currentRound = [];
var nextRound = [];
var currentMatchIndex = 0;

// Fetch worldcup data and set up round selection
async function initSetup() {
    var titleEl = document.getElementById('setup-title');
    document.getElementById('setup-screen').style.display = 'block';

    if (!worldcupId) {
        titleEl.innerText = '잘못된 접근입니다.';
        return;
    }

    titleEl.innerText = '데이터 수집 중... ⏳';

    try {
        var response = await fetch(API_BASE_URL + '/api/worldcup-play?id=' + worldcupId);
        if (!response.ok) throw new Error('API Request Failed');

        var data = await response.json();
        var worldcupInfo = data.worldcup;

        // Map data to internal structure
        fetchedDataset = data.items.map(function (item) {
            return { id: item.id, name: item.name, img: item.image_url };
        });

        titleEl.innerText = worldcupInfo.title;

        // Populate round options (powers of 2: 4, 8, 16 ... 256)
        var selectEl = document.getElementById('round-select');
        selectEl.innerHTML = '';

        var powersOfTwo = [4, 8, 16, 32, 64, 128, 256];
        var hasOptions = false;
        powersOfTwo.forEach(function (num) {
            if (num <= fetchedDataset.length) {
                var opt = document.createElement('option');
                opt.value = num;
                opt.text = num + '강';
                opt.selected = true;
                selectEl.appendChild(opt);
                hasOptions = true;
            }
        });

        if (!hasOptions || fetchedDataset.length < 4) {
            titleEl.innerText = '후보가 부족합니다 (최소 4개 필요)';
            document.querySelector('#setup-screen button').style.display = 'none';
        }
    } catch (e) {
        console.error('데이터 로드 실패', e);
        titleEl.innerText = '데이터 로딩 오류 발생';
    }
}

// Start the tournament game
window.startGame = function () {
    var selectEl = document.getElementById('round-select');
    var selectedLimit = parseInt(selectEl.value, 10);

    document.getElementById('setup-screen').style.display = 'none';
    document.getElementById('game-screen').style.display = 'block';

    // Shuffle and slice to selected round size
    var shuffledFull = fetchedDataset.slice().sort(function () { return Math.random() - 0.5; });
    var tournamentContenders = shuffledFull.slice(0, selectedLimit);

    currentRound = tournamentContenders;
    nextRound = [];
    currentMatchIndex = 0;

    renderMatch();
};

// Display the current match
function renderMatch() {
    var totalMatches = currentRound.length / 2;
    var currentMatchNum = (currentMatchIndex / 2) + 1;

    var roundName = currentRound.length === 2 ? '결승전' : currentRound.length + '강';
    var progress = currentRound.length === 2 ? '' : '(' + currentMatchNum + '/' + totalMatches + ')';
    document.getElementById('round-status').innerText = roundName + ' ' + progress;

    var left = currentRound[currentMatchIndex];
    var right = currentRound[currentMatchIndex + 1];

    document.getElementById('img-left').src = left.img;
    document.getElementById('name-left').innerText = left.name;
    document.getElementById('img-right').src = right.img;
    document.getElementById('name-right').innerText = right.name;
}

// Handle user's contender selection
window.selectContender = function (selectedIndex) {
    var winner = currentRound[currentMatchIndex + selectedIndex];
    nextRound.push(winner);
    currentMatchIndex += 2;

    if (currentMatchIndex >= currentRound.length) {
        if (nextRound.length === 1) {
            showWinner(nextRound[0]);
        } else {
            currentRound = nextRound.slice().sort(function () { return Math.random() - 0.5; });
            nextRound = [];
            currentMatchIndex = 0;
            renderMatch();
        }
    } else {
        renderMatch();
    }
};

// Display the winner
function showWinner(winner) {
    document.getElementById('game-screen').style.display = 'none';
    document.getElementById('setup-screen').style.display = 'none';
    document.getElementById('winner-img').src = winner.img;
    document.getElementById('winner-name').innerText = winner.name;
    document.getElementById('result-screen').style.display = 'block';
}

// Share result (placeholder)
window.shareResult = function () {
    var winnerName = document.getElementById('winner-name').innerText;
    alert('[모의 공유] 제가 선택한 우승자는 \'' + winnerName + '\' 입니다!');
};

// Initialize on page load
document.addEventListener('DOMContentLoaded', function () {
    initSetup();
});
