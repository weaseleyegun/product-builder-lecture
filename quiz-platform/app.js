// app.js - Main page logic (fetch quiz/worldcup data and render cards)

document.addEventListener('DOMContentLoaded', function () {

    let allQuizzes = [];
    let allWorldcups = [];

    // Fetch quiz list from API and render cards
    async function fetchDailyQuizzes(sort) {
        var grid = document.getElementById('daily-quiz-grid');
        if (!grid) return;
        var sortParam = sort || 'rank';
        try {
            var response = await fetch(API_BASE_URL + '/api/daily-quiz?sort=' + sortParam);
            if (response.ok) {
                allQuizzes = await response.json();

                // If it's the home page (index.html), show only the first 5 quizzes (already sorted by rank/play_count)
                var isHomePage = window.location.pathname.endsWith('index.html') || window.location.pathname === '/';
                var displayQuizzes = isHomePage ? allQuizzes.slice(0, 5) : allQuizzes;

                renderQuizzes(grid, displayQuizzes, isHomePage);
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
                allWorldcups = await response.json();

                // If it's the home page (index.html), show only the first 5 worldcups
                var isHomePage = window.location.pathname.endsWith('index.html') || window.location.pathname === '/';
                var displayWorldcups = isHomePage ? allWorldcups.slice(0, 5) : allWorldcups;

                renderWorldcups(grid, displayWorldcups);
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
        return match || { gradient: 'linear-gradient(135deg, #868e96, #adb5bd)', tag: '퀴즈', thumbnail: '', hashtags: [] };
    }

    function extractThumbnail(item) {
        if (item.description && item.description.includes('[THUMBNAIL_URL:')) {
            var match = item.description.match(/\[THUMBNAIL_URL:(.*?)\]/);
            if (match) {
                // item.description = item.description.replace(match[0], '').trim(); // Don't mutate here yet as we might need desc for hashtags
                return match[1].trim();
            }
        }
        return null;
    }

    function extractHashtags(item) {
        if (item.description && item.description.includes('[HASHTAGS:')) {
            var match = item.description.match(/\[HASHTAGS:(.*?)\]/);
            if (match) {
                return match[1].split(',').map(function (t) { return t.trim(); }).filter(Boolean);
            }
        }
        return [];
    }

    function cleanDescription(desc) {
        if (!desc) return '';
        return desc.replace(/\[THUMBNAIL_URL:.*?\]/g, '').replace(/\[HASHTAGS:.*?\]/g, '').trim();
    }

    // Render quiz cards into the grid
    // showHot: if true, first 5 shown on home page with HOT badge
    function renderQuizzes(grid, quizzes, showHot) {
        grid.innerHTML = quizzes.map(function (quiz, idx) {
            var meta = getQuizMeta(quiz.title);
            var customThumb = quiz.thumbnail_url || extractThumbnail(quiz);
            var hashtags = extractHashtags(quiz);
            var thumb = customThumb || meta.thumbnail;
            var displayDesc = cleanDescription(quiz.description) || '재밌는 AI 퀴즈를 풀어보세요!';

            var imageStyle = thumb
                ? 'background: url(\'' + thumb + '\') center/cover no-repeat, ' + meta.gradient + ';'
                : 'background: ' + meta.gradient + ';';
            var isHot = showHot && idx < 5;
            var hotBadge = isHot ? '<span style="position:absolute;top:10px;right:10px;background:#ff4757;color:#fff;font-size:0.72rem;font-weight:800;padding:3px 10px;border-radius:20px;letter-spacing:1px;">HOT</span>' : '';
            var statsHtml = (quiz.play_count || quiz.correct_rate) ?
                '<div style="display:flex;gap:0.5rem;flex-wrap:wrap;margin-top:0.4rem;">' +
                (quiz.play_count ? '<span style="font-size:0.75rem;color:var(--text-muted);">▶ ' + (quiz.play_count || 0) + '실행</span>' : '') +
                (quiz.correct_rate ? '<span style="font-size:0.75rem;color:var(--accent);">✅ ' + quiz.correct_rate + '%</span>' : '') +
                '</div>' : '';

            // Render up to 3 hashtags
            var tagsHtml = '';
            if (hashtags.length > 0) {
                tagsHtml = '<div class="hashtag-row" style="display:flex; gap:0.4rem; overflow:hidden; flex-wrap:wrap; margin-top:0.8rem;">' +
                    hashtags.slice(0, 5).map(function (t) { return '<span style="font-size:0.65rem; padding:2px 8px; border-radius:12px; background:rgba(255,255,255,0.05); color:var(--text-muted);">#' + t + '</span>'; }).join('') +
                    '</div>';
            } else {
                tagsHtml = '<span class="tag">#' + meta.tag + '</span>';
            }

            return '<div class="card quiz-card" style="position:relative;" data-id="' + quiz.id + '" onclick="location.href=\'quiz-play.html?id=' + quiz.id + '\'"><div class="card-image" style="' + imageStyle + '">' + hotBadge + '</div>' +
                '<div class="card-content">' +
                '<h3>' + quiz.title + '</h3>' +
                '<p>' + displayDesc + '</p>' +
                statsHtml +
                tagsHtml +
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
            var customThumb = cup.thumbnail_url || extractThumbnail(cup);
            var hashtags = extractHashtags(cup);
            var thumb = customThumb || (meta && meta.thumbnail);
            var displayDesc = cleanDescription(cup.description) || '최고의 1위를 선택하세요!';

            var gradient = meta ? meta.gradient : WORLDCUP_COLORS[i % WORLDCUP_COLORS.length];
            var imageStyle = thumb
                ? 'background: url(\'' + thumb + '\') center/cover no-repeat, ' + gradient + ';'
                : 'background: ' + gradient + ';';

            // Render up to 3 hashtags
            var tagsHtml = '';
            if (hashtags.length > 0) {
                tagsHtml = '<div class="hashtag-row" style="display:flex; gap:0.4rem; overflow:hidden; flex-wrap:wrap; margin-top:0.8rem;">' +
                    hashtags.slice(0, 5).map(function (t) { return '<span style="font-size:0.65rem; padding:2px 8px; border-radius:12px; background:rgba(255,255,255,0.05); color:var(--accent);">#' + t + '</span>'; }).join('') +
                    '</div>';
            }

            return '<div class="card worldcup-card" onclick="location.href=\'worldcup-play.html?id=' + cup.id + '\'">' +
                '<div class="card-image" style="' + imageStyle + '"></div>' +
                '<div class="card-content">' +
                '<h3>' + cup.title + '</h3>' +
                '<p>' + displayDesc + '</p>' +
                tagsHtml +
                '</div></div>';
        }).join('');
    }

    // Initialize TierMaker (placeholder)
    function initTierMaker() {
        console.log('TierMaker Drag & Drop Initialized');
    }

    // Global Search Event Listener
    var searchInput = document.getElementById('global-search');
    if (searchInput) {
        searchInput.addEventListener('input', function (e) {
            var originalQuery = e.target.value.toLowerCase().trim();
            // # 기호를 제거하여 일반 단어로 변경 (예: #노래 -> 노래)
            var query = originalQuery.replace(/#/g, '');

            var isHomePage = window.location.pathname.endsWith('index.html') || window.location.pathname === '/';

            if (!query) {
                // 입력창이 비었을 때
                var grid1 = document.getElementById('daily-quiz-grid');
                if (grid1 && allQuizzes.length > 0) renderQuizzes(grid1, isHomePage ? allQuizzes.slice(0, 5) : allQuizzes, isHomePage);
                var grid2 = document.getElementById('worldcup-grid');
                if (grid2 && allWorldcups.length > 0) renderWorldcups(grid2, isHomePage ? allWorldcups.slice(0, 5) : allWorldcups);
                return;
            }

            var grid1 = document.getElementById('daily-quiz-grid');
            if (grid1 && allQuizzes.length > 0) {
                var filteredQuizzes = allQuizzes.filter(function (q) {
                    var meta = getQuizMeta(q.title);
                    var hasTagMatch = meta.hashtags && meta.hashtags.some(function (tag) { return tag.includes(query); });
                    return hasTagMatch || q.title.toLowerCase().includes(query) || (q.description && q.description.toLowerCase().includes(query));
                });
                if (filteredQuizzes.length > 0) {
                    // 검색 결과는 5개 제한을 풀거나 그대로 제한할 수 있는데, 일단은 검색하면 다 보여주는 게 편하므로 제한 안함
                    renderQuizzes(grid1, filteredQuizzes);
                } else {
                    grid1.innerHTML = '<p style="grid-column: 1 / -1; text-align: center; color: var(--text-muted); padding: 2rem;">검색 결과가 없습니다.</p>';
                }
            }

            var grid2 = document.getElementById('worldcup-grid');
            if (grid2 && allWorldcups.length > 0) {
                var filteredWorldcups = allWorldcups.filter(function (w) {
                    var meta = getWorldcupMeta(w.title);
                    var hasTagMatch = meta && meta.hashtags && meta.hashtags.some(function (tag) { return tag.includes(query); });
                    return hasTagMatch || w.title.toLowerCase().includes(query) || (w.description && w.description.toLowerCase().includes(query));
                });
                if (filteredWorldcups.length > 0) {
                    renderWorldcups(grid2, filteredWorldcups);
                } else {
                    grid2.innerHTML = '<p style="grid-column: 1 / -1; text-align: center; color: var(--text-muted); padding: 2rem;">검색 결과가 없습니다.</p>';
                }
            }
        });
    }

    fetchDailyQuizzes('rank');
    fetchWorldcups();
    initTierMaker();

    // Expose sort function for quiz-list page
    window.sortQuizzes = function (sort) {
        fetchDailyQuizzes(sort);
    };
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
