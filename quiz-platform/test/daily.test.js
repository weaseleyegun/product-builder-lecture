import test from 'node:test';
import assert from 'node:assert';
import { kstDay, pickDaily, handleDailyPick } from '../src/routes/daily.js';
import { makeFake } from './helpers.js';

test('kstDay uses Korean calendar day (UTC+9)', () => {
    assert.strictEqual(kstDay(new Date('2026-10-15T14:59:59Z')).date, '2026-10-15');
    assert.strictEqual(kstDay(new Date('2026-10-15T15:00:00Z')).date, '2026-10-16');
    assert.strictEqual(kstDay(new Date('2026-10-15T15:00:00Z')).index, kstDay(new Date('2026-10-15T14:59:59Z')).index + 1);
});

test('pickDaily rotates through candidates in a fixed order and never fails on negative/huge indexes', () => {
    const qs = [{ id: 'c' }, { id: 'a' }, { id: 'b' }];
    assert.deepStrictEqual([0, 1, 2, 3].map((i) => pickDaily(qs, i).id), ['a', 'b', 'c', 'a']);
    assert.strictEqual(pickDaily(qs, -1).id, 'c');
    assert.strictEqual(pickDaily([], 5), null);
});

test('daily-pick returns the same published text quiz for the whole day, ignoring hidden/media-only quizzes', async () => {
    const f = makeFake({ rows: {
        quiz_questions: [{ quiz_id: 'q1', question_text: '?' }, { quiz_id: 'q2', question_text: '?' }, { quiz_id: 'q3', question_text: '?' }, { quiz_id: 'q4', question_text: null }],
        quizzes: [
            { id: 'q1', slug: 'one', title: 'One', status: 'published' },
            { id: 'q2', slug: null, title: 'Two', status: 'published' },
            { id: 'q3', slug: 'three', title: 'Three', status: 'hidden' },
            { id: 'q4', slug: 'four', title: 'Four', status: 'published' },
        ] } });
    const morning = await (await handleDailyPick(f.client, new Date('2026-10-16T00:10:00Z'))).json();
    const night = await (await handleDailyPick(f.client, new Date('2026-10-16T13:50:00Z'))).json();
    assert.deepStrictEqual(morning, night);
    assert(['q1', 'q2'].includes(morning.id));
    const next = await (await handleDailyPick(f.client, new Date('2026-10-17T00:10:00Z'))).json();
    assert.notStrictEqual(next.id, morning.id);
});

test('daily-pick is 404 when nothing qualifies', async () => {
    const f = makeFake({ rows: { quiz_questions: [], quizzes: [] } });
    assert.strictEqual((await handleDailyPick(f.client)).status, 404);
});
