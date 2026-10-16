// ugc.js - 회원이 직접 만든 퀴즈/월드컵 제출
//
//   POST /api/user-created-quiz     {title, description, questions:[{media_id, answer, wrongs:[3]}]}
//   POST /api/user-created-content  {title, description, items:[{name, image_url}]}
//
// - 제출물은 항상 '초안(draft)'으로 저장된다. 관리자가 대시보드에서 검수한 뒤에만 공개된다.
// - DB 작업은 제출자 본인의 JWT로 수행하므로 RLS가 "그 사용자의 권한"으로 적용된다(관리자 계정으로 우회하지 않는다).
// - 입력은 길이·개수·형식을 모두 검증하고, 한 사용자가 검수 대기 중인 항목은 3개까지만 허용한다.

import { createClient } from '@supabase/supabase-js';
import { jsonResponse, errorResponse } from '../helpers/cors.js';
import { isBlocked, normalizeText, LIMITS } from '../quality/constants.js';

const MAX_BODY_CHARS = 300 * 1024;
const MAX_PENDING_PER_USER = 3;
const TITLE = [2, 60];
const DESC_MAX = 1200;
const NAME_MAX = LIMITS.textMax;     // 정답/보기/후보 이름
const URL_MAX = LIMITS.urlMax;
const QUESTIONS = [LIMITS.questions[0], 30];   // 공개(검수 통과) 최소 문제 수와 같게

const isStr = (v) => typeof v === 'string';
const between = (n, [lo, hi]) => typeof n === 'number' && n >= lo && n <= hi;
const isHttps = (u) => { if (!isStr(u) || u.length > URL_MAX) return false; try { return new URL(u).protocol === 'https:'; } catch { return false; } };
const isYoutubeId = (v) => isStr(v) && /^[\w-]{11}$/.test(v);

export function validateUgcQuiz(b) {
    const errors = [];
    if (!b || typeof b !== 'object') return ['잘못된 요청입니다.'];
    if (!isStr(b.title) || !between(b.title.trim().length, TITLE)) errors.push(`제목은 ${TITLE[0]}~${TITLE[1]}자여야 합니다.`);
    else if (isBlocked(b.title)) errors.push('제목에 사용할 수 없는 표현이 있습니다.');
    if (b.description !== undefined && (!isStr(b.description) || b.description.length > DESC_MAX)) errors.push(`설명은 ${DESC_MAX}자 이하여야 합니다.`);
    const qs = Array.isArray(b.questions) ? b.questions : null;
    if (!qs || !between(qs.length, QUESTIONS)) { errors.push(`문제는 ${QUESTIONS[0]}~${QUESTIONS[1]}개여야 합니다.`); return errors; }
    qs.forEach((q, i) => {
        const tag = `${i + 1}번 문제`;
        if (!q || typeof q !== 'object') { errors.push(`${tag}: 형식 오류`); return; }
        if (!isYoutubeId(q.media_id) && !isHttps(q.media_id)) errors.push(`${tag}: 유튜브 영상 또는 https 이미지 주소가 필요합니다.`);
        if (!isStr(q.answer) || !between(q.answer.trim().length, [1, NAME_MAX])) { errors.push(`${tag}: 정답은 1~${NAME_MAX}자여야 합니다.`); return; }
        if (isBlocked(q.answer)) errors.push(`${tag}: 정답에 사용할 수 없는 표현이 있습니다.`);
        const wrongs = Array.isArray(q.wrongs) ? q.wrongs : null;
        if (!wrongs || wrongs.length !== 3 || wrongs.some((w) => !isStr(w) || !between(w.trim().length, [1, NAME_MAX]))) { errors.push(`${tag}: 오답 보기 3개가 필요합니다.`); return; }
        if (new Set([q.answer, ...wrongs].map(normalizeText)).size !== 4) errors.push(`${tag}: 보기가 서로 달라야 합니다.`);
        if (wrongs.some(isBlocked)) errors.push(`${tag}: 보기에 사용할 수 없는 표현이 있습니다.`);
    });
    return errors;
}

