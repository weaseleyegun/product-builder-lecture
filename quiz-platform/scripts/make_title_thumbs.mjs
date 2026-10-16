// make_title_thumbs.mjs - 썸네일이 없는 공개 퀴즈/월드컵에 "제목 카드" 이미지를 만들어 붙인다.
//
// 사용: node scripts/make_title_thumbs.mjs [--dry]
//  - 대상: status='published' 이면서 thumbnail_url 도, thumbnail_data 도 없고 --since 날짜(기본 2026-10-13) 이후에 만든 퀴즈와 월드컵
//  - 제목(" — " 앞부분)을 큰 글씨로 담은 600×400 카드를 헤드리스 Chrome으로 만들고, Python(Pillow)으로 JPEG(약 20~40KB)로 줄여
//    thumbnail_data(base64)에 저장한다. 이미 썸네일이 있는 항목은 건드리지 않는다.
//  - 관리자 계정(.dev.vars)으로 로그인한다. 필요: Chrome 또는 Edge, Python + Pillow.

import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { spawnSync } from 'node:child_process';
import { writeFileSync, mkdtempSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dry = process.argv.includes('--dry');
// 예전 콘텐츠는 목록이 제목 키워드로 고르는 기본 그림(app.js의 QUIZ_META)을 쓰므로, 이 날짜 이후에 만든 것만 대상으로 한다 (--since=YYYY-MM-DD)
const sinceArg = process.argv.find((a) => a.startsWith('--since='));
const SINCE = sinceArg ? sinceArg.slice(8) : '2026-10-13';
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
if (!CHROME) { console.error('Chrome/Edge를 찾을 수 없습니다.'); process.exit(1); }

dotenv.config({ path: join(root, '.dev.vars'), quiet: true });
const { SUPABASE_URL, SUPABASE_ANON_KEY, ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;
const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });
const { error: le } = await sb.auth.signInWithPassword({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
if (le) { console.error('관리자 로그인 실패'); process.exit(1); }

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const THEMES = [['#1b1530', '#4527a0'], ['#102a43', '#0b6e8a'], ['#2d1b2e', '#a23b72'], ['#1f2d1f', '#2f8f5b'], ['#2b2118', '#b5651d'], ['#1c1c3a', '#3b4cc0']];
const hash = (s) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
const emojiFor = (kind, title) => (kind === 'worldcup' ? '🏆' : /K-POP|아이돌|걸그룹|보이그룹|팬덤/.test(title) ? '🎤' : /애니|캐릭터|포스터/.test(title) ? '🎬' : /속담|사자성어|맞춤법|초성|상식/.test(title) ? '📝' : /게임|BGM/.test(title) ? '🎮' : /노래|곡|발매/.test(title) ? '🎵' : '🧩');
const html = (title, kind) => {
    const [a, b] = THEMES[hash(title) % THEMES.length];
    return `<!doctype html><html><head><meta charset="utf-8"><style>
html,body{margin:0;width:600px;height:400px;overflow:hidden}
body{background:linear-gradient(135deg,${a},${b});color:#fff;font-family:'Malgun Gothic','Apple SD Gothic Neo',sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:0 44px;box-sizing:border-box}
.k{font-size:20px;color:rgba(255,255,255,.75);margin-bottom:16px}.t{font-size:36px;font-weight:800;line-height:1.35;word-break:keep-all}.b{font-size:34px;margin-top:20px}
</style></head><body><div class="k">Quiz-Rank.com · ${kind === 'worldcup' ? '이상형 월드컵' : '퀴즈'}</div><div class="t">${esc(title)}</div><div class="b">${emojiFor(kind, title)}</div></body></html>`;
};

const dir = mkdtempSync(join(tmpdir(), 'title-thumbs-'));
let made = 0, idx = 0;
for (const [table, kind] of [['quizzes', 'quiz'], ['worldcups', 'worldcup']]) {
    const { data, error } = await sb.from(table).select('id, title, thumbnail_url, has_thumbnail_data, created_at').eq('status', 'published');
    if (error) { console.error(error.message); process.exit(1); }
    const targets = (data || []).filter((r) => !r.thumbnail_url && !r.has_thumbnail_data && r.created_at >= SINCE);
    console.log(`${table}: 대상 ${targets.length}개`);
    for (const r of targets) {
        idx++;
        const short = r.title.replace(/ — .*/, '').replace(/\s*\(.*?\)\s*$/, '').trim();
        if (dry) { console.log('  (dry)', short); continue; }
        const htmlPath = join(dir, `c${idx}.html`), pngPath = join(dir, `c${idx}.png`), jpgPath = join(dir, `c${idx}.jpg`);
        writeFileSync(htmlPath, html(short, kind), 'utf8');
        const profile = mkdtempSync(join(tmpdir(), 'tt-profile-'));
        const run = spawnSync(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', `--user-data-dir=${profile}`, '--window-size=600,400', `--screenshot=${pngPath}`, pathToFileURL(htmlPath).href], { stdio: 'ignore', timeout: 60000 });
        if (run.status !== 0 || !existsSync(pngPath)) { console.log('  실패(스크린샷):', short); continue; }
        const conv = spawnSync('python', ['-I', '-c', 'import sys;from PIL import Image;Image.open(sys.argv[1]).convert("RGB").save(sys.argv[2],"JPEG",quality=82,optimize=True)', pngPath, jpgPath]);
        if (conv.status !== 0 || !existsSync(jpgPath)) { console.log('  실패(JPEG 변환):', short); continue; }
        const b64 = readFileSync(jpgPath).toString('base64');
        const { error: ue } = await sb.from(table).update({ thumbnail_data: `data:image/jpeg;base64,${b64}` }).eq('id', r.id);
        console.log(ue ? `  실패: ${short} ${ue.message}` : `  저장: ${short} (${Math.round(b64.length / 1024)}KB)`);
        if (!ue) made++;
    }
}
console.log(dry ? '--dry: 변경 없음' : `완료: ${made}개`);
