import test from 'node:test';
import assert from 'node:assert';
import { handleDrafts } from '../src/routes/drafts.js';
import { makeFake } from './helpers.js';

const ENV = { SUPABASE_URL: 'https://x.supabase.co', SUPABASE_ANON_KEY: 'anon', ADMIN_EMAIL: 'agent@quizrank.com' };
const long = '이'.repeat(320);
const QID = '11111111-1111-1111-1111-111111111111';

const goodQuiz = () => ({
    title: '오늘의 K-POP 아티스트 맞추기 퀴즈', description: long,
    questions: Array.from({ length: 6 }, (_, i) => ({
        answer: `가수${i}`, videoId: 'dQw4w9WgXcQ', startTime: 5, endTime: 20,
        options: [`가수${i}`, `다른A${i}`, `다른B${i}`, `다른C${i}`].map((t, k) => ({ id: 'ABCD'[k], text: t, isCorrect: k === 0 })),
    })),
});
const goodWorldcup = () => ({
    title: '이 중 최고를 골라 월드컵', description: long,
    items: Array.from({ length: 8 }, (_, i) => ({ name: `후보${i}번`, image_url: `https://i.ytimg.com/vi/${i}/hq.jpg` })),
});

// anon 클라이언트(인증 확인용)와 관리자 토큰 클라이언트(DB 작업용)를 분리해서 주입한다.
function run(method, path, body, { anon = {}, db = {}, token = 'tok', headers = {} } = {}) {
    const a = makeFake(anon);
    const d = makeFake(db);
    const request = new Request('https://api.test' + path, {
        method,
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
        body: body === undefined ? undefined : (typeof body === 'string' ? body : JSON.stringify(body)),
    });
    return handleDrafts(request, new URL(request.url), a.client, ENV, { makeClient: () => d.client }).then((res) => ({ res, anon: a, db: d }));
}

// ── 인증 ──────────────────────────────────────────────
test('no token → 401, non-admin → 403, nothing touches the DB', async () => {
    let r = await run('GET', '/api/admin/drafts', undefined, { token: null });
    assert.strictEqual(r.res.status, 401);
    r = await run('POST', '/api/admin/drafts', { kind: 'quiz', draft: goodQuiz() }, { anon: { user: { id: 'u', email: 'someone@else.com' } } });
    assert.strictEqual(r.res.status, 403);
    assert.strictEqual(r.db.inserts.length, 0);
    r = await run('GET', '/api/admin/drafts', undefined, { anon: { user: null } });
    assert.strictEqual(r.res.status, 401);
});

// ── 등록 ──────────────────────────────────────────────
test('valid quiz draft → 201, stored as draft with snake_case question rows', async () => {
    const { res, db } = await run('POST', '/api/admin/drafts', { kind: 'quiz', draft: goodQuiz() }, { db: { insertReturns: { quizzes: [{ id: QID }] } } });
    assert.strictEqual(res.status, 201);
    assert.deepStrictEqual(await res.json(), { id: QID, kind: 'quiz' });
    const parent = db.inserts.find((i) => i.table === 'quizzes').payload;
    const p = Array.isArray(parent) ? parent[0] : parent;
    assert.strictEqual(p.status, 'draft'); assert.strictEqual(p.source, 'daily'); assert.strictEqual(p.creator_id, 'admin-id');
    const kids = db.inserts.find((i) => i.table === 'quiz_questions').payload;
    assert.strictEqual(kids.length, 6);
    assert.deepStrictEqual(Object.keys(kids[0]).sort(), ['answer', 'end_time', 'is_embeddable', 'options', 'quiz_id', 'start_time', 'video_id']);
    assert.strictEqual(kids[0].quiz_id, QID); assert.strictEqual(kids[0].video_id, 'dQw4w9WgXcQ'); assert.strictEqual(kids[0].start_time, 5);
});

