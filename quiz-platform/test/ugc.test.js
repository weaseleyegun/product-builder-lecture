import test from 'node:test';
import assert from 'node:assert';
import { handleUserCreatedQuiz, handleUserCreatedContent, validateUgcQuiz, validateUgcWorldcup } from '../src/routes/ugc.js';
import { makeFake } from './helpers.js';

const ENV = { SUPABASE_URL: 'https://x.supabase.co', SUPABASE_ANON_KEY: 'anon' };
const USER = { id: 'user-1', email: 'someone@example.com' };

const quizBody = () => ({
    title: '내가 만든 팝송 퀴즈', description: '설명',
    questions: Array.from({ length: 6 }, (_, i) => ({ media_id: 'dQw4w9WgXcQ', answer: `정답${i}`, wrongs: ['오답1', '오답2', '오답3'] })),
});
const cupBody = () => ({
    title: '내가 만든 월드컵', description: '',
    items: Array.from({ length: 8 }, (_, i) => ({ name: `후보${i + 1}`, image_url: `https://example.com/${i + 1}.png` })),
});

// rpcResult: DB 함수가 돌려줄 값 또는 { error }.  호출 기록은 calls 에 남는다.
function call(handler, body, { auth = { user: USER }, rpcResult = 'new-id', token = 'tok' } = {}) {
    const a = makeFake({ user: auth.user });
    const calls = [];
    const clientTokens = [];
    const db = {
        from: () => { throw new Error('UGC 제출은 테이블에 직접 쓰지 않는다'); },
        rpc: (name, args) => { calls.push({ name, args }); return Promise.resolve(rpcResult && rpcResult.error ? { data: null, error: rpcResult.error } : { data: rpcResult, error: null }); },
    };
    const request = new Request('https://api.test/x', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: typeof body === 'string' ? body : JSON.stringify(body),
    });
    return handler(request, a.client, ENV, { makeClient: (t) => { clientTokens.push(t); return db; } }).then((res) => ({ res, calls, anon: a, clientTokens }));
}

test('no token → 401, bad token → 401, nothing is written', async () => {
    let r = await call(handleUserCreatedQuiz, quizBody(), { token: null });
    assert.strictEqual(r.res.status, 401);
    r = await call(handleUserCreatedQuiz, quizBody(), { auth: { user: null } });
    assert.strictEqual(r.res.status, 401);
    assert.strictEqual(r.calls.length, 0);
});

test('a valid quiz goes through the submit_ugc_quiz function with the CALLER token, never an admin session', async () => {
    const r = await call(handleUserCreatedQuiz, quizBody(), { rpcResult: 'q-new' });
    assert.strictEqual(r.res.status, 201);
    const json = await r.res.json();
    assert.deepStrictEqual([json.success, json.quizId, json.status], [true, 'q-new', 'draft']);
    assert.deepStrictEqual(r.clientTokens, ['tok']);
    assert.strictEqual(r.calls.length, 1);
    assert.strictEqual(r.calls[0].name, 'submit_ugc_quiz');
    const qs = r.calls[0].args.p_questions;
    assert.strictEqual(qs.length, 6);
    assert.strictEqual(qs[0].options.filter((o) => o.isCorrect).length, 1);
    assert.strictEqual(qs[0].options.find((o) => o.isCorrect).text, '정답0');
    assert.deepStrictEqual(new Set(qs.map((q) => q.options.findIndex((o) => o.isCorrect))), new Set([0, 1, 2, 3]));
    // 상태·출처·작성자 같은 칼럼은 클라이언트가 보낼 수 없다 (함수가 고정한다)
    assert.deepStrictEqual(Object.keys(r.calls[0].args).sort(), ['p_description', 'p_questions', 'p_title']);
    assert.strictEqual(r.anon.inserts.length, 0);
});

test('a valid worldcup goes through submit_ugc_worldcup', async () => {
    const r = await call(handleUserCreatedContent, cupBody(), { rpcResult: 'w-new' });
    assert.strictEqual(r.res.status, 201);
    assert.strictEqual((await r.res.json()).worldcupId, 'w-new');
    assert.strictEqual(r.calls[0].name, 'submit_ugc_worldcup');
    assert.strictEqual(r.calls[0].args.p_items.length, 8);
});

