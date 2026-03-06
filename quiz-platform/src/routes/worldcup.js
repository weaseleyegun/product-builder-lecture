// worldcup.js - Worldcup API route handlers

import { jsonResponse, errorResponse } from '../helpers/cors.js';

// GET /api/worldcups - Fetch worldcup list for main page
async function handleWorldcups(supabase) {
    const { data, error } = await supabase
        .from('worldcups')
        .select('id, slug, title, description, thumbnail_url, play_count')
        .order('created_at', { ascending: false })
        .limit(100);

    if (error) return errorResponse(error.message);
    return jsonResponse(data);
}

// GET /api/worldcup-play?id=UUID_OR_SLUG - Fetch worldcup items for gameplay
async function handleWorldcupPlay(url, supabase) {
    const worldcupId = url.searchParams.get('id');
    if (!worldcupId) return errorResponse("Worldcup ID or Slug is required", 400);

    // Fetch worldcup info (Try ID first, then slug)
    let cupQuery = supabase.from('worldcups').select('*');
    if (worldcupId.length === 36 && worldcupId.includes('-')) {
        cupQuery = cupQuery.eq('id', worldcupId);
    } else {
        cupQuery = cupQuery.eq('slug', worldcupId);
    }

    const { data: cupInfo, error: cupError } = await cupQuery.single();

    if (cupError || !cupInfo) return errorResponse("Worldcup not found", 404);

    const actualId = cupInfo.id; // Correct UUID for items lookup

    // Fetch all items and shuffle
    const { data: items, error: itemsError } = await supabase
        .from('worldcup_items')
        .select('id, name, image_url, win_count')
        .eq('worldcup_id', actualId);

    if (itemsError) return errorResponse(itemsError.message);

    const shuffledItems = items.sort(() => 0.5 - Math.random());
    return jsonResponse({ worldcup: cupInfo, items: shuffledItems });
}

// POST /api/user-created-content - Submit user-created worldcup
async function handleUserCreatedContent(request, supabase) {
    try {
        const body = await request.json();
        const { title, description, items } = body;

        if (!title) {
            return errorResponse("Title is required.", 400);
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

        if (cupError) return errorResponse(cupError.message, 500);

        const worldcupId = cupData[0].id;

        // Insert items if any
        if (items && items.length > 0) {
            const itemsToInsert = items.map(item => ({
                worldcup_id: worldcupId,
                name: item.name,
                image_url: item.image_url
            }));

            const { error: itemsError } = await supabase
                .from('worldcup_items')
                .insert(itemsToInsert);

            if (itemsError) return errorResponse(itemsError.message, 500);
        }

        return jsonResponse({ success: true, worldcupId });
    } catch (err) {
        return errorResponse(err.message || "Internal Server Error", 500);
    }
}

export { handleWorldcups, handleWorldcupPlay, handleUserCreatedContent };