test('valid worldcup draft → 201, items inserted with worldcup_id', async () => {
    const WID = '22222222-2222-2222-2222-222222222222';
    const { res, db } = await run('POST', '/api/admin/drafts', { kind: 'worldcup', draft: goodWorldcup() }, { db: { insertReturns: { worldcups: [{ id: WID }] } } });
    assert.strictEqual(res.status, 201);
    const kids = db.inserts.find((i) => i.table === 'worldcup_items').payload;
    assert.strictEqual(kids.length, 8); assert.deepStrictEqual(Object.keys(kids[0]).sort(), ['image_url', 'name', 'worldcup_id']); assert.strictEqual(kids[0].worldcup_id, WID);
});

test('invalid draft → 422 with reasons and NOTHING is inserted', async () => {
    const d = goodQuiz(); d.questions[0].answer = '재미'; d.questions[0].options[0].text = '재미';
    const { res, db } = await run('POST', '/api/admin/drafts', { kind: 'quiz', draft: d });
    assert.strictEqual(res.status, 422);
    const body = await res.json();
    assert(body.errors.some((e) => e.includes('generic')));
    assert.strictEqual(db.inserts.length, 0);
});

test('duplicate title/description against existing rows (any status) → 422', async () => {
    const d = goodQuiz();
    const existing = [{ title: d.title, description: d.description, status: 'hidden' }];
    const { res, db } = await run('POST', '/api/admin/drafts', { kind: 'quiz', draft: d }, { db: { rows: { quizzes: existing } } });
    assert.strictEqual(res.status, 422);
    const e = (await res.json()).errors;
    assert(e.includes('duplicate_title')); assert(e.some((x) => x.startsWith('duplicate_description')));
    assert.strictEqual(db.inserts.length, 0);
});

test('too many pending drafts → 429 (review queue flood guard)', async () => {
    const pending = Array.from({ length: 30 }, (_, i) => ({ id: `d${i}`, status: 'draft', title: `t${i}`, description: `x${i}` }));
    const { res, db } = await run('POST', '/api/admin/drafts', { kind: 'quiz', draft: goodQuiz() }, { db: { rows: { quizzes: pending } } });
    assert.strictEqual(res.status, 429);
    assert.strictEqual(db.inserts.length, 0);
});

test('bad kind / malformed body → 400', async () => {
    assert.strictEqual((await run('POST', '/api/admin/drafts', { kind: 'tier', draft: goodQuiz() })).res.status, 400);
    assert.strictEqual((await run('POST', '/api/admin/drafts', { kind: 'quiz' })).res.status, 400);
    assert.strictEqual((await run('POST', '/api/admin/drafts', 'not json')).res.status, 400);
    assert.strictEqual((await run('POST', '/api/admin/drafts', { kind: 'quiz', draft: 'x' })).res.status, 400);
});

test('child insert failure hides the parent (no half-built draft left reviewable) and returns 500', async () => {
    const { res, db } = await run('POST', '/api/admin/drafts', { kind: 'quiz', draft: goodQuiz() }, { db: { insertErrors: { quiz_questions: { message: 'boom' } } } });
    assert.strictEqual(res.status, 500);
    const upd = db.updates.find((u) => u.table === 'quizzes');
    assert(upd, 'parent must be updated');
    assert.strictEqual(upd.payload.status, 'hidden'); assert.strictEqual(upd.payload.hidden_reason, 'insert_failed');
});

// ── 목록 ──────────────────────────────────────────────
test('GET lists drafts of both kinds with a preview', async () => {
    const rows = {
        quizzes: [{ id: QID, status: 'draft', title: 'Q', description: 'd', source: 'daily', created_at: '2026-10-13', quiz_questions: [{ answer: 'a' }, { answer: 'b' }] }, { id: 'x', status: 'published', title: 'pub' }],
        worldcups: [{ id: 'w1', status: 'draft', title: 'W', description: 'd', source: 'daily', created_at: '2026-10-13', worldcup_items: [{ name: 'n1' }] }],
    };
    const { res } = await run('GET', '/api/admin/drafts', undefined, { db: { rows } });
    assert.strictEqual(res.status, 200);
    const { drafts } = await res.json();
    assert.deepStrictEqual(drafts.map((d) => [d.kind, d.id]).sort(), [['quiz', QID], ['worldcup', 'w1']]);
    assert.deepStrictEqual(drafts.find((d) => d.kind === 'quiz').preview, ['a', 'b']);
    assert.strictEqual(drafts.find((d) => d.kind === 'quiz').count, 2);
});

