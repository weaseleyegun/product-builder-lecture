// drafts.js - 초안 등록·목록·공개·반려 (관리자 전용)
//
//   POST /api/admin/drafts                        {kind:'quiz'|'worldcup', draft, source?}  → 201 {id,kind} | 422 {errors}
//   GET  /api/admin/drafts                        → {drafts:[{kind,id,title,description,source,created_at,count,preview,samples}]}
//   POST /api/admin/drafts/:kind/:id/publish      → status='published' (자식이 충분할 때만)
//   POST /api/admin/drafts/:kind/:id/reject       {reason} → status='hidden'
//
// 모든 요청은 Authorization: Bearer <관리자 JWT> 가 필요하다. DB 작업은 같은 JWT를 실은 클라이언트로 수행하므로
// RLS는 "그 관리자"의 권한으로 적용된다(비밀번호 로그인 불필요). 초안은 RLS상 관리자·작성자 외에는 읽을 수 없다.

import { createClient } from '@supabase/supabase-js';
import { jsonResponse, errorResponse } from '../helpers/cors.js';
import { UUID_RE, childCount } from '../helpers/list.js';
import { validateQuizDraft, validateWorldcupDraft } from '../quality/validate.js';
import { LIMITS } from '../quality/constants.js';

const KINDS = {
    quiz: {
        table: 'quizzes', child: 'quiz_questions', validate: validateQuizDraft, previewKey: 'answer',
        childSelect: 'answer, video_id, start_time, question_text',
        samples: (kids) => kids.slice(0, 3).map((k) => ({ answer: k.answer, videoId: k.video_id, startTime: k.start_time, questionText: k.question_text })),
        enough: (n) => n >= LIMITS.questions[0],
    },
    worldcup: {
        table: 'worldcups', child: 'worldcup_items', validate: validateWorldcupDraft, previewKey: 'name',
        childSelect: 'name, image_url',
        // 이미지 없이 이름만으로 만든 월드컵은 검수자가 후보를 전부 볼 수 있게 한다
        samples: (kids) => kids.slice(0, kids.every((k) => !k.image_url) ? 64 : 8).map((k) => ({ name: k.name, image_url: k.image_url })),
        enough: (n) => LIMITS.worldcupSizes.includes(n),
    },
};
const MAX_PENDING_DRAFTS = 30;     // 검수 대기 초안이 이만큼 쌓이면 새 초안을 받지 않는다
const CONTEXT_ROWS = 500;          // 중복 검사에 쓸 기존 콘텐츠 수(모든 상태 포함)
const PREVIEW_ROWS = 8;
const MAX_BODY_CHARS = 200 * 1024; // 요청 본문 상한

// kind 이름 → 설정. 문자열만 허용하고 프로토타입 키('__proto__', 'constructor' …)는 거절한다.
function getKind(name) {
    return typeof name === 'string' && Object.prototype.hasOwnProperty.call(KINDS, name) ? KINDS[name] : null;
}

async function authenticateAdmin(request, supabase, env) {
    const header = request.headers.get('Authorization') || '';
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : null;
    if (!token) return { err: errorResponse('Authorization header missing', 401) };

    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data || !data.user) return { err: errorResponse('Invalid or expired token', 401) };
    if (data.user.email !== (env.ADMIN_EMAIL || 'agent@quizrank.com')) return { err: errorResponse('Admin only', 403) };
    return { token, user: data.user };
}

// 본문을 크기 제한과 함께 JSON으로 읽는다. { json } | { status, message }
async function readJson(request) {
    let text;
    try { text = await request.text(); } catch { return { status: 400, message: 'Invalid body' }; }
    if (text.length > MAX_BODY_CHARS) return { status: 413, message: 'Request body too large' };
    try { return { json: JSON.parse(text) }; } catch { return { status: 400, message: 'Invalid JSON' }; }
}

