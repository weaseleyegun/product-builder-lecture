// ============================================================
//  QuizRank Auto Agent — Google Apps Script (All-in-One)
//  매일 새벽 자동으로 퀴즈/월드컵/티어리스트를 생성하는 에이전트
//  👉 이 파일 하나를 GAS 에디터에 복사-붙여넣기 하면 끝!
// ============================================================


// ======================== CONFIG =============================

var SUPABASE_URL = 'https://rdpdwtkhqizlcpeergrz.supabase.co';
var SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJkcGR3dGtocWl6bGNwZWVyZ3J6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE4NDYzMzIsImV4cCI6MjA4NzQyMjMzMn0.focF9Zyo53PtKZmX-zBZFSH8ijwr2w1K8RteXFWWIqk';
var AGENT_EMAIL = 'agent@quizrank.com';
var AGENT_PASSWORD = 'seed_password_1234!';

var GEMINI_API_KEY = 'AIzaSyBYJmhQC6dIXaPHCSQ8lNhaFymqLFJGdGA';
var GEMINI_MODEL = 'gemini-2.0-flash';
var GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models/';

var PIPED_INSTANCES = [
    'https://pipedapi.kavin.rocks',
    'https://api.piped.projectsegfault.com',
    'https://pipedapi.in.projectsegfault.com'
];

var TRENDS_RSS_URL = 'https://trends.google.co.kr/trending/rss?geo=KR';

var QUIZ_QUESTION_COUNT = 10;
var WORLDCUP_ITEM_COUNT = 16;
var TIERLIST_ITEM_COUNT = 16;
var CONTENT_CLEANUP_DAYS = 30;
var LOG_SHEET_NAME = 'AgentLog';


// ======================== MAIN PIPELINE ======================

/**
 * 📌 메인 파이프라인: 매일 새벽 자동 실행
 */
