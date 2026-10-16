// set_text_thumbs.mjs - 이름만으로 만든 월드컵(content/text_worldcups.mjs)의 목록용 썸네일을 만들어 붙인다.
//
// 사용: node scripts/set_text_thumbs.mjs
//  - 제목을 큰 글씨로 담은 600×400 PNG 카드를 헤드리스 Chrome으로 만들고, 같은 제목의 월드컵 thumbnail_data(base64)에 저장한다.
//  - 관리자 계정(.dev.vars)으로 로그인한다. 이미 썸네일이 있는 항목은 건드리지 않는다.

import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdtempSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { TEXT_WORLDCUPS } from '../content/text_worldcups.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
if (!CHROME) { console.error('Chrome/Edge를 찾을 수 없습니다.'); process.exit(1); }

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const html = (title) => `<!doctype html><html><head><meta charset="utf-8"><style>
html,body{margin:0;width:600px;height:400px;overflow:hidden}
body{background:linear-gradient(135deg,#1b1530,#2a1f55 55%,#4527a0);color:#fff;font-family:'Malgun Gothic','Apple SD Gothic Neo',sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:0 40px;box-sizing:border-box}
.k{font-size:20px;color:#d6ccff;margin-bottom:18px}.t{font-size:34px;font-weight:800;line-height:1.35}.b{font-size:26px;margin-top:22px}
</style></head><body><div class="k">Quiz-Rank.com · 이상형 월드컵</div><div class="t">${esc(title)}</div><div class="b">🏆</div></body></html>`;

dotenv.config({ path: join(root, '.dev.vars'), quiet: true });
const { SUPABASE_URL, SUPABASE_ANON_KEY, ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;
const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });
const { error: le } = await sb.auth.signInWithPassword({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
if (le) { console.error('관리자 로그인 실패'); process.exit(1); }

const dir = mkdtempSync(join(tmpdir(), 'thumbs-'));
for (const [i, w] of TEXT_WORLDCUPS.entries()) {
    const title = w.draft.title;
    const { data: rows, error } = await sb.from('worldcups').select('id, has_thumbnail_data, thumbnail_url').eq('title', title);
    if (error || !rows || rows.length !== 1) { console.log('건너뜀(월드컵을 찾지 못함/중복):', title); continue; }
    if (rows[0].has_thumbnail_data) { console.log('이미 있음:', title); continue; }
    const htmlPath = join(dir, `card-${i}.html`), pngPath = join(dir, `card-${i}.png`);
    writeFileSync(htmlPath, html(title.replace(/ — .*/, '')), 'utf8');
    spawnSync(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--window-size=600,400', `--screenshot=${pngPath}`, pathToFileURL(htmlPath).href], { stdio: 'ignore' });
    const b64 = readFileSync(pngPath).toString('base64');
    const { error: ue } = await sb.from('worldcups').update({ thumbnail_data: `data:image/png;base64,${b64}` }).eq('id', rows[0].id);
    console.log(ue ? `실패: ${title} ${ue.message}` : `썸네일 저장: ${title} (${Math.round(b64.length / 1024)}KB)`);
}
