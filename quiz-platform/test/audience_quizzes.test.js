import test from 'node:test';
import assert from 'node:assert';
import { AUDIENCE_QUIZZES as FIRST } from '../content/audience_quizzes.mjs';
import { AUDIENCE_QUIZZES_B } from '../content/audience_quizzes_b.mjs';
import { AUDIENCE_QUIZZES_C } from '../content/audience_quizzes_c.mjs';

const AUDIENCE_QUIZZES = [...FIRST, ...AUDIENCE_QUIZZES_B, ...AUDIENCE_QUIZZES_C];
import { TEXT_QUIZZES } from '../content/text_quizzes.mjs';
import { YEAR_QUIZZES } from '../content/year_quizzes.mjs';
import { validateQuizDraft, jaccard3, normalize } from '../src/quality/validate.js';

const all = [...TEXT_QUIZZES, ...YEAR_QUIZZES, ...AUDIENCE_QUIZZES];

test('audience quizzes: 15 quizzes of 10 text questions with explanations and one correct option', () => {
    assert.strictEqual(AUDIENCE_QUIZZES.length, 15);
    for (const { draft } of AUDIENCE_QUIZZES) {
        assert.strictEqual(draft.questions.length, 10, draft.title);
        for (const q of draft.questions) {
            assert(q.questionText && !q.videoId);
            assert(q.explanation.length >= 10 && q.explanation.length <= 300, q.explanation);
            assert.strictEqual(q.options.length, 4);
            assert.strictEqual(q.options.filter((o) => o.isCorrect).length, 1);
            assert.strictEqual(q.options.find((o) => o.isCorrect).text, q.answer);
        }
    }
});

test('every audience quiz passes the validator against ALL other content sets', () => {
    AUDIENCE_QUIZZES.forEach((quiz, i) => {
        const others = all.filter((o) => o !== quiz).map((o) => o.draft);
        const r = validateQuizDraft(quiz.draft, { existingTitles: others.map((o) => o.title), existingDescriptions: others.map((o) => o.description) });
        assert.deepStrictEqual(r.errors, [], `${quiz.draft.title}: ${r.errors.join(' / ')}`);
    });
});

test('descriptions are distinct (not templated) across every content set', () => {
    const descs = all.map((q) => normalize(q.draft.description));
    for (let a = 0; a < descs.length; a++) for (let b = a + 1; b < descs.length; b++) {
        assert(jaccard3(descs[a], descs[b]) < 0.45, `descriptions ${a} and ${b} are too similar`);
    }
});

test('correct answers are spread over the four positions', () => {
    const pos = [0, 0, 0, 0];
    for (const { draft } of AUDIENCE_QUIZZES) for (const q of draft.questions) pos[q.options.findIndex((o) => o.isCorrect)]++;
    for (const n of pos) assert(n >= 10, `skewed positions: ${pos}`);
});
