// validate.js - 퀴즈/월드컵 초안 검증 (단일 출처). 통과하지 못한 초안은 저장되지 않는다.
//
// draft.quiz      = { title, description, questions: [{ answer, options:[{id,text,isCorrect}], videoId, startTime, endTime }] }
// draft.worldcup  = { title, description, items: [{ name, image_url }] }
// ctx             = { existingTitles: string[], existingDescriptions: string[] }
// 반환            = { ok, errors: string[], warnings: string[] }   (errors에 하나라도 있으면 ok=false)

import { GENERIC_WORDS, BLOCKED_PATTERN, ALLOWED_IMAGE_HOSTS, LIMITS } from './constants.js';

export const normalize = (t) => String(t ?? '').toLowerCase().replace(/[^0-9a-z가-힣]/g, '');

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

function checkText(d, ctx, errors) {
    const title = isStr(d.title) ? d.title : '';
    const desc = isStr(d.description) ? d.description : '';
    if (!between(title.length, LIMITS.title)) errors.push(`title: ${LIMITS.title[0]}~${LIMITS.title[1]}자`);
    if (BLOCKED_PATTERN.test(title)) errors.push('blocked: 제목에 제외어 포함');   // 설명문 본문은 검사하지 않음(일반 문장에 우연히 포함 가능)
    if (!between(desc.length, LIMITS.description)) errors.push(`description: ${LIMITS.description[0]}~${LIMITS.description[1]}자`);

    const nt = normalize(title);
    if (nt && (ctx.existingTitles || []).some((t) => normalize(t) === nt)) errors.push('duplicate_title');

    const nd = normalize(desc);
    if (nd && (ctx.existingDescriptions || []).some((x) => jaccard3(normalize(x), nd) >= LIMITS.duplicateDescriptionSimilarity)) {
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

        const answerNorm = normalize(q.answer);
        if (answerNorm.length < 2 || GENERIC_WORDS.has(answerNorm)) errors.push(`${tag} generic_answer: 맞출 수 없는 일반 단어`);
        if (BLOCKED_PATTERN.test(String(q.answer ?? ''))) errors.push(`${tag} blocked: 정답에 제외어 포함`);

        const opts = Array.isArray(q.options) ? q.options : [];
        const texts = opts.map((o) => normalize(o && o.text));
        if (opts.length !== 4 || new Set(texts).size !== 4 || texts.some((t) => !t)) errors.push(`${tag} options: 서로 다른 4개 필요`);
        if (opts.filter((o) => o && o.isCorrect === true).length !== 1) errors.push(`${tag} options: 정답 1개`);
        for (let a = 0; a < texts.length; a++) {
            for (let b = a + 1; b < texts.length; b++) {
                if (texts[a] && texts[b] && (texts[a].includes(texts[b]) || texts[b].includes(texts[a]))) {
                    errors.push(`${tag} overlap: 보기끼리 포함 관계`);
                }
            }
        }

        const vid = String(q.videoId ?? '');
        if (!/^[\w-]{11}$/.test(vid) && !/^https:\/\//.test(vid)) errors.push(`${tag} video_id 형식 오류`);
        const len = Number(q.endTime) - Number(q.startTime);
        if (!(len >= LIMITS.clipSeconds[0] && len <= LIMITS.clipSeconds[1])) errors.push(`${tag} clip: ${LIMITS.clipSeconds[0]}~${LIMITS.clipSeconds[1]}초`);
    });

    return { ok: errors.length === 0, errors, warnings };
}

export function validateWorldcupDraft(d, ctx = {}) {
    const errors = [], warnings = [];
    if (!d || typeof d !== 'object') return { ok: false, errors: ['draft: 객체가 아님'], warnings };
    checkText(d, ctx, errors);

    const items = Array.isArray(d.items) ? d.items : [];
    if (!LIMITS.worldcupSizes.includes(items.length)) errors.push(`size: 후보는 ${LIMITS.worldcupSizes.join('/')}개`);

    const names = items.map((x) => normalize(x && x.name));
    if (new Set(names).size !== names.length) errors.push('duplicate_item: 후보 이름 중복');

    items.forEach((x, i) => {
        const tag = `item${i + 1}`;
        const nm = names[i];
        if (!nm || GENERIC_WORDS.has(nm)) errors.push(`${tag} generic_name`);
        if (BLOCKED_PATTERN.test(String(x && x.name ? x.name : ''))) errors.push(`${tag} blocked: 이름에 제외어 포함`);
        let host = '';
        try { const u = new URL(String(x && x.image_url)); host = u.protocol === 'https:' ? u.hostname : ''; } catch { /* invalid url */ }
        if (!ALLOWED_IMAGE_HOSTS.includes(host)) errors.push(`${tag} image_url: https + 허용 도메인만`);
    });

    return { ok: errors.length === 0, errors, warnings };
}
