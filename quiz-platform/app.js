// app.js - Main page logic (fetch quiz/worldcup data and render cards)

document.addEventListener('DOMContentLoaded', function () {

    let allQuizzes = [];
    let allWorldcups = [];
    let allTiers = [];

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
        var wcGrid = document.getElementById('worldcup-grid');
        var tierGrid = document.getElementById('tier-grid');
        try {
            var response = await fetch(API_BASE_URL + '/api/worldcups');
            if (response.ok) {
                let data = await response.json();

                allTiers = data.filter(function (item) {
                    var title = item.title.toLowerCase();
                    return title.includes('티어') || title.includes('등급') || title.includes('랭킹') || title.includes('리스트');
                });

                allWorldcups = data.filter(function (item) {
                    return !allTiers.includes(item);
                });

                var isHomePage = window.location.pathname.endsWith('index.html') || window.location.pathname === '/';

                if (wcGrid) {
                    var displayWorldcups = isHomePage ? allWorldcups.slice(0, 5) : allWorldcups;
                    renderWorldcups(wcGrid, displayWorldcups);
                }

                if (tierGrid) {
                    var displayTiers = isHomePage ? allTiers.slice(0, 5) : allTiers;
                    renderTiers(tierGrid, displayTiers);
                }
            } else {
                if (wcGrid) wcGrid.innerHTML = '<p style="grid-column: 1 / -1; text-align: center;">데이터를 불러오는데 실패했습니다.</p>';
                if (tierGrid) tierGrid.innerHTML = '<p style="grid-column: 1 / -1; text-align: center;">데이터를 불러오는데 실패했습니다.</p>';
            }
        } catch (error) {
            console.error('Error fetching worldcup data:', error);
            if (wcGrid) wcGrid.innerHTML = '<p style="grid-column: 1 / -1; text-align: center;">서버와 연결할 수 없습니다.</p>';
        }
    }

    // Helper functions for metadata and extraction
    function getQuizMeta(title) {
        for (var i = 0; i < QUIZ_META.length; i++) {
            if (title.toUpperCase().includes(QUIZ_META[i].keyword)) return QUIZ_META[i];
        }
        return QUIZ_META[0]; // Default
    }

    function getWorldcupMeta(title) {
        for (var i = 0; i < WORLDCUP_META.length; i++) {
            if (title.includes(WORLDCUP_META[i].keyword)) return WORLDCUP_META[i];
        }
        return null;
    }

    function extractThumbnail(item) {
        if (item.thumbnail_url) return item.thumbnail_url;
        if (item.description && item.description.includes('[THUMB:')) {
            return item.description.match(/\[THUMB:(.*?)\]/)[1];
        }
        return null;
    }

    function cleanDescription(desc) {
        if (!desc) return '';
        return desc.replace(/\[THUMB:.*?\]/g, '').replace(/\[HASHTAGS:.*?\]/g, '').trim();
    }

    function extractHashtags(item) {
        if (item.description && item.description.includes('[HASHTAGS:')) {
            return item.description.match(/\[HASHTAGS:(.*?)\]/)[1].split(',');
        }
        const meta = getWorldcupMeta(item.title);
        return meta ? meta.hashtags : ['퀴즈', '월드컵'];
    }

    // Render quiz cards into the grid
    function renderQuizzes(grid, items, isHomePage) {
        grid.innerHTML = '';
        items.forEach(function (item) {
            var card = document.createElement('div');
            card.className = 'card quiz-card' + (isHomePage ? ' home-card' : '');
            if (item.is_new) card.classList.add('new');

            // Use slug if available for SEO
            var identifier = item.slug || item.id;
            var playUrl = 'quiz-play.html?id=' + identifier;

            var meta = getQuizMeta(item.title);
            var hashtags = extractHashtags(item);
            var thumb = item.thumbnail_url || extractThumbnail(item) || meta.thumbnail;
            var cleanDesc = cleanDescription(item.description);

            card.innerHTML = `
                <div class="card-image" style="background: url('${thumb}') center/cover no-repeat;">
                    ${(item.rank && item.rank <= 3) ? '<div class="ranking-badge">' + item.rank + '</div>' : ''}
                    ${item.is_hot ? '<div class="hot-badge">HOT</div>' : ''}
                </div>
                <div class="card-content">
                    <h3 class="card-title">${item.title}</h3>
                    <p class="card-desc">${cleanDesc.substring(0, 60)}${cleanDesc.length > 60 ? '...' : ''}</p>
                    <div class="card-tags">
                        ${hashtags.slice(0, 3).map(tag => '<span class="tag">#' + tag.trim() + '</span>').join('')}
                    </div>
                    <div class="card-stats">
                        <span>▶ ${(item.play_count || 0).toLocaleString()}회 실행</span>
                        <span class="success-rate">✅ ${(item.correct_rate || 0).toFixed(1)}%</span>
                    </div>
                </div>
            `;
            card.onclick = function () { location.href = playUrl; };
            grid.appendChild(card);
        });
    }

    // Render worldcup cards into the grid
    function renderWorldcups(grid, worldcups) {
        grid.innerHTML = '';
        worldcups.forEach(function (item, i) {
            var card = document.createElement('div');
            card.className = 'card worldcup-card';

            var identifier = item.slug || item.id;
            var playUrl = 'worldcup-play.html?id=' + identifier;

            var meta = getWorldcupMeta(item.title);
            var thumb = item.thumbnail_url || extractThumbnail(item) || (meta ? meta.thumbnail : null);
            var tags = extractHashtags(item);
            var cleanDesc = cleanDescription(item.description) || '최고의 1위를 선택하세요!';

            var gradient = meta ? meta.gradient : WORLDCUP_COLORS[i % WORLDCUP_COLORS.length];
            var imageStyle = thumb
                ? `background: url('${thumb}') center/cover no-repeat, ${gradient};`
                : `background: ${gradient};`;

            var tagsHtml = '<div class="card-tags">' +
                tags.slice(0, 2).map(tag => '<span class="tag">#' + tag.trim() + '</span>').join('') +
                '</div>';

            card.innerHTML = `
                <div class="card-image" style="${imageStyle}"></div>
                <div class="card-content">
                    <h3>${item.title}</h3>
                    <p>${cleanDesc.substring(0, 50)}...</p>
                    ${tagsHtml}
                </div>
            `;
            card.onclick = function () { location.href = playUrl; };
            grid.appendChild(card);
        });
    }

    // Render tier lists into the grid
    function renderTiers(grid, tiers) {
        if (!grid) return;
        grid.innerHTML = '';
        tiers.forEach(function (item, i) {
            var card = document.createElement('div');
            card.className = 'card tier-card';

            var identifier = item.slug || item.id;
            var playUrl = 'tier-view.html?id=' + identifier;

            var meta = getWorldcupMeta(item.title);
            var thumb = item.thumbnail_url || extractThumbnail(item) || (meta ? meta.thumbnail : null);

            var gradient = 'linear-gradient(135deg, #7950F2, #AE3EC9)';
            var imageStyle = thumb
                ? `background: url('${thumb}') center/cover no-repeat, ${gradient};`
                : `background: ${gradient};`;

            card.innerHTML = `
                <div class="card-image" style="${imageStyle}"></div>
                <div class="card-content">
                    <h3>${item.title}</h3>
                    <p>티어 리스트/랭킹 만들기</p>
                    <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 0.5rem;">
                        <span>▶ ${(item.play_count || 0).toLocaleString()}회 실행</span>
                    </div>
                </div>
            `;
            card.onclick = function () { location.href = playUrl; };
            grid.appendChild(card);
        });
    }

    // Initialize
    fetchDailyQuizzes('rank');
    fetchWorldcups();

    // Sorting listeners
    var sortLinks = document.querySelectorAll('.filter-links a');
    sortLinks.forEach(function (link) {
        link.addEventListener('click', function (e) {
            e.preventDefault();
            sortLinks.forEach(l => l.classList.remove('active'));
            this.classList.add('active');
            var sort = this.innerText.includes('인기') ? 'rank' : 'latest';
            fetchDailyQuizzes(sort);
        });
    });
});
