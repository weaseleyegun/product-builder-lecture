import test from 'node:test';
import assert from 'node:assert';
import { YEAR_QUIZZES } from '../content/year_quizzes.mjs';
import { validateQuizDraft, jaccard3, normalize } from '../src/quality/validate.js';

test('year quizzes pass the validator', () => {
    YEAR_QUIZZES.forEach((quiz, i) => {
        const others = YEAR_QUIZZES.filter((_, j) => j !== i).map((o) => o.draft);
        const r = validateQuizDraft(quiz.draft, { existingTitles: others.map((o) => o.title), existingDescriptions: others.map((o) => o.description) });
        assert.deepStrictEqual(r.errors, [], `${quiz.draft.title}: ${r.errors.join(' / ')}`);
    });
});

test('year questions are video questions whose answer is a plausible year', () => {
    for (const { draft } of YEAR_QUIZZES) {
        for (const q of draft.questions) {
            assert(/^[\w-]{11}$/.test(q.videoId));
            assert(/^(19|20)\d\d$/.test(q.answer) && +q.answer <= 2025);
            assert.strictEqual(q.options.find((o) => o.isCorrect).text, q.answer);
            assert(q.explanation.includes(q.answer));
        }
    }
});

test('year quiz descriptions are not near-duplicates', () => {
    assert(jaccard3(normalize(YEAR_QUIZZES[0].draft.description), normalize(YEAR_QUIZZES[1].draft.description)) < 0.3);
});
