// ============================================================
//  QuizRank Auto Agent — Google Apps Script (No-AI Edition v4)
//  ✨ Gemini 완전 제거 — 데이터 기반 자동 퀴즈/월드컵/티어 생성
//
//  전략:
//    • YouTube Advanced Service (GAS 내장) → 트렌딩 & 검색 1순위
//    • Piped / Invidious → fallback
//    • Google Trends RSS → 핫 키워드 수집 → 키워드별 YouTube 영상 검색 → 퀴즈/월드컵 (A안)
//    • 인기 차트(mostPopular)는 키워드 수집이 부족할 때만 대체 사용
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
var LOG_SHEET_NAME = 'AgentLog';

// ── 키워드 기반 생성 (Google Trends → YouTube 검색) ──
var KEYWORD_ITEM_TARGET = 16;       // 하루에 모을 키워드-영상 쌍 (퀴즈 10 + 월드컵 16에 재사용)
var KEYWORD_MAX_SEARCHES = 12;      // Trends 키워드용 YouTube 검색 호출 상한 (검색 1회 = 100 units, 하루 무료 10,000)
var KEYWORD_TRENDS_MAX = 3;         // Trends 키워드는 검증을 통과한 것만 최대 N개 (뉴스/일반명사 위주라 보조 용도)
var KEYWORD_TRENDS_MIN_VIEWS = 200000; // Trends 키워드 영상 최소 조회수 (지역 뉴스 클립 배제)
var KEYWORD_RECENT_DAYS = 14;       // 최근 N일 안에 올라온 영상 우선
var KEYWORD_REUSE_BLOCK_DAYS = 7;   // 같은 키워드를 N일 안에 다시 쓰지 않음
var KEYWORD_MAX_PER_CATEGORY = 6;   // 카테고리 쏠림 방지 (게임은 아래 별도 상한)
var KEYWORD_MAX_GAMING = 2;
var USED_KEYWORDS_PROP = 'USED_KEYWORDS';
// 비극/정치/범죄성 이슈는 가벼운 퀴즈에 어울리지 않고 광고 정책에도 불리 → 제외
var BLOCKED_KEYWORD_PATTERN = new RegExp([
    '사망|사고|참사|추락|화재|살인|피살|성폭|성범죄|폭행|자살|극단|실종|구속|체포|기소|재판|판결|탄핵',
    '대통령|국회|여당|야당|의원|총선|대선|전쟁|테러|확진|지진|폭발|붕괴|마약|도박|불법|별세|부고|추모|속보',
    '주가|증시|코스피|코스닥|환율|금리|비트코인|코인|공모주|배당|소송|특허|법원|검찰|경찰|특검',
    '사령관|미사일|북한|군사|선로|열차|철도'
].join('|'));
var KEYWORD_MIN_LENGTH = 2;            // 한 글자 키워드("놀" 등)는 의미 없음
var KEYWORD_MIN_FOR_QUIZ = 6;          // 이보다 적으면 키워드 퀴즈 대신 카테고리 균형 영상 퀴즈 사용
// Trends 키워드에 허용하는 분야 (YouTube categoryId): 영화1 음악10 스포츠17 게임20 코미디23 엔터24
// 제외: 블로그22(지역 영상 다수), 뉴스/정치25, 교육27, 과학기술28(주식·시사 해설), 비영리29 등
var KEYWORD_ALLOWED_CATEGORY_IDS = { '1': 1, '10': 1, '17': 1, '20': 1, '23': 1, '24': 1 };
// 폴백(인기 차트)에서 카테고리별로 골고루 가져올 목록 (게임 제외 → 쏠림 방지)
var BALANCED_CATEGORIES = [['10', 4], ['24', 4], ['17', 3], ['1', 2], ['23', 2]];
// 키워드 보강: 카테고리별 인기 영상 제목에서 아티스트/프로그램명을 뽑아 키워드로 사용 (검색 쿼터 0, 호출당 1 unit)
// [categoryId, 최대 채택 수]
var ENTITY_CHART_CATEGORIES = [['10', 8], ['24', 4], ['17', 3], ['1', 4], ['23', 2]];