test('DB function errors map to HTTP statuses without leaking internals', async () => {
    let r = await call(handleUserCreatedQuiz, quizBody(), { rpcResult: { error: { message: 'pending_limit' } } });
    assert.strictEqual(r.res.status, 429);
    r = await call(handleUserCreatedQuiz, quizBody(), { rpcResult: { error: { message: 'invalid_media' } } });
    assert.strictEqual(r.res.status, 400);
    r = await call(handleUserCreatedQuiz, quizBody(), { rpcResult: { error: { message: 'relation "quizzes" does not exist' } } });
    assert.strictEqual(r.res.status, 500);
    assert(!(await r.res.text()).includes('relation'));
});

test('oversized or malformed bodies are rejected before touching the DB', async () => {
    let r = await call(handleUserCreatedQuiz, 'not json');
    assert.strictEqual(r.res.status, 400);
    r = await call(handleUserCreatedQuiz, JSON.stringify({ title: 'x'.repeat(400 * 1024) }));
    assert.strictEqual(r.res.status, 413);
    assert.strictEqual(r.calls.length, 0);
});

test('quiz validation: lengths, counts, media format, duplicates and blocked words', () => {
    const ok = quizBody();
    assert.deepStrictEqual(validateUgcQuiz(ok), []);
    assert(validateUgcQuiz({ ...ok, title: 'a' }).length);
    assert(validateUgcQuiz({ ...ok, title: '대통령 선거 퀴즈입니다' }).length);
    assert(validateUgcQuiz({ ...ok, description: '마약 이야기' }).length);
    assert(validateUgcQuiz({ ...ok, questions: [] }).length);
    assert(validateUgcQuiz({ ...ok, questions: ok.questions.slice(0, 5) }).length);   // 공개 최소 6문제
    assert(validateUgcQuiz({ ...ok, questions: Array(31).fill(ok.questions[0]) }).length);
    const q = (patch) => ({ ...ok, questions: [{ ...ok.questions[0], ...patch }, ...ok.questions.slice(1)] });
    assert(validateUgcQuiz(q({ media_id: 'javascript:alert(1)' })).length);
    assert(validateUgcQuiz(q({ media_id: 'http://insecure.example/x.png' })).length);
    assert.deepStrictEqual(validateUgcQuiz(q({ media_id: 'https://example.com/x.png' })), []);
    assert(validateUgcQuiz(q({ wrongs: ['a', 'b'] })).length);
    assert(validateUgcQuiz(q({ wrongs: ['정답0', 'b', 'c'] })).length);
    assert(validateUgcQuiz(q({ answer: 'x'.repeat(61) })).length);
    assert(validateUgcQuiz(q({ answer: {} })).length);
    assert(validateUgcQuiz(null).length);
});

test('worldcup validation: item counts, https images (no data: URLs), names', () => {
    assert.deepStrictEqual(validateUgcWorldcup(cupBody()), []);
    assert(validateUgcWorldcup({ ...cupBody(), items: cupBody().items.slice(0, 7) }).length);   // 8/16/32/64개만
    assert(validateUgcWorldcup({ ...cupBody(), items: [{ name: 'a', image_url: 'javascript:1' }, ...cupBody().items.slice(1)] }).length);
    assert(validateUgcWorldcup({ ...cupBody(), items: [{ name: 'a', image_url: 'data:image/png;base64,AAAA' }, ...cupBody().items.slice(1)] }).length);
    assert(validateUgcWorldcup({ ...cupBody(), items: [{ name: '', image_url: 'https://e.com/a.png' }, ...cupBody().items.slice(1)] }).length);
});

// ── 작성자의 사후 수정 차단 (admin.js) ──────────────────────────
import { handleUpdateQuiz } from '../src/routes/admin.js';

test('owners can edit their quiz only while it is a draft; published content is admin-only', async () => {
    const run = async (status, user) => {
        const f = makeFake({ user, rows: { quizzes: [{ id: 'q1', creator_id: 'user-1', status }] } });
        const request = new Request('https://api.test/api/admin/quiz/q1', { method: 'PUT', headers: { Authorization: 'Bearer t', 'Content-Type': 'application/json' }, body: JSON.stringify({ title: '새 제목', description: 'd' }) });
        const res = await handleUpdateQuiz(request, new URL(request.url), f.client, { ADMIN_PASSWORD: 'pw', ADMIN_EMAIL: 'agent@quizrank.com' });
        return { res, updates: f.updates };
    };
    let r = await run('published', USER);
    assert.strictEqual(r.res.status, 403);
    assert.strictEqual(r.updates.length, 0);
    r = await run('draft', USER);
    assert.strictEqual(r.res.status, 200);
    assert.strictEqual(r.updates.length, 1);
    r = await run('published', { id: 'admin-id', email: 'agent@quizrank.com' });
    assert.strictEqual(r.res.status, 200);
});
