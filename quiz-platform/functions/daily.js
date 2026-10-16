import { API, SITE } from './_lib/seo.js';

// GET /daily → 오늘의 퀴즈로 이동 (KST 기준 하루 한 개, 모두 같은 퀴즈)
export async function onRequestGet() {
    let target = `${SITE}/quiz-list`;
    try {
        const r = await fetch(`${API}/api/daily-pick`, { cf: { cacheTtl: 300, cacheEverything: true } });
        if (r.ok) {
            const { slug, id } = await r.json();
            const key = slug || id;
            if (typeof key === 'string' && /^[A-Za-z0-9-]{3,64}$/.test(key)) target = `${SITE}/quiz-play?id=${encodeURIComponent(key)}`;
        }
    } catch { /* 목록으로 대체 */ }
    return new Response(null, { status: 302, headers: { Location: target, 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' } });
}
