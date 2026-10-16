import { renderPlayPage } from './_lib/play-page.js';

// GET /quiz-play?id=<uuid|slug>  → 정적 quiz-play.html + 퀴즈별 SEO 메타
export const onRequestGet = (context) => renderPlayPage(context, 'quiz');
