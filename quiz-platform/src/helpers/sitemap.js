// helpers/sitemap.js - Generate sitemap.xml for SEO

export async function handleSitemap(supabase) {
    try {
        const baseUrl = 'https://quizrank.pages.dev';

        // Fetch all quizzes and worldcups (use created_at as updated_at is missing)
        const [quizRes, wcRes] = await Promise.all([
            supabase.from('quizzes').select('id, slug, created_at'),
            supabase.from('worldcups').select('id, slug, created_at')
        ]);

        if (quizRes.error) console.error('Quiz fetch error for sitemap:', quizRes.error);
        if (wcRes.error) console.error('Worldcup fetch error for sitemap:', wcRes.error);

        let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
        xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

        // Home
        xml += `  <url><loc>${baseUrl}/</loc><priority>1.0</priority></url>\n`;
        xml += `  <url><loc>${baseUrl}/quiz-list.html</loc><priority>0.8</priority></url>\n`;
        xml += `  <url><loc>${baseUrl}/worldcup-list.html</loc><priority>0.8</priority></url>\n`;

        // Quizzes
        if (quizRes.data) {
            quizRes.data.forEach(item => {
                const identifier = item.slug || item.id;
                const lastmod = item.created_at ? new Date(item.created_at).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
                xml += `  <url><loc>${baseUrl}/quiz-play.html?id=${identifier}</loc><lastmod>${lastmod}</lastmod><priority>0.7</priority></url>\n`;
            });
        }

        // Worldcups / Tiers
        if (wcRes.data) {
            wcRes.data.forEach(item => {
                const identifier = item.slug || item.id;
                const page = (item.slug && item.slug.startsWith('tier-')) ? 'tier-view.html' : 'worldcup-play.html';
                const lastmod = item.created_at ? new Date(item.created_at).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
                xml += `  <url><loc>${baseUrl}/${page}?id=${identifier}</loc><lastmod>${lastmod}</lastmod><priority>0.7</priority></url>\n`;
            });
        }

        xml += '</urlset>';

        return new Response(xml, {
            headers: {
                'Content-Type': 'application/xml; charset=utf-8',
                'X-Content-Type-Options': 'nosniff',
                'Cache-Control': 'public, max-age=3600'
            }
        });
    } catch (err) {
        return new Response('Error generating sitemap: ' + err.message, { status: 500 });
    }
}
