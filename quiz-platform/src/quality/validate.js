// validate.js - 퀴즈/월드컵 초안 검증 (단일 출처). 통과하지 못한 초안은 저장되지 않는다.
//
// draft.quiz      = { title, description, questions: [{ answer, options:[{id,text,isCorrect}], videoId, startTime, endTime }] }
// draft.worldcup  = { title, description, items: [{ name, image_url }] }
// ctx             = { existingTitles: string[], existingDescriptions: string[] }
// 반환            = { ok, errors: string[], warnings: string[] }   (errors에 하나라도 있으면 ok=false)
//
// 모든 필드는 신뢰하지 않는다: 타입·길이·범위를 먼저 확인하고, 금지어는 NFKC 정규화(자모 분해/제로폭 문자 회피 방지) 후 검사한다.

import { normalizeText, isBlocked, GENERIC_WORDS, ALLOWED_IMAGE_HOSTS, LIMITS } from './constants.js';

export const normalize = normalizeText;

// 3-gram Jaccard 유사도 (0~1)
export function jaccard3(a, b) {
    const grams = (s) => { const set = new Set(); for (let i = 0; i + 3 <= s.length; i++) set.add(s.slice(i, i + 3)); return set; };
    const A = grams(a), B = grams(b);
    if (A.size === 0 || B.size === 0) return a === b ? 1 : 0;
    let inter = 0;
    for (const g of A) if (B.has(g)) inter++;
    return inter / (A.size + B.size - inter);
}

const isStr = (v) => typeof v === 'string';
const between = (n, [lo, hi]) => typeof n === 'number' && n >= lo && n <= hi;

// https URL이고 호스트가 허용 목록에 있는지
function allowedHttpsUrl(value) {
    if (!isStr(value) || value.length > LIMITS.urlMax) return false;
    try { const u = new URL(value); return u.protocol === 'https:' && ALLOWED_IMAGE_HOSTS.includes(u.hostname); } catch { return false; }
}

function checkText(d, ctx, errors) {
    const title = isStr(d.title) ? d.title : '';
    const desc = isStr(d.description) ? d.description : '';
    if (!between(title.length, LIMITS.title)) errors.push(`title: ${LIMITS.title[0]}~${LIMITS.title[1]}자`);
    if (isBlocked(title)) errors.push('blocked: 제목에 제외어 포함');   // 설명문 본문은 검사하지 않음(일반 문장에 우연히 포함 가능)
    if (!between(desc.length, LIMITS.description)) errors.push(`description: ${LIMITS.description[0]}~${LIMITS.description[1]}자`);

    const nt = normalizeText(title);
    if (nt && (ctx.existingTitles || []).some((t) => normalizeText(t) === nt)) errors.push('duplicate_title');

    const nd = normalizeText(desc);
    if (nd && (ctx.existingDescriptions || []).some((x) => jaccard3(normalizeText(x), nd) >= LIMITS.duplicateDescriptionSimilarity)) {
        errors.push('duplicate_description: 기존 설명과 너무 비슷함(템플릿 문구 금지)');
    }
}

