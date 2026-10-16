// admin.js - Admin API route handlers (Server-side JWT verification)

import { jsonResponse, errorResponse } from '../helpers/cors.js';
import { signInAsAdmin } from '../helpers/auth.js';
import { THUMB_URL_RE } from '../helpers/list.js';

// 수정 요청의 썸네일 값을 DB 갱신 필드로 변환한다.
//  - 관리자 화면이 받아 간 우리 서버 썸네일 URL(/api/thumb/...)을 그대로 돌려보낸 경우: 건드리지 않음(저장된 base64 보존)
//  - 빈 문자열: 썸네일 제거(URL·base64 모두)
//  - 그 외 값: 새 URL로 교체
export function thumbnailPatch(value) {
    if (value === undefined || value === null) return {};
    if (typeof value !== 'string') return {};
    if (THUMB_URL_RE.test(value)) return {};
    if (value.trim() === '') return { thumbnail_url: null, thumbnail_data: null };
    return { thumbnail_url: value };
}

// ── Auth guard ───────────────────────────────────────────────────────────────
// Extracts Bearer token from Authorization header and verifies it with Supabase.
async function verifyOwnerOrAdminToken(request, tableName, itemId, supabase, env) {
    const authHeader = request.headers.get('Authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;

    if (!token) {
        return { user: null, err: errorResponse('Authorization header missing', 401) };
    }

    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user) {
        return { user: null, err: errorResponse('Invalid or expired token', 401) };
    }

    const adminEmail = env.ADMIN_EMAIL || 'agent@quizrank.com';
    const isAdmin = data.user.email === adminEmail;

    if (isAdmin) {
        return { user: data.user, isAdmin: true, err: null };
    }

    // Check ownership
    const { data: itemData, error: itemError } = await supabase
        .from(tableName)
        .select('creator_id, status')
        .eq('id', itemId)
        .single();

    if (itemError || !itemData) {
        return { user: null, err: errorResponse('Item not found', 404) };
    }

    if (itemData.creator_id !== data.user.id) {
        return { user: null, err: errorResponse('Access denied: not the owner or admin', 403) };
    }

    return { user: data.user, isAdmin: false, status: itemData.status, err: null };
}

// 공개된 콘텐츠의 제목·설명·썸네일은 운영자만 바꿀 수 있다 (검수를 통과한 내용이 사후에 바뀌지 않게). 작성자는 초안일 때만 수정한다.
const ownerCannotEdit = (v) => (!v.isAdmin && v.status !== 'draft') ? errorResponse('공개된 콘텐츠는 운영자만 수정할 수 있습니다.', 403) : null;
// ─────────────────────────────────────────────────────────────────────────────

// PUT /api/admin/quiz/:id
async function handleUpdateQuiz(request, url, supabase, env) {
    if (request.method !== 'PUT') return errorResponse('Method not allowed', 405);

    const id = url.pathname.split('/').pop();
    if (!id || id === 'quiz') return errorResponse('Quiz ID is required', 400);

    const verified = await verifyOwnerOrAdminToken(request, 'quizzes', id, supabase, env);
    if (verified.err) return verified.err;
    const locked = ownerCannotEdit(verified);
    if (locked) return locked;

    try {
        const body = await request.json();
        const { title, description, thumbnail_url } = body;

        await signInAsAdmin(supabase, env);

        const { error: updateErr } = await supabase
            .from('quizzes')
            .update({ title, description, ...thumbnailPatch(thumbnail_url) })
            .eq('id', id);

        if (updateErr) return errorResponse('DB Update Error: ' + updateErr.message, 500);
        return jsonResponse({ success: true, message: 'Quiz updated successfully' });
    } catch (err) {
        return errorResponse(err.message || 'Internal Server Error', 500);
    }
}

// PUT /api/admin/worldcup/:id
async function handleUpdateWorldcup(request, url, supabase, env) {
    if (request.method !== 'PUT') return errorResponse('Method not allowed', 405);

    const id = url.pathname.split('/').pop();
    if (!id || id === 'worldcup') return errorResponse('Worldcup ID is required', 400);

    const verified = await verifyOwnerOrAdminToken(request, 'worldcups', id, supabase, env);
    if (verified.err) return verified.err;
    const locked = ownerCannotEdit(verified);
    if (locked) return locked;

    try {
        const body = await request.json();
        const { title, description, thumbnail_url } = body;

        await signInAsAdmin(supabase, env);

        const { error: updateErr } = await supabase
            .from('worldcups')
            .update({ title, description, ...thumbnailPatch(thumbnail_url) })
            .eq('id', id);

        if (updateErr) return errorResponse('DB Update Error: ' + updateErr.message, 500);
        return jsonResponse({ success: true, message: 'Worldcup updated successfully' });
    } catch (err) {
        return errorResponse(err.message || 'Internal Server Error', 500);
    }
}

// DELETE /api/admin/quiz/:id
async function handleDeleteQuiz(request, url, supabase, env) {
    const id = url.pathname.split('/').pop();
    if (!id || id === 'quiz') return errorResponse('Quiz ID is required', 400);

    const { err } = await verifyOwnerOrAdminToken(request, 'quizzes', id, supabase, env);
    if (err) return err;

    try {
        await signInAsAdmin(supabase, env);
        const { error: deleteErr } = await supabase.from('quizzes').delete().eq('id', id);
        if (deleteErr) return errorResponse('DB Delete Error: ' + deleteErr.message, 500);
        return jsonResponse({ success: true, message: 'Quiz deleted successfully' });
    } catch (err) {
        return errorResponse(err.message, 500);
    }
}

// DELETE /api/admin/worldcup/:id
async function handleDeleteWorldcup(request, url, supabase, env) {
    const id = url.pathname.split('/').pop();
    if (!id || id === 'worldcup') return errorResponse('Worldcup ID is required', 400);

    const { err } = await verifyOwnerOrAdminToken(request, 'worldcups', id, supabase, env);
    if (err) return err;

    try {
        await signInAsAdmin(supabase, env);
        const { error: deleteErr } = await supabase.from('worldcups').delete().eq('id', id);
        if (deleteErr) return errorResponse('DB Delete Error: ' + deleteErr.message, 500);
        return jsonResponse({ success: true, message: 'Worldcup deleted successfully' });
    } catch (err) {
        return errorResponse(err.message, 500);
    }
}

export { handleUpdateQuiz, handleUpdateWorldcup, handleDeleteQuiz, handleDeleteWorldcup };
