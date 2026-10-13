// ============================================================
//  QuizRank Auto Agent — Google Apps Script (No-AI Edition v4)
//  ✨ Gemini 완전 제거 — 데이터 기반 자동 퀴즈/월드컵/티어 생성
//
//  전략:
//    • YouTube Advanced Service (GAS 내장) → 트렌딩 & 검색 1순위
//    • Piped / Invidious → fallback
//    • Google Trends RSS → 키워드 수집
//    • Jikan API (애니), Dog CEO API → 월드컵 소재
//    • AI 의존 0% — 할당량/비용/에러 걱정 없음
//
//  ⚠️ 사전 준비:
//    GAS 에디터 → [서비스] → [YouTube Data API v3] 추가 (별칭: YouTube)
// ============================================================


// ======================== CONFIG =============================

var SUPABASE_URL = 'https://rdpdwtkhqizlcpeergrz.supabase.co';
var SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJkcGR3dGtocWl6bGNwZWVyZ3J6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE4NDYzMzIsImV4cCI6MjA4NzQyMjMzMn0.focF9Zyo53PtKZmX-zBZFSH8ijwr2w1K8RteXFWWIqk';
var AGENT_EMAIL = 'agent@quizrank.com';
// 비밀번호는 코드에 넣지 않습니다. GAS 편집기 > 프로젝트 설정 > 스크립트 속성에 AGENT_PASSWORD로 등록하세요.
function getAgentPassword_() {
    var pw = PropertiesService.getScriptProperties().getProperty('AGENT_PASSWORD');
    if (!pw) throw new Error('스크립트 속성 AGENT_PASSWORD가 설정되지 않았습니다.');
    return pw;
}

var PIPED_INSTANCES = [
    'https://pipedapi.kavin.rocks',
    'https://pipedapi.adminforge.de',
    'https://pipedapi.darkness.services'
];

var INVIDIOUS_INSTANCES = [
    'https://inv.nadeko.net',
    'https://invidious.nerdvpn.de',
    'https://iv.nbooo.com'
];

var TRENDS_RSS_URL = 'https://trends.google.co.kr/trending/rss?geo=KR';

var QUIZ_MIN_QUESTIONS = 4;    // 최소 문항 수 (미만이면 스킵)
var QUIZ_TARGET_QUESTIONS = 10; // 목표 문항 수
var WORLDCUP_ITEM_COUNT = 16;
var CONTENT_CLEANUP_DAYS = 30;
var LOG_SHEET_NAME = 'AgentLog';

// ── 어그로성 퀴즈 제목 템플릿 ({topic} 자리에 실제 주제 삽입) ──
var QUIZ_TITLE_TEMPLATES = {
    music: [
        '이거 다 맞추면 ㄹㅇ 음악 천재 🎵 {topic} 맞추기',
        '1초만 듣고 맞춰봐! {topic} 퀴즈 🔥',
        '10명 중 2명만 올클리어 🤯 {topic} 노래 맞추기',
        '찐팬만 맞출 수 있다는 {topic} 퀴즈',
        '이 노래 모르면 간첩이다 🎵 {topic} 테스트',
        '올클하면 인간 주크박스 인정 🏆 {topic}'
    ],
    gaming: [
        '진짜 게이머만 맞출 수 있는 {topic} 퀴즈 🎮',
        '이 게임 영상 보고 맞춰봐 — {topic} 테스트',
        '겜알못은 0점 나옴 ㅋㅋ {topic} 퀴즈 🔥',
        '이거 맞추면 ㄹㅇ 프로게이머 🎮 {topic}'
    ],
    sports: [
        '진짜 팬이라면 이 장면 안다 ⚽ {topic} 맞추기',
        '스포츠 덕후만 맞출 수 있는 {topic} 퀴즈',
        '이 명장면 3초 안에 맞추면 레전드 🏆 {topic}'
    ],
    entertainment: [
        '이 영상 뭔지 맞춰봐 🎬 지금 난리난 {topic}',
        '요즘 이거 안 보면 대화 못 낀다 🔥 {topic} 퀴즈',
        '10명 중 3명만 전부 맞춤 🤯 {topic} 맞추기'
    ],
    trending: [
        '지금 한국에서 난리 난 영상들 🔥 {topic} 맞추기',
        '이거 다 맞추면 트렌드 마스터 인정 🏆 {topic}',
        '요즘 핫한 영상 몇 개나 알아? {topic} 퀴즈',
        '이거 모르면 아웃! 실시간 {topic} 테스트 🔥'
    ]
};

// ── 어그로성 월드컵 제목 템플릿 ──
var WORLDCUP_TITLE_TEMPLATES = [
    '둘 중 하나만 볼 수 있다면? 🏆 {topic} 월드컵',
    '이 중 최고를 골라! {topic} 이상형 월드컵',
    '진짜 고민된다... 🤔 {topic} 택1 월드컵',
    '취향 저격 테스트 💘 {topic} 이상형 월드컵',
    '하나만 남겨야 한다면? {topic} 월드컵 🔥',
    '네 픽은 뭐야? {topic} 이상형 월드컵'
];

// ── 카테고리별 주제 설명 (topic 추출 실패 시 fallback) ──
var CATEGORY_TOPIC_NAMES = {
    music: ['K-POP 최신곡', '요즘 핫한 음악', '실시간 인기 음악', '지금 난리 난 노래'],
    gaming: ['요즘 핫한 게임', '실시간 인기 게임', '화제의 게임 영상'],
    sports: ['스포츠 명장면', '오늘의 스포츠 하이라이트', '화제의 경기'],
    entertainment: ['화제의 영상', '지금 핫한 콘텐츠', '인기 영상'],
    trending: ['실시간 인기 급상승 영상', '지금 난리 난 영상', '실시간 트렌딩']
};


// ======================== MAIN PIPELINE ======================

