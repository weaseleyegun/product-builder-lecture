import test from 'node:test';
import assert from 'node:assert';
import { cleanDescription, buildMeta, escapeAttr, isValidId } from '../functions/_lib/seo.js';
import { handleSitemap } from '../src/helpers/sitemap.js';
import { makeFake } from './helpers.js';

// ── cleanDescription ──────────────────────────────────
test('cleanDescription strips internal [TOKENS], collapses whitespace and truncates', () => {
    assert.strictEqual(cleanDescription('현세대 최고는?\n[HASHTAGS:아이돌,연예인맞추기]'), '현세대 최고는?');
    assert.strictEqual(cleanDescription('설명 [THUMB:https://x/y.png] 이어서'), '설명 이어서');
    assert.strictEqual(cleanDescription('  여러   공백\n\n줄바꿈  '), '여러 공백 줄바꿈');
    const long = cleanDescription('가'.repeat(400));
    assert(long.length <= 156 && long.endsWith('…'), String(long.length));
    assert.strictEqual(cleanDescription(null), '');
    assert.strictEqual(cleanDescription(undefined), '');
    assert.strictEqual(cleanDescription(123), '');
});

test('cleanDescription never cuts inside a surrogate pair', () => {
    const s = '😀'.repeat(200);
    const out = cleanDescription(s);
    assert(!/[\ud800-\udbff]$/.test(out.replace(/…$/, '')), 'ends with a lone high surrogate');
});

// ── buildMeta ─────────────────────────────────────────
test('buildMeta: quiz page title, description, canonical (slug preferred) and image', () => {
    const m = buildMeta('quiz', { id: 'abc', slug: 'quiz-abc', title: '속담 퀴즈', description: '속담을 풀어 보세요. [HASHTAGS:a,b]', thumbnail_url: 'https://i.ytimg.com/x.jpg' });
    assert.strictEqual(m.title, '속담 퀴즈 | Quiz-Rank.com');
    assert.strictEqual(m.description, '속담을 풀어 보세요.');
    assert.strictEqual(m.canonical, 'https://quiz-rank.com/quiz-play?id=quiz-abc');
    assert.strictEqual(m.image, 'https://i.ytimg.com/x.jpg');
});

test('buildMeta: falls back to id, default description, and drops unsafe images', () => {
    const m = buildMeta('worldcup', { id: '11111111-1111-1111-1111-111111111111', title: '월드컵', description: '', thumbnail_url: 'javascript:alert(1)' });
    assert.strictEqual(m.canonical, 'https://quiz-rank.com/worldcup-play?id=11111111-1111-1111-1111-111111111111');
    assert(m.description.length > 20, 'default description');
    assert.strictEqual(m.image, null);
    assert.strictEqual(buildMeta('quiz', { id: 'x', title: 't', thumbnail_url: 'http://insecure/x.png' }).image, null);
    assert.strictEqual(buildMeta('quiz', { id: 'x', title: 't', thumbnail_url: 'https://ok.example/x.png' }).image, 'https://ok.example/x.png');
});

test('buildMeta: id in the canonical URL is encoded', () => {
    const m = buildMeta('quiz', { id: 'a b&c', slug: null, title: 't' });
    assert.strictEqual(m.canonical, 'https://quiz-rank.com/quiz-play?id=a%20b%26c');
});

test('buildMeta: long titles are kept but the page title stays reasonable', () => {
    const m = buildMeta('quiz', { id: 'x', title: '가'.repeat(120) });
    assert(m.title.endsWith(' | Quiz-Rank.com') && m.title.length <= 100);
});

test('escapeAttr escapes quotes, angle brackets and ampersands', () => {
    assert.strictEqual(escapeAttr('a"b<c>&d\'e'), 'a&quot;b&lt;c&gt;&amp;d&#39;e');
});

test('isValidId accepts uuid/slug shapes only', () => {
    for (const ok of ['quiz-ec106977', '11111111-1111-1111-1111-111111111111', 'wc-541ea712']) assert(isValidId(ok), ok);
    for (const bad of ['', null, undefined, 'a', 'x'.repeat(65), 'a b', 'a/b', 'a"b', '<script>', '../x']) assert(!isValidId(bad), String(bad));
});

// ── 사이트맵 (워커) ───────────────────────────────────
const wc = (id, title, status = 'published') => ({ id, slug: null, title, status, created_at: '2026-10-01T00:00:00Z', published_at: '2026-10-05T00:00:00Z' });
test('sitemap: pretty URLs (no .html), static pages included, only published, tier-like worldcups excluded', async () => {
    const f = makeFake({ rows: {
        quizzes: [{ id: 'q-pub', slug: 'quiz-pub', status: 'published', created_at: '2026-10-01T00:00:00Z', published_at: '2026-10-05T00:00:00Z' }, { id: 'q-hid', status: 'hidden', created_at: '2026-10-01T00:00:00Z' }],
        worldcups: [wc('w-pub', '음식 월드컵'), wc('w-tier', '인기 영화 등급 랭킹 티어'), wc('w-list', '인기 만화 등급 리스트'), wc('w-hid', '숨김', 'hidden')],
    } });
    const xml = await (await handleSitemap(f.client)).text();
    for (const p of ['/', '/quiz-list', '/worldcup-list', '/about', '/terms', '/privacy']) assert(xml.includes(`<loc>https://quiz-rank.com${p === '/' ? '/' : p}</loc>`), p);
    assert(xml.includes('<loc>https://quiz-rank.com/quiz-play?id=quiz-pub</loc>'), 'slug preferred');
    assert(xml.includes('<loc>https://quiz-rank.com/worldcup-play?id=w-pub</loc>'));
    assert(!/\.html/.test(xml), 'no .html URLs (they 308-redirect)');
    for (const gone of ['q-hid', 'w-hid', 'w-tier', 'w-list']) assert(!xml.includes(gone), gone);
    assert(xml.includes('<lastmod>2026-10-05</lastmod>'), 'published_at preferred for lastmod');
    assert(!xml.includes('tier-list') && !xml.includes('tier-view'));
});

test('sitemap: ids are URL-encoded and XML-escaped', async () => {
    const f = makeFake({ rows: { quizzes: [{ id: 'x', slug: 'a&b c', status: 'published', created_at: '2026-10-01T00:00:00Z' }], worldcups: [] } });
    const xml = await (await handleSitemap(f.client)).text();
    assert(xml.includes('quiz-play?id=a%26b%20c'), xml);
    assert(!xml.includes('a&b'), 'raw ampersand must not appear');
});

test('sitemap: response is XML with a cache header', async () => {
    const res = await handleSitemap(makeFake({ rows: { quizzes: [], worldcups: [] } }).client);
    assert(res.headers.get('Content-Type').startsWith('application/xml'));
    assert(/max-age=\d+/.test(res.headers.get('Cache-Control')));
});
