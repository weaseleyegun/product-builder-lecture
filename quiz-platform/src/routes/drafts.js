// drafts.js - 초안 등록·목록·공개·반려 (관리자 전용)
//
//   POST /api/admin/drafts                        {kind:'quiz'|'worldcup', draft, source?}  → 201 {id,kind} | 422 {errors}
//   GET  /api/admin/drafts                        → {drafts:[{kind,id,title,description,source,created_at,count,preview}]}
//   POST /api/admin/drafts/:kind/:id/publish      → status='published'
//   POST /api/admin/drafts/:kind/:id/reject       {reason} → status='hidden'
//
// 모든 요청은 Authorization: Bearer <관리자 JWT> 가 필요하다. DB 작업은 같은 JWT를 실은 클라이언트로 수행하므로
// RLS는 "그 관리자"의 권한으로 적용된다(비밀번호 로그인 불필요). 초안은 RLS상 관리자·작성자 외에는 읽을 수 없다.

import { createClient } from '@supabase/supabase-js';
import { jsonResponse, errorResponse } from '../helpers/cors.js';
import { UUID_RE } from '../helpers/list.js';
import { validateQuizDraft, validateWorldcupDraft } from '../quality/validate.js';

const KINDS = {
    quiz: { table: 'quizzes', child: 'quiz_questions', validate: validateQuizDraft, previewKey: 'answer' },
    worldcup: { table: 'worldcups', child: 'worldcup_items', validate: validateWorldcupDraft, previewKey: 'name' },
};
const MAX_PENDING_DRAFTS = 30;     // 검수 대기 초안이 이만큼 쌓이면 새 초안을 받지 않는다
const CONTEXT_ROWS = 500;          // 중복 검사에 쓸 기존 콘텐츠 수(모든 상태 포함)
const PREVIEW_ROWS = 8;

async function authenticateAdmin(request, supabase, env) {
    const header = request.headers.get('Authorization') || '';
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : null;
    if (!token) return { err: errorResponse('Authorization header missing', 401) };

    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data || !data.user) return { err: errorResponse('Invalid or expired token', 401) };
    if (data.user.email !== (env.ADMIN_EMAIL || 'agent@quizrank.com')) return { err: errorResponse('Admin only', 403) };
    return { token, user: data.user };
}

async function readJson(request) {
    try { return await request.json(); } catch { return undefined; }
}

async function createDraft(request, db, user) {
    const body = await readJson(request);
    if (!body || typeof body !== 'object') return errorResponse('Invalid JSON', 400);
    const kind = KINDS[body.kind];
    if (!kind) return errorResponse('kind must be quiz or worldcup', 400);
    if (!body.draft || typeof body.draft !== 'object') return errorResponse('draft is required', 400);
    const source = body.source === 'curated' ? 'curated' : 'daily';

    // 검수 대기열 폭주 방지
    const pending = await db.from(kind.table).select('id').eq('status', 'draft').limit(MAX_PENDING_DRAFTS);
    if (pending.error) return errorResponse(pending.error.message, 500);
    if ((pending.data || []).length >= MAX_PENDING_DRAFTS) return errorResponse('검수 대기 중인 초안이 너무 많습니다. 먼저 처리해 주세요.', 429);

    // 중복 검사용 기존 콘텐츠(숨김 포함)
    const existing = await db.from(kind.table).select('title, description').order('created_at', { ascending: false }).limit(CONTEXT_ROWS);
    if (existing.error) return errorResponse(existing.error.message, 500);
    const ctx = {
        existingTitles: (existing.data || []).map((r) => r.title).filter(Boolean),
        existingDescriptions: (existing.data || []).map((r) => r.description).filter(Boolean),
    };

    const result = kind.validate(body.draft, ctx);
    if (!result.ok) return jsonResponse({ errors: result.errors, warnings: result.warnings }, 422);

    const d = body.draft;
    const parent = await db.from(kind.table)
        .insert([{ title: d.title, description: d.description, creator_id: user.id, status: 'draft', source }])
        .select('id');
    if (parent.error || !parent.data || !parent.data[0]) return errorResponse('DB insert failed: ' + (parent.error ? parent.error.message : 'no row'), 500);
    const id = parent.data[0].id;

    const children = body.kind === 'quiz'
        ? d.questions.map((q) => ({
            quiz_id: id, video_id: q.videoId, start_time: q.startTime, end_time: q.endTime,
            answer: q.answer, options: q.options, is_embeddable: true,
        }))
        : d.items.map((it) => ({ worldcup_id: id, name: it.name, image_url: it.image_url }));

    const kids = await db.from(kind.child).insert(children);
    if (kids.error) {
        // DELETE 정책이 없어 지울 수 없으므로, 반쪽짜리 초안이 검수 목록에 남지 않게 숨긴다.
        await db.from(kind.table).update({ status: 'hidden', hidden_reason: 'insert_failed' }).eq('id', id);
        return errorResponse('DB insert failed: ' + kids.error.message, 500);
    }
    return jsonResponse({ id, kind: body.kind }, 201);
}

async function listDrafts(db) {
    const drafts = [];
    for (const [name, kind] of Object.entries(KINDS)) {
        const { data, error } = await db.from(kind.table)
            .select(`id, title, description, source, created_at, ${kind.child}(${kind.previewKey})`)
            .eq('status', 'draft')
            .order('created_at', { ascending: true });
        if (error) return errorResponse(error.message, 500);
        for (const row of data || []) {
            const kids = Array.isArray(row[kind.child]) ? row[kind.child] : [];
            drafts.push({
                kind: name, id: row.id, title: row.title, description: row.description,
                source: row.source, created_at: row.created_at,
                count: kids.length, preview: kids.slice(0, PREVIEW_ROWS).map((k) => k[kind.previewKey]),
            });
        }
    }
    return jsonResponse({ drafts });
}

async function decide(request, db, kindName, id, action) {
    const kind = KINDS[kindName];
    if (!kind) return errorResponse('kind must be quiz or worldcup', 400);
    if (!UUID_RE.test(id || '')) return errorResponse('id must be a uuid', 400);

    let patch;
    if (action === 'publish') {
        patch = { status: 'published', published_at: new Date().toISOString() };
    } else {
        const body = await readJson(request);
        const reason = body && typeof body.reason === 'string' ? body.reason.trim() : '';
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
