import { API } from './_lib/seo.js';

// GET /sitemap.xml → 워커의 /api/sitemap (공개된 퀴즈·월드컵만, 새 콘텐츠가 생기면 자동 반영). 1시간 캐시.
export async function onRequestGet() {
    try {
        const r = await fetch(`${API}/api/sitemap`, { cf: { cacheTtl: 3600, cacheEverything: true } });
        if (r.ok) {
            return new Response(r.body, {
                status: 200,
                headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=3600' },
            });
        }
    } catch { /* fallthrough */ }
    return new Response('sitemap temporarily unavailable', { status: 503, headers: { 'Retry-After': '300' } });
}
