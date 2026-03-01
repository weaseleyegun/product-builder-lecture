// admin.js - Admin API route handlers

import { jsonResponse, errorResponse } from '../helpers/cors.js';

// PUT /api/admin/quiz/:id - Update quiz metadata
async function handleUpdateQuiz(request, url, supabase) {
    if (request.method !== 'PUT') return errorResponse("Method not allowed", 405);

    const id = url.pathname.split('/').pop();
    if (!id || id === 'quiz') return errorResponse("Quiz ID is required", 400);

    try {
        const body = await request.json();
        const { title, description, thumbnail_url } = body;

        // Login as admin user to get auth session for RLS
        // (This should be done at the router level in a real app, 
        // but for now we authenticate inside the handler for simplicity)
        const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
            email: 'agent@quizrank.com',
            password: 'seed_password_1234!'
        });
        if (authErr) return errorResponse("Admin Auth Failed: " + authErr.message, 401);

        const { error: updateErr } = await supabase
            .from('quizzes')
            .update({ title, description, thumbnail_url })
            .eq('id', id);

        if (updateErr) return errorResponse("DB Update Error: " + updateErr.message, 500);

        return jsonResponse({ success: true, message: "Quiz updated successfully" });
    } catch (err) {
        return errorResponse(err.message || "Internal Server Error", 500);
    }
}

// PUT /api/admin/worldcup/:id - Update worldcup metadata
async function handleUpdateWorldcup(request, url, supabase) {
    if (request.method !== 'PUT') return errorResponse("Method not allowed", 405);

    const id = url.pathname.split('/').pop();
    if (!id || id === 'worldcup') return errorResponse("Worldcup ID is required", 400);

    try {
        const body = await request.json();
        const { title, description, thumbnail_url } = body;

        const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
            email: 'agent@quizrank.com',
            password: 'seed_password_1234!'
        });
        if (authErr) return errorResponse("Admin Auth Failed: " + authErr.message, 401);

        const { error: updateErr } = await supabase
            .from('worldcups')
            .update({ title, description, thumbnail_url })
            .eq('id', id);

        if (updateErr) return errorResponse("DB Update Error: " + updateErr.message, 500);

        return jsonResponse({ success: true, message: "Worldcup updated successfully" });
    } catch (err) {
        return errorResponse(err.message || "Internal Server Error", 500);
    }
}

export { handleUpdateQuiz, handleUpdateWorldcup };
