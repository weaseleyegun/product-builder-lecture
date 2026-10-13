// thumb.js - GET /api/thumb/:kind/:id  (DB에 base64로 저장된 썸네일을 이미지로 서빙)

import { errorResponse, corsHeaders } from '../helpers/cors.js';
import { UUID_RE } from '../helpers/list.js';

const TABLES = { quiz: 'quizzes', worldcup: 'worldcups' };
// SVG는 스크립트를 실행할 수 있으므로 허용하지 않는다 (같은 출처에서 열리면 저장형 XSS가 됨)
const ALLOWED_MIME = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);

async function handleThumbnail(url, supabase) {
    const [, , , kind, id] = url.pathname.split('/');   // ['', 'api', 'thumb', kind, id]
    const table = TABLES[kind];
    if (!table) return errorResponse('Unknown kind', 400);
    if (!UUID_RE.test(id || '')) return errorResponse('Invalid id', 400);

    // RLS가 published(또는 소유자/관리자)만 읽게 하므로 숨김 콘텐츠의 썸네일은 404가 된다.
    const { data, error } = await supabase.from(table).select('thumbnail_data, thumbnail_url').eq('id', id).single();
    if (error || !data) return errorResponse('Not found', 404);

    // 새 컬럼 우선, 예전 방식(thumbnail_url에 data:)도 호환
    const raw = typeof data.thumbnail_data === 'string' ? data.thumbnail_data
        : (typeof data.thumbnail_url === 'string' && data.thumbnail_url.startsWith('data:') ? data.thumbnail_url : null);
    if (!raw) return errorResponse('Not found', 404);

    const m = raw.match(/^data:(image\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/=\s]+)$/i);
    const mime = m && m[1].toLowerCase();
    if (!m || !ALLOWED_MIME.has(mime)) return errorResponse('Not found', 404);

    let bytes;
    try {
        const bin = atob(m[2].replace(/\s+/g, ''));
        bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    } catch {
        return errorResponse('Not found', 404);   // 깨진 base64
    }

    return new Response(bytes, {
        status: 200,
        headers: {
            ...corsHeaders,
            'Content-Type': mime,
            'Cache-Control': 'public, max-age=3600',
            'X-Content-Type-Options': 'nosniff',
            'Content-Security-Policy': "default-src 'none'; sandbox",
        },
    });
}

export { handleThumbnail };