// ── 공개 / 반려 ───────────────────────────────────────
test('publish → status published + published_at; only drafts can be published', async () => {
    const rows = { quizzes: [{ id: QID, status: 'draft', quiz_questions: [{ count: 6 }] }] };
    const ok = await run('POST', `/api/admin/drafts/quiz/${QID}/publish`, undefined, { db: { rows } });
    assert.strictEqual(ok.res.status, 200);
    const p = ok.db.updates[0].payload;
    assert.strictEqual(p.status, 'published'); assert(/^\d{4}-\d\d-\d\dT/.test(p.published_at));
    assert(ok.db.log.includes('quizzes.eq:status=draft'), 'must guard on status=draft');

    const already = await run('POST', `/api/admin/drafts/quiz/${QID}/publish`, undefined, { db: { rows: { quizzes: [{ id: QID, status: 'published', quiz_questions: [{ count: 6 }] }] } } });
    assert.strictEqual(already.res.status, 404);
    const bad = await run('POST', '/api/admin/drafts/quiz/not-a-uuid/publish');
    assert.strictEqual(bad.res.status, 400);
    const badKind = await run('POST', `/api/admin/drafts/tier/${QID}/publish`);
    assert.strictEqual(badKind.res.status, 400);
});

test('reject requires a reason and hides the draft', async () => {
    const rows = { quizzes: [{ id: QID, status: 'draft' }] };
    const none = await run('POST', `/api/admin/drafts/quiz/${QID}/reject`, {}, { db: { rows } });
    assert.strictEqual(none.res.status, 400);
    assert.strictEqual(none.db.updates.length, 0);
    const long201 = await run('POST', `/api/admin/drafts/quiz/${QID}/reject`, { reason: 'x'.repeat(201) }, { db: { rows } });
    assert.strictEqual(long201.res.status, 400);
    const ok = await run('POST', `/api/admin/drafts/quiz/${QID}/reject`, { reason: '정답이 모호함' }, { db: { rows } });
    assert.strictEqual(ok.res.status, 200);
    assert.strictEqual(ok.db.updates[0].payload.status, 'hidden');
    assert.strictEqual(ok.db.updates[0].payload.hidden_reason, 'rejected: 정답이 모호함');
});

test('unknown draft route → 404', async () => {
    assert.strictEqual((await run('GET', '/api/admin/drafts/whatever/zzz')).res.status, 404);
    assert.strictEqual((await run('DELETE', '/api/admin/drafts')).res.status, 405);
});

// ── 리뷰 반영 ─────────────────────────────────────────
test('kind must be a plain string: arrays and prototype keys are rejected before any DB write', async () => {
    for (const kind of [['quiz'], { toString: () => 'quiz' }, '__proto__', 'constructor', 'toString', 7, null]) {
        const { res, db } = await run('POST', '/api/admin/drafts', { kind, draft: goodQuiz() });
        assert.strictEqual(res.status, 400, JSON.stringify(kind));
        assert.strictEqual(db.inserts.length, 0);
    }
    // URL 경로의 kind도 마찬가지
    for (const kind of ['__proto__', 'constructor']) {
        assert.strictEqual((await run('POST', `/api/admin/drafts/${kind}/${QID}/publish`)).res.status, 400, kind);
    }
});

test('publish refuses a draft with no (or too few) children', async () => {
    for (const kids of [[], [{ count: 0 }], [{ count: 2 }]]) {
        const r = await run('POST', `/api/admin/drafts/quiz/${QID}/publish`, undefined, { db: { rows: { quizzes: [{ id: QID, status: 'draft', quiz_questions: kids }] } } });
        assert.strictEqual(r.res.status, 409, JSON.stringify(kids));
        assert(!r.db.updates.some((u) => u.payload.status === 'published'));
    }
    const WID = '22222222-2222-2222-2222-222222222222';
    const bad = await run('POST', `/api/admin/drafts/worldcup/${WID}/publish`, undefined, { db: { rows: { worldcups: [{ id: WID, status: 'draft', worldcup_items: [{ count: 9 }] }] } } });
    assert.strictEqual(bad.res.status, 409, 'worldcup size must be 8/16/32/64');
    const good = await run('POST', `/api/admin/drafts/worldcup/${WID}/publish`, undefined, { db: { rows: { worldcups: [{ id: WID, status: 'draft', worldcup_items: [{ count: 16 }] }] } } });
    assert.strictEqual(good.res.status, 200);
});

