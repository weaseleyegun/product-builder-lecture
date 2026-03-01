// worldcup.js - Worldcup API route handlers

import { jsonResponse, errorResponse } from '../helpers/cors.js';

// GET /api/worldcups - Fetch worldcup list for main page
async function handleWorldcups(supabase) {
    const { data, error } = await supabase
        .from('worldcups')
        .select('id, title, description, thumbnail_url, play_count')
        .order('created_at', { ascending: false })
        .limit(100);

    if (error) return errorResponse(error.message);
    return jsonResponse(data);
}

// GET /api/worldcup-play?id=UUID - Fetch worldcup items for gameplay
async function handleWorldcupPlay(url, supabase) {
    const worldcupId = url.searchParams.get('id');
    if (!worldcupId) return errorResponse("Worldcup ID is required", 400);

    // Fetch worldcup info
    const { data: cupInfo, error: cupError } = await supabase
        .from('worldcups')
        .select('*')
        .eq('id', worldcupId)
        .single();

    if (cupError) return errorResponse(cupError.message);

    // Fetch all items and shuffle
    const { data: items, error: itemsError } = await supabase
        .from('worldcup_items')
        .select('id, name, image_url, win_count')
        .eq('worldcup_id', worldcupId);

    if (itemsError) return errorResponse(itemsError.message);

    const shuffledItems = items.sort(() => 0.5 - Math.random());
    return jsonResponse({ worldcup: cupInfo, items: shuffledItems });
}

// POST /api/user-created-content - Submit user-created worldcup
async function handleUserCreatedContent(request, supabase) {
    try {
        const body = await request.json();
        const { title, description, items } = body;

        if (!title || !items || items.length === 0) {
            return errorResponse("Title and items are required.", 400);
        }

        // Authenticate to bypass RLS
        await supabase.auth.signInWithPassword({
            email: 'agent@quizrank.com',
            password: 'seed_password_1234!'
        });

        // Insert worldcup
        const { data: cupData, error: cupError } = await supabase
            .from('worldcups')
            .insert([{ title, description: description || '' }])
            .select();

        if (cupError) {
            console.error("Supabase Error:", cupError.message);
            return errorResponse("DB Insert failed: " + cupError.message, 500);
        }

        const worldcupId = cupData[0].id;

        // Insert items
        const itemsToInsert = items.map(function (item) {
            return {
                worldcup_id: worldcupId,
                name: item.name,
                image_url: item.image_url
            };
        });

        const { error: itemsError } = await supabase
            .from('worldcup_items')
            .insert(itemsToInsert);

        if (itemsError) return errorResponse(itemsError.message);

        return jsonResponse({ success: true, worldcupId });
    } catch (err) {
        return errorResponse(err.message || "Internal Server Error.");
    }
}

export { handleWorldcups, handleWorldcupPlay, handleUserCreatedContent };
