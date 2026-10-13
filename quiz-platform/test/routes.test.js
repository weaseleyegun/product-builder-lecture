import test from 'node:test';
import assert from 'node:assert';
import { handleDailyQuiz, handleQuizPlay } from '../src/routes/quiz.js';
import { handleWorldcups, handleWorldcupPlay } from '../src/routes/worldcup.js';
import { handleSitemap } from '../src/helpers/sitemap.js';
import { makeFake } from './helpers.js';

const U = (path) => new URL('https://api.test' + path);
const QID = '11111111-1111-1111-1111-111111111111';

// ── 목록 ──────────────────────────────────────────────
test('quiz list reads only published rows, default page size 60', async () => {
    const f = makeFake({ rows: { quizzes: [] } });
    await handleDailyQuiz(U('/api/daily-quiz?sort=rank'), f.client);
    assert(f.log.includes('quizzes.eq:status=published'));
    assert(f.log.includes('quizzes.range:0-59'), f.log.join());
});

test('quiz list caps limit at 100 and honours offset', async () => {
    const f = makeFake({ rows: { quizzes: [] } });
    await handleDailyQuiz(U('/api/daily-quiz?limit=9999&offset=20'), f.client);
    assert(f.log.includes('quizzes.range:20-119'), f.log.join());
});

test('quiz list ignores garbage limit/offset', async () => {
    const f = makeFake({ rows: { quizzes: [] } });
    await handleDailyQuiz(U('/api/daily-quiz?limit=abc&offset=-5'), f.client);
    assert(f.log.includes('quizzes.range:0-59'), f.log.join());
});

test('base64 thumbnails are replaced by a thumb URL, normal URLs untouched', async () => {
    const f = makeFake({ rows: { quizzes: [
        { id: QID, title: 'a', status: 'published', thumbnail_url: 'data:image/png;base64,AAAA' },
        { id: '22222222-2222-2222-2222-222222222222', title: 'b', status: 'published', thumbnail_url: 'https://i.ytimg.com/x.jpg' },
    ] } });
    const body = await (await handleDailyQuiz(U('/api/daily-quiz'), f.client)).json();
    assert.strictEqual(body[0].thumbnail_url, `https://api.test/api/thumb/quiz/${QID}`);
    assert.strictEqual(body[1].thumbnail_url, 'https://i.ytimg.com/x.jpg');
});

test('worldcup list reads only published rows and pages', async () => {
    const f = makeFake({ rows: { worldcups: [] } });
    await handleWorldcups(U('/api/worldcups?limit=5&offset=10'), f.client);
    assert(f.log.includes('worldcups.eq:status=published'));
    assert(f.log.includes('worldcups.range:10-14'), f.log.join());
});

// ── 상세/플레이 ────────────────────────────────────────
test('quiz play: filters published, never increments play_count', async () => {
    const f = makeFake({ rows: {
        quizzes: [{ id: QID, slug: null, title: 't', status: 'published', play_count: 3 }],
        quiz_questions: [{ id: 'q1', quiz_id: QID, video_id: 'dQw4w9WgXcQ', answer: 'a', options: [], is_embeddable: true }],
    } });
    const res = await handleQuizPlay(U(`/api/quiz-play?id=${QID}&limit=5`), f.client);
    assert.strictEqual(res.status, 200);
    assert(f.log.includes('quizzes.eq:status=published'));
    assert(!f.log.some((l) => l.startsWith('rpc:')), 'no rpc: ' + f.log.join());
    assert(!f.log.some((l) => l.endsWith('.update')), 'no update: ' + f.log.join());
});

test('quiz play: hidden/unknown quiz is 404', async () => {
    const f = makeFake({ rows: { quizzes: [{ id: QID, status: 'hidden' }] } });
    const res = await handleQuizPlay(U(`/api/quiz-play?id=${QID}`), f.client);
    assert.strictEqual(res.status, 404);
});

test('quiz play strips base64 thumbnail from quiz info', async () => {
    const f = makeFake({ rows: { quizzes: [{ id: QID, status: 'published', thumbnail_url: 'data:image/png;base64,AAAA' }], quiz_questions: [] } });
    const body = await (await handleQuizPlay(U(`/api/quiz-play?id=${QID}`), f.client)).json();
    assert.strictEqual(body.quiz.thumbnail_url, `https://api.test/api/thumb/quiz/${QID}`);
});

test('worldcup play: published only, no increment, empty worldcup is 404', async () => {
    const WID = '33333333-3333-3333-3333-333333333333';
    const empty = makeFake({ rows: { worldcups: [{ id: WID, status: 'published' }], worldcup_items: [] } });
    assert.strictEqual((await handleWorldcupPlay(U(`/api/worldcup-play?id=${WID}`), empty.client)).status, 404);

    const ok = makeFake({ rows: {
        worldcups: [{ id: WID, status: 'published' }],
        worldcup_items: [{ id: 'i1', worldcup_id: WID, name: 'a' }, { id: 'i2', worldcup_id: WID, name: 'b' }],
    } });
    const res = await handleWorldcupPlay(U(`/api/worldcup-play?id=${WID}`), ok.client);
    assert.strictEqual(res.status, 200);
    assert(ok.log.includes('worldcups.eq:status=published'));
    assert(!ok.log.some((l) => l.startsWith('rpc:') || l.endsWith('.update')), ok.log.join());

    const hidden = makeFake({ rows: { worldcups: [{ id: WID, status: 'hidden' }], worldcup_items: [{ worldcup_id: WID }, { worldcup_id: WID }] } });
    assert.strictEqual((await handleWorldcupPlay(U(`/api/worldcup-play?id=${WID}`), hidden.client)).status, 404);
});

// ── 사이트맵 ───────────────────────────────────────────
test('sitemap lists only published rows on the real domain', async () => {
    const f = makeFake({ rows: {
        quizzes: [{ id: 'q-pub', slug: null, status: 'published', created_at: '2026-10-01T00:00:00Z' }, { id: 'q-hid', status: 'hidden', created_at: '2026-10-01T00:00:00Z' }],
        worldcups: [{ id: 'w-pub', slug: null, status: 'published', created_at: '2026-10-01T00:00:00Z' }, { id: 'w-hid', status: 'hidden', created_at: '2026-10-01T00:00:00Z' }],
    } });
    const xml = await (await handleSitemap(f.client)).text();
    assert(xml.includes('q-pub') && xml.includes('w-pub'));
    assert(!xml.includes('q-hid') && !xml.includes('w-hid'), 'hidden rows leaked into sitemap');
    assert(xml.includes('https://quiz-rank.com/') && !xml.includes('quizrank.pages.dev'));
});