function dailyAutoAgent() {
    var startTime = new Date();
    var todayStr = Utilities.formatDate(startTime, 'Asia/Seoul', 'yyyy-MM-dd HH:mm');
    Logger.log('');
    Logger.log('==============================================');
    Logger.log('🚀 [' + todayStr + '] 일일 콘텐츠 에이전트 시작 (No-AI v4)');
    Logger.log('==============================================');

    var results = {
        quiz: { status: '⏳', title: '', id: '' },
        worldcup: { status: '⏳', title: '', id: '' },
        tierlist: { status: '⏳', title: '', id: '' },
        cleanup: { status: '⏳' },
        error: null
    };

    try {
        // ── Step 0: Supabase 인증 ──
        Logger.log('\n── Step 0: Supabase 인증 ──');
        var auth = getSupabaseToken_();
        var token = auth.token;
        var userId = auth.userId;

        // ── Step 1: YouTube 트렌딩 영상 수집 ──
        Logger.log('\n── Step 1: YouTube 트렌딩 영상 수집 ──');
        var trendingVideos = fetchTrendingVideos_();
        Logger.log('수집된 트렌딩 영상: ' + trendingVideos.length + '개');

        // ── Step 2: 퀴즈 생성 (트렌딩 영상 기반) ──
        Logger.log('\n── Step 2: 퀴즈 생성 ──');
        try {
            var quizData = buildQuizFromVideos_(trendingVideos);
            if (quizData && quizData.questions.length >= QUIZ_MIN_QUESTIONS) {
                var quizId = insertQuizToDB_(quizData, token, userId);
                results.quiz = { status: '✅', title: quizData.title, id: quizId };
            } else {
                Logger.log('⚠️ 유효 문항 부족 → 키워드 검색 퀴즈 시도');
                var keywordQuiz = buildQuizFromKeywords_();
                if (keywordQuiz && keywordQuiz.questions.length >= QUIZ_MIN_QUESTIONS) {
                    var quizId2 = insertQuizToDB_(keywordQuiz, token, userId);
                    results.quiz = { status: '✅', title: keywordQuiz.title, id: quizId2 };
                } else {
                    results.quiz.status = '⚠️ 영상 부족';
                }
            }
        } catch (e) {
            Logger.log('❌ 퀴즈 실패: ' + e.message);
            results.quiz.status = '❌ ' + e.message.substring(0, 50);
        }

        // ── Step 3: 이상형 월드컵 생성 (YouTube 트렌딩 기반) ──
        Logger.log('\n── Step 3: 이상형 월드컵 생성 ──');
        try {
            var wcData = buildWorldcupFromVideos_(trendingVideos);
            if (wcData && wcData.items.length >= 8) {
                var wcId = insertWorldcupToDB_(wcData, token, userId);
                results.worldcup = { status: '✅', title: wcData.title, id: wcId };
            } else {
                Logger.log('⚠️ 월드컵 후보 부족 → 애니 월드컵 시도');
                var animeWc = buildAnimeWorldcup_();
                if (animeWc && animeWc.items.length >= 8) {
                    var wcId2 = insertWorldcupToDB_(animeWc, token, userId);
                    results.worldcup = { status: '✅', title: animeWc.title, id: wcId2 };
                } else {
                    results.worldcup.status = '⚠️ 데이터 부족';
                }
            }
        } catch (e) {
            Logger.log('❌ 월드컵 실패: ' + e.message);
            results.worldcup.status = '❌ ' + e.message.substring(0, 50);
        }

        // ── Step 4: 보너스 월드컵 (강아지) ──
        Logger.log('\n── Step 4: 보너스 월드컵 생성 ──');
        try {
            var dogWc = buildDogWorldcup_();
            if (dogWc && dogWc.items.length >= 8) {
                var tierId = insertWorldcupToDB_(dogWc, token, userId);
                results.tierlist = { status: '✅', title: dogWc.title, id: tierId };
            } else {
                results.tierlist.status = '⚠️ 데이터 부족';
            }
        } catch (e) {
            Logger.log('❌ 보너스 실패: ' + e.message);
            results.tierlist.status = '❌ ' + e.message.substring(0, 50);
        }

        // ── Step 5: 오래된 콘텐츠 정리 ──
        Logger.log('\n── Step 5: 오래된 콘텐츠 정리 ──');
        try { cleanupStaleContent_(token, userId); results.cleanup.status = '✅'; }
        catch (e) { results.cleanup.status = '⚠️'; }

    } catch (e) {
        Logger.log('💀 치명적 오류: ' + e.message);
        results.error = e.message;
    }

    // ── 결과 요약 ──
    var elapsed = ((new Date() - startTime) / 1000).toFixed(1);
    Logger.log('\n==============================================');
    Logger.log('📊 결과 (소요: ' + elapsed + '초)');
    Logger.log('  퀴즈: ' + results.quiz.status + ' ' + results.quiz.title);
    Logger.log('  월드컵: ' + results.worldcup.status + ' ' + results.worldcup.title);
    Logger.log('  티어: ' + results.tierlist.status + ' ' + results.tierlist.title);
    Logger.log('  정리: ' + results.cleanup.status);
    if (results.error) Logger.log('  ❌ 에러: ' + results.error);
    Logger.log('==============================================');

    logToSheet_(results, elapsed);
}


// ======================== YOUTUBE ADVANCED SERVICE ============
// GAS 내장 YouTube Data API v3 — API 키 불필요 (OAuth 자동)
// ⚠️ GAS 에디터 → 왼쪽 [+] 서비스 → YouTube Data API v3 추가 필요

/**
 * YouTube Advanced Service로 한국 트렌딩 영상 수집
 * 무료 할당량: 10,000 units/day, mostPopular = 1 unit/call
 */
