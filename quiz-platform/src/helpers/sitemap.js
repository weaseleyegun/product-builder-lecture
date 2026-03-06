// helpers/sitemap.js - Generate sitemap.xml for SEO

export async function handleSitemap(supabase) {
    try {
        const baseUrl = 'https://quizrank.pages.dev';

        // Fetch all quizzes and worldcups
        const [quizRes, wcRes] = await Promise.all([
            supabase.from('quizzes').select('id, slug, updated_at'),
            supabase.from('worldcups').select('id, slug, updated_at')
        ]);

        let xml = '<?xml version="1.0" encoding="UTF-8"?>';
        xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">';

        // Home
        xml += `<url><loc>${baseUrl}/</loc><priority>1.0</priority></url>`;
        xml += `<url><loc>${baseUrl}/quiz-list.html</loc><priority>0.8</priority></url>`;
        xml += `<url><loc>${baseUrl}/worldcup-list.html</loc><priority>0.8</priority></url>`;

        // Quizzes
        if (quizRes.data) {
            quizRes.data.forEach(item => {
                const id = item.slug || item.id;
                xml += `<url><loc>${baseUrl}/quiz-play.html?id=${id}</loc><lastmod>${new Date(item.updated_at || Date.now()).toISOString().split('T')[0]}</lastmod><priority>0.7</priority></url>`;
            });
        }

        // Worldcups / Tiers
        if (wcRes.data) {
            wcRes.data.forEach(item => {
                const id = item.slug || item.id;
                const page = (item.slug && item.slug.startsWith('tier-')) ? 'tier-view.html' : 'worldcup-play.html';
                xml += `<url><loc>${baseUrl}/${page}?id=${id}</loc><lastmod>${new Date(item.updated_at || Date.now()).toISOString().split('T')[0]}</lastmod><priority>0.7</priority></url>`;
            });
        }

        xml += '</urlset>';

        return new Response(xml, {
            headers: {
                'Content-Type': 'application/xml',
                'Access-Control-Allow-Origin': '*'
            }
        });
    } catch (err) {
        return new Response('Error generating sitemap', { status: 500 });
    }
}