test('if hiding the half-built parent also fails, the error says so (not silently swallowed)', async () => {
    const { res } = await run('POST', '/api/admin/drafts', { kind: 'quiz', draft: goodQuiz() }, { db: { insertErrors: { quiz_questions: { message: 'boom' } }, updateErrors: { quizzes: { message: 'rls denied' } } } });
    assert.strictEqual(res.status, 500);
    const msg = (await res.json()).error;
    assert(msg.includes('boom') && msg.includes('rls denied'), msg);
});

test('rows hidden because their insert failed do not block a retry with the same title', async () => {
    const d = goodQuiz();
    const rows = { quizzes: [{ title: d.title, description: d.description, status: 'hidden', hidden_reason: 'insert_failed' }] };
    const { res } = await run('POST', '/api/admin/drafts', { kind: 'quiz', draft: d }, { db: { rows } });
    assert.strictEqual(res.status, 201);
    // 하지만 사람이 반려/숨긴 것(다른 사유)은 계속 중복으로 막는다
    const rows2 = { quizzes: [{ title: d.title, description: d.description, status: 'hidden', hidden_reason: 'rejected: x' }] };
    assert.strictEqual((await run('POST', '/api/admin/drafts', { kind: 'quiz', draft: d }, { db: { rows: rows2 } })).res.status, 422);
});

test('options are sanitized before storing: only id/text/isCorrect, ids forced to A-D', async () => {
    const d = goodQuiz();
    d.questions[0].options = d.questions[0].options.map((o, i) => ({ ...o, id: 'Z' + i, evil: '<script>alert(1)</script>', extra: { a: 1 } }));
    const { res, db } = await run('POST', '/api/admin/drafts', { kind: 'quiz', draft: d });
    assert.strictEqual(res.status, 201);
    const kids = db.inserts.find((i) => i.table === 'quiz_questions').payload;
    assert.deepStrictEqual(kids[0].options.map((o) => Object.keys(o).sort().join()), Array(4).fill('id,isCorrect,text'));
    assert.deepStrictEqual(kids[0].options.map((o) => o.id), ['A', 'B', 'C', 'D']);
});

test('oversized request bodies are rejected with 413', async () => {
    const d = goodQuiz(); d.pad = 'x'.repeat(300 * 1024);
    const { res, db } = await run('POST', '/api/admin/drafts', { kind: 'quiz', draft: d });
    assert.strictEqual(res.status, 413);
    assert.strictEqual(db.inserts.length, 0);
});

test('draft list includes review samples: quiz clips and worldcup images', async () => {
    const rows = {
        quizzes: [{ id: QID, status: 'draft', title: 'Q', description: 'd', source: 'daily', created_at: 'x', quiz_questions: [{ answer: 'a', video_id: 'dQw4w9WgXcQ', start_time: 5 }, { answer: 'b', video_id: 'https://cdn.myanimelist.net/a.jpg', start_time: 0 }] }],
        worldcups: [{ id: 'w1', status: 'draft', title: 'W', description: 'd', source: 'daily', created_at: 'x', worldcup_items: [{ name: 'n1', image_url: 'https://i.ytimg.com/a.jpg' }] }],
    };
    const { drafts } = await (await run('GET', '/api/admin/drafts', undefined, { db: { rows } })).res.json();
    const quiz = drafts.find((d) => d.kind === 'quiz'), wc = drafts.find((d) => d.kind === 'worldcup');
    assert.deepStrictEqual(quiz.samples[0], { answer: 'a', videoId: 'dQw4w9WgXcQ', startTime: 5 });
    assert.deepStrictEqual(wc.samples[0], { name: 'n1', image_url: 'https://i.ytimg.com/a.jpg' });
    assert.deepStrictEqual(quiz.preview, ['a', 'b']);
});