function dailyAutoAgent() {
    var startTime = new Date();
    var todayStr = Utilities.formatDate(startTime, 'Asia/Seoul', 'yyyy-MM-dd HH:mm');
    Logger.log('');
    Logger.log('==============================================');
    Logger.log('🚀 [' + todayStr + '] 일일 콘텐츠 에이전트 시작');
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

        // ── Step 1: 트렌드 키워드 수집 ──
        Logger.log('\n── Step 1: 트렌드 키워드 수집 ──');
        var keywords = fetchTrendingKeywords_();
        Logger.log('수집된 키워드: ' + keywords.slice(0, 5).join(', ') + '...');

        // ── Step 2: 퀴즈 생성 ──
        Logger.log('\n── Step 2: 퀴즈 생성 ──');
        try {
            var quizKeyword = pickKeyword_(keywords, 0);
            var quizContent = generateQuizContent_(quizKeyword);
            var validQuestions = batchSearchYouTubeForQuiz_(quizContent.questions);

            if (validQuestions.length >= 4) {
                quizContent.questions = validQuestions;
                var quizId = insertQuizToDB_(quizContent, token, userId);
                results.quiz = { status: '✅', title: quizContent.title, id: quizId };
            } else {
                Logger.log('⚠️ 유효한 퀴즈 문제가 4개 미만이라 스킵');
                results.quiz.status = '⚠️ 영상 부족';
            }
        } catch (e) {
            Logger.log('❌ 퀴즈 생성 실패: ' + e.message);
            results.quiz.status = '❌ ' + e.message.substring(0, 50);
        }

        // ── Step 3: 이상형 월드컵 생성 ──
        Logger.log('\n── Step 3: 이상형 월드컵 생성 ──');
        try {
            var wcKeyword = pickKeyword_(keywords, 1);
            var wcContent = generateWorldcupContent_(wcKeyword);
            wcContent.items = batchSearchYouTubeForImages_(wcContent.items);
            var wcId = insertWorldcupToDB_(wcContent, token, userId);
            results.worldcup = { status: '✅', title: wcContent.title, id: wcId };
        } catch (e) {
            Logger.log('❌ 월드컵 생성 실패: ' + e.message);
            results.worldcup.status = '❌ ' + e.message.substring(0, 50);
        }

        // ── Step 4: 티어 리스트 생성 ──
        Logger.log('\n── Step 4: 티어 리스트 생성 ──');
        try {
            var tierKeyword = pickKeyword_(keywords, 2);
            var tierContent = generateTierlistContent_(tierKeyword);
            tierContent.items = batchSearchYouTubeForImages_(tierContent.items);
            var tierId = insertWorldcupToDB_(tierContent, token, userId);
            results.tierlist = { status: '✅', title: tierContent.title, id: tierId };
        } catch (e) {
            Logger.log('❌ 티어 리스트 생성 실패: ' + e.message);
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


// ======================== TRENDS =============================

function fetchTrendingKeywords_() {
    Logger.log('📡 Google Trends RSS에서 인기 검색어 수집 중...');
    try {
        var resp = UrlFetchApp.fetch(TRENDS_RSS_URL, {
            muteHttpExceptions: true,
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
        });
        if (resp.getResponseCode() !== 200) return fetchTrendingFromGemini_();

        var doc = XmlService.parse(resp.getContentText());
        var channel = doc.getRootElement().getChild('channel');
        if (!channel) return fetchTrendingFromGemini_();

        var items = channel.getChildren('item');
        var kw = [];
        for (var i = 0; i < items.length && i < 20; i++) {
            var t = items[i].getChildText('title');
            if (t && t.trim()) kw.push(t.trim());
        }
        if (kw.length === 0) return fetchTrendingFromGemini_();
        Logger.log('✅ Trends에서 ' + kw.length + '개 키워드 수집');
        return kw;
    } catch (e) {
        Logger.log('⚠️ Trends RSS 실패: ' + e.message);
        return fetchTrendingFromGemini_();
    }
}

function fetchTrendingFromGemini_() {
    Logger.log('🤖 Gemini로 트렌드 키워드 추론 중...');
    var today = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd');
    var prompt = '오늘(' + today + ') 한국에서 가장 핫한 키워드 20개를 추천해줘.\n' +
        'K-POP, 드라마, 영화, 예능, 게임, 스포츠, 유튜버, 애니 등 다양하게.\n' +
        '반드시 { "keywords": ["키워드1", ...] } JSON으로 응답.';
    try {
        var parsed = JSON.parse(callGemini_(prompt));
        return parsed.keywords || [];
    } catch (e) {
        return ['K-POP 신곡', '인기 드라마', '화제의 유튜버', '인기 애니', 'LOL', '핫한 영화', '인기 아이돌', '인기 게임', '톱 예능'];
    }
}

function pickKeyword_(keywords, index) {
    if (!keywords || keywords.length === 0) return '한국 인기 콘텐츠';
    var shuffled = keywords.slice().sort(function () { return Math.random() - 0.5; });
    return shuffled[Math.min(index, shuffled.length - 1)];
}


// ======================== GEMINI ==============================

function callGemini_(prompt) {
    if (!prompt || String(prompt).trim().length === 0) {
        throw new Error('prompt가 비어있습니다. testRun()을 실행하세요.');
    }
    prompt = String(prompt);

    var url = GEMINI_BASE_URL + GEMINI_MODEL + ':generateContent?key=' + GEMINI_API_KEY;
    var resp = UrlFetchApp.fetch(url, {
        method: 'post',
        contentType: 'application/json',
        payload: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: 'application/json', temperature: 0.9 }
        }),
        muteHttpExceptions: true
    });

    if (resp.getResponseCode() !== 200) {
        throw new Error('Gemini HTTP ' + resp.getResponseCode() + ': ' + resp.getContentText().substring(0, 200));
    }
    return JSON.parse(resp.getContentText()).candidates[0].content.parts[0].text;
}