// 보기는 id/text/isCorrect 세 필드만 저장하고 id는 A~D로 고정한다(임의 키·값 저장 방지).
const LETTERS = ['A', 'B', 'C', 'D'];
const sanitizeOptions = (opts) => opts.map((o, i) => ({ id: LETTERS[i], text: o.text, isCorrect: o.isCorrect === true }));

async function createDraft(request, db, user) {
    const parsed = await readJson(request);
    if (parsed.status) return errorResponse(parsed.message, parsed.status);
    const body = parsed.json;
    if (!body || typeof body !== 'object') return errorResponse('Invalid JSON', 400);

    const kindName = body.kind;
    const kind = getKind(kindName);
    if (!kind) return errorResponse('kind must be quiz or worldcup', 400);
    if (!body.draft || typeof body.draft !== 'object') return errorResponse('draft is required', 400);
    const source = body.source === 'curated' ? 'curated' : 'daily';

    // 검수 대기열 폭주 방지
    // 회원 제출(ugc)은 사용자별 상한이 따로 있으므로 운영 초안 대기열 계산에서 제외한다 (스팸으로 생성기가 막히지 않게)
    const pending = await db.from(kind.table).select('id').eq('status', 'draft').neq('source', 'ugc').limit(MAX_PENDING_DRAFTS);
    if (pending.error) return errorResponse(pending.error.message, 500);
    if ((pending.data || []).length >= MAX_PENDING_DRAFTS) return errorResponse('검수 대기 중인 초안이 너무 많습니다. 먼저 처리해 주세요.', 429);

    // 중복 검사용 기존 콘텐츠. 저장 도중 실패해 숨겨진 행(insert_failed)은 제외해 같은 제목으로 재시도할 수 있게 한다.
    const existing = await db.from(kind.table).select('title, description, hidden_reason').order('created_at', { ascending: false }).limit(CONTEXT_ROWS);
    if (existing.error) return errorResponse(existing.error.message, 500);
    const rows = (existing.data || []).filter((r) => r.hidden_reason !== 'insert_failed');
    const ctx = {
        existingTitles: rows.map((r) => r.title).filter(Boolean),
        existingDescriptions: rows.map((r) => r.description).filter(Boolean),
    };

    const result = kind.validate(body.draft, ctx);
    if (!result.ok) return jsonResponse({ errors: result.errors, warnings: result.warnings }, 422);

    const d = body.draft;
    const parent = await db.from(kind.table)
        .insert([{ title: d.title, description: d.description, creator_id: user.id, status: 'draft', source }])
        .select('id');
    if (parent.error || !parent.data || !parent.data[0]) return errorResponse('DB insert failed: ' + (parent.error ? parent.error.message : 'no row'), 500);
    const id = parent.data[0].id;

    const children = kindName === 'quiz'
        ? d.questions.map((q) => {
            const media = q.videoId !== undefined && q.videoId !== null && q.videoId !== '';
            return {
                quiz_id: id,
                video_id: media ? q.videoId : null,
                start_time: media ? q.startTime : 0,
                end_time: media ? q.endTime : null,
                answer: q.answer,
                options: sanitizeOptions(q.options),
                question_text: typeof q.questionText === 'string' && q.questionText.trim() ? q.questionText.trim() : null,
                explanation: typeof q.explanation === 'string' && q.explanation.trim() ? q.explanation.trim() : null,
                is_embeddable: true,
            };
        })
        : d.items.map((it) => ({ worldcup_id: id, name: it.name, image_url: d.textOnly === true ? null : it.image_url }));

    const kids = await db.from(kind.child).insert(children);
    if (kids.error) {
        // DELETE 정책이 없어 지울 수 없으므로, 반쪽짜리 초안이 검수 목록에 남지 않게 숨긴다. 숨기기마저 실패하면 그 사실도 알린다.
        const hide = await db.from(kind.table).update({ status: 'hidden', hidden_reason: 'insert_failed' }).eq('id', id);
        const extra = hide && hide.error ? ` (그리고 초안 숨김도 실패: ${hide.error.message} — 대시보드에서 id ${id} 초안을 반려해 주세요)` : '';
        return errorResponse('DB insert failed: ' + kids.error.message + extra, 500);
    }
    return jsonResponse({ id, kind: kindName }, 201);
}

