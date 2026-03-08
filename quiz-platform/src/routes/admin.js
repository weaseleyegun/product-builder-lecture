// admin.js - Admin API route handlers (Server-side JWT verification)

import { jsonResponse, errorResponse } from '../helpers/cors.js';

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
        .select('creator_id')
        .eq('id', itemId)
        .single();

    if (itemError || !itemData) {
        return { user: null, err: errorResponse('Item not found', 404) };
    }

    if (itemData.creator_id !== data.user.id) {
        return { user: null, err: errorResponse('Access denied: not the owner or admin', 403) };
    }

    return { user: data.user, isAdmin: false, err: null };
}
// ─────────────────────────────────────────────────────────────────────────────

// PUT /api/admin/quiz/:id
async function handleUpdateQuiz(request, url, supabase, env) {
    if (request.method !== 'PUT') return errorResponse('Method not allowed', 405);

    const id = url.pathname.split('/').pop();
    if (!id || id === 'quiz') return errorResponse('Quiz ID is required', 400);

    const { err } = await verifyOwnerOrAdminToken(request, 'quizzes', id, supabase, env);
    if (err) return err;

    try {
        const body = await request.json();
        const { title, description, thumbnail_url } = body;

        await supabase.auth.signInWithPassword({
            email: 'agent@quizrank.com',
            password: env.ADMIN_PASSWORD || 'seed_password_1234!'
        });

        const { error: updateErr } = await supabase
            .from('quizzes')
            .update({ title, description, thumbnail_url })
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

    const { err } = await verifyOwnerOrAdminToken(request, 'worldcups', id, supabase, env);
    if (err) return err;

    try {
        const body = await request.json();
        const { title, description, thumbnail_url } = body;

        await supabase.auth.signInWithPassword({
            email: 'agent@quizrank.com',
            password: env.ADMIN_PASSWORD || 'seed_password_1234!'
        });

        const { error: updateErr } = await supabase
            .from('worldcups')
            .update({ title, description, thumbnail_url })
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
        await supabase.auth.signInWithPassword({
            email: 'agent@quizrank.com',
            password: env.ADMIN_PASSWORD || 'seed_password_1234!'
        });
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
        await supabase.auth.signInWithPassword({
            email: 'agent@quizrank.com',
            password: env.ADMIN_PASSWORD || 'seed_password_1234!'
        });
        const { error: deleteErr } = await supabase.from('worldcups').delete().eq('id', id);
        if (deleteErr) return errorResponse('DB Delete Error: ' + deleteErr.message, 500);
        return jsonResponse({ success: true, message: 'Worldcup deleted successfully' });
    } catch (err) {
        return errorResponse(err.message, 500);
    }
}

export { handleUpdateQuiz, handleUpdateWorldcup, handleDeleteQuiz, handleDeleteWorldcup };
