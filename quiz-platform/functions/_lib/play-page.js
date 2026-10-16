// functions/_lib/play-page.js - 퀴즈/월드컵 플레이 페이지에 퀴즈별 메타(title, description, canonical, OG)를 서버에서 넣는다.
// 검색엔진과 카카오톡·SNS 크롤러는 JavaScript를 실행하지 않거나 늦게 실행하므로, 정적 HTML에 이미 들어 있어야 한다.
// - 정상: 퀴즈별 메타를 주입한 HTML
// - 없는/숨겨진 콘텐츠: 404 상태 + noindex (soft-404 방지)
// - API 장애: 정적 페이지를 그대로 반환 (페이지는 항상 열린다)

import { API, buildMeta, escapeAttr, isValidId } from './seo.js';

const ENDPOINTS = {
    quiz: (id) => `/api/quiz-play?id=${encodeURIComponent(id)}&limit=1`,
    worldcup: (id) => `/api/worldcup-play?id=${encodeURIComponent(id)}`,
};

export async function renderPlayPage(context, kind) {
    const response = await context.next();                    // 정적 HTML (quiz-play.html / worldcup-play.html)
    const id = new URL(context.request.url).searchParams.get('id');
    if (!isValidId(id) || !(response.headers.get('content-type') || '').includes('text/html')) return response;

    let item = null;
    let notFound = false;
    try {
        const r = await fetch(API + ENDPOINTS[kind](id), { cf: { cacheTtl: 300, cacheEverything: true } });
        if (r.status === 404) notFound = true;
        else if (r.ok) {
            const json = await r.json();
            item = kind === 'quiz' ? json.quiz : json.worldcup;
        }
    } catch { /* API 장애 → 정적 페이지 */ }
    if (!item && !notFound) return response;

    const headers = new Headers(response.headers);
    headers.delete('content-length');
    headers.set('Cache-Control', 'public, max-age=0, s-maxage=300');

    const rewriter = new HTMLRewriter();
    if (notFound) {
        rewriter.on('head', { element(e) { e.append('<meta name="robots" content="noindex">', { html: true }); } });
        return rewriter.transform(new Response(response.body, { status: 404, headers }));
    }

    const m = buildMeta(kind, item);
    const set = (selector, attr, value) => rewriter.on(selector, { element(e) { e.setAttribute(attr, value); } });
    rewriter.on('title', { element(e) { e.setInnerContent(m.title); } });          // setInnerContent는 텍스트를 이스케이프한다
    set('meta[name="description"]', 'content', m.description);
    set('link[rel="canonical"]', 'href', m.canonical);
    set('meta[property="og:title"]', 'content', m.title);
    set('meta[property="og:description"]', 'content', m.description);
    set('meta[property="og:url"]', 'content', m.canonical);
    set('meta[name="twitter:title"]', 'content', m.title);
    set('meta[name="twitter:description"]', 'content', m.description);
    if (m.image) {
        set('meta[name="twitter:card"]', 'content', 'summary_large_image');
        rewriter.on('head', { element(e) {
            const img = escapeAttr(m.image);
            e.append(`<meta property="og:image" content="${img}"><meta name="twitter:image" content="${img}">`, { html: true });
        } });
    }
    return rewriter.transform(new Response(response.body, { status: response.status, headers }));
}