async function listDrafts(db) {
    const drafts = [];
    for (const [name, kind] of Object.entries(KINDS)) {
        const { data, error } = await db.from(kind.table)
            .select(`id, title, description, source, created_at, ${kind.child}(${kind.childSelect})`)
            .eq('status', 'draft')
            .order('created_at', { ascending: true });
        if (error) return errorResponse(error.message, 500);
        for (const row of data || []) {
            const kids = Array.isArray(row[kind.child]) ? row[kind.child] : [];
            drafts.push({
                kind: name, id: row.id, title: row.title, description: row.description,
                source: row.source, created_at: row.created_at,
                count: kids.length,
                preview: kids.slice(0, PREVIEW_ROWS).map((k) => k[kind.previewKey]),
                samples: kind.samples(kids),
            });
        }
    }
    return jsonResponse({ drafts });
}

async function decide(request, db, kindName, id, action) {
    const kind = getKind(kindName);
    if (!kind) return errorResponse('kind must be quiz or worldcup', 400);
    if (!UUID_RE.test(id || '')) return errorResponse('id must be a uuid', 400);

    let patch;
    if (action === 'publish') {
        // 공개 직전에 자식(문제/후보)이 충분한지 다시 확인한다 (저장 도중 중단된 초안이 공개되는 것을 막음)
        const cur = await db.from(kind.table).select(`id, ${kind.child}(count)`).eq('id', id).eq('status', 'draft').single();
        if (cur.error || !cur.data) return errorResponse('Draft not found', 404);
        const n = childCount(cur.data, kind.child);
        if (!kind.enough(n)) return errorResponse(`초안의 ${kindName === 'quiz' ? '문제' : '후보'} 수(${n})가 공개 기준에 맞지 않습니다.`, 409);
        patch = { status: 'published', published_at: new Date().toISOString() };
    } else {
        const parsed = await readJson(request);
        const reason = parsed.json && typeof parsed.json.reason === 'string' ? parsed.json.reason.trim() : '';
        if (!reason || reason.length > 200) return errorResponse('reason is required (1~200 chars)', 400);
        patch = { status: 'hidden', hidden_reason: `rejected: ${reason}` };
    }

    // 초안만 처리한다(이미 공개/숨김된 콘텐츠를 실수로 바꾸지 않도록)
    const { data, error } = await db.from(kind.table).update(patch).eq('id', id).eq('status', 'draft').select('id');
    if (error) return errorResponse(error.message, 500);
    if (!data || data.length === 0) return errorResponse('Draft not found', 404);
    return jsonResponse({ success: true, id, status: patch.status });
}

export async function handleDrafts(request, url, supabase, env, deps = {}) {
    const auth = await authenticateAdmin(request, supabase, env);
    if (auth.err) return auth.err;

    const makeDb = deps.makeClient || ((token) => createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
        global: { headers: { Authorization: `Bearer ${token}` } },
        auth: { persistSession: false, autoRefreshToken: false },
    }));
    const db = makeDb(auth.token);

    const parts = url.pathname.split('/').filter(Boolean);   // ['api','admin','drafts', kind?, id?, action?]
    if (parts.length === 3) {
        if (request.method === 'POST') return createDraft(request, db, auth.user);
        if (request.method === 'GET') return listDrafts(db);
        return errorResponse('Method not allowed', 405);
    }
    if (parts.length === 6 && request.method === 'POST' && (parts[5] === 'publish' || parts[5] === 'reject')) {
        return decide(request, db, parts[3], parts[4], parts[5]);
    }
    return errorResponse('Not Found', 404);
}
