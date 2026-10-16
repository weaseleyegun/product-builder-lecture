// helpers/sitemap.js - sitemap.xml 생성 (Pages Function /sitemap.xml 이 이 응답을 그대로 내보낸다)
//
// - 검색엔진에는 리다이렉트되지 않는 최종 주소만 알려야 하므로 '.html' 없는 주소를 쓴다 (Cloudflare Pages가 .html → 308 처리).
// - 공개(published) 콘텐츠만, 내용이 비어 있는 티어 리스트/랭킹 월드컵은 제외한다 (해당 페이지는 noindex).

const BASE = 'https://quiz-rank.com';
const STATIC_PAGES = [
    ['/', '1.0'], ['/quiz-list', '0.8'], ['/worldcup-list', '0.8'],
    ['/about', '0.5'], ['/terms', '0.3'], ['/privacy', '0.3'],
];
// 클라이언트(app.js)가 티어 리스트로 분류하는 기준과 같다
const TIER_LIKE = /티어|등급|랭킹|리스트/;

const xmlEscape = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
const day = (d) => (d ? new Date(d) : new Date()).toISOString().split('T')[0];

export async function handleSitemap(supabase) {
    try {
        const [quizRes, wcRes] = await Promise.all([
            supabase.from('quizzes').select('id, slug, created_at, published_at').eq('status', 'published'),
            supabase.from('worldcups').select('id, slug, title, created_at, published_at').eq('status', 'published'),
        ]);
        if (quizRes.error || wcRes.error) {
            // 일부만 담긴 sitemap이 캐시되지 않게 오류로 응답한다 (Pages Function이 503으로 바꿔 짧게 재시도하게 한다)
            console.error('Sitemap fetch error:', quizRes.error || wcRes.error);
            return new Response('sitemap temporarily unavailable', { status: 503, headers: { 'Retry-After': '300' } });
        }

        const urls = STATIC_PAGES.map(([path, priority]) => `  <url><loc>${BASE}${path}</loc><priority>${priority}</priority></url>`);
        const add = (page, item, priority) => {
            const key = encodeURIComponent(item.slug || item.id);
            urls.push(`  <url><loc>${xmlEscape(`${BASE}/${page}?id=${key}`)}</loc><lastmod>${day(item.published_at || item.created_at)}</lastmod><priority>${priority}</priority></url>`);
        };
        (quizRes.data || []).forEach((q) => add('quiz-play', q, '0.7'));
        (wcRes.data || []).filter((w) => !TIER_LIKE.test(w.title || '')).forEach((w) => add('worldcup-play', w, '0.7'));

        const xml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + urls.join('\n') + '\n</urlset>';
        return new Response(xml, {
            headers: {
                'Content-Type': 'application/xml; charset=utf-8',
                'X-Content-Type-Options': 'nosniff',
                'Cache-Control': 'public, max-age=3600',
            },
        });
    } catch (err) {
        return new Response('Error generating sitemap: ' + err.message, { status: 500 });
    }
}