export function validateQuizDraft(d, ctx = {}) {
    const errors = [], warnings = [];
    if (!d || typeof d !== 'object') return { ok: false, errors: ['draft: 객체가 아님'], warnings };
    checkText(d, ctx, errors);

    const qs = Array.isArray(d.questions) ? d.questions : [];
    if (!between(qs.length, LIMITS.questions)) errors.push(`questions: ${LIMITS.questions[0]}~${LIMITS.questions[1]}개`);

    qs.forEach((q, i) => {
        const tag = `Q${i + 1}`;
        if (!q || typeof q !== 'object') { errors.push(`${tag} 형식 오류`); return; }

        // 유형: 영상/이미지가 있으면 미디어 문제, 없고 질문 문장이 있으면 텍스트 문제
        const hasMedia = q.videoId !== undefined && q.videoId !== null && q.videoId !== '';
        const hasQuestionText = isStr(q.questionText) && q.questionText.trim().length > 0;
        const isTextQuestion = !hasMedia && hasQuestionText;

        // 정답
        if (!isStr(q.answer)) { errors.push(`${tag} answer: 문자열이어야 함`); }
        else {
            const an = normalizeText(q.answer);
            if (q.answer.length > LIMITS.textMax) errors.push(`${tag} length: 정답 ${LIMITS.textMax}자 초과`);
            if (an.length < 2 || (!isTextQuestion && GENERIC_WORDS.has(an))) errors.push(`${tag} generic_answer: 맞출 수 없는 일반 단어(또는 2자 미만)`);
            if (isBlocked(q.answer)) errors.push(`${tag} blocked: 정답에 제외어 포함`);
        }

        // 보기
        const opts = Array.isArray(q.options) ? q.options : [];
        const okShape = opts.every((o) => o && typeof o === 'object' && isStr(o.text));
        if (!okShape) errors.push(`${tag} options: text는 문자열이어야 함`);
        const texts = opts.map((o) => normalizeText(o && o.text));
        if (opts.length !== 4 || new Set(texts).size !== 4 || texts.some((t) => !t)) errors.push(`${tag} options: 서로 다른 4개 필요`);
        const correct = opts.filter((o) => o && o.isCorrect === true);
        if (correct.length !== 1) errors.push(`${tag} options: 정답 1개`);
        else if (isStr(q.answer) && isStr(correct[0].text) && normalizeText(correct[0].text) !== normalizeText(q.answer)) {
            errors.push(`${tag} answer_mismatch: 정답과 정답 보기의 내용이 다름`);
        }
        opts.forEach((o) => {
            if (o && isStr(o.text)) {
                if (o.text.length > LIMITS.textMax) errors.push(`${tag} length: 보기 ${LIMITS.textMax}자 초과`);
                if (isBlocked(o.text)) errors.push(`${tag} blocked: 보기에 제외어 포함`);
            }
        });
        for (let a = 0; a < texts.length; a++) {
            for (let b = a + 1; b < texts.length; b++) {
                if (texts[a] && texts[b] && (texts[a].includes(texts[b]) || texts[b].includes(texts[a]))) {
                    errors.push(`${tag} overlap: 보기끼리 포함 관계`);
                }
            }
        }

        // 질문 문장 / 해설
        if (q.questionText !== undefined && q.questionText !== null) {
            if (!isStr(q.questionText)) errors.push(`${tag} question_text: 문자열이어야 함`);
            else {
                if (q.questionText.length > LIMITS.questionTextMax) errors.push(`${tag} question_text: ${LIMITS.questionTextMax}자 초과`);
                if (isBlocked(q.questionText)) errors.push(`${tag} blocked: 질문에 제외어 포함`);
            }
        }
        if (q.explanation !== undefined && q.explanation !== null && !isStr(q.explanation)) {
            errors.push(`${tag} explanation: 문자열이어야 함`);
        } else if (isTextQuestion) {
            // 텍스트 문제에서는 해설이 곧 오리지널 콘텐츠이므로 필수
            const ex = isStr(q.explanation) ? q.explanation.trim() : '';
            if (!between(ex.length, LIMITS.explanation)) errors.push(`${tag} explanation: 텍스트 문제는 해설 ${LIMITS.explanation[0]}~${LIMITS.explanation[1]}자 필수`);
        } else if (isStr(q.explanation) && q.explanation.length > LIMITS.explanation[1]) {
            errors.push(`${tag} explanation: ${LIMITS.explanation[1]}자 초과`);
        }

        if (isTextQuestion) return;   // 영상/이미지·클립 검사는 미디어 문제에만 적용

        // 미디어: YouTube 영상 ID(11자) 또는 허용 호스트의 https 이미지
        const vid = q.videoId;
        const youtube = isStr(vid) && /^[\w-]{11}$/.test(vid);
        if (!youtube && !allowedHttpsUrl(vid)) errors.push(`${tag} video_id: 영상/이미지(또는 질문 문장)가 필요하고, 형식·호스트가 맞아야 함`);

        // 클립 구간: 0 이상의 정수 초, 길이 3~30초
        const st = q.startTime, et = q.endTime;
        const intsOk = Number.isInteger(st) && Number.isInteger(et) && st >= 0 && et >= 0;
        if (!intsOk || !between(et - st, LIMITS.clipSeconds)) errors.push(`${tag} clip: 0 이상 정수 초, 길이 ${LIMITS.clipSeconds[0]}~${LIMITS.clipSeconds[1]}초`);
    });

    return { ok: errors.length === 0, errors, warnings };
}

export function validateWorldcupDraft(d, ctx = {}) {
    const errors = [], warnings = [];
    if (!d || typeof d !== 'object') return { ok: false, errors: ['draft: 객체가 아님'], warnings };
    checkText(d, ctx, errors);

    const items = Array.isArray(d.items) ? d.items : [];
    if (!LIMITS.worldcupSizes.includes(items.length)) errors.push(`size: 후보는 ${LIMITS.worldcupSizes.join('/')}개`);

    const names = items.map((x) => normalizeText(x && x.name));
    if (new Set(names).size !== names.length) errors.push('duplicate_item: 후보 이름 중복');

    items.forEach((x, i) => {
        const tag = `item${i + 1}`;
        if (!x || typeof x !== 'object' || !isStr(x.name)) { errors.push(`${tag} name: 문자열이어야 함`); return; }
        if (x.name.length > LIMITS.textMax) errors.push(`${tag} length: 이름 ${LIMITS.textMax}자 초과`);
        const nm = normalizeText(x.name);
        if (!nm || GENERIC_WORDS.has(nm)) errors.push(`${tag} generic_name`);
        if (isBlocked(x.name)) errors.push(`${tag} blocked: 이름에 제외어 포함`);
        if (d.textOnly === true) {
            if (x.image_url !== undefined && x.image_url !== null && x.image_url !== '') errors.push(`${tag} image_url: 이름만으로 구성한 월드컵에는 이미지를 넣을 수 없음`);
        } else if (!allowedHttpsUrl(x.image_url)) errors.push(`${tag} image_url: https + 허용 도메인 + ${LIMITS.urlMax}자 이하만`);
    });

    return { ok: errors.length === 0, errors, warnings };
}
