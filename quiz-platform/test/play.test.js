import test from 'node:test';
import assert from 'node:assert';
import { handlePlayStart } from '../src/routes/play.js';
import { handleThumbnail } from '../src/routes/thumb.js';
import { thumbnailPatch, handleUpdateQuiz } from '../src/routes/admin.js';
import { makeFake, req } from './helpers.js';

const ID = '11111111-1111-1111-1111-111111111111';
const U = (path) => new URL('https://api.test' + path);

// ── POST /api/play-start ──────────────────────────────
test('play-start registers a play once per session (rpc decides)', async () => {
    const seen = new Set();
    const f = makeFake({ rpc: { register_play: ({ p_type, p_id, p_session }) => { const k = [p_type, p_id, p_session].join('|'); if (seen.has(k)) return false; seen.add(k); return true; } } });
    const body = { type: 'quiz', id: ID, session: 'sess-1234567890' };
    const first = await (await handlePlayStart(req('POST', body), f.client)).json();
    const second = await (await handlePlayStart(req('POST', body), f.client)).json();
    assert.deepStrictEqual([first.counted, second.counted], [true, false]);
});

test('play-start passes exact rpc args', async () => {
    let got;
    const f = makeFake({ rpc: { register_play: (a) => { got = a; return true; } } });
    await handlePlayStart(req('POST', { type: 'worldcup', id: ID, session: 'abcdefgh12345678' }), f.client);
    assert.deepStrictEqual(got, { p_type: 'worldcup', p_id: ID, p_session: 'abcdefgh12345678' });
});

test('play-start rejects bad input with 400 and never calls rpc', async () => {
    const bad = [
        { type: 'user', id: ID, session: 'abcdefgh12345678' },
        { type: 'quiz', id: 'not-a-uuid', session: 'abcdefgh12345678' },
        { type: 'quiz', id: ID, session: 'short' },
        { type: 'quiz', id: ID, session: 'x'.repeat(200) },
        { type: 'quiz', id: ID },
    ];
    for (const b of bad) {
        const f = makeFake();
        const res = await handlePlayStart(req('POST', b), f.client);
        assert.strictEqual(res.status, 400, JSON.stringify(b));
        assert(!f.log.some((l) => l.startsWith('rpc:')));
    }
    const notJson = new Request('https://api.test/x', { method: 'POST', body: 'zzz' });
    assert.strictEqual((await handlePlayStart(notJson, makeFake().client)).status, 400);
});

// ── GET /api/thumb/:kind/:id ──────────────────────────
test('thumbnail endpoint decodes thumbnail_data and sets cache + CSP headers', async () => {
    const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
    const f = makeFake({ rows: { quizzes: [{ id: ID, status: 'published', thumbnail_url: null, thumbnail_data: 'data:image/png;base64,' + png.toString('base64') }] } });
    const res = await handleThumbnail(U(`/api/thumb/quiz/${ID}`), f.client);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.headers.get('Content-Type'), 'image/png');
    assert(/max-age=\d+/.test(res.headers.get('Cache-Control')));
    assert(/sandbox/.test(res.headers.get('Content-Security-Policy')));
    assert.strictEqual(res.headers.get('X-Content-Type-Options'), 'nosniff');
    assert.deepStrictEqual(Buffer.from(await res.arrayBuffer()), png);
});

test('thumbnail endpoint: unknown kind 400, bad id 400, plain-URL/missing row 404', async () => {
    const f = makeFake({ rows: { quizzes: [{ id: ID, status: 'published', thumbnail_url: 'https://i.ytimg.com/x.jpg' }] } });
    assert.strictEqual((await handleThumbnail(U(`/api/thumb/user/${ID}`), f.client)).status, 400);
    assert.strictEqual((await handleThumbnail(U('/api/thumb/quiz/zzz'), f.client)).status, 400);
    assert.strictEqual((await handleThumbnail(U(`/api/thumb/quiz/${ID}`), f.client)).status, 404);
    assert.strictEqual((await handleThumbnail(U('/api/thumb/quiz/99999999-9999-9999-9999-999999999999'), f.client)).status, 404);
});

test('thumbnail endpoint serves only png/jpeg/webp/gif (no svg, no html)', async () => {
    for (const mime of ['text/html', 'image/svg+xml', 'image/svg+xml;charset=utf-8']) {
        const f = makeFake({ rows: { quizzes: [{ id: ID, status: 'published', thumbnail_data: `data:${mime};base64,PHN2Zz48L3N2Zz4=` }] } });
        assert.strictEqual((await handleThumbnail(U(`/api/thumb/quiz/${ID}`), f.client)).status, 404, mime);
    }
    for (const mime of ['image/jpeg', 'image/webp', 'image/gif']) {
        const f = makeFake({ rows: { quizzes: [{ id: ID, status: 'published', thumbnail_data: `data:${mime};base64,AAAA` }] } });
        assert.strictEqual((await handleThumbnail(U(`/api/thumb/quiz/${ID}`), f.client)).status, 200, mime);
    }
});

test('thumbnail endpoint: malformed base64 is a 404, not a 500', async () => {
    const f = makeFake({ rows: { quizzes: [{ id: ID, status: 'published', thumbnail_data: 'data:image/png;base64,@@@@' }] } });
    assert.strictEqual((await handleThumbnail(U(`/api/thumb/quiz/${ID}`), f.client)).status, 404);
});

test('thumbnail endpoint still serves legacy data: URIs stored in thumbnail_url', async () => {
    const f = makeFake({ rows: { quizzes: [{ id: ID, status: 'published', thumbnail_url: 'data:image/png;base64,AAAA' }] } });
    assert.strictEqual((await handleThumbnail(U(`/api/thumb/quiz/${ID}`), f.client)).status, 200);
});

// ── 관리자 수정: 썸네일 왕복 시 데이터 손실 방지 ──────────────
test('thumbnailPatch: untouched thumb URL / missing value keep the stored image', () => {
    assert.deepStrictEqual(thumbnailPatch(`https://api.test/api/thumb/quiz/${ID}`), {});
    assert.deepStrictEqual(thumbnailPatch(`https://x.workers.dev/api/thumb/worldcup/${ID}`), {});
    assert.deepStrictEqual(thumbnailPatch(undefined), {});
    assert.deepStrictEqual(thumbnailPatch(null), {});
    assert.deepStrictEqual(thumbnailPatch(123), {});
});

test('thumbnailPatch: new URL replaces, empty string clears both url and data', () => {
    assert.deepStrictEqual(thumbnailPatch('https://i.ytimg.com/a.jpg'), { thumbnail_url: 'https://i.ytimg.com/a.jpg' });
    assert.deepStrictEqual(thumbnailPatch('  '), { thumbnail_url: null, thumbnail_data: null });
});

test('admin quiz update never overwrites the stored thumbnail with its own thumb URL', async () => {
    const f = makeFake({ rows: { quizzes: [{ id: ID, creator_id: 'someone', status: 'published' }] } });
    const request = new Request(`https://api.test/api/admin/quiz/${ID}`, { method: 'PUT', headers: { Authorization: 'Bearer t', 'Content-Type': 'application/json' }, body: JSON.stringify({ title: '새 제목', description: 'd', thumbnail_url: `https://api.test/api/thumb/quiz/${ID}` }) });
    const res = await handleUpdateQuiz(request, new URL(`https://api.test/api/admin/quiz/${ID}`), f.client, { ADMIN_PASSWORD: 'x', ADMIN_EMAIL: 'agent@quizrank.com' });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(f.updates.length, 1);
    assert.deepStrictEqual(Object.keys(f.updates[0].payload).sort(), ['description', 'title']);
});