function fetchTrendingByYouTubeService_() {
    Logger.log('  📡 YouTube Advanced Service (trending)...');
    try {
        var response = YouTube.Videos.list('snippet,contentDetails', {
            chart: 'mostPopular',
            regionCode: 'KR',
            maxResults: 50
        });

        if (!response.items || response.items.length === 0) {
            Logger.log('  ⚠️ YouTube Service: 결과 없음');
            return [];
        }

        var result = [];
        for (var i = 0; i < response.items.length; i++) {
            var item = response.items[i];
            var vid = item.id;
            var title = item.snippet.title;
            var thumb = item.snippet.thumbnails && item.snippet.thumbnails.high
                ? item.snippet.thumbnails.high.url
                : 'https://i.ytimg.com/vi/' + vid + '/hqdefault.jpg';
            var categoryId = item.snippet.categoryId || '';

            result.push({
                videoId: vid,
                title: title,
                thumbnail: thumb,
                category: mapYouTubeCategory_(categoryId),
                channelTitle: item.snippet.channelTitle || ''
            });
        }
        Logger.log('  ✅ YouTube Service: ' + result.length + '개 트렌딩 수집');
        return result;
    } catch (e) {
        Logger.log('  ⚠️ YouTube Service 실패: ' + e.message);
        Logger.log('  💡 GAS 에디터 → [서비스] → YouTube Data API v3 추가가 필요합니다');
        return [];
    }
}

/**
 * YouTube Advanced Service로 검색
 * 100 units/call — 키워드 검색 시 사용
 */
function searchByYouTubeService_(query) {
    try {
        var response = YouTube.Search.list('snippet', {
            q: query,
            type: 'video',
            regionCode: 'KR',
            relevanceLanguage: 'ko',
            maxResults: 5
        });

        if (!response.items || response.items.length === 0) return null;

        for (var i = 0; i < response.items.length; i++) {
            var item = response.items[i];
            var vid = item.id.videoId;
            if (vid && item.snippet.title) {
                return {
                    videoId: vid,
                    title: item.snippet.title,
                    thumbnail: item.snippet.thumbnails && item.snippet.thumbnails.high
                        ? item.snippet.thumbnails.high.url
                        : 'https://i.ytimg.com/vi/' + vid + '/hqdefault.jpg'
                };
            }
        }
    } catch (e) {
        // YouTube Service 비활성 → fallback으로 진행
    }
    return null;
}

/**
 * YouTube 카테고리 ID → 내부 카테고리 매핑
 * https://developers.google.com/youtube/v3/docs/videoCategories
 */
function mapYouTubeCategory_(categoryId) {
    var map = {
        '1': 'entertainment',  // Film & Animation
        '2': 'entertainment',  // Autos & Vehicles
        '10': 'music',         // Music
        '17': 'sports',        // Sports
        '20': 'gaming',        // Gaming
        '22': 'entertainment', // People & Blogs
        '23': 'entertainment', // Comedy
        '24': 'entertainment', // Entertainment
        '25': 'entertainment', // News & Politics
        '26': 'entertainment', // Howto & Style
        '27': 'entertainment', // Education
        '28': 'entertainment', // Science & Technology
    };
    return map[String(categoryId)] || 'trending';
}


// ======================== TRENDING VIDEO COLLECTION ===========

/**
 * YouTube 트렌딩 영상 수집
 * 우선순위: YouTube Service → Piped → Invidious → 빈 배열
 * 반환: [{ videoId, title, thumbnail, category }]
 */
function fetchTrendingVideos_() {
    Logger.log('📺 YouTube 트렌딩 수집 중...');

    // ── 1순위: YouTube Advanced Service (가장 안정적) ──
    var ytResult = fetchTrendingByYouTubeService_();
    if (ytResult.length > 0) return ytResult;

    // ── 2순위: Piped API ──
    for (var i = 0; i < PIPED_INSTANCES.length; i++) {
        try {
            var resp = UrlFetchApp.fetch(PIPED_INSTANCES[i] + '/trending?region=KR', {
                muteHttpExceptions: true,
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
            });
            if (resp.getResponseCode() !== 200) continue;
            var videos = JSON.parse(resp.getContentText());
            if (!Array.isArray(videos) || videos.length === 0) continue;

            var result = [];
            for (var j = 0; j < videos.length && j < 50; j++) {
                var v = videos[j];
                var vid = extractVideoId_(v.url || '');
                if (vid && v.title) {
                    result.push({
                        videoId: vid,
                        title: v.title,
                        thumbnail: v.thumbnail || ('https://i.ytimg.com/vi/' + vid + '/hqdefault.jpg'),
                        category: guessCategory_(v.title)
                    });
                }
            }
            if (result.length > 0) {
                Logger.log('  ✅ Piped: ' + result.length + '개 (via ' + PIPED_INSTANCES[i] + ')');
                return result;
            }
        } catch (e) {
            Logger.log('  ⚠️ Piped ' + PIPED_INSTANCES[i] + ': ' + e.message);
        }
    }

    // ── 3순위: Invidious API ──
    for (var k = 0; k < INVIDIOUS_INSTANCES.length; k++) {
        try {
            var resp2 = UrlFetchApp.fetch(INVIDIOUS_INSTANCES[k] + '/api/v1/trending?region=KR', {
                muteHttpExceptions: true,
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
            });
            if (resp2.getResponseCode() !== 200) continue;
            var vids2 = JSON.parse(resp2.getContentText());
            if (!Array.isArray(vids2) || vids2.length === 0) continue;

            var result2 = [];
            for (var m = 0; m < vids2.length && m < 50; m++) {
                var v2 = vids2[m];
                if (v2.videoId && v2.title) {
                    result2.push({
                        videoId: v2.videoId,
                        title: v2.title,
                        thumbnail: 'https://i.ytimg.com/vi/' + v2.videoId + '/hqdefault.jpg',
                        category: guessCategory_(v2.title)
                    });
                }
            }
            if (result2.length > 0) {
                Logger.log('  ✅ Invidious: ' + result2.length + '개 (via ' + INVIDIOUS_INSTANCES[k] + ')');
                return result2;
            }
        } catch (e) {
            Logger.log('  ⚠️ Invidious ' + INVIDIOUS_INSTANCES[k] + ': ' + e.message);
        }
    }

    Logger.log('⚠️ 모든 트렌딩 소스 실패 → 빈 배열 반환');
    return [];
}


// ======================== YOUTUBE SEARCH (다중 소스) =========

/**
 * YouTube 검색 (YouTube Service → Piped → Invidious)
 */