// ── 퀴즈 생성 ──
function generateQuizContent_(keyword) {
    Logger.log('🧠 퀴즈 생성: ' + keyword);
    var prompt = '퀴즈 플랫폼 콘텐츠 생성 전문가 AI.\n' +
        '트렌드: "' + keyword + '"\n' +
        '음악/영상 맞추기 퀴즈를 만들어라. 유튜브 영상을 듣고/보고 정답 맞추기.\n\n' +
        '🔥 모든 정답("answer")은 반드시 "공식 한국어 발매명" 단 하나로만.\n\n' +
        'JSON: { "title": "자극적 퀴즈 제목", "description": "이 퀴즈의 주제와 관련된 역사, 비하인드 스토리, 사람들의 반응 등을 포함하여 방문자가 글을 읽는 재미를 느낄 수 있도록 블로그 포스팅처럼 상세한 설명 (최소 300자 이상 텍스트)",\n' +
        '"questions": [{ "answer": "한국어 정답", "searchQuery": "유튜브 검색어", "hint": "힌트" }] }\n' +
        '총 ' + QUIZ_QUESTION_COUNT + '개, 중복 없이, 유명~보통까지 다양하게.';

    var parsed = JSON.parse(callGemini_(prompt));
    var allAnswers = parsed.questions.map(function (q) { return q.answer; });
    parsed.questions.forEach(function (q) { q.options = buildOptions_(q.answer, allAnswers); });
    Logger.log('✅ 퀴즈: "' + parsed.title + '" (' + parsed.questions.length + '문제)');
    return parsed;
}

function buildOptions_(correct, all) {
    var wrongs = all.filter(function (a) { return a !== correct; })
        .sort(function () { return Math.random() - 0.5; }).slice(0, 3);
    var choices = [correct].concat(wrongs).sort(function () { return Math.random() - 0.5; });
    var labels = ['A', 'B', 'C', 'D'];
    return choices.map(function (t, i) { return { id: labels[i], text: t, isCorrect: t === correct }; });
}

// ── 월드컵 생성 ──
function generateWorldcupContent_(keyword) {
    Logger.log('🧠 월드컵 생성: ' + keyword);
    var prompt = '이상형 월드컵 콘텐츠 전문가 AI.\n트렌드: "' + keyword + '"\n' +
        '이상형 월드컵 후보 ' + WORLDCUP_ITEM_COUNT + '개. 고민하면서 재미있게 선택할 수 있게.\n' +
        'JSON: { "title": "🏆 자극적 월드컵 제목", "description": "이 주제에 대한 역사적 배경, 인터넷 밈, 사람들의 평가, 참여하면 좋은 점 등을 포함하여 블로그 글처럼 길고 상세하게 작성된 설명 (최소 300자 이상 텍스트)",\n' +
        '"items": [{ "name": "후보 이름(한국어)", "searchQuery": "유튜브 이미지 검색어" }] }\n' +
        '총 ' + WORLDCUP_ITEM_COUNT + '개, 고유하게.';
    var parsed = JSON.parse(callGemini_(prompt));
    Logger.log('✅ 월드컵: "' + parsed.title + '" (' + parsed.items.length + '후보)');
    return parsed;
}

// ── 티어리스트 생성 ──
function generateTierlistContent_(keyword) {
    Logger.log('🧠 티어리스트 생성: ' + keyword);
    var month = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy년 M월');
    var prompt = '티어 리스트 콘텐츠 전문가 AI.\n트렌드: "' + keyword + '" (' + month + ')\n' +
        '유저가 S/A/B/C/D 등급 분류할 아이템 ' + TIERLIST_ITEM_COUNT + '개.\n' +
        'JSON: { "title": "📊 티어리스트 제목(시기 포함)", "description": "각 티어의 기준은 어떻게 나누는 것이 좋은지, 이 주제가 왜 현재 핫한지와 같은 상세한 오버뷰를 블로그 포스팅처럼 길게 설명 (최소 300자 이상 텍스트)",\n' +
        '"items": [{ "name": "항목 이름(한국어)", "searchQuery": "유튜브 이미지 검색어" }] }\n' +
        '총 ' + TIERLIST_ITEM_COUNT + '개, 고유하게.';
    var parsed = JSON.parse(callGemini_(prompt));
    Logger.log('✅ 티어: "' + parsed.title + '" (' + parsed.items.length + '항목)');
    return parsed;
}


