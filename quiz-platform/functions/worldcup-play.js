import { renderPlayPage } from './_lib/play-page.js';

// GET /worldcup-play?id=<uuid|slug>  → 정적 worldcup-play.html + 월드컵별 SEO 메타
export const onRequestGet = (context) => renderPlayPage(context, 'worldcup');