function searchYouTube_(query) {
    // ── 1순위: YouTube Advanced Service ──
    var ytResult = searchByYouTubeService_(query);
    if (ytResult) return ytResult;

    // ── 2순위: Piped API ──
    for (var i = 0; i < PIPED_INSTANCES.length; i++) {
        try {
            var url = PIPED_INSTANCES[i] + '/search?q=' + encodeURIComponent(query) + '&filter=videos';
            var resp = UrlFetchApp.fetch(url, {
                muteHttpExceptions: true,
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
            });
            if (resp.getResponseCode() !== 200) continue;

            var data = JSON.parse(resp.getContentText());
            var items = data.items || data;
            if (!items || items.length === 0) continue;

            for (var j = 0; j < items.length && j < 5; j++) {
                var vid = extractVideoId_(items[j].url || '');
                if (vid && items[j].title) {
                    return {
                        videoId: vid,
                        title: items[j].title,
                        thumbnail: 'https://i.ytimg.com/vi/' + vid + '/hqdefault.jpg'
                    };
                }
            }
        } catch (e) { continue; }
    }

    // ── 3순위: Invidious API ──
    for (var k = 0; k < INVIDIOUS_INSTANCES.length; k++) {
        try {
            var url2 = INVIDIOUS_INSTANCES[k] + '/api/v1/search?q=' + encodeURIComponent(query) + '&type=video';
            var resp2 = UrlFetchApp.fetch(url2, {
                muteHttpExceptions: true,
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
            });
            if (resp2.getResponseCode() !== 200) continue;

            var items2 = JSON.parse(resp2.getContentText());
            if (!Array.isArray(items2) || items2.length === 0) continue;

            for (var m = 0; m < items2.length && m < 5; m++) {
                if (items2[m].videoId && items2[m].title) {
                    return {
                        videoId: items2[m].videoId,
                        title: items2[m].title,
                        thumbnail: 'https://i.ytimg.com/vi/' + items2[m].videoId + '/hqdefault.jpg'
                    };
                }
            }
        } catch (e) { continue; }
    }

    return null;
}

function extractVideoId_(url) {
    if (!url) return null;
    var m = url.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
    if (m) return m[1];
    m = url.match(/\/([a-zA-Z0-9_-]{11})$/);
    return m ? m[1] : null;
}


// ======================== GOOGLE TRENDS KEYWORDS =============

/**
 * Google Trends RSS에서 핫 검색어 수집
 */
function fetchTrendingKeywords_() {
    Logger.log('📡 Google Trends RSS 수집 중...');
    try {
        var resp = UrlFetchApp.fetch(TRENDS_RSS_URL, {
            muteHttpExceptions: true,
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
        });
        if (resp.getResponseCode() !== 200) return getDefaultKeywords_();

        var doc = XmlService.parse(resp.getContentText());
        var channel = doc.getRootElement().getChild('channel');
        if (!channel) return getDefaultKeywords_();

        var items = channel.getChildren('item');
        var kw = [];
        for (var i = 0; i < items.length && i < 20; i++) {
            var t = items[i].getChildText('title');
            if (t && t.trim()) kw.push(t.trim());
        }
        if (kw.length === 0) return getDefaultKeywords_();
        Logger.log('✅ Trends에서 ' + kw.length + '개 키워드 수집');
        return kw;
    } catch (e) {
        Logger.log('⚠️ Google Trends 실패: ' + e.message);
        return getDefaultKeywords_();
    }
}

/**
 * 하드코딩 Fallback 키워드
 */
function getDefaultKeywords_() {
    Logger.log('📋 기본 키워드 사용');
    return [
        'BTS MV', '뉴진스 MV', '에스파 MV', '아이브 MV', '르세라핌 MV',
        '인기 드라마 OST', '인기 애니 OST', '롤 하이라이트',
        '발로란트 하이라이트', '원신 플레이', '핫한 예능 클립', '인기 유튜버',
        'K-POP 히트곡 MV', '넷플릭스 예고편', '인기 밈 영상',
        '축구 골 하이라이트', '야구 홈런 하이라이트', '먹방 영상',
        '인기 쇼츠', '챌린지 영상'
    ];
}


// ======================== QUIZ GENERATION (NO AI) =============

/**
 * 트렌딩 영상 → 퀴즈 자동 생성
 * 영상 제목을 정답으로, 같은 배치 제목을 오답으로 사용
 */
function buildQuizFromVideos_(videos) {
    if (!videos || videos.length < QUIZ_MIN_QUESTIONS) return null;

    Logger.log('🧩 트렌딩 영상으로 퀴즈 빌드 중...');

    // 셔플하여 다양성 확보
    var shuffled = videos.slice().sort(function () { return Math.random() - 0.5; });
    var selected = shuffled.slice(0, Math.min(QUIZ_TARGET_QUESTIONS, shuffled.length));

    // 모든 제목 수집 (오답 풀)
    var allTitles = videos.map(function (v) { return cleanVideoTitle_(v.title); });

    var questions = [];
    for (var i = 0; i < selected.length; i++) {
        var v = selected[i];
        var cleanTitle = cleanVideoTitle_(v.title);
        if (!cleanTitle || cleanTitle.length < 2) continue;

        var options = buildOptionsFromPool_(cleanTitle, allTitles);
        questions.push({
            answer: cleanTitle,
            hint: v.category || '인기 영상',
            options: options,
            videoId: v.videoId,
            videoTitle: v.title
        });
    }

    if (questions.length < QUIZ_MIN_QUESTIONS) return null;

    // ── 어그로 제목 생성 ──
    var topCategory = detectTopCategory_(questions);
    var topicPhrase = extractTopicPhrase_(videos, topCategory);
    var titleTemplate = pickRandom_(QUIZ_TITLE_TEMPLATES[topCategory] || QUIZ_TITLE_TEMPLATES.trending);
    var finalTitle = titleTemplate.replace(/\{topic\}/g, topicPhrase);

    var quizData = {
        title: finalTitle,
        description: '지금 한국에서 가장 핫한 ' + topicPhrase + ' 영상들! ' +
            '영상 클립을 보고 제목을 맞춰보세요. 매일 자동 갱신되는 실시간 트렌드 퀴즈로, ' +
            '총 ' + questions.length + '문제가 준비되어 있습니다. ' +
            '과연 당신은 몇 개나 맞출 수 있을까요? 지금 바로 도전해보세요!',
        questions: questions
    };

    Logger.log('✅ 퀴즈 빌드 완료: "' + quizData.title + '" (' + questions.length + '문제)');
    return quizData;
}

