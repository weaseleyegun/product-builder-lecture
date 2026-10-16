// reveal.js - 이미지 퀴즈의 단계별 공개(줌·블러·모자이크·실루엣·일부 가림) 계산. DOM을 건드리지 않는 순수 함수라 Node에서 테스트한다.
//
// 단계: 0(처음) → 1 → 2 (힌트를 볼 때마다 한 단계 공개) → 3(완전 공개: 정답을 고른 뒤)
// 점수: 0단계에서 맞히면 100점, 1단계 70점, 2단계 40점.
(function (root) {
    var MODES = ['zoom', 'blur', 'mosaic', 'silhouette', 'mask'];
    var POINTS = [100, 70, 40];
    var FULL = 3;                       // 완전 공개 단계

    var ZOOM_SCALE = [4, 2.4, 1.5, 1];
    var BLUR_PX = [26, 13, 5, 0];
    var MOSAIC_CELLS = [8, 16, 32, 0];  // 가로 칸 수 (0 = 원본)
    var SILHOUETTE_BRIGHTNESS = [0, 0.2, 0.55, 1];
    var MASK_SCALE = [1, 0.6, 0.3, 0];

    function num(v, lo, hi, dflt) {
        v = typeof v === 'number' ? v : parseFloat(v);
        if (!isFinite(v)) return dflt;
        return Math.min(hi, Math.max(lo, v));
    }

    // 문제 설정(q.reveal)과 퀴즈 기본 방식을 합쳐 안전한 설정으로 만든다. 방식이 없으면 null(일반 이미지 문제).
    function normalize(quizMode, questionReveal) {
        var r = questionReveal && typeof questionReveal === 'object' ? questionReveal : {};
        var mode = MODES.indexOf(r.mode) !== -1 ? r.mode : (MODES.indexOf(quizMode) !== -1 ? quizMode : null);
        if (!mode) return null;
        return {
            mode: mode,
            x: num(r.x, 0, 100, 50),   // 초점(%) — 줌의 중심, 가림 상자의 중심
            y: num(r.y, 0, 100, 35),
            w: num(r.w, 5, 100, 40),   // 가림 상자 크기(%)
            h: num(r.h, 5, 100, 30)
        };
    }

    function clampStage(stage) {
        stage = parseInt(stage, 10);
        if (!isFinite(stage) || stage < 0) return 0;
        return stage > FULL ? FULL : stage;
    }

    // 단계별 CSS 값. 반환: { transform, transformOrigin, filter, mosaicCells, mask: {x,y,w,h}|null }
    function styleFor(cfg, stage) {
        stage = clampStage(stage);
        var out = { transform: 'none', transformOrigin: '50% 50%', filter: 'none', mosaicCells: 0, mask: null };
        if (!cfg || stage >= FULL) return out;
        if (cfg.mode === 'zoom') {
            out.transform = 'scale(' + ZOOM_SCALE[stage] + ')';
            out.transformOrigin = cfg.x + '% ' + cfg.y + '%';
        } else if (cfg.mode === 'blur') {
            out.filter = BLUR_PX[stage] > 0 ? 'blur(' + BLUR_PX[stage] + 'px)' : 'none';
        } else if (cfg.mode === 'mosaic') {
            out.mosaicCells = MOSAIC_CELLS[stage];
        } else if (cfg.mode === 'silhouette') {
            out.filter = 'brightness(' + SILHOUETTE_BRIGHTNESS[stage] + ')';
        } else if (cfg.mode === 'mask') {
            var k = MASK_SCALE[stage];
            if (k > 0) out.mask = { x: cfg.x, y: cfg.y, w: cfg.w * k, h: cfg.h * k };
        }
        return out;
    }

    function pointsFor(stage) { return POINTS[Math.min(clampStage(stage), POINTS.length - 1)]; }
    function lastHintStage() { return POINTS.length - 1; }
    // 다음 힌트를 보면 줄어드는 점수 (더 볼 힌트가 없으면 0)
    function nextHintCost(stage) {
        stage = clampStage(stage);
        if (stage >= lastHintStage()) return 0;
        return POINTS[stage] - POINTS[stage + 1];
    }

    var api = { MODES: MODES, FULL: FULL, normalize: normalize, styleFor: styleFor, pointsFor: pointsFor, nextHintCost: nextHintCost, lastHintStage: lastHintStage };
    root.Reveal = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