// ======================== YOUTUBE (Piped) =====================

function searchYouTube_(query) {
    for (var i = 0; i < PIPED_INSTANCES.length; i++) {
        try {
            var url = PIPED_INSTANCES[i] + '/search?q=' + encodeURIComponent(query) + '&filter=videos';
            var resp = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
            if (resp.getResponseCode() !== 200) continue;

            var data = JSON.parse(resp.getContentText());
            var items = data.items || data;
            if (!items || items.length === 0) continue;

            for (var j = 0; j < items.length && j < 5; j++) {
                var vid = extractVideoId_(items[j].url || '');
                if (vid && items[j].title) {
                    return { videoId: vid, title: items[j].title, thumbnail: 'https://i.ytimg.com/vi/' + vid + '/hqdefault.jpg' };
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

function batchSearchYouTubeForQuiz_(questions) {
    Logger.log('🔍 YouTube 퀴즈 검색: ' + questions.length + '개...');
    var valid = [];
    for (var i = 0; i < questions.length; i++) {
        var q = questions[i];
        var yt = searchYouTube_(q.searchQuery);
        if (yt) {
            valid.push({ answer: q.answer, hint: q.hint || '', options: q.options, videoId: yt.videoId, videoTitle: yt.title });
            Logger.log('  ✓ ' + q.answer + ' → ' + yt.videoId);
        } else {
            Logger.log('  ✗ ' + q.answer);
        }
        Utilities.sleep(500);
    }
    Logger.log('✅ 퀴즈 매칭: ' + valid.length + '/' + questions.length);
    return valid;
}

function batchSearchYouTubeForImages_(items) {
    Logger.log('🖼️ YouTube 이미지 검색: ' + items.length + '개...');
    var result = [];
    for (var i = 0; i < items.length; i++) {
        var yt = searchYouTube_(items[i].searchQuery);
        result.push({ name: items[i].name, image_url: yt ? yt.thumbnail : null });
        Logger.log('  ' + (yt ? '✓' : '⚠') + ' ' + items[i].name);
        Utilities.sleep(500);
    }
    return result;
}


// ======================== SUPABASE ===========================

function getSupabaseToken_() {
    var resp = UrlFetchApp.fetch(SUPABASE_URL + '/auth/v1/token?grant_type=password', {
        method: 'post', contentType: 'application/json',
        headers: { 'apikey': SUPABASE_ANON_KEY },
        payload: JSON.stringify({ email: AGENT_EMAIL, password: AGENT_PASSWORD }),
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
    Logger.log('💾 월드컵/티어 적재: "' + data.title + '"');
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

/** 📅 매일 새벽 3시 트리거 설정 (1번만 실행하면 됨) */
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

/** 🧪 트렌드 수집만 테스트 */
function testTrends() {
    var kw = fetchTrendingKeywords_();
    kw.forEach(function (k, i) { Logger.log((i + 1) + '. ' + k); });
}

/** 🧪 YouTube 검색 테스트 */
function testYouTubeSearch() {
    Logger.log(JSON.stringify(searchYouTube_('BTS Dynamite MV')));
}

/** 🧪 Supabase 인증 테스트 */
function testSupabaseAuth() {
    var auth = getSupabaseToken_();
    Logger.log('✅ User ID: ' + auth.userId);
}

/** 🧪 Gemini API 테스트 */
function testGemini() {
    var r = callGemini_('한국에서 인기 있는 음식 3개를 { "foods": ["a","b","c"] } JSON으로 알려줘.');
    Logger.log('Gemini: ' + r);
}

/** 현재 트리거 확인 */
function listTriggers() {
    var t = ScriptApp.getProjectTriggers();
    if (t.length === 0) { Logger.log('트리거 없음'); return; }
    t.forEach(function (tr, i) { Logger.log((i + 1) + '. ' + tr.getHandlerFunction()); });
}