// ── 저장 용량 관리 ──
// 평소에는 콘텐츠를 삭제하지 않는다. (삭제하면 색인된 URL이 404가 되고 SEO/애드센스에 불리)
// 에이전트가 만든 행 수가 상한을 넘을 때만, 플레이 0회인 가장 오래된 것부터 소량 삭제한다.
// 참고: 하루 약 20KB 증가 → 상한 5,000개는 수년치. Supabase 무료 DB 500MB 기준.
var CONTENT_MAX_ROWS = 5000;        // 테이블(퀴즈/월드컵)별 에이전트 콘텐츠 상한
var CONTENT_TRIM_BATCH = 50;        // 상한 초과 시 1회 실행당 최대 삭제 수

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

        // ── Step 1: 핫 키워드 수집 → 키워드별 YouTube 영상 검색 ──
        Logger.log('\n── Step 1: 핫 키워드 + 영상 수집 ──');
        var keywordItems = collectKeywordVideos_(KEYWORD_ITEM_TARGET);
        Logger.log('수집된 키워드-영상 쌍: ' + keywordItems.length + '개');

        // 키워드 수집이 부족할 때만 인기 차트 영상으로 대체 (1 unit/call)
        var trendingVideos = [];
        if (keywordItems.length < 8) {
            Logger.log('⚠️ 키워드 수집 부족 → 카테고리 균형 인기 차트로 대체');
            trendingVideos = fetchBalancedTrendingVideos_();
            if (trendingVideos.length < 8) trendingVideos = fetchTrendingVideos_();
            Logger.log('수집된 트렌딩 영상: ' + trendingVideos.length + '개');
        }

        // ── Step 2: 퀴즈 생성 (키워드 우선, 부족하면 영상 제목 퀴즈) ──
        Logger.log('\n── Step 2: 퀴즈 생성 ──');
        try {
            var quizData = keywordItems.length >= KEYWORD_MIN_FOR_QUIZ
                ? buildQuizFromKeywordVideos_(keywordItems)
                : buildQuizFromVideos_(trendingVideos);
            if (quizData && quizData.questions.length >= QUIZ_MIN_QUESTIONS) {
                var quizId = insertQuizToDB_(quizData, token, userId);
                results.quiz = { status: '📝 초안', title: quizData.title, id: quizId };
            } else {
                Logger.log('⚠️ 유효 문항 부족 → 키워드 검색 퀴즈 시도');
                var keywordQuiz = buildQuizFromKeywords_();
                if (keywordQuiz && keywordQuiz.questions.length >= QUIZ_MIN_QUESTIONS) {
                    var quizId2 = insertQuizToDB_(keywordQuiz, token, userId);
                    results.quiz = { status: '📝 초안', title: keywordQuiz.title, id: quizId2 };
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
            var wcData = keywordItems.length >= 8
                ? buildWorldcupFromKeywordVideos_(keywordItems)
                : buildWorldcupFromVideos_(trendingVideos);
            if (wcData && wcData.items.length >= 8) {
                var wcId = insertWorldcupToDB_(wcData, token, userId);
                results.worldcup = { status: '📝 초안', title: wcData.title, id: wcId };
            } else {
                Logger.log('⚠️ 월드컵 후보 부족 → 애니 월드컵 시도');
                var animeWc = buildAnimeWorldcup_();
                if (animeWc && animeWc.items.length >= 8) {
                    var wcId2 = insertWorldcupToDB_(animeWc, token, userId);
                    results.worldcup = { status: '📝 초안', title: animeWc.title, id: wcId2 };
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
                results.tierlist = { status: '📝 초안', title: dogWc.title, id: tierId };
            } else {
                results.tierlist.status = '⚠️ 데이터 부족';
            }
        } catch (e) {
            Logger.log('❌ 보너스 실패: ' + e.message);
            results.tierlist.status = '❌ ' + e.message.substring(0, 50);
        }

        // ── Step 5: 저장 용량 점검 (상한 초과 시에만 정리) ──
        Logger.log('\n── Step 5: 저장 용량 점검 ──');
        try { results.cleanup.status = '✅ ' + trimContentIfOverCap_(token, userId); }
        catch (e) { results.cleanup.status = '⚠️ ' + e.message.substring(0, 60); }

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
function searchByYouTubeService_(query, opts) {
    try {
        var params = {
            q: query,
            type: 'video',
            regionCode: 'KR',
            relevanceLanguage: 'ko',
            videoEmbeddable: 'true',   // 퀴즈 플레이어에서 재생 가능한 영상만
            safeSearch: 'moderate',
            maxResults: 5
        };
        if (opts && opts.recentDays) {
            var after = new Date(new Date().getTime() - opts.recentDays * 24 * 3600 * 1000);
            params.publishedAfter = after.toISOString();
        }
        var response = YouTube.Search.list('snippet', params);

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
function fetchTrendingKeywords_(noDefault) {
    Logger.log('📡 Google Trends RSS 수집 중...');
    var fallback = function () { return noDefault ? [] : getDefaultKeywords_(); };
    try {
        var resp = UrlFetchApp.fetch(TRENDS_RSS_URL, {
            muteHttpExceptions: true,
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
        });
        if (resp.getResponseCode() !== 200) return fallback();

        var doc = XmlService.parse(resp.getContentText());
        var channel = doc.getRootElement().getChild('channel');
        if (!channel) return fallback();

        var items = channel.getChildren('item');
        var kw = [];
        for (var i = 0; i < items.length && i < 30; i++) {
            var t = items[i].getChildText('title');
            if (t && t.trim()) kw.push(t.trim());
        }
        if (kw.length === 0) return fallback();
        Logger.log('✅ Trends에서 ' + kw.length + '개 키워드 수집');
        return kw;
    } catch (e) {
        Logger.log('⚠️ Google Trends 실패: ' + e.message);
        return fallback();
    }
}

// ======================== KEYWORD-BASED GENERATION (A안) =====
// Google Trends 핫 키워드 → 키워드별 YouTube 영상 1개 → 퀴즈/월드컵에 재사용

function getUsedKeywords_() {
    try {
        var raw = PropertiesService.getScriptProperties().getProperty(USED_KEYWORDS_PROP);
        return raw ? JSON.parse(raw) : {};
    } catch (e) { return {}; }
}

function saveUsedKeywords_(used) {
    var cutoff = new Date().getTime() - KEYWORD_REUSE_BLOCK_DAYS * 24 * 3600 * 1000;
    var pruned = {};
    for (var k in used) { if (used[k] >= cutoff) pruned[k] = used[k]; }
    try { PropertiesService.getScriptProperties().setProperty(USED_KEYWORDS_PROP, JSON.stringify(pruned)); } catch (e) { /* skip */ }
}

/** 영상 ID들의 카테고리 ID와 조회수를 한 번에 조회 (1 unit). 실패하면 빈 객체 */
function fetchVideoInfo_(videoIds) {
    var map = {};
    try {
        var r = YouTube.Videos.list('snippet,statistics', { id: videoIds.join(','), maxResults: 50 });
        (r.items || []).forEach(function (it) {
            map[it.id] = {
                categoryId: String(it.snippet.categoryId || ''),
                views: parseInt((it.statistics && it.statistics.viewCount) || '0', 10)
            };
        });
    } catch (e) { Logger.log('⚠️ 영상 정보 조회 실패: ' + e.message); }
    return map;
}

function normalizeForMatch_(t) {
    return String(t || '').toLowerCase().replace(/[^0-9a-z가-힣]/g, '');
}

/**
 * 키워드-영상 쌍 수집 (퀴즈/월드컵 공용)
 *  1) 카테고리별 인기 영상 제목에서 아티스트/프로그램명 추출 → 기본 공급원 (맞출 수 있는 고유명사)
 *  2) Google Trends 핫 키워드 → 엄격 검증을 통과한 것만 최대 KEYWORD_TRENDS_MAX개 추가
 */
function collectKeywordVideos_(target, dryRun) {
    var used = getUsedKeywords_();
    var now = new Date().getTime();
    var blockMs = KEYWORD_REUSE_BLOCK_DAYS * 24 * 3600 * 1000;

    var items = collectEntityKeywordsFromCharts_(target, [], used, now, blockMs);
    Logger.log('🎯 인기 영상 고유명사 키워드 ' + items.length + '개');

    var trends = collectTrendsKeywordItems_(items, used, now, blockMs);
    Logger.log('📈 Trends 검증 통과 키워드 ' + trends.length + '개');
    items = items.concat(trends);

    if (!dryRun) {
        items.forEach(function (x) { used[x.keyword] = now; });
        saveUsedKeywords_(used);
    }
    return items;
}

/**
 * Trends 키워드 → YouTube 검색 → 검증 (영상 카테고리, 제목에 키워드 포함, 최소 조회수, 카테고리 상한)
 * 일반 명사/지역 뉴스("건설업", "파주시")는 대부분 제목·조회수 검증에서 탈락한다.
 */
function collectTrendsKeywordItems_(existing, used, now, blockMs) {
    var keywords = fetchTrendingKeywords_(true);
    if (keywords.length === 0) return [];

    var haveKw = {}, haveVid = {}, counts = {};
    existing.forEach(function (it) {
        haveKw[it.keyword] = true; haveVid[it.videoId] = true;
        counts[it.category] = (counts[it.category] || 0) + 1;
    });

    var fresh = [], stale = [];
    keywords.forEach(function (kw) {
        if (kw.length < KEYWORD_MIN_LENGTH || kw.length > 30 || BLOCKED_KEYWORD_PATTERN.test(kw) || isBannedKeyword_(kw, getBannedKeywords_()) || haveKw[kw]) {
            Logger.log('  ✗ "' + kw + '" (키워드 제외)');
            return;
        }
        if (used[kw] && now - used[kw] < blockMs) stale.push(kw); else fresh.push(kw);
    });
    var candidates = fresh.concat(stale);

    var found = [], seen = {}, searches = 0;
    for (var i = 0; i < candidates.length && searches < KEYWORD_MAX_SEARCHES && found.length < KEYWORD_TRENDS_MAX * 3; i++) {
        var kw = candidates[i];
        searches++;
        var yt = searchByYouTubeService_(kw, { recentDays: KEYWORD_RECENT_DAYS });
        if (!yt || seen[yt.videoId] || haveVid[yt.videoId]) { Logger.log('  ✗ "' + kw + '" (영상 없음)'); continue; }
        if (BLOCKED_KEYWORD_PATTERN.test(yt.title)) { Logger.log('  ✗ "' + kw + '" (영상 제목 제외어)'); continue; }
        seen[yt.videoId] = true;
        found.push({ keyword: kw, videoId: yt.videoId, title: yt.title, thumbnail: yt.thumbnail });
        Utilities.sleep(200);
    }

    var info = found.length ? fetchVideoInfo_(found.map(function (x) { return x.videoId; })) : {};
    var out = [];
    for (var j = 0; j < found.length && out.length < KEYWORD_TRENDS_MAX; j++) {
        var it = found[j], vi = info[it.videoId];
        if (!vi || !KEYWORD_ALLOWED_CATEGORY_IDS[vi.categoryId]) { Logger.log('  ✗ "' + it.keyword + '" (카테고리 ' + (vi ? vi.categoryId : '미확인') + ' 제외)'); continue; }
        if (normalizeForMatch_(it.title).indexOf(normalizeForMatch_(it.keyword)) === -1) { Logger.log('  ✗ "' + it.keyword + '" (영상 제목에 키워드 없음)'); continue; }
        if (vi.views < KEYWORD_TRENDS_MIN_VIEWS) { Logger.log('  ✗ "' + it.keyword + '" (조회수 ' + vi.views + ' 부족)'); continue; }
        var cat = mapYouTubeCategory_(vi.categoryId);
        var cap = cat === 'gaming' ? KEYWORD_MAX_GAMING : KEYWORD_MAX_PER_CATEGORY;
        if ((counts[cat] || 0) >= cap) { Logger.log('  ✗ "' + it.keyword + '" (' + cat + ' 상한)'); continue; }
        counts[cat] = (counts[cat] || 0) + 1;
        it.category = cat;
        out.push(it);
        Logger.log('  ✓ Trends "' + it.keyword + '" [' + cat + '/' + vi.categoryId + ', 조회수 ' + vi.views + '] → ' + it.videoId);
    }
    Logger.log('🔎 Trends 검색 ' + searches + '회 (≈' + (searches * 100 + 1) + ' units)');
    return out;
}

/**
 * 폴백: 인기 차트를 카테고리별로 따로 가져와 골고루 섞음 (게임/뉴스 쏠림 방지, 호출당 1 unit)
 */
function fetchBalancedTrendingVideos_() {
    var out = [], seen = {};
    BALANCED_CATEGORIES.forEach(function (pair) {
        try {
            var r = YouTube.Videos.list('snippet', { chart: 'mostPopular', regionCode: 'KR', videoCategoryId: pair[0], maxResults: 15 });
            var n = 0;
            (r.items || []).forEach(function (it) {
                if (n >= pair[1] || seen[it.id] || BLOCKED_KEYWORD_PATTERN.test(it.snippet.title)) return;
                seen[it.id] = true; n++;
                out.push({
                    videoId: it.id, title: it.snippet.title,
                    thumbnail: it.snippet.thumbnails && it.snippet.thumbnails.high ? it.snippet.thumbnails.high.url : 'https://i.ytimg.com/vi/' + it.id + '/hqdefault.jpg',
                    category: mapYouTubeCategory_(pair[0]), channelTitle: it.snippet.channelTitle || ''
                });
            });
        } catch (e) { Logger.log('  ⚠️ 카테고리 ' + pair[0] + ' 차트 실패: ' + e.message); }
    });
    Logger.log('  ✅ 카테고리 균형 차트: ' + out.length + '개');
    return out;
}

var ENTITY_GENERIC_PATTERN = /^(official|mv|m\/v|teaser|티저|예고|하이라이트|shorts?|live|풀영상|full|new|공식|클립|스페셜|특집|\d+회|ep\.?\s*\d+|\d{1,2}화|\d{4})/i;

// 방송사/플랫폼/리그 이름은 영상만 보고 맞출 수 없으므로 키워드에서 제외
var ENTITY_PLATFORM_PATTERN = /^(넷플릭스|netflix|디즈니\+?|티빙|웨이브|쿠팡플레이|tvn|mbc|sbs|kbs|jtbc|ena|mnet|엠넷|유튜브|youtube|epl|mlb|kbo|nba|lck|lol|축구 국대|국대|하이라이트)$/i;

// 해시태그 중 프로그램/인물명이 아닌 일반 태그
var ENTITY_GENERIC_HASHTAG = /shorts?|쇼츠|숏|reels|드라마$|시니어|반전|레전드|웃긴|모먼트|꿀잼|예능|영화|코미디|스케치|개그|먹방|이슈|핫|실화|^\d+(분|초|위|명|개|화|회)|ㅋ|ㅠ|ㅎ/i;
// 일반 명사 해시태그(종목명, 감정, 국가 등)는 영상만 보고 맞출 수 없으므로 제외
var ENTITY_COMMON_NOUN_HASHTAG = /^(축구|야구|농구|배구|테니스|골프|탁구|배드민턴|수영|격투기|복싱|ufc|스포츠|재미|웃음|감동|일상|브이로그|vlog|리뷰|추천|꿀팁|정보|뉴스|속보|화제|논란|명장면|하이라이트|영상|연예|연예인|배우|가수|아이돌|국대|한국|일본|중국|미국|외국인|외국|해외|커플|부부|가족|친구|아기|동물|강아지|고양이|음식|여행|패션|뷰티|게임|음악|노래|댄스|챌린지|영상편집|편집|모음|추억|감성|힐링|웃참|공감|팩트|선행|미담|기부|봉사|응원|사랑|우정|가족애|효도|반전|실화|사연|후기|비하인드|현장|직캠|무대|공연|콘서트|인터뷰|근황|레전드|명대사|명언|사이다|통쾌|참교육|복수|응징|갑질|꿀|역대급|미쳤|소름|충격|감동실화)$/i;

// 운영 중 발견한 부적절 키워드는 코드 수정 없이 스크립트 속성 BANNED_KEYWORDS(쉼표 구분)에 추가하면 바로 제외된다.
// 예: 사이다,선행,재미
function getBannedKeywords_() {
    try {
        var raw = PropertiesService.getScriptProperties().getProperty('BANNED_KEYWORDS') || '';
        return raw.split(',').map(function (x) { return normalizeForMatch_(x); }).filter(function (x) { return x; });
    } catch (e) { return []; }
}

function isBannedKeyword_(kw, banned) {
    var n = normalizeForMatch_(kw);
    for (var i = 0; i < banned.length; i++) { if (n === banned[i]) return true; }
    return false;
}

/**
 * 실제 한국 인기 차트 데이터 분석 결과에 맞춘 이름 추출 (없으면 null)
 *  - 음악: 자동 생성 "아티스트 - Topic" 채널 → 아티스트명 / 제목이 채널명으로 시작(임영웅 …) / "아티스트 'ㄱ' MV"
 *  - 그 외: 제목의 해시태그(#슬기로운의사생활, #나를충전해줘 …) 중 프로그램/인물명
 *  - 낚시성 재편집 제목 자체에서는 이름을 뽑지 않는다 (맞출 수 없는 문제 방지)
 */
function extractEntityFromTitle_(title, categoryId, channelTitle) {
    if (!title) return null;
    var t = title.replace(/\s+/g, ' ').trim();
    var ch = String(channelTitle || '').trim();

    if (String(categoryId) === '10') {
        // 1) 자동 생성 Topic 채널: "N.Flying - Topic" → N.Flying
        if (/\s*-\s*Topic$/i.test(ch)) {
            var artist = ch.replace(/\s*-\s*Topic$/i, '').trim();
            return artist.length >= 2 ? artist : null;
        }
        // 2) 앞쪽 [MV] 같은 형식 태그 제거 후 "아티스트 'ㄱ'" / "아티스트 - 곡"
        var m = t.replace(/^[\[【(]\s*(?:official\s*)?(?:mv|m\/v|music video|live|performance video|dance practice)[^\]】)]*[\]】)]\s*/i, '');
        var a = m.match(/^([^-–—'‘’"“”「『\[|]{2,24}?)\s*(?:[-–—]\s|['‘"“「『])/);
        if (a) {
            var name = a[1].trim();
            if (name.split(' ').length <= 4 && name.length >= 2 && !ENTITY_GENERIC_PATTERN.test(name)) return name;
        }
        // 3) 제목이 채널(아티스트)명으로 시작: "임영웅 [Baila] Live Clip" / 채널 "임영웅"
        if (ch.length >= 2 && ch.length <= 20 && t.indexOf(ch) === 0 && !ENTITY_PLATFORM_PATTERN.test(ch)) return ch;
        return null;
    }

    // 음악 외: 해시태그에서 프로그램/인물명 (앞 태그가 뒤 태그의 접두어면 짧은 쪽: #김원효기존쎄 #김원효 → 김원효)
    var tags = [], re = /#([0-9A-Za-z가-힣_]{2,14})/g, hm;
    while ((hm = re.exec(t)) !== null) {
        if (!ENTITY_GENERIC_HASHTAG.test(hm[1]) && !ENTITY_COMMON_NOUN_HASHTAG.test(hm[1]) && !ENTITY_PLATFORM_PATTERN.test(hm[1])) tags.push(hm[1]);
    }
    if (tags.length === 0) return null;
    var pick = tags[0];
    tags.forEach(function (u) { if (u.length < pick.length && pick.indexOf(u) === 0) pick = u; });
    return pick;
}

/**
 * 카테고리별 인기 영상에서 키워드-영상 쌍 수집
 * - 임베드 가능한 영상만, 제외어/중복/카테고리 상한 적용
 * - 최근 사용한 키워드는 제외하지 않고 후순위 (인기 차트는 하루 만에 거의 안 바뀌므로, 제외하면 0개가 될 수 있음)
 */
function collectEntityKeywordsFromCharts_(need, existing, used, now, blockMs) {
    var haveKw = {}, haveVid = {}, counts = {};
    existing.forEach(function (it) {
        haveKw[it.keyword] = true; haveVid[it.videoId] = true;
        counts[it.category] = (counts[it.category] || 0) + 1;
    });

    // 1단계: 카테고리별 차트에서 후보 추출
    var banned = getBannedKeywords_();
    var cands = [], seenCand = {}, stats = [];
    ENTITY_CHART_CATEGORIES.forEach(function (pair) {
        var cat = mapYouTubeCategory_(pair[0]);
        var fetched = 0, extracted = 0;
        try {
            var r = YouTube.Videos.list('snippet,status', { chart: 'mostPopular', regionCode: 'KR', videoCategoryId: pair[0], maxResults: 50 });
            var list = r.items || [];
            fetched = list.length;
            list.forEach(function (v) {
                if (v.status && v.status.embeddable === false) return;
                var kw = extractEntityFromTitle_(v.snippet.title, pair[0], v.snippet.channelTitle);
                if (!kw || kw.length < KEYWORD_MIN_LENGTH || kw.length > 30 || ENTITY_PLATFORM_PATTERN.test(kw)) return;
                if (BLOCKED_KEYWORD_PATTERN.test(kw) || BLOCKED_KEYWORD_PATTERN.test(v.snippet.title)) return;
                if (isBannedKeyword_(kw, banned)) return;
                if (seenCand[kw]) return;
                var nk = normalizeForMatch_(kw), similar = false;
                for (var c0 in seenCand) {
                    var nc = normalizeForMatch_(c0);
                    if (nk.length >= 3 && nc.length >= 3 && (nk.indexOf(nc) !== -1 || nc.indexOf(nk) !== -1)) { similar = true; break; }
                }
                if (similar) return;   // 'NCT WISH' vs 'NCT WISH 엔시티 위시' 같은 중복 → 보기 혼동 방지
                seenCand[kw] = true; extracted++;
                cands.push({ kw: kw, v: v, pair: pair, cat: cat, stale: !!(used[kw] && now - used[kw] < blockMs) });
            });
        } catch (e) { Logger.log('  ⚠️ 카테고리 ' + pair[0] + ' 차트 실패: ' + e.message); }
        stats.push(pair[0] + ': 영상 ' + fetched + '개 → 이름 ' + extracted + '개');
    });
    Logger.log('  🔍 차트 추출 — ' + stats.join(' / '));

    // 2단계: 새 키워드 먼저, 모자라면 최근 사용 키워드로 채움
    var out = [], taken = {}, staleUsed = 0;
    [false, true].forEach(function (staleRound) {
        cands.forEach(function (c) {
            if (out.length >= need || c.stale !== staleRound) return;
            if (haveKw[c.kw] || haveVid[c.v.id]) return;
            if ((taken[c.pair[0]] || 0) >= c.pair[1]) return;
            var cap = c.cat === 'gaming' ? KEYWORD_MAX_GAMING : KEYWORD_MAX_PER_CATEGORY;
            if ((counts[c.cat] || 0) >= cap) return;

            haveKw[c.kw] = true; haveVid[c.v.id] = true;
            counts[c.cat] = (counts[c.cat] || 0) + 1;
            taken[c.pair[0]] = (taken[c.pair[0]] || 0) + 1;
            if (c.stale) staleUsed++;
            var th = c.v.snippet.thumbnails;
            out.push({
                keyword: c.kw, videoId: c.v.id, title: c.v.snippet.title, category: c.cat,
                thumbnail: th && th.high ? th.high.url : 'https://i.ytimg.com/vi/' + c.v.id + '/hqdefault.jpg'
            });
            Logger.log('  ✓ 차트 "' + c.kw + '" [' + c.cat + '/' + c.pair[0] + ']' + (c.stale ? ' (최근 사용)' : '') + ' → ' + c.v.id);
        });
    });
    if (staleUsed) Logger.log('  ♻️ 최근 사용 키워드 ' + staleUsed + '개 재사용 (새 키워드 부족)');
    return out;
}

/** 오답 보기: 다른 키워드 중 겹치지 않는 3개 */
function buildKeywordOptions_(correctItem, items) {
    var correct = correctItem.keyword;
    var shuffle = function (arr) { return arr.sort(function () { return Math.random() - 0.5; }); };
    var others = items.filter(function (o) {
        var k = o.keyword;
        return k !== correct && k.indexOf(correct) === -1 && correct.indexOf(k) === -1;
    });
    // 같은 분야(음악은 음악끼리 등) 보기를 우선 써서 소거법으로 쉽게 풀리지 않게 함
    var same = shuffle(others.filter(function (o) { return o.category === correctItem.category; }));
    var diff = shuffle(others.filter(function (o) { return o.category !== correctItem.category; }));
    var pool = same.concat(diff).slice(0, 3).map(function (o) { return o.keyword; });
    if (pool.length < 3) return null;

    var choices = [correct].concat(pool).sort(function () { return Math.random() - 0.5; });
    var labels = ['A', 'B', 'C', 'D'];
    return choices.map(function (t, i) { return { id: labels[i], text: t, isCorrect: t === correct }; });
}

/** 키워드-영상 쌍 → "영상 보고 지금 화제의 검색어 맞추기" 퀴즈 */
function buildQuizFromKeywordVideos_(items) {
    if (!items || items.length < QUIZ_MIN_QUESTIONS) return null;
    Logger.log('🧩 핫 키워드 퀴즈 빌드 중...');

    var allKeywords = items.map(function (it) { return it.keyword; });
    var selected = items.slice().sort(function () { return Math.random() - 0.5; }).slice(0, QUIZ_TARGET_QUESTIONS);

    var questions = [];
    selected.forEach(function (it) {
        var options = buildKeywordOptions_(it, items);
        if (!options) return;
        questions.push({
            answer: it.keyword, hint: it.category, options: options,
            videoId: it.videoId, videoTitle: it.title, startTime: 5, endTime: 20
        });
    });
    if (questions.length < QUIZ_MIN_QUESTIONS) return null;

    var dateLabel = Utilities.formatDate(new Date(), 'Asia/Seoul', 'M월 d일');
    var titles = [
        '📈 {d} 실시간 급상승 검색어 퀴즈 — 영상 보고 키워드 맞추기',
        '지금 한국이 검색 중인 건? 🔥 {d} 핫 키워드 맞추기',
        '{d} 오늘의 화제 검색어, 영상만 보고 몇 개 맞출까? 🤔',
        '뉴스 안 봐도 아는 사람만 맞춘다 😎 {d} 인기 검색어 퀴즈'
    ];
    var title = pickRandom_(titles).replace('{d}', dateLabel);

    return {
        title: title,
        description: dateLabel + ' 기준으로 구글 트렌드에서 한국 사용자들이 가장 많이 검색한 키워드를 모아 만든 퀴즈입니다. ' +
            '각 문제에서는 해당 키워드와 관련된 실제 YouTube 영상 클립이 재생되고, 영상을 본 뒤 지금 화제가 되고 있는 검색어가 무엇인지 네 개의 보기 중에서 고르면 됩니다. ' +
            '스포츠 경기 결과, 연예·방송 소식, 새로 공개된 콘텐츠, 생활 이슈 등 분야를 가리지 않고 골고루 출제되며, 한 분야에 치우치지 않도록 주제 비율을 조절합니다. ' +
            '총 ' + questions.length + '문제로 구성되어 있고 매일 새로운 키워드로 자동 갱신됩니다. 평소 뉴스와 SNS를 얼마나 챙겨 보는지 친구들과 점수를 비교해 보세요.',
        questions: questions
    };
}

/** 키워드-영상 쌍 → "오늘의 화제 검색어 이상형 월드컵" */
function buildWorldcupFromKeywordVideos_(items) {
    if (!items || items.length < 8) return null;
    Logger.log('🏆 핫 키워드 월드컵 빌드 중...');

    var size = items.length >= 16 ? 16 : 8;   // 토너먼트는 8강/16강만 가능
    var selected = items.slice().sort(function () { return Math.random() - 0.5; }).slice(0, size);
    var wcItems = selected.map(function (it) {
        return { name: it.keyword, image_url: it.thumbnail || ('https://i.ytimg.com/vi/' + it.videoId + '/hqdefault.jpg') };
    });

    var dateLabel = Utilities.formatDate(new Date(), 'Asia/Seoul', 'M월 d일');
    var titles = [
        '{d} 가장 궁금한 이슈는? 🏆 급상승 검색어 월드컵',
        '오늘 제일 핫한 검색어 TOP1을 뽑아라 🔥 {d} 월드컵',
        '둘 중 더 끌리는 이슈는? 🤔 {d} 화제의 키워드 월드컵'
    ];
    return {
        title: pickRandom_(titles).replace('{d}', dateLabel),
        description: dateLabel + ' 구글 트렌드 인기 검색어 ' + wcItems.length + '개로 만든 이상형 월드컵입니다. ' +
            '두 키워드씩 맞붙는 토너먼트에서 더 관심이 가는 이슈를 계속 선택해 나가면 최종 우승 키워드가 정해집니다. ' +
            '결과는 다른 참여자들의 선택과 함께 집계되어, 오늘 사람들이 가장 궁금해한 주제가 무엇인지 한눈에 확인할 수 있습니다. ' +
            '후보에는 스포츠, 연예·방송, 새로 공개된 콘텐츠, 생활 이슈 등 다양한 분야의 키워드가 섞여 있고, 각 후보에는 관련 YouTube 영상의 대표 이미지가 함께 표시됩니다. ' +
            '친구들과 같은 월드컵을 하고 선택이 얼마나 다른지 비교해 보는 것도 재미있습니다. 매일 새로운 키워드로 자동 갱신되니 내일 다시 찾아와 새로운 이슈를 골라 보세요.',
        items: wcItems
    };
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

// ── 초안 등록 ──
// 콘텐츠는 DB에 직접 넣지 않는다. 워커의 /api/admin/drafts 가 품질 검증(src/quality/validate.js)을 한 뒤
// status='draft'로 저장하고, 관리자 대시보드에서 사람이 공개해야 사이트에 노출된다.
var WORKER_URL = 'https://quiz-platform-worker.rlaehrjs03.workers.dev';

function postDraft_(kind, draft, token) {
    var resp = UrlFetchApp.fetch(WORKER_URL + '/api/admin/drafts', {
        method: 'post', contentType: 'application/json',
        headers: { 'Authorization': 'Bearer ' + token },
        payload: JSON.stringify({ kind: kind, draft: draft, source: 'daily' }),
        muteHttpExceptions: true
    });
    var code = resp.getResponseCode();
    var body = {};
    try { body = JSON.parse(resp.getContentText()); } catch (e) { /* not json */ }
    if (code === 201) return body.id;
    if (code === 422) throw new Error('품질 검증 실패: ' + (body.errors || []).slice(0, 6).join(' / '));
    if (code === 429) throw new Error('검수 대기 초안이 너무 많음 (대시보드에서 먼저 처리)');
    throw new Error('초안 전송 실패(' + code + '): ' + resp.getContentText().substring(0, 200));
}

function insertQuizToDB_(data, token, userId) {
    Logger.log('📝 퀴즈 초안 전송: "' + data.title + '"');
    var draft = {
        title: data.title,
        description: data.description || '',
        questions: data.questions.map(function (q) {
            return {
                answer: q.answer, options: q.options, videoId: q.videoId,
                startTime: q.startTime != null ? q.startTime : 30,
                endTime: q.endTime != null ? q.endTime : 45
            };
        })
    };
    var id = postDraft_('quiz', draft, token);
    Logger.log('✅ 퀴즈 초안 등록(검수 대기): ' + id);
    return id;
}

function insertWorldcupToDB_(data, token, userId) {
    Logger.log('📝 월드컵 초안 전송: "' + data.title + '"');
    var draft = {
        title: data.title,
        description: data.description || '',
        items: data.items.map(function (item) { return { name: item.name, image_url: item.image_url }; })
    };
    var id = postDraft_('worldcup', draft, token);
    Logger.log('✅ 월드컵 초안 등록(검수 대기): ' + id + ' (' + draft.items.length + '개)');
    return id;
}

// ── 공개된 퀴즈의 영상 상태 점검 ──
// 삭제·비공개·임베드 금지된 영상이 문제에 남으면 플레이가 막힌다.
// 문제 단위로 is_embeddable=false 처리(플레이 API가 이미 제외함)하고, 남은 문제가 QUIZ_MIN_QUESTIONS 미만이면 퀴즈를 숨긴다.
// 쿼터: Videos.list 50개당 1 unit. 주 1회 실행 권장(setupWeeklyLinkCheckTrigger).
function sbPatch_(table, query, payload, token) {
    var resp = UrlFetchApp.fetch(SUPABASE_URL + '/rest/v1/' + table + '?' + query, {
        method: 'patch', contentType: 'application/json',
        headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': 'Bearer ' + token, 'Prefer': 'return=minimal' },
        payload: JSON.stringify(payload), muteHttpExceptions: true
    });
    if (resp.getResponseCode() >= 300) throw new Error('PATCH 실패(' + table + '): ' + resp.getContentText().substring(0, 200));
}

function checkPublishedVideos(dryRun) {
    var token = getSupabaseToken_().token;
    var quizzes = sbSelect_('quizzes', 'select=id,title&status=eq.published', token);
    var summary = { quizzes: quizzes.length, checked: 0, brokenQuestions: 0, hiddenQuizzes: 0 };

    quizzes.forEach(function (quiz) {
        var qs = sbSelect_('quiz_questions', 'select=id,video_id&quiz_id=eq.' + quiz.id + '&is_embeddable=neq.false', token);
        var ytQs = qs.filter(function (q) { return /^[\w-]{11}$/.test(q.video_id || ''); });   // 이미지(https) 문제는 제외
        if (ytQs.length === 0) return;

        var okIds = {};
        for (var i = 0; i < ytQs.length; i += 50) {
            var ids = ytQs.slice(i, i + 50).map(function (q) { return q.video_id; });
            var resp = YouTube.Videos.list('status', { id: ids.join(','), maxResults: 50 });
            (resp.items || []).forEach(function (it) {
                if (it.status && it.status.privacyStatus === 'public' && it.status.embeddable === true) okIds[it.id] = true;
            });
        }
        summary.checked += ytQs.length;

        var broken = ytQs.filter(function (q) { return !okIds[q.video_id]; });
        if (broken.length === 0) return;
        summary.brokenQuestions += broken.length;
        Logger.log('⚠️ "' + quiz.title + '": 재생 불가 ' + broken.length + '/' + ytQs.length + '개');

        var remaining = qs.length - broken.length;
        if (dryRun) { if (remaining < QUIZ_MIN_QUESTIONS) { summary.hiddenQuizzes++; Logger.log('   (dry-run) 남은 문제 ' + remaining + '개 → 숨김 대상'); } return; }

        for (var j = 0; j < broken.length; j += 40) {
            var chunk = broken.slice(j, j + 40).map(function (q) { return q.id; });
            sbPatch_('quiz_questions', 'id=in.(' + chunk.join(',') + ')', { is_embeddable: false }, token);
        }
        if (remaining < QUIZ_MIN_QUESTIONS) {
            sbPatch_('quizzes', 'id=eq.' + quiz.id, { status: 'hidden', hidden_reason: 'broken_video' }, token);
            summary.hiddenQuizzes++;
            Logger.log('   → 남은 문제 ' + remaining + '개라 퀴즈를 숨김 처리');
        }
    });

    Logger.log('🔗 영상 점검 완료' + (dryRun ? ' (dry-run, 변경 없음)' : '') + ': ' + JSON.stringify(summary));
    return summary;
}

/** 🧪 영상 점검 (변경 없이 결과만 확인) */
function testCheckPublishedVideos() { return checkPublishedVideos(true); }

/** 매주 월요일 새벽 4시에 영상 점검 실행 */
function setupWeeklyLinkCheckTrigger() {
    ScriptApp.getProjectTriggers().forEach(function (t) {
        if (t.getHandlerFunction() === 'checkPublishedVideos') ScriptApp.deleteTrigger(t);
    });
    ScriptApp.newTrigger('checkPublishedVideos').timeBased().onWeekDay(ScriptApp.WeekDay.MONDAY).atHour(4).create();
    Logger.log('✅ 매주 월요일 04시 영상 점검 트리거 설정 완료');
}


// ── 저장 용량 관리 ──
// 행 수를 세어 반환 (HEAD + Prefer: count=exact → Content-Range 헤더)
function sbCount_(table, query, token) {
    // GAS UrlFetchApp은 HEAD를 지원하지 않으므로 GET + limit=1 로 Content-Range 헤더만 활용
    var resp = UrlFetchApp.fetch(SUPABASE_URL + '/rest/v1/' + table + '?select=id&limit=1&' + query, {
        method: 'get',
        headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': 'Bearer ' + token, 'Prefer': 'count=exact' },
        muteHttpExceptions: true
    });
    var range = resp.getHeaders()['Content-Range'] || resp.getHeaders()['content-range'] || '';
    var m = String(range).match(/\/(\d+)$/);
    if (!m) throw new Error('COUNT 실패(' + table + ')');
    return parseInt(m[1], 10);
}

/**
 * 평소에는 아무것도 삭제하지 않고 현재 행 수만 보고한다.
 * 에이전트 콘텐츠가 CONTENT_MAX_ROWS를 넘을 때만 플레이 0회인 가장 오래된 것부터
 * CONTENT_TRIM_BATCH개씩 삭제한다. (사용자 생성/플레이된 콘텐츠는 건드리지 않음)
 * 반환: 로그 시트에 남길 상태 문자열
 */
function trimContentIfOverCap_(token, userId) {
    var parts = [];
    var tables = [['quizzes', '퀴즈'], ['worldcups', '월드컵']];
    for (var t = 0; t < tables.length; t++) {
        var table = tables[t][0], label = tables[t][1];
        var mine = 'creator_id=eq.' + userId;
        var total = sbCount_(table, mine, token);
        var removed = 0;

        if (total > CONTENT_MAX_ROWS) {
            var over = Math.min(total - CONTENT_MAX_ROWS, CONTENT_TRIM_BATCH);
            var old = sbSelect_(table, 'select=id&' + mine + '&play_count=eq.0&order=created_at.asc&limit=' + over, token);
            for (var i = 0; i < old.length && i < over; i++) { sbDelete_(table, 'id=eq.' + old[i].id, token); removed++; }
            Logger.log('🧹 ' + label + ' 상한 초과(' + total + '/' + CONTENT_MAX_ROWS + ') → ' + removed + '개 삭제');
        } else {
            Logger.log('📦 ' + label + ' ' + total + '/' + CONTENT_MAX_ROWS + ' (삭제 없음)');
        }
        parts.push(label + ' ' + (total - removed) + '/' + CONTENT_MAX_ROWS + (removed ? ' (-' + removed + ')' : ''));
    }
    return parts.join(', ');
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

/** 🧪 핫 키워드 퀴즈 빌드 테스트 (DB 저장 안 함, 검색 쿼터 사용 ≈ 1,600 units) */
function testKeywordQuiz() {
    var items = collectKeywordVideos_(KEYWORD_ITEM_TARGET, true);   // dry-run: 사용 이력 저장 안 함
    Logger.log('수집 ' + items.length + '개');
    var quiz = buildQuizFromKeywordVideos_(items);
    if (!quiz) { Logger.log('❌ 퀴즈 빌드 실패 (키워드 부족)'); return; }
    Logger.log('📋 ' + quiz.title);
    quiz.questions.forEach(function (q, i) {
        Logger.log('  Q' + (i + 1) + '. [' + q.videoId + '] 정답: ' + q.answer + ' / 보기: ' + q.options.map(function (o) { return o.text; }).join(' | '));
    });
    var wc = buildWorldcupFromKeywordVideos_(items);
    Logger.log('🏆 ' + (wc ? wc.title + ' (' + wc.items.length + '개)' : '월드컵 빌드 실패'));
}

/** 🔬 진단: 카테고리별 인기 차트의 실제 제목/채널과 현재 추출 결과를 그대로 출력 (DB 저장 없음, 카테고리당 1 unit) */
function testChartTitles() {
    ENTITY_CHART_CATEGORIES.forEach(function (pair) {
        try {
            var r = YouTube.Videos.list('snippet,status', { chart: 'mostPopular', regionCode: 'KR', videoCategoryId: pair[0], maxResults: 50 });
            var list = r.items || [];
            Logger.log('===== 카테고리 ' + pair[0] + ' (' + list.length + '개) =====');
            list.slice(0, 20).forEach(function (v, i) {
                var kw = extractEntityFromTitle_(v.snippet.title, pair[0], v.snippet.channelTitle);
                var emb = v.status && v.status.embeddable === false ? ' [임베드불가]' : '';
                Logger.log((i + 1) + '. ' + v.snippet.title + '  | 채널: ' + (v.snippet.channelTitle || '') + emb + '  → ' + (kw || '-'));
            });
        } catch (e) { Logger.log('카테고리 ' + pair[0] + ' 실패: ' + e.message); }
    });
}

/** 🧰 키워드 사용 이력 초기화 (테스트로 이력이 쌓였을 때) */
function resetUsedKeywords() {
    PropertiesService.getScriptProperties().deleteProperty(USED_KEYWORDS_PROP);
    Logger.log('✅ 키워드 사용 이력 초기화 완료');
}

/** ⏸ 일일 자동 실행 중단 (품질 게이트 도입 전까지 자동 공개 금지) */
function pauseDailyTrigger() {
    var removed = 0;
    ScriptApp.getProjectTriggers().forEach(function (t) {
        if (t.getHandlerFunction() === 'dailyAutoAgent') { ScriptApp.deleteTrigger(t); removed++; }
    });
    Logger.log('⏸ 일일 트리거 ' + removed + '개 삭제');
}

/** 현재 트리거 확인 */
function listTriggers() {
    var t = ScriptApp.getProjectTriggers();
    if (t.length === 0) { Logger.log('트리거 없음'); return; }
    t.forEach(function (tr, i) { Logger.log((i + 1) + '. ' + tr.getHandlerFunction()); });
}
