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
        if (typeof registerPlay === 'function') registerPlay('worldcup', worldcupInfo.id);

        // SEO: Update Meta Tags
        if (typeof updateSEOMeta === 'function') {
            updateSEOMeta(worldcupInfo.title, worldcupInfo.description, worldcupInfo.thumbnail_url);
        }

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

// 이미지가 없는 후보(이름만 있는 월드컵)를 보여 줄 텍스트 카드. SVG를 data URI로 만들어 <img>에 넣는다 (<img>의 SVG는 스크립트가 실행되지 않는다).
function textCardUri(name) {
    name = String(name).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\ufffe\uffff]/g, '');   // XML에서 허용되지 않는 제어 문자 제거
    var esc = function (s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); };
    var words = String(name).split(/\s+/).filter(Boolean);
    var lines = [];
    var line = '';
    words.forEach(function (w) {
        while (Array.from(w).length > 11) { // 아주 긴 단어는 강제로 나눈다
            if (line) { lines.push(line); line = ''; }
            var chars = Array.from(w);
            lines.push(chars.slice(0, 11).join(''));
            w = chars.slice(11).join('');
        }
        if (Array.from((line ? line + ' ' : '') + w).length > 11 && line) { lines.push(line); line = w; }
        else { line = line ? line + ' ' + w : w; }
    });
    if (line) lines.push(line);
    lines = lines.slice(0, 4);
    var widest = lines.reduce(function (m, l) { return Math.max(m, Array.from(l).length); }, 0);
    var size = widest >= 9 ? 40 : (lines.length <= 2 ? 60 : 46);   // 긴 줄은 카드 폭(잘림)을 넘지 않게 줄인다
    var gap = size * 1.3;
    var startY = 200 - ((lines.length - 1) * gap) / 2 + size * 0.35;
    var text = lines.map(function (l, i) {
        return '<text x="300" y="' + (startY + i * gap) + '" font-size="' + size + '" font-weight="800" fill="#fff" text-anchor="middle" font-family="Malgun Gothic, Apple SD Gothic Neo, sans-serif">' + esc(l) + '</text>';
    }).join('');
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2a1f55"/><stop offset="1" stop-color="#4527a0"/></linearGradient></defs><rect width="600" height="400" fill="url(#g)"/>' + text + '</svg>';
    try {
        return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    } catch (e) {   // 깨진 서러게이트 등 인코딩 불가 → 이름 없는 기본 카드
        return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400"><rect width="600" height="400" fill="#2a1f55"/></svg>');
    }
}

function showContender(imgEl, item) {
    if (item.img) {
        if (window.SafeImageLoader) SafeImageLoader.load(imgEl, item.img, item.name);
        else imgEl.src = item.img;
    } else {
        imgEl.src = textCardUri(item.name);
        imgEl.style.opacity = '1';
    }
}

// Display the current match
function renderMatch() {
    var totalMatches = currentRound.length / 2;
    var currentMatchNum = (currentMatchIndex / 2) + 1;

    var roundName = currentRound.length === 2 ? '결승전' : currentRound.length + '강';
    var progress = currentRound.length === 2 ? '' : '(' + currentMatchNum + '/' + totalMatches + ')';
    document.getElementById('round-status').innerText = roundName + ' ' + progress;

    var left = currentRound[currentMatchIndex];
    var right = currentRound[currentMatchIndex + 1];

    showContender(document.getElementById('img-left'), left);
    showContender(document.getElementById('img-right'), right);

    document.getElementById('name-left').innerText = left.name;
    document.getElementById('name-right').innerText = right.name;

    // UX IMPROVEMENT: Ensure the user sees the new pair by scrolling to top of arena
    window.scrollTo({ top: 0, behavior: 'smooth' });
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
    showContender(document.getElementById('winner-img'), winner);
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
