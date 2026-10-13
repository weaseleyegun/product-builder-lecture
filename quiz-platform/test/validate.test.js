import test from 'node:test';
import assert from 'node:assert';
import { validateQuizDraft, validateWorldcupDraft, jaccard3, normalize } from '../src/quality/validate.js';

const long = '가'.repeat(310);
const q = (answer, texts, extra = {}) => ({
    answer, videoId: 'dQw4w9WgXcQ', startTime: 5, endTime: 20,
    options: texts.map((t, i) => ({ id: 'ABCD'[i], text: t, isCorrect: t === answer })), ...extra,
});
const goodQuiz = () => ({
    title: '오늘의 K-POP 아티스트 맞추기', description: long,
    questions: Array.from({ length: 6 }, (_, i) => q(`가수${i}`, [`가수${i}`, `다른A${i}`, `다른B${i}`, `다른C${i}`])),
});
const ctx = { existingTitles: [], existingDescriptions: [] };
const errs = (d, c = ctx) => validateQuizDraft(d, c).errors;

// ── 퀴즈 ──────────────────────────────────────────────
test('good quiz passes', () => assert.deepStrictEqual(errs(goodQuiz()), []));

test('generic noun answer is rejected (재미/축구/사이다 …)', () => {
    for (const bad of ['재미', '축구', '사이다', '선행']) {
        const d = goodQuiz(); d.questions[0] = q(bad, [bad, '가나다라', '마바사아', '자차카타']);
        assert(errs(d).some((e) => e.includes('generic')), bad);
    }
});

test('answer shorter than 2 chars is rejected', () => {
    const d = goodQuiz(); d.questions[0] = q('놀', ['놀', '가나다라', '마바사아', '자차카타']);
    assert(errs(d).some((e) => e.includes('generic')));
});

test('options containing each other are rejected (NCT WISH vs NCT WISH 엔시티 위시)', () => {
    const d = goodQuiz(); d.questions[0] = q('NCT WISH', ['NCT WISH', 'NCT WISH 엔시티 위시', 'AAAA', 'BBBB']);
    assert(errs(d).some((e) => e.includes('overlap')));
});

test('options must be 4 distinct with exactly one correct', () => {
    const d = goodQuiz(); d.questions[0] = q('가수0', ['가수0', '가수0', 'XX1', 'XX2']);
    assert(errs(d).some((e) => e.includes('options')));
    const d2 = goodQuiz(); d2.questions[1].options[1].isCorrect = true;
    assert(errs(d2).some((e) => e.includes('정답 1개')));
});

test('description must be 300~1200 chars', () => {
    const d = goodQuiz(); d.description = '짧다';
    assert(errs(d).some((e) => e.includes('description')));
    d.description = '가'.repeat(1300);
    assert(errs(d).some((e) => e.includes('description')));
});

test('near-duplicate description is rejected (templated content)', () => {
    const d = goodQuiz();
    const c = { existingTitles: [], existingDescriptions: [d.description] };
    assert(errs(d, c).some((e) => e.includes('duplicate_description')));
    // 날짜만 다른 템플릿 설명도 걸린다
    const tpl = (n) => `10월 ${n}일 기준으로 구글 트렌드에서 한국 사용자들이 가장 많이 검색한 키워드를 모아 만든 퀴즈입니다. 각 문제에서는 관련 영상이 재생되고 네 개의 보기 중에서 고르면 됩니다. `.repeat(3);
    const d2 = goodQuiz(); d2.description = tpl(13);
    assert(errs(d2, { existingTitles: [], existingDescriptions: [tpl(12)] }).some((e) => e.includes('duplicate_description')));
});

test('clearly different description passes the duplicate check', () => {
    const d = goodQuiz(); d.description = '안녕하세요반갑습니다오늘도좋은하루되세요'.repeat(20);
    const other = '전혀다른문장으로작성된아주긴설명입니다만내용은완전히다릅니다'.repeat(12);
    assert.deepStrictEqual(errs(d, { existingTitles: [], existingDescriptions: [other] }), []);
});

test('duplicate title is rejected (normalized)', () => {
    const d = goodQuiz();
    assert(errs(d, { existingTitles: [d.title.toUpperCase() + ' !'], existingDescriptions: [] }).some((e) => e.includes('duplicate_title')));
});

