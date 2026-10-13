// thumb.js - GET /api/thumb/:kind/:id  (DB에 base64로 저장된 썸네일을 이미지로 서빙, 브라우저/엣지 캐시 가능)

import { errorResponse, corsHeaders } from '../helpers/cors.js';
import { UUID_RE } from '../helpers/list.js';

const TABLES = { quiz: 'quizzes', worldcup: 'worldcups' };

async function handleThumbnail(url, supabase) {
    const [, , , kind, id] = url.pathname.split('/');   // ['', 'api', 'thumb', kind, id]
    const table = TABLES[kind];
    if (!table) return errorResponse('Unknown kind', 400);
    if (!UUID_RE.test(id || '')) return errorResponse('Invalid id', 400);

    // RLS가 published(또는 소유자/관리자)만 읽게 하므로 숨김 콘텐츠의 썸네일은 404가 된다.
    const { data, error } = await supabase.from(table).select('thumbnail_url').eq('id', id).single();
    if (error || !data || typeof data.thumbnail_url !== 'string') return errorResponse('Not found', 404);

    const m = data.thumbnail_url.match(/^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i);
    if (!m) return errorResponse('Not found', 404);   // image/* 이외(html 등)는 서빙하지 않는다

    const bin = atob(m[2]);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);

    return new Response(bytes, {
        status: 200,
        headers: {
            ...corsHeaders,
            'Content-Type': m[1].toLowerCase(),
            'Cache-Control': 'public, max-age=86400',
            'X-Content-Type-Options': 'nosniff',
        },
    });
}

export { handleThumbnail };
