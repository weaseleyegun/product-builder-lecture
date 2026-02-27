// app.js - Main page logic (fetch quiz/worldcup data and render cards)

document.addEventListener('DOMContentLoaded', function () {

    // Fetch quiz list from API and render cards
    async function fetchDailyQuizzes() {
        var grid = document.getElementById('daily-quiz-grid');
        if (!grid) return;
        try {
            var response = await fetch(API_BASE_URL + '/api/daily-quiz');
            if (response.ok) {
                var quizzes = await response.json();
                renderQuizzes(grid, quizzes);
            } else {
                grid.innerHTML = '<p style="grid-column: 1 / -1; text-align: center;">퀴즈 데이터를 불러오는데 실패했습니다.</p>';
            }
        } catch (error) {
            console.error('Error fetching data from API:', error);
            grid.innerHTML = '<p style="grid-column: 1 / -1; text-align: center;">서버와 연결할 수 없습니다.</p>';
        }
    }

    // Fetch worldcup list from API and render cards
    async function fetchWorldcups() {
        var grid = document.getElementById('worldcup-grid');
        if (!grid) return;
        try {
            var response = await fetch(API_BASE_URL + '/api/worldcups');
            if (response.ok) {
                var worldcups = await response.json();
                renderWorldcups(grid, worldcups);
            } else {
                grid.innerHTML = '<p style="grid-column: 1 / -1; text-align: center;">월드컵 데이터를 불러오는데 실패했습니다.</p>';
            }
        } catch (error) {
            console.error('Error fetching worldcups:', error);
            grid.innerHTML = '<p style="grid-column: 1 / -1; text-align: center;">서버와 연결할 수 없습니다.</p>';
        }
    }

    // Get gradient, tag, and thumbnail for a quiz card based on title keyword
    function getQuizMeta(title) {
        var match = QUIZ_META.find(function (m) { return title && title.includes(m.keyword); });
        return match || { gradient: 'linear-gradient(135deg, #868e96, #adb5bd)', tag: '퀴즈', thumbnail: '' };
    }

    // Render quiz cards into the grid
    function renderQuizzes(grid, quizzes) {
        grid.innerHTML = quizzes.map(function (quiz) {
            var meta = getQuizMeta(quiz.title);
            var imageStyle = meta.thumbnail
                ? 'background: url(\'' + meta.thumbnail + '\') center/cover no-repeat, ' + meta.gradient + ';'
                : 'background: ' + meta.gradient + ';';
            return '<div class="card quiz-card" data-id="' + quiz.id + '" onclick="location.href=\'quiz-play.html?id=' + quiz.id + '\'">' +
                '<div class="card-image" style="' + imageStyle + '"></div>' +
                '<div class="card-content">' +
                '<h3>' + quiz.title + '</h3>' +
                '<p>' + (quiz.description || '재밌는 AI 퀴즈를 풀어보세요!') + '</p>' +
                '<span class="tag">#' + meta.tag + '</span>' +
                '</div></div>';
        }).join('');
    }

    // Get worldcup card metadata
    function getWorldcupMeta(title) {
        var match = WORLDCUP_META.find(function (m) { return title && title.includes(m.keyword); });
        return match || null;
    }

    // Render worldcup cards into the grid
    function renderWorldcups(grid, worldcups) {
        grid.innerHTML = worldcups.map(function (cup, i) {
            var meta = getWorldcupMeta(cup.title);
            var gradient = meta ? meta.gradient : WORLDCUP_COLORS[i % WORLDCUP_COLORS.length];
            var imageStyle = meta && meta.thumbnail
                ? 'background: url(\'' + meta.thumbnail + '\') center/cover no-repeat, ' + gradient + ';'
                : 'background: ' + gradient + ';';
            return '<div class="card worldcup-card" onclick="location.href=\'worldcup-play.html?id=' + cup.id + '\'">' +
                '<div class="card-image" style="' + imageStyle + '"></div>' +
                '<div class="card-content">' +
                '<h3>' + cup.title + '</h3>' +
                '<p>' + (cup.description || '최고의 1위를 선택하세요!') + '</p>' +
                '</div></div>';
        }).join('');
    }

    // Initialize TierMaker (placeholder)
    function initTierMaker() {
        console.log('TierMaker Drag & Drop Initialized');
    }

    fetchDailyQuizzes();
    fetchWorldcups();
    initTierMaker();
});

// SEO utility
function seoOptimization(title, desc) {
    document.title = title + ' - QuizRank.io';
    var metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) metaDesc.setAttribute('content', desc);
}

// Kakao share (placeholder)
function shareKakao(resultData) {
    console.log('카카오톡 공유:', resultData);
}
