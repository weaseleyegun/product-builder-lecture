import test from 'node:test';
import assert from 'node:assert';
import { TEXT_WORLDCUPS } from '../content/text_worldcups.mjs';
import { AUDIENCE_QUIZZES_C } from '../content/audience_quizzes_c.mjs';
import { TEXT_QUIZZES } from '../content/text_quizzes.mjs';
import { validateWorldcupDraft, validateQuizDraft, jaccard3, normalize } from '../src/quality/validate.js';

const cups = TEXT_WORLDCUPS.map((w) => w.draft);

test('text-only worldcups pass the validator (names only, 16 unique candidates each)', () => {
    cups.forEach((d, i) => {
        const others = cups.filter((_, j) => j !== i);
        const r = validateWorldcupDraft(d, { existingTitles: others.map((o) => o.title), existingDescriptions: others.map((o) => o.description) });
        assert.deepStrictEqual(r.errors, [], `${d.title}: ${r.errors.join(' / ')}`);
        assert.strictEqual(d.items.length, 16);
        assert(d.items.every((it) => it.image_url === undefined));
    });
});

test('text-only mode forbids images, while normal worldcups still require an allowed image', () => {
    const base = cups[0];
    const withImage = { ...base, items: base.items.map((it, i) => (i === 0 ? { ...it, image_url: 'https://i.ytimg.com/x.jpg' } : it)) };
    assert(validateWorldcupDraft(withImage).errors.some((e) => e.includes('image_url')));
    const notText = { ...base, textOnly: false };
    assert(validateWorldcupDraft(notText).errors.some((e) => e.includes('image_url')));   // 이미지가 없으면 일반 월드컵으로는 통과 못 한다
    assert.deepStrictEqual(validateWorldcupDraft({ ...base, textOnly: 'true' }).errors.length > 0, true);   // 문자열 'true'는 인정하지 않는다
});

test('text worldcup descriptions are not templated copies of each other', () => {
    for (let a = 0; a < cups.length; a++) for (let b = a + 1; b < cups.length; b++) {
        assert(jaccard3(normalize(cups[a].description), normalize(cups[b].description)) < 0.5, `worldcups ${a} and ${b} too similar`);
    }
});

test('"최애 정보" quizzes (set C) pass the validator and have spread-out answer positions', () => {
    AUDIENCE_QUIZZES_C.forEach((quiz) => {
        const others = [...TEXT_QUIZZES, ...AUDIENCE_QUIZZES_C.filter((o) => o !== quiz)].map((o) => o.draft);
        const r = validateQuizDraft(quiz.draft, { existingTitles: others.map((o) => o.title), existingDescriptions: others.map((o) => o.description) });
        assert.deepStrictEqual(r.errors, [], `${quiz.draft.title}: ${r.errors.join(' / ')}`);
        for (const q of quiz.draft.questions) {
            assert.strictEqual(q.options.filter((o) => o.isCorrect).length, 1);
            assert(q.explanation.length >= 10);
        }
    });
});

// ── 초안 제출 경로: 이름만 있는 월드컵은 image_url이 null로 저장된다 ──
import { handleDrafts } from '../src/routes/drafts.js';
import { makeFake } from './helpers.js';

test('drafts route stores text-only worldcup candidates with image_url = null', async () => {
    const anon = makeFake({});
    const db = makeFake({ insertReturns: { worldcups: [{ id: '11111111-1111-1111-1111-111111111111' }] } });
    const request = new Request('https://api.test/api/admin/drafts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer tok' },
        body: JSON.stringify({ kind: 'worldcup', draft: TEXT_WORLDCUPS[0].draft, source: 'curated' }),
    });
    const res = await handleDrafts(request, new URL(request.url), anon.client, { SUPABASE_URL: 'x', SUPABASE_ANON_KEY: 'y', ADMIN_EMAIL: 'agent@quizrank.com' }, { makeClient: () => db.client });
    assert.strictEqual(res.status, 201);
    const items = db.inserts.find((i) => i.table === 'worldcup_items').payload;
    assert.strictEqual(items.length, 16);
    assert(items.every((it) => it.image_url === null && typeof it.name === 'string'));
});
