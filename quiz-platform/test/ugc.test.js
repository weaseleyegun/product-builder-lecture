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

function call(handler, body, { auth = { user: USER }, db = {}, token = 'tok' } = {}) {
    const a = makeFake({ user: auth.user });
    const d = makeFake(db);
    const request = new Request('https://api.test/x', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: typeof body === 'string' ? body : JSON.stringify(body),
    });
    return handler(request, a.client, ENV, { makeClient: () => d.client }).then((res) => ({ res, db: d, anon: a }));
}

test('no token → 401, bad token → 401, nothing is written', async () => {
    let r = await call(handleUserCreatedQuiz, quizBody(), { token: null });
    assert.strictEqual(r.res.status, 401);
    r = await call(handleUserCreatedQuiz, quizBody(), { auth: { user: null } });
    assert.strictEqual(r.res.status, 401);
    assert.strictEqual(r.db.inserts.length, 0);
});

test('a valid quiz is stored as a DRAFT with source ugc, owned by the caller, using the caller token (no admin sign-in)', async () => {
    const r = await call(handleUserCreatedQuiz, quizBody(), { db: { insertReturns: { quizzes: [{ id: 'q-new' }] } } });
    assert.strictEqual(r.res.status, 201);
    const json = await r.res.json();
    assert.deepStrictEqual([json.success, json.quizId, json.status], [true, 'q-new', 'draft']);
    const parent = r.db.inserts.find((i) => i.table === 'quizzes').payload[0];
    assert.deepStrictEqual([parent.status, parent.source, parent.creator_id], ['draft', 'ugc', 'user-1']);
    const kid = r.db.inserts.find((i) => i.table === 'quiz_questions').payload[0];
    assert.strictEqual(kid.quiz_id, 'q-new');
    assert.strictEqual(kid.options.filter((o) => o.isCorrect).length, 1);
    assert.strictEqual(kid.options.find((o) => o.isCorrect).text, '정답0');
    assert.strictEqual(r.anon.inserts.length, 0);
});

test('a valid worldcup is stored as a draft', async () => {
    const r = await call(handleUserCreatedContent, cupBody(), { db: { insertReturns: { worldcups: [{ id: 'w-new' }] } } });
    assert.strictEqual(r.res.status, 201);
    const parent = r.db.inserts.find((i) => i.table === 'worldcups').payload[0];
    assert.deepStrictEqual([parent.status, parent.source], ['draft', 'ugc']);
    assert.strictEqual(r.db.inserts.find((i) => i.table === 'worldcup_items').payload.length, 8);
});

test('users with 3 pending submissions are rate limited (429)', async () => {
    const pending = [1, 2, 3].map((n) => ({ id: `p${n}`, creator_id: 'user-1', status: 'draft' }));
    const r = await call(handleUserCreatedQuiz, quizBody(), { db: { rows: { quizzes: pending } } });
    assert.strictEqual(r.res.status, 429);
    assert.strictEqual(r.db.inserts.length, 0);
});

test('oversized or malformed bodies are rejected before touching the DB', async () => {
    let r = await call(handleUserCreatedQuiz, 'not json');
    assert.strictEqual(r.res.status, 400);
    r = await call(handleUserCreatedQuiz, JSON.stringify({ title: 'x'.repeat(400 * 1024) }));
    assert.strictEqual(r.res.status, 413);
    assert.strictEqual(r.db.inserts.length, 0);
});

test('quiz validation: lengths, counts, media format, duplicates and blocked words', () => {
    const ok = quizBody();
    assert.deepStrictEqual(validateUgcQuiz(ok), []);
    assert(validateUgcQuiz({ ...ok, title: 'a' }).length);
    assert(validateUgcQuiz({ ...ok, title: '대통령 선거 퀴즈입니다' }).length);
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

test('worldcup validation: item counts, https images, names', () => {
    assert.deepStrictEqual(validateUgcWorldcup(cupBody()), []);
    assert(validateUgcWorldcup({ ...cupBody(), items: cupBody().items.slice(0, 7) }).length);   // 8/16/32/64개만
    assert(validateUgcWorldcup({ ...cupBody(), items: [{ name: 'a', image_url: 'javascript:1' }, ...cupBody().items.slice(1)] }).length);
    assert(validateUgcWorldcup({ ...cupBody(), items: [{ name: '', image_url: 'https://e.com/a.png' }, ...cupBody().items.slice(1)] }).length);
});