/**
 * 키워드 기반 YouTube 검색 → 퀴즈 생성 (fallback)
 */
function buildQuizFromKeywords_() {
    Logger.log('🔍 키워드 기반 퀴즈 빌드 시도...');

    var keywords = fetchTrendingKeywords_();
    var shuffled = keywords.slice().sort(function () { return Math.random() - 0.5; });
    var searchKeywords = shuffled.slice(0, Math.min(QUIZ_TARGET_QUESTIONS + 5, shuffled.length));

    var videos = [];
    for (var i = 0; i < searchKeywords.length; i++) {
        var yt = searchYouTube_(searchKeywords[i]);
        if (yt) {
            videos.push({
                videoId: yt.videoId,
                title: yt.title,
                thumbnail: yt.thumbnail,
                category: guessCategory_(searchKeywords[i])
            });
            Logger.log('  ✓ "' + searchKeywords[i] + '" → ' + yt.videoId);
        } else {
            Logger.log('  ✗ "' + searchKeywords[i] + '"');
        }
        Utilities.sleep(300);
    }

    if (videos.length < QUIZ_MIN_QUESTIONS) return null;
    return buildQuizFromVideos_(videos);
}


// ======================== WORLDCUP / TIERLIST GENERATION ======

/**
 * YouTube 트렌딩 → 이상형 월드컵
 */
function buildWorldcupFromVideos_(videos) {
    if (!videos || videos.length < 8) return null;

    Logger.log('🏆 트렌딩 영상으로 월드컵 빌드 중...');

    var shuffled = videos.slice().sort(function () { return Math.random() - 0.5; });
    var selected = shuffled.slice(0, Math.min(WORLDCUP_ITEM_COUNT, shuffled.length));

    var items = selected.map(function (v) {
        return {
            name: cleanVideoTitle_(v.title),
            image_url: v.thumbnail || ('https://i.ytimg.com/vi/' + v.videoId + '/hqdefault.jpg')
        };
    }).filter(function (item) { return item.name && item.name.length > 1; });

    if (items.length < 8) return null;

    // ── 어그로 제목 생성 ──
    var topicPhrase = extractTopicPhrase_(videos, detectTopCategory_(videos.map(function (v) { return { hint: v.category }; })));
    var titleTemplate = pickRandom_(WORLDCUP_TITLE_TEMPLATES);
    var finalTitle = titleTemplate.replace(/\{topic\}/g, topicPhrase);

    return {
        title: finalTitle,
        description: '지금 한국에서 난리 난 ' + topicPhrase + '! ' +
            '이 중에서 딱 하나만 골라야 한다면? 총 ' + items.length + '개 후보 중 승자는 누구?',
        items: items
    };
}

/**
 * Jikan API → 애니 캐릭터 월드컵 (fallback)
 */
function buildAnimeWorldcup_() {
    Logger.log('🎌 Jikan API로 애니 월드컵 빌드 중...');
    try {
        var randomPage = Math.floor(Math.random() * 10) + 1;
        var resp = UrlFetchApp.fetch('https://api.jikan.moe/v4/top/characters?page=' + randomPage + '&limit=16', {
            muteHttpExceptions: true
        });
        if (resp.getResponseCode() !== 200) return null;

        var json = JSON.parse(resp.getContentText());
        if (!json.data || json.data.length === 0) return null;

        var items = json.data.map(function (char) {
            return {
                name: char.name + ' (캐릭터)',
                image_url: char.images && char.images.jpg ? char.images.jpg.image_url : null
            };
        }).filter(function (item) { return item.image_url; });

        Logger.log('✅ 애니 월드컵 빌드 완료: ' + items.length + '개');
        var animeWcTitles = [
            '둘 중 한 명과 살아야 한다면? 🎌 애니 캐릭터 이상형 월드컵',
            '이 캐릭터 중 최애 하나만 골라 🔥 글로벌 인기 애니 월드컵',
            '오타쿠 감별 테스트 🎌 네 최애 캐릭터는 누구야?',
            '진짜 고민된다... 둘 다 좋은데 😭 애니 캐릭터 택1 월드컵',
            '찐 덕후만 고민하는 애니 이상형 월드컵 🏆'
        ];
        return {
            title: pickRandom_(animeWcTitles),
            description: '전 세계 팬들이 사랑하는 레전드 애니 캐릭터 ' + items.length + '명이 격돌! 과연 최애 원픽은 누구? 매일 자동 갱신되는 캐릭터 라인업으로 매번 새로운 고민을 즐겨보세요.',
            items: items
        };
    } catch (e) {
        Logger.log('⚠️ Jikan API 실패: ' + e.message);
        return null;
    }
}

/**
 * Dog CEO API → 강아지 월드컵
 */
