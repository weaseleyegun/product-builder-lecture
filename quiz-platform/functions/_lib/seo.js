// functions/_lib/seo.js - 퀴즈/월드컵 상세 페이지의 SEO 메타 생성 (순수 함수, Node 테스트 가능)
// '_lib'는 라우트가 아니다: Pages Functions는 onRequest* 를 내보내는 파일만 경로가 된다.

export const SITE = 'https://quiz-rank.com';
export const API = 'https://quiz-platform-worker.rlaehrjs03.workers.dev';

const SITE_NAME = 'Quiz-Rank.com';
const DEFAULTS = {
    quiz: { path: '/quiz-play', description: '정답 해설이 있는 퀴즈를 풀어 보세요. Quiz-Rank.com에서 무료로 플레이할 수 있습니다.' },
    worldcup: { path: '/worldcup-play', description: '이상형 월드컵으로 최고를 가려 보세요. Quiz-Rank.com에서 무료로 플레이할 수 있습니다.' },
};

// 쿼리의 id(UUID 또는 slug)로 허용하는 모양
export const isValidId = (id) => typeof id === 'string' && /^[A-Za-z0-9-]{3,64}$/.test(id);

export const escapeAttr = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// DB의 설명에는 내부용 [THUMB:…] [HASHTAGS:…] 토큰이 섞여 있을 수 있다. 메타 설명에서는 제거하고 155자로 줄인다.
export function cleanDescription(desc, max = 155) {
    if (typeof desc !== 'string') return '';
    const text = desc.replace(/\[[A-Z_]+:[^\]]*\]/g, ' ').replace(/\s+/g, ' ').trim();
    const chars = Array.from(text);                       // 코드포인트 단위로 자른다 (서로게이트 쌍 보호)
    return chars.length > max ? chars.slice(0, max).join('').trimEnd() + '…' : text;
}

const isHttps = (u) => { try { return new URL(u).protocol === 'https:'; } catch { return false; } };

// item: API가 돌려준 quiz / worldcup 객체
export function buildMeta(kind, item) {
    const d = DEFAULTS[kind];
    const key = item.slug || item.id;
    const rawTitle = String(item.title || '').trim();
    const shown = Array.from(rawTitle).length > 70 ? Array.from(rawTitle).slice(0, 70).join('').trimEnd() + '…' : rawTitle;
    return {
        title: shown ? `${shown} | ${SITE_NAME}` : SITE_NAME,
        description: cleanDescription(item.description) || d.description,
        canonical: `${SITE}${d.path}?id=${encodeURIComponent(key)}`,
        image: isHttps(item.thumbnail_url) ? item.thumbnail_url : null,
    };
}
