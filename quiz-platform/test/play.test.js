import test from 'node:test';
import assert from 'node:assert';
import { handlePlayStart } from '../src/routes/play.js';
import { handleThumbnail } from '../src/routes/thumb.js';
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
test('thumbnail endpoint decodes base64 and sets cache headers', async () => {
    const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
    const f = makeFake({ rows: { quizzes: [{ id: ID, status: 'published', thumbnail_url: 'data:image/png;base64,' + png.toString('base64') }] } });
    const res = await handleThumbnail(U(`/api/thumb/quiz/${ID}`), f.client);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.headers.get('Content-Type'), 'image/png');
    assert(/max-age=\d+/.test(res.headers.get('Cache-Control')));
    assert.deepStrictEqual(Buffer.from(await res.arrayBuffer()), png);
});

test('thumbnail endpoint: unknown kind 400, bad id 400, non-data/missing row 404', async () => {
    const f = makeFake({ rows: { quizzes: [{ id: ID, status: 'published', thumbnail_url: 'https://i.ytimg.com/x.jpg' }] } });
    assert.strictEqual((await handleThumbnail(U(`/api/thumb/user/${ID}`), f.client)).status, 400);
    assert.strictEqual((await handleThumbnail(U('/api/thumb/quiz/zzz'), f.client)).status, 400);
    assert.strictEqual((await handleThumbnail(U(`/api/thumb/quiz/${ID}`), f.client)).status, 404);
    assert.strictEqual((await handleThumbnail(U('/api/thumb/quiz/99999999-9999-9999-9999-999999999999'), f.client)).status, 404);
});

test('thumbnail endpoint only serves image/* data URIs', async () => {
    const f = makeFake({ rows: { quizzes: [{ id: ID, status: 'published', thumbnail_url: 'data:text/html;base64,PHNjcmlwdD4=' }] } });
    assert.strictEqual((await handleThumbnail(U(`/api/thumb/quiz/${ID}`), f.client)).status, 404);
});