function buildDogWorldcup_() {
    Logger.log('🐶 Dog CEO API로 강아지 월드컵 빌드 중...');
    try {
        var resp = UrlFetchApp.fetch('https://dog.ceo/api/breeds/image/random/16', {
            muteHttpExceptions: true
        });
        if (resp.getResponseCode() !== 200) return null;

        var json = JSON.parse(resp.getContentText());
        if (json.status !== 'success' || !json.message) return null;

        var breedNames = {
            'husky': '허스키', 'pomeranian': '포메라니안', 'corgi': '웰시 코기',
            'retriever': '리트리버', 'pug': '퍼그', 'shiba': '시바견',
            'bulldog': '불독', 'poodle': '푸들', 'beagle': '비글',
            'dachshund': '닥스훈트', 'dalmatian': '달마시안', 'chihuahua': '치와와',
            'maltese': '말티즈', 'samoyed': '사모예드', 'schnauzer': '슈나우저',
            'labrador': '래브라도', 'germanshepherd': '저먼 셰퍼드', 'shihtzu': '시츄'
        };

        var items = json.message.map(function (imgUrl, idx) {
            var parts = imgUrl.split('/');
            var breedRaw = parts[parts.length - 2].toLowerCase().replace(/-/g, '');
            var mainBreed = breedRaw.split('-')[0];
            var name = breedNames[mainBreed] || (mainBreed.charAt(0).toUpperCase() + mainBreed.slice(1));
            return { name: '기호 ' + (idx + 1) + '번: ' + name, image_url: imgUrl };
        });

        Logger.log('✅ 강아지 월드컵 빌드 완료: ' + items.length + '마리');
        var dogWcTitles = [
            '심장 폭발 주의 🐶💥 이 중 한 마리만 데려갈 수 있다면?',
            '둘 다 너무 귀여운데 하나만 골라야 함 😭🐶 멍멍이 월드컵',
            '댕댕이 심쿵 테스트 🐶 당신의 원픽 멍뭉이는?',
            '귀여움 폭발! 이 강아지들 중 최강 귀요미를 뽑아라 🏆🐶',
            '멍멍이 이상형 월드컵 🐶 한 마리만 선택해야 한다면?'
        ];
        return {
            title: pickRandom_(dogWcTitles),
            description: '매일 전 세계에서 수집된 ' + items.length + '마리의 심쿵 강아지들! 다 귀여운데 하나만 골라야 한다면? 당신의 원픽 멍뭉이를 찾아보세요!',
            items: items
        };
    } catch (e) {
        Logger.log('⚠️ Dog API 실패: ' + e.message);
        return null;
    }
}


// ======================== UTILITY: VIDEO TITLE & CATEGORY ====

/**
 * 영상 제목에서 불필요한 태그/구두점 정리
 */