test('title length 8~60', () => {
    const d = goodQuiz(); d.title = '짧은제목';
    assert(errs(d).some((e) => e.includes('title')));
    d.title = '가'.repeat(61);
    assert(errs(d).some((e) => e.includes('title')));
});

test('invalid youtube id / bad clip range rejected; https image id allowed', () => {
    const d = goodQuiz(); d.questions[0].videoId = 'x'; d.questions[1].endTime = 6;
    const e = errs(d);
    assert(e.some((x) => x.includes('video_id'))); assert(e.some((x) => x.includes('clip')));
    const d2 = goodQuiz(); d2.questions[0].videoId = 'https://cdn.myanimelist.net/images/a.jpg';
    assert.deepStrictEqual(errs(d2), []);
});

test('question count must be 6~30', () => {
    const d = goodQuiz(); d.questions = d.questions.slice(0, 5);
    assert(errs(d).some((e) => e.includes('questions')));
});

test('blocked sensitive words in title or answers are rejected', () => {
    const d = goodQuiz(); d.title = '대통령 탄핵 퀴즈 맞추기 도전';
    assert(!validateQuizDraft(d, ctx).ok);
    const d2 = goodQuiz(); d2.questions[0] = q('삼성전기 주가', ['삼성전기 주가', '가나다라', '마바사아', '자차카타']);
    assert(errs(d2).some((e) => e.includes('blocked')));
});

test('blocked words inside the long description alone do not reject (프로즈에 우연히 포함 가능)', () => {
    const d = goodQuiz(); d.description = ('사고하는 힘을 기르는 퀴즈입니다. ' + '나'.repeat(300));
    assert.deepStrictEqual(errs(d), []);
});

test('malformed drafts do not throw', () => {
    for (const bad of [{}, { title: 1 }, { questions: 'x' }, null, undefined]) {
        assert.doesNotThrow(() => validateQuizDraft(bad, ctx));
        assert.strictEqual(validateQuizDraft(bad, ctx).ok, false);
    }
    assert.strictEqual(validateWorldcupDraft(undefined, ctx).ok, false);
});

// ── 월드컵 ────────────────────────────────────────────
const wcItems = (n, host = 'i.ytimg.com') => Array.from({ length: n }, (_, i) => ({ name: `후보${i}번`, image_url: `https://${host}/vi/${i}/hq.jpg` }));
const wc = (items) => ({ title: '테스트 월드컵 제목입니다', description: long, items });

test('worldcup with 8/16/32/64 valid items passes', () => {
    for (const n of [8, 16, 32, 64]) assert.deepStrictEqual(validateWorldcupDraft(wc(wcItems(n)), ctx).errors, [], String(n));
});

test('worldcup size must be 8/16/32/64', () => {
    for (const n of [0, 7, 9, 12, 65]) assert(validateWorldcupDraft(wc(wcItems(n)), ctx).errors.some((e) => e.includes('size')), String(n));
});

test('worldcup names must be unique (normalized) and not generic', () => {
    const items = wcItems(8); items[1].name = '  후보0번 '; items[2].name = '재미';
    const e = validateWorldcupDraft(wc(items), ctx).errors;
    assert(e.some((x) => x.includes('duplicate_item'))); assert(e.some((x) => x.includes('generic_name')));
});

test('worldcup image must be https on an allowed host', () => {
    const items = wcItems(8);
    items[0].image_url = 'http://i.ytimg.com/a.jpg';        // http
    items[1].image_url = 'https://evil.example.com/a.jpg';  // 허용 안 된 도메인
    items[2].image_url = 'javascript:alert(1)';             // 위험 스킴
    items[3].image_url = 'not a url';
    items[4].image_url = '';
    const e = validateWorldcupDraft(wc(items), ctx).errors.filter((x) => x.includes('image_url'));
    assert.strictEqual(e.length, 5, e.join());
});

test('worldcup shares title/description rules', () => {
    const d = wc(wcItems(8)); d.description = '짧음';
    assert(validateWorldcupDraft(d, ctx).errors.some((e) => e.includes('description')));
    const d2 = wc(wcItems(8));
    assert(validateWorldcupDraft(d2, { existingTitles: [d2.title], existingDescriptions: [] }).errors.some((e) => e.includes('duplicate_title')));
});

