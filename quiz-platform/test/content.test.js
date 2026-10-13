import test from 'node:test';
import assert from 'node:assert';
import { TEXT_QUIZZES } from '../content/text_quizzes.mjs';
import { validateQuizDraft, jaccard3, normalize } from '../src/quality/validate.js';

// 출시할 콘텐츠가 품질 게이트를 통과하고, 서로 비슷한 설명이 없는지 자동으로 확인한다.

test('there are 6 text quizzes of 10 questions each', () => {
    assert.strictEqual(TEXT_QUIZZES.length, 6);
    for (const q of TEXT_QUIZZES) assert.strictEqual(q.draft.questions.length, 10, q.draft.title);
});

test('every quiz passes the validator (with every OTHER quiz as the existing content)', () => {
    TEXT_QUIZZES.forEach((quiz, i) => {
        const others = TEXT_QUIZZES.filter((_, j) => j !== i).map((o) => o.draft);
        const ctx = { existingTitles: others.map((o) => o.title), existingDescriptions: others.map((o) => o.description) };
        const r = validateQuizDraft(quiz.draft, ctx);
        assert.deepStrictEqual(r.errors, [], `${quiz.draft.title}: ${r.errors.join(' / ')}`);
    });
});

test('every question is a text question with an explanation and exactly one correct option', () => {
    for (const { draft } of TEXT_QUIZZES) {
        for (const q of draft.questions) {
            assert(q.questionText && !q.videoId, 'text question');
            assert(q.explanation.length >= 10 && q.explanation.length <= 300);
            assert.strictEqual(q.options.length, 4);
            assert.strictEqual(q.options.filter((o) => o.isCorrect).length, 1);
            assert.strictEqual(q.options.find((o) => o.isCorrect).text, q.answer);
        }
    }
});

test('descriptions and titles are unique across the set and not templated', () => {
    const descs = TEXT_QUIZZES.map((q) => normalize(q.draft.description));
    for (let a = 0; a < descs.length; a++) for (let b = a + 1; b < descs.length; b++) {
        assert(jaccard3(descs[a], descs[b]) < 0.3, `descriptions ${a} and ${b} are too similar`);
    }
    assert.strictEqual(new Set(TEXT_QUIZZES.map((q) => q.draft.title)).size, TEXT_QUIZZES.length);
});

test('correct answers are spread over all four positions (not always first)', () => {
    const counts = [0, 0, 0, 0];
    for (const { draft } of TEXT_QUIZZES) for (const q of draft.questions) counts[q.options.findIndex((o) => o.isCorrect)]++;
    assert(counts.every((c) => c >= 8), 'positions: ' + counts.join(','));
    // 한 퀴즈 안에서도 같은 위치가 6번 이상 몰리지 않는다
    for (const { draft } of TEXT_QUIZZES) {
        const c = [0, 0, 0, 0]; draft.questions.forEach((q) => c[q.options.findIndex((o) => o.isCorrect)]++);
        assert(Math.max(...c) <= 4, `${draft.title}: ${c.join(',')}`);
    }
});

test('no option text uses " - " (the legacy player would cut it) and nothing is blank', () => {
    for (const { draft } of TEXT_QUIZZES) for (const q of draft.questions) {
        for (const o of q.options) { assert(!o.text.includes(' - '), o.text); assert(o.text.trim().length > 0); }
    }
});