function cleanVideoTitle_(title) {
    if (!title) return '';
    return title
        .replace(/\[.*?\]/g, '')          // [MV], [Official] 등 제거
        .replace(/\(.*?\)/g, '')          // (feat. ...) 등 제거
        .replace(/\|.*$/g, '')            // | 이후 제거
        .replace(/[-–—].*?(official|mv|m\/v|music video|lyrics|lyric)/gi, '') // official MV 등 제거
        .replace(/official\s*(music\s*)?video/gi, '')
        .replace(/#\S+/g, '')             // 해시태그 제거
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * 영상 제목에서 카테고리 추측
 */
function guessCategory_(title) {
    if (!title) return 'trending';
    var t = title.toLowerCase();
    if (/mv|music|뮤직|노래|song|album|feat\.|ft\.|remix/i.test(t)) return 'music';
    if (/game|게임|롤|발로란트|마크|원신|배그|오버워치|gameplay/i.test(t)) return 'gaming';
    if (/축구|야구|농구|스포츠|sport|goal|하이라이트|highlight/i.test(t)) return 'sports';
    if (/드라마|영화|예능|movie|drama|show|entertainment/i.test(t)) return 'entertainment';
    return 'trending';
}

/**
 * 질문/영상 배열에서 가장 빈도 높은 카테고리 감지
 */
function detectTopCategory_(items) {
    var counts = {};
    items.forEach(function (q) {
        var cat = q.hint || q.category || 'trending';
        counts[cat] = (counts[cat] || 0) + 1;
    });

    var maxCat = 'trending';
    var maxCount = 0;
    for (var cat in counts) {
        if (counts[cat] > maxCount) { maxCount = counts[cat]; maxCat = cat; }
    }
    return maxCat;
}

/**
 * 영상 데이터에서 구체적인 '주제 문구' 추출
 * 예: "K-POP 최신곡", "요즘 핫한 게임", "실시간 인기 영상" 등
 *
 * 전략:
 *   1. 채널명에서 유명 K-POP 레이블/게임사 등 감지
 *   2. 제목에서 반복되는 키워드(아티스트명, 게임명 등) 감지
 *   3. 둘 다 실패 시 카테고리 기반 fallback
 */
function extractTopicPhrase_(videos, topCategory) {
    if (!videos || videos.length === 0) {
        return pickRandom_(CATEGORY_TOPIC_NAMES[topCategory] || CATEGORY_TOPIC_NAMES.trending);
    }

    // ── 1. 채널명 분석 (K-POP 레이블, 게임사 등) ──
    var channelCounts = {};
    videos.forEach(function (v) {
        var ch = v.channelTitle || '';
        if (ch) channelCounts[ch] = (channelCounts[ch] || 0) + 1;
    });

    // K-POP 레이블 감지
    var kpopLabels = ['HYBE', 'SM Entertainment', 'YG Entertainment', 'JYP Entertainment',
        'Starship', 'PLEDIS', 'KQ Entertainment', 'Stone Music', '1theK',
        'ADOR', 'SOURCE MUSIC', 'Kakao Entertainment'];
    for (var ch in channelCounts) {
        for (var lbl = 0; lbl < kpopLabels.length; lbl++) {
            if (ch.toLowerCase().indexOf(kpopLabels[lbl].toLowerCase()) !== -1) {
                return 'K-POP 아이돌 신곡';
            }
        }
    }

    // ── 2. 제목 키워드 분석 ──
    var allTitles = videos.map(function (v) { return (v.title || '').toLowerCase(); }).join(' ');

    // 구체적 키워드 매칭
    var specificTopics = [
        { pattern: /\bnewjeans|뉴진스/i, topic: '뉴진스 & K-POP 신곡' },
        { pattern: /\bbts|방탄소년단/i, topic: 'BTS & K-POP 히트곡' },
        { pattern: /\baespa|에스파/i, topic: '에스파 & K-POP 최신곡' },
        { pattern: /\bblackpink|블랙핑크/i, topic: '블랙핑크 & K-POP' },
        { pattern: /\bive|아이브/i, topic: '아이브 & K-POP 신곡' },
        { pattern: /\b(lol|리그오브레전드|롤)/i, topic: 'LOL & 게임 영상' },
        { pattern: /\b(valorant|발로란트)/i, topic: '발로란트 & 게임 영상' },
        { pattern: /\b(minecraft|마인크래프트|마크)/i, topic: '마크 & 게임 영상' },
        { pattern: /\b(genshin|원신)/i, topic: '원신 & 게임 영상' },
        { pattern: /\b(fifa|축구|football|soccer)/i, topic: '축구 명장면' },
        { pattern: /\b(야구|baseball|kbo|mlb)/i, topic: '야구 하이라이트' },
        { pattern: /\b(드라마|drama)/i, topic: '화제의 드라마 장면' },
        { pattern: /\b(예능|variety|entertainment)/i, topic: '핫한 예능 클립' },
        { pattern: /\b(먹방|mukbang|asmr)/i, topic: '먹방 & ASMR 영상' },
        { pattern: /\b(vlog|브이로그|일상)/i, topic: '인기 브이로그' },
        { pattern: /\b(shorts|쇼츠|short)/i, topic: '인기 쇼츠 영상' },
        { pattern: /\b(anime|애니|アニメ)/i, topic: '인기 애니 영상' },
        { pattern: /\b(netflix|넷플릭스)/i, topic: '넷플릭스 화제작' }
    ];

    for (var sp = 0; sp < specificTopics.length; sp++) {
        if (specificTopics[sp].pattern.test(allTitles)) {
            return specificTopics[sp].topic;
        }
    }

    // ── 3. 가장 많이 등장하는 채널 활용 ──
    var topChannel = '';
    var topChCount = 0;
    for (var c in channelCounts) {
        if (channelCounts[c] > topChCount && c.length > 1) {
            topChCount = channelCounts[c];
            topChannel = c;
        }
    }
    // 같은 채널 영상이 3개 이상이면 채널명을 주제에 포함
    if (topChCount >= 3 && topChannel) {
        return topChannel + ' 인기 영상';
    }

    // ── 4. 카테고리 기반 fallback ──
    return pickRandom_(CATEGORY_TOPIC_NAMES[topCategory] || CATEGORY_TOPIC_NAMES.trending);
}

/**
 * 오답 풀에서 4지선다 생성
 */
function buildOptionsFromPool_(correct, allTitles) {
    var pool = allTitles.filter(function (t) { return t !== correct && t.length > 1; });
    pool = pool.sort(function () { return Math.random() - 0.5; }).slice(0, 3);

    var defaults = ['인기 영상 A', '트렌딩 영상 B', '화제의 영상 C'];
    while (pool.length < 3) {
        pool.push(defaults[pool.length]);
    }

    var choices = [correct].concat(pool).sort(function () { return Math.random() - 0.5; });
    var labels = ['A', 'B', 'C', 'D'];
    return choices.map(function (t, i) {
        return { id: labels[i], text: t, isCorrect: t === correct };
    });
}

function pickRandom_(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}


// ======================== SUPABASE ===========================

function getSupabaseToken_() {
    var resp = UrlFetchApp.fetch(SUPABASE_URL + '/auth/v1/token?grant_type=password', {
        method: 'post', contentType: 'application/json',
        headers: { 'apikey': SUPABASE_ANON_KEY },
        payload: JSON.stringify({ email: AGENT_EMAIL, password: getAgentPassword_() }),
        muteHttpExceptions: true
    });
    if (resp.getResponseCode() !== 200) throw new Error('Supabase 인증 실패: ' + resp.getContentText().substring(0, 200));
    var data = JSON.parse(resp.getContentText());
    Logger.log('✅ Supabase 인증 완료 (User: ' + data.user.id + ')');
    return { token: data.access_token, userId: data.user.id };
}

function sbInsert_(table, payload, token) {
    var resp = UrlFetchApp.fetch(SUPABASE_URL + '/rest/v1/' + table, {
        method: 'post', contentType: 'application/json',
        headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': 'Bearer ' + token, 'Prefer': 'return=representation' },
        payload: JSON.stringify(payload), muteHttpExceptions: true
    });
    if (resp.getResponseCode() !== 201) throw new Error('INSERT 실패(' + table + '): ' + resp.getContentText().substring(0, 300));
    return JSON.parse(resp.getContentText());
}

function sbSelect_(table, query, token) {
    var resp = UrlFetchApp.fetch(SUPABASE_URL + '/rest/v1/' + table + '?' + query, {
        method: 'get',
        headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': 'Bearer ' + token },
        muteHttpExceptions: true
    });
    if (resp.getResponseCode() !== 200) throw new Error('SELECT 실패(' + table + ')');
    return JSON.parse(resp.getContentText());
}

function sbDelete_(table, query, token) {
    UrlFetchApp.fetch(SUPABASE_URL + '/rest/v1/' + table + '?' + query, {
        method: 'delete',
        headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': 'Bearer ' + token },
        muteHttpExceptions: true
    });
}

// ── DB 적재 ──
function insertQuizToDB_(data, token, userId) {
    Logger.log('💾 퀴즈 적재: "' + data.title + '"');
    var quiz = sbInsert_('quizzes', { title: data.title, description: data.description || '', creator_id: userId }, token);
    var quizId = quiz[0].id;

    var rows = data.questions.map(function (q) {
        return { quiz_id: quizId, video_id: q.videoId, start_time: 30, end_time: 45, answer: q.answer, options: q.options, is_embeddable: true };
    });
    for (var i = 0; i < rows.length; i += 20) sbInsert_('quiz_questions', rows.slice(i, i + 20), token);

    Logger.log('✅ 퀴즈 완료: ' + quizId);
    return quizId;
}

function insertWorldcupToDB_(data, token, userId) {
    Logger.log('💾 월드컵 적재: "' + data.title + '"');
    var cup = sbInsert_('worldcups', { title: data.title, description: data.description || '', play_count: 0, creator_id: userId }, token);
    var cupId = cup[0].id;

    var rows = data.items.map(function (item) {
        return { worldcup_id: cupId, name: item.name, image_url: item.image_url };
    });
    sbInsert_('worldcup_items', rows, token);

    Logger.log('✅ 적재 완료: ' + cupId + ' (' + rows.length + '개)');
    return cupId;
}

// ── 콘텐츠 정리 ──
function cleanupStaleContent_(token, userId) {
    Logger.log('🧹 오래된 콘텐츠 정리...');
    var cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - CONTENT_CLEANUP_DAYS);
    var iso = cutoff.toISOString();
    var count = 0;

    try {
        var staleQ = sbSelect_('quizzes', 'select=id,title&creator_id=eq.' + userId + '&play_count=eq.0&created_at=lt.' + iso, token);
        for (var i = 0; i < staleQ.length; i++) { sbDelete_('quizzes', 'id=eq.' + staleQ[i].id, token); count++; }
    } catch (e) { /* skip */ }

    try {
        var staleW = sbSelect_('worldcups', 'select=id,title&creator_id=eq.' + userId + '&play_count=eq.0&created_at=lt.' + iso, token);
        for (var j = 0; j < staleW.length; j++) { sbDelete_('worldcups', 'id=eq.' + staleW[j].id, token); count++; }
    } catch (e) { /* skip */ }

    Logger.log('✅ 정리 완료: ' + count + '개 삭제');
}


// ======================== LOGGING ============================

function logToSheet_(results, elapsed) {
    try {
        var ss = SpreadsheetApp.getActiveSpreadsheet();
        if (!ss) return;
        var sheet = ss.getSheetByName(LOG_SHEET_NAME);
        if (!sheet) {
            sheet = ss.insertSheet(LOG_SHEET_NAME);
            sheet.appendRow(['실행 시각', '소요(초)', '퀴즈 상태', '퀴즈 제목', '퀴즈 ID', '월드컵 상태', '월드컵 제목', '월드컵 ID', '티어 상태', '티어 제목', '티어 ID', '정리', '에러']);
            sheet.getRange(1, 1, 1, 13).setFontWeight('bold');
        }
        var now = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd HH:mm:ss');
        sheet.appendRow([now, elapsed, results.quiz.status, results.quiz.title, results.quiz.id, results.worldcup.status, results.worldcup.title, results.worldcup.id, results.tierlist.status, results.tierlist.title, results.tierlist.id, results.cleanup.status, results.error || '']);
    } catch (e) { /* standalone mode, skip */ }
}


// ======================== TRIGGER ============================

function setupDailyTrigger() {
    var triggers = ScriptApp.getProjectTriggers();
    for (var i = 0; i < triggers.length; i++) {
        if (triggers[i].getHandlerFunction() === 'dailyAutoAgent') {
            ScriptApp.deleteTrigger(triggers[i]);
        }
    }
    ScriptApp.newTrigger('dailyAutoAgent').timeBased().everyDays(1).atHour(3).create();
    Logger.log('✅ 매일 새벽 3시 트리거 설정 완료!');
}


// ======================== TEST FUNCTIONS =====================

/** 🧪 전체 파이프라인 즉시 실행 */
function testRun() {
    Logger.log('🧪 수동 테스트 모드');
    dailyAutoAgent();
}

/** 🧪 YouTube Advanced Service 트렌딩 테스트 */
function testYouTubeService() {
    Logger.log('📡 YouTube Advanced Service 테스트...');
    var vids = fetchTrendingByYouTubeService_();
    if (vids.length === 0) {
        Logger.log('❌ 실패 — GAS 에디터 → [서비스] → YouTube Data API v3 추가가 필요합니다');
        Logger.log('📖 방법: 왼쪽 사이드바 [+] 클릭 → YouTube Data API v3 선택 → 추가');
        return;
    }
    Logger.log('✅ ' + vids.length + '개 트렌딩 수집:');
    vids.slice(0, 10).forEach(function (v, i) {
        Logger.log('  ' + (i + 1) + '. [' + v.category + '] ' + v.title);
    });
}

/** 🧪 트렌딩 영상 수집 (전체 소스 시도) */
function testTrending() {
    var vids = fetchTrendingVideos_();
    Logger.log('총 ' + vids.length + '개 수집:');
    vids.slice(0, 15).forEach(function (v, i) {
        Logger.log('  ' + (i + 1) + '. [' + v.category + '] ' + v.title + ' → ' + v.videoId);
    });
}

/** 🧪 Google Trends 키워드 테스트 */
function testTrends() {
    var kw = fetchTrendingKeywords_();
    kw.forEach(function (k, i) { Logger.log((i + 1) + '. ' + k); });
}

/** 🧪 YouTube 검색 테스트 */
function testYouTubeSearch() {
    var queries = ['BTS Dynamite MV', '뉴진스 Hype Boy', '원신 플레이'];
    queries.forEach(function (q) {
        var r = searchYouTube_(q);
        Logger.log(q + ' → ' + (r ? r.videoId + ' (' + r.title + ')' : '❌ 실패'));
    });
}

/** 🧪 Supabase 인증 테스트 */
function testSupabaseAuth() {
    var auth = getSupabaseToken_();
    Logger.log('✅ User ID: ' + auth.userId);
}

/** 🧪 퀴즈 빌드 테스트 (DB 저장 안 함) */
function testQuizBuild() {
    var vids = fetchTrendingVideos_();
    var quiz = buildQuizFromVideos_(vids);
    if (quiz) {
        Logger.log('📋 퀴즈: ' + quiz.title);
        Logger.log('📋 설명: ' + quiz.description.substring(0, 100) + '...');
        quiz.questions.forEach(function (q, i) {
            Logger.log('  Q' + (i + 1) + '. [' + q.videoId + '] 정답: ' + q.answer);
            q.options.forEach(function (o) {
                Logger.log('    ' + o.id + ') ' + o.text + (o.isCorrect ? ' ✓' : ''));
            });
        });
    } else {
        Logger.log('❌ 퀴즈 빌드 실패 (영상 부족)');
    }
}

/** 현재 트리거 확인 */
function listTriggers() {
    var t = ScriptApp.getProjectTriggers();
    if (t.length === 0) { Logger.log('트리거 없음'); return; }
    t.forEach(function (tr, i) { Logger.log((i + 1) + '. ' + tr.getHandlerFunction()); });
}
