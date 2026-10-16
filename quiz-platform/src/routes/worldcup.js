// worldcup.js - Worldcup API route handlers

import { jsonResponse, errorResponse } from '../helpers/cors.js';
import { parsePaging, withThumbUrl, childCount, stripKey } from '../helpers/list.js';

// GET /api/worldcups?sort=rank|latest&limit=100&offset=0 - Fetch worldcup list (published, 후보 2개 이상만)
async function handleWorldcups(url, supabase) {
    const sort = url.searchParams.get('sort') || 'rank';
    const { from, to } = parsePaging(url);

    let query = supabase
        .from('worldcups')
        .select('id, slug, title, description, thumbnail_url, has_thumbnail_data, play_count, created_at, creator_id, worldcup_items(count)')
        .eq('status', 'published')
        .range(from, to);

    if (sort === 'rank') {
        query = query.order('play_count', { ascending: false });
    } else if (sort === 'latest') {
        query = query.order('created_at', { ascending: false });
    }

    // 정렬 동점일 때 페이지 사이에서 행이 중복/누락되지 않도록 id를 마지막 정렬 키로 둔다
    query = query.order('id', { ascending: true });

    const { data, error } = await query;
    if (error) return errorResponse(error.message);
    // 후보가 2개 미만인 월드컵(생성 도중 실패 등)은 노출하지 않는다
    const rows = (data || []).filter((row) => childCount(row, 'worldcup_items') >= 2).map((row) => stripKey(row, 'worldcup_items'));
    return jsonResponse(rows.map((row) => withThumbUrl(row, 'worldcup', url.origin)));
}

// GET /api/worldcup-play?id=UUID_OR_SLUG - Fetch worldcup items for gameplay (published only)
// play_count는 여기서 올리지 않는다 → POST /api/play-start (세션당 하루 1회)
async function handleWorldcupPlay(url, supabase) {
    const worldcupId = url.searchParams.get('id');
    if (!worldcupId) return errorResponse("Worldcup ID or Slug is required", 400);

    // Fetch worldcup info (Try ID first, then slug)
    let cupQuery = supabase.from('worldcups').select('id, slug, title, description, thumbnail_url, has_thumbnail_data, play_count, created_at, creator_id, status, source').eq('status', 'published');
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

export { handleWorldcups, handleWorldcupPlay };