// ── 유틸 ──────────────────────────────────────────────
test('normalize / jaccard3', () => {
    assert.strictEqual(normalize(' A-b c! 가나 '), 'abc가나');
    assert.strictEqual(jaccard3(normalize('abcdefg'), normalize('abcdefg')), 1);
    assert(jaccard3(normalize('안녕하세요반갑습니다'), normalize('전혀다른문장입니다만')) < 0.3);
    assert.strictEqual(jaccard3('', ''), 1);
    assert.strictEqual(jaccard3('ab', 'cd'), 0);
});

// ── 리뷰 반영: 정답/보기 일치, 타입, 길이, 유니코드 회피 ───────────────
test('answer must equal the correct option text', () => {
    const d = goodQuiz(); d.questions[0].answer = '가수0'; d.questions[0].options[0].text = '완전다른이름';
    d.questions[0].options[0].isCorrect = true;
    assert(errs(d).some((e) => e.includes('answer_mismatch')));
});

test('time values must be non-negative integers (null / string / negative / fractional rejected)', () => {
    for (const [s, e] of [[null, 20], ['5', 20], [-20, 0], [5.5, 20], [5, null], [5, '20'], [5, Infinity], [NaN, 20]]) {
        const d = goodQuiz(); d.questions[0].startTime = s; d.questions[0].endTime = e;
        assert(errs(d).some((x) => x.includes('clip')), JSON.stringify([s, e]));
    }
});

test('non-string answer / option text / videoId do not throw and are rejected', () => {
    const d = goodQuiz();
    d.questions[0].answer = ['가수0'];
    d.questions[1].options[0].text = 123;
    d.questions[2].videoId = ['dQw4w9WgXcQ'];
    assert.doesNotThrow(() => validateQuizDraft(d, ctx));
    assert.strictEqual(validateQuizDraft(d, ctx).ok, false);
});

test('length caps: answer, option text, worldcup name, image url', () => {
    const d = goodQuiz(); const big = '가'.repeat(61);
    d.questions[0] = q(big, [big, 'AA11', 'BB22', 'CC33']);
    assert(errs(d).some((e) => e.includes('length')));
    const items = wcItems(8); items[0].name = big; items[1].image_url = 'https://i.ytimg.com/' + 'a'.repeat(600);
    const e = validateWorldcupDraft(wc(items), ctx).errors;
    assert(e.some((x) => x.includes('length'))); assert(e.some((x) => x.includes('image_url')));
});

test('image question urls must be https on an allowed host', () => {
    const d = goodQuiz(); d.questions[0].videoId = 'https://evil.example.com/a.jpg';
    assert(errs(d).some((e) => e.includes('video_id')));
    const ok = goodQuiz(); ok.questions[0].videoId = 'https://cdn.myanimelist.net/images/a.jpg';
    assert.deepStrictEqual(errs(ok), []);
});

test('blocked words are caught in option texts too', () => {
    const d = goodQuiz(); d.questions[0].options[1].text = '삼성전기 주가';
    assert(errs(d).some((e) => e.includes('blocked')));
});

test('zero-width characters and decomposed Hangul cannot evade the blocked-word / duplicate checks', () => {
    const d = goodQuiz(); d.title = '사\u200b망 퀴즈 맞추기 도전하기';
    assert(errs(d).some((e) => e.includes('blocked')), 'zero-width');
    const d2 = goodQuiz(); d2.title = '대통령 퀴즈 맞추기 도전하기'.normalize('NFD');
    assert(errs(d2).some((e) => e.includes('blocked')), 'NFD hangul');
    const d3 = goodQuiz(); const t = '오늘의 한국 노래 퀴즈 도전';
    const c = { existingTitles: [t.normalize('NFD')], existingDescriptions: [] };
    d3.title = t;
    assert(errs(d3, c).includes('duplicate_title'), 'NFD duplicate title');
});

test('non-Korean names (Japanese/Chinese/Cyrillic) are valid worldcup items and normalize non-empty', () => {
    const names = ['鬼滅の刃', 'ナルト', '进击的巨人', 'Привет', 'Pokémon', '葬送のフリーレン', 'ワンピース', 'ドラゴンボール'];
    const items = names.map((n, i) => ({ name: n, image_url: `https://cdn.myanimelist.net/images/${i}.jpg` }));
    assert.deepStrictEqual(validateWorldcupDraft(wc(items), ctx).errors, []);
    assert.notStrictEqual(normalize('鬼滅の刃'), '');
    assert.strictEqual(normalize('한글'.normalize('NFD')), normalize('한글'));
});
