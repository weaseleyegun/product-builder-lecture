// worldcup.js - Worldcup API route handlers

import { jsonResponse, errorResponse } from '../helpers/cors.js';
import { signInAsAdmin } from '../helpers/auth.js';
import { parsePaging, withThumbUrl } from '../helpers/list.js';

// GET /api/worldcups?sort=rank|latest&limit=60&offset=0 - Fetch worldcup list (published only)
async function handleWorldcups(url, supabase) {
    const sort = url.searchParams.get('sort') || 'rank';
    const { from, to } = parsePaging(url);

    let query = supabase
        .from('worldcups')
        .select('id, slug, title, description, thumbnail_url, play_count, created_at, creator_id')
        .eq('status', 'published')
        .range(from, to);

    if (sort === 'rank') {
        query = query.order('play_count', { ascending: false });
    } else if (sort === 'latest') {
        query = query.order('created_at', { ascending: false });
    }

    const { data, error } = await query;
    if (error) return errorResponse(error.message);
    return jsonResponse((data || []).map((row) => withThumbUrl(row, 'worldcup', url.origin)));
}

// GET /api/worldcup-play?id=UUID_OR_SLUG - Fetch worldcup items for gameplay (published only)
// play_count는 여기서 올리지 않는다 → POST /api/play-start (세션당 하루 1회)
async function handleWorldcupPlay(url, supabase) {
    const worldcupId = url.searchParams.get('id');
    if (!worldcupId) return errorResponse("Worldcup ID or Slug is required", 400);

    // Fetch worldcup info (Try ID first, then slug)
    let cupQuery = supabase.from('worldcups').select('*').eq('status', 'published');
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

    // 후보가 2개 미만이면 토너먼트가 성립하지 않는다 (빈 월드컵 노출 방지)
    if (!items || items.length < 2) return errorResponse("Worldcup not found", 404);

    const shuffledItems = items.sort(() => 0.5 - Math.random());
    return jsonResponse({ worldcup: withThumbUrl(cupInfo, 'worldcup', url.origin), items: shuffledItems });
}

// POST /api/user-created-content - Submit user-created worldcup
async function handleUserCreatedContent(request, supabase, env) {
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
        await signInAsAdmin(supabase, env);

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