export function validateUgcWorldcup(b) {
    const errors = [];
    if (!b || typeof b !== 'object') return ['잘못된 요청입니다.'];
    if (!isStr(b.title) || !between(b.title.trim().length, TITLE)) errors.push(`제목은 ${TITLE[0]}~${TITLE[1]}자여야 합니다.`);
    else if (isBlocked(b.title)) errors.push('제목에 사용할 수 없는 표현이 있습니다.');
    if (b.description !== undefined && (!isStr(b.description) || b.description.length > DESC_MAX)) errors.push(`설명은 ${DESC_MAX}자 이하여야 합니다.`);
    const items = Array.isArray(b.items) ? b.items : null;
    if (!items || !LIMITS.worldcupSizes.includes(items.length)) { errors.push(`후보는 ${LIMITS.worldcupSizes.join('/')}개 중 하나여야 합니다.`); return errors; }
    items.forEach((it, i) => {
        const tag = `${i + 1}번 후보`;
        if (!it || typeof it !== 'object') { errors.push(`${tag}: 형식 오류`); return; }
        if (!isStr(it.name) || !between(it.name.trim().length, [1, NAME_MAX])) errors.push(`${tag}: 이름은 1~${NAME_MAX}자여야 합니다.`);
        else if (isBlocked(it.name)) errors.push(`${tag}: 이름에 사용할 수 없는 표현이 있습니다.`);
        if (!isHttps(it.image_url)) errors.push(`${tag}: https 이미지 주소가 필요합니다.`);
    });
    return errors;
}

async function readBody(request) {
    let text;
    try { text = await request.text(); } catch { return { err: errorResponse('Invalid body', 400) }; }
    if (text.length > MAX_BODY_CHARS) return { err: errorResponse('요청이 너무 큽니다.', 413) };
    try { return { json: JSON.parse(text) }; } catch { return { err: errorResponse('Invalid JSON', 400) }; }
}

// 공통: 토큰 확인 → 본문 검증 → 사용자 JWT 클라이언트 → 대기 개수 제한 → 초안 저장
async function submit(request, supabase, env, deps, { table, child, validate, toChildren, idKey }) {
    const header = request.headers.get('Authorization') || '';
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : null;
    if (!token) return errorResponse('로그인이 필요합니다.', 401);
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data || !data.user) return errorResponse('유효하지 않은 토큰입니다.', 401);
    const user = data.user;

    const parsed = await readBody(request);
    if (parsed.err) return parsed.err;
    const body = parsed.json;
    const errors = validate(body);
    if (errors.length) return jsonResponse({ error: errors[0], errors }, 400);

    const makeDb = deps.makeClient || ((t) => createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
        global: { headers: { Authorization: `Bearer ${t}` } },
        auth: { persistSession: false, autoRefreshToken: false },
    }));
    const db = makeDb(token);

    const pending = await db.from(table).select('id').eq('creator_id', user.id).eq('status', 'draft').limit(MAX_PENDING_PER_USER);
    if (pending.error) return errorResponse('Failed to check pending submissions', 500);
    if ((pending.data || []).length >= MAX_PENDING_PER_USER) return jsonResponse({ error: `검수 대기 중인 항목이 ${MAX_PENDING_PER_USER}개 있습니다. 검수가 끝난 뒤 다시 제출해 주세요.` }, 429);

    const parent = await db.from(table)
        .insert([{ title: body.title.trim(), description: isStr(body.description) ? body.description : '', creator_id: user.id, status: 'draft', source: 'ugc' }])
        .select('id');
    if (parent.error || !parent.data || !parent.data[0]) return errorResponse('저장에 실패했습니다.', 500);
    const id = parent.data[0].id;

    const kids = await db.from(child).insert(toChildren(body, id));
    if (kids.error) return errorResponse('저장에 실패했습니다. 관리자에게 문의해 주세요.', 500);

    return jsonResponse({ success: true, [idKey]: id, status: 'draft', message: '제출되었습니다. 관리자 검수 후 공개됩니다.' }, 201);
}

const LETTERS = ['A', 'B', 'C', 'D'];

export function handleUserCreatedQuiz(request, supabase, env, deps = {}) {
    return submit(request, supabase, env, deps, {
        table: 'quizzes', child: 'quiz_questions', idKey: 'quizId', validate: validateUgcQuiz,
        toChildren: (b, id) => b.questions.map((q, idx) => {
            const answer = q.answer.trim();
            const ordered = q.wrongs.map((w) => w.trim());
            const pos = idx % 4;                       // 정답 위치는 문제 번호로 정해 고르게 분산한다
            ordered.splice(pos, 0, answer);
            return {
                quiz_id: id,
                video_id: q.media_id,
                start_time: 0,
                end_time: 15,
                answer,
                options: ordered.map((text, i) => ({ id: LETTERS[i], text, isCorrect: i === pos })),
                is_embeddable: true,
            };
        }),
    });
}

export function handleUserCreatedContent(request, supabase, env, deps = {}) {
    return submit(request, supabase, env, deps, {
        table: 'worldcups', child: 'worldcup_items', idKey: 'worldcupId', validate: validateUgcWorldcup,
        toChildren: (b, id) => b.items.map((it) => ({ worldcup_id: id, name: it.name.trim(), image_url: it.image_url })),
    });
}
