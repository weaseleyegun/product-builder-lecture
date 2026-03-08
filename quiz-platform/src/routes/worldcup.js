// worldcup.js - Worldcup API route handlers

import { jsonResponse, errorResponse } from '../helpers/cors.js';

// GET /api/worldcups?sort=rank|latest - Fetch worldcup list for main page
async function handleWorldcups(url, supabase) {
    const sort = url.searchParams.get('sort') || 'rank';

    let query = supabase
        .from('worldcups')
        .select('id, slug, title, description, thumbnail_url, play_count, created_at, creator_id')
        .limit(100);

    if (sort === 'rank') {
        query = query.order('play_count', { ascending: false });
    } else if (sort === 'latest') {
        query = query.order('created_at', { ascending: false });
    }

    const { data, error } = await query;
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

    // Increment play_count
    await supabase.rpc('increment_worldcup_play_count', { wc_id: actualId }).maybeSingle();
    // Fallback: direct update if rpc fails
    await supabase.from('worldcups').update({ play_count: (cupInfo.play_count || 0) + 1 }).eq('id', actualId);

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

        // Verify Token
        const authHeader = request.headers.get('Authorization') || '';
        const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
        if (!token) return errorResponse("로그인이 필요합니다.", 401);

        const { data: userData, error: userError } = await supabase.auth.getUser(token);
        if (userError || !userData?.user) return errorResponse("유효하지 않은 토큰입니다.", 401);

        const creatorId = userData.user.id;

        // Authenticate to bypass RLS
        await supabase.auth.signInWithPassword({
            email: 'agent@quizrank.com',
            password: 'seed_password_1234!'
        });

        // Insert worldcup
        const { data: cupData, error: cupError } = await supabase
            .from('worldcups')
            .insert([{ title, description: description || '', creator_id: creatorId }])
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
