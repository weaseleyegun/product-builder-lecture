import test from 'node:test';
import assert from 'node:assert';
import { createRequire } from 'node:module';
import { validateQuizDraft } from '../src/quality/validate.js';

const require = createRequire(import.meta.url);
const Reveal = require('../js/utils/reveal.js');

test('normalize: quiz default mode, per-question override, clamping and unknown modes', () => {
    assert.strictEqual(Reveal.normalize(null, null), null);
    assert.strictEqual(Reveal.normalize('bogus', { mode: 'also-bogus' }), null);
    assert.strictEqual(Reveal.normalize('blur', null).mode, 'blur');
    assert.strictEqual(Reveal.normalize('blur', { mode: 'zoom', x: 20, y: 70 }).mode, 'zoom');
    const c = Reveal.normalize('zoom', { x: 500, y: -5, w: 'abc' });
    assert.deepStrictEqual([c.x, c.y, c.w], [100, 0, 40]);   // 범위를 벗어나거나 숫자가 아니면 안전한 값
    assert.strictEqual(Reveal.normalize('zoom', 'string-not-object').mode, 'zoom');
});

test('styleFor: each mode reveals progressively and is fully clear at the final stage', () => {
    for (const mode of Reveal.MODES) {
        const cfg = Reveal.normalize(mode, { x: 30, y: 40 });
        const full = Reveal.styleFor(cfg, Reveal.FULL);
        assert.deepStrictEqual([full.transform, full.filter, full.mosaicCells, full.mask], ['none', 'none', 0, null], mode);
        const first = Reveal.styleFor(cfg, 0);
        assert(first.transform !== 'none' || first.filter !== 'none' || first.mosaicCells > 0 || first.mask, `${mode}: stage 0 must hide something`);
    }
    assert.strictEqual(Reveal.styleFor(Reveal.normalize('zoom', { x: 30, y: 40 }), 0).transformOrigin, '30% 40%');
    const zoom = [0, 1, 2].map((s) => parseFloat(Reveal.styleFor(Reveal.normalize('zoom', {}), s).transform.slice(6)));
    assert(zoom[0] > zoom[1] && zoom[1] > zoom[2] && zoom[2] > 1);
    const cells = [0, 1, 2].map((s) => Reveal.styleFor(Reveal.normalize('mosaic', {}), s).mosaicCells);
    assert(cells[0] < cells[1] && cells[1] < cells[2]);
    const maskW = [0, 1, 2].map((s) => Reveal.styleFor(Reveal.normalize('mask', { w: 50 }), s).mask.w);
    assert(maskW[0] > maskW[1] && maskW[1] > maskW[2]);
});

test('styleFor tolerates bad stages and null config', () => {
    assert.deepStrictEqual(Reveal.styleFor(null, 0).filter, 'none');
    const cfg = Reveal.normalize('blur', {});
    assert.deepStrictEqual(Reveal.styleFor(cfg, -3), Reveal.styleFor(cfg, 0));
    assert.deepStrictEqual(Reveal.styleFor(cfg, 99), Reveal.styleFor(cfg, Reveal.FULL));
    assert.deepStrictEqual(Reveal.styleFor(cfg, 'x'), Reveal.styleFor(cfg, 0));
});

test('points drop with each hint and the hint cost matches', () => {
    assert.deepStrictEqual([0, 1, 2].map(Reveal.pointsFor), [100, 70, 40]);
    assert.strictEqual(Reveal.pointsFor(3), 40);          // 마지막 단계 이후에도 점수는 더 줄지 않는다
    assert.deepStrictEqual([0, 1, 2].map(Reveal.nextHintCost), [30, 30, 0]);
});

// ── 초안 검증: 공개 방식 필드 ──
const long = '이'.repeat(320);
const imgQuiz = (patch = {}, qpatch = {}) => ({
    title: '이미지 공개 방식 테스트 퀴즈', description: long,
    questions: Array.from({ length: 6 }, (_, i) => ({
        answer: `정답${i}`, videoId: 'https://i.ytimg.com/vi/abc/hq.jpg', startTime: 0, endTime: 15,
        options: [`정답${i}`, `오답A${i}`, `오답B${i}`, `오답C${i}`].map((t, k) => ({ id: 'ABCD'[k], text: t, isCorrect: k === 0 })),
        ...qpatch,
    })),
    ...patch,
});

test('draft validation: revealMode and per-question reveal', () => {
    assert.deepStrictEqual(validateQuizDraft(imgQuiz({ revealMode: 'zoom' }, { reveal: { x: 30, y: 40 } })).errors, []);
    assert(validateQuizDraft(imgQuiz({ revealMode: 'sepia' })).errors.some((e) => e.includes('revealMode')));
    assert(validateQuizDraft(imgQuiz({}, { reveal: { mode: 'x' } })).errors.some((e) => e.includes('reveal.mode')));
    assert(validateQuizDraft(imgQuiz({}, { reveal: { x: 120 } })).errors.some((e) => e.includes('reveal.x')));
    assert(validateQuizDraft(imgQuiz({}, { reveal: { evil: 1 } })).errors.some((e) => e.includes('알 수 없는 키')));
    assert(validateQuizDraft(imgQuiz({}, { reveal: [1] })).errors.some((e) => e.includes('reveal')));
});
