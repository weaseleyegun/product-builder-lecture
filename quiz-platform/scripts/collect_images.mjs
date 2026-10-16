// collect_images.mjs - 이미지 퀴즈·월드컵에 쓸 "사용 허락이 명확한" 이미지를 여러 출처에서 찾아 모으는 도구
//
// 출처(라이선스가 CC0 / 퍼블릭 도메인 / CC BY / CC BY-SA 인 것만 가져온다. NC·ND·모든 권리 보유는 제외):
//   commons    위키미디어 커먼즈 (키 불필요)
//   openverse  Openverse — Flickr·Wikimedia 등 여러 곳의 CC 이미지를 모은 검색 (키 불필요, 요청 속도 제한 있음)
//   pixabay    Pixabay (환경변수 PIXABAY_KEY 가 있을 때)
//   pexels     Pexels  (환경변수 PEXELS_KEY 가 있을 때)
//   unsplash   Unsplash (환경변수 UNSPLASH_KEY 가 있을 때)
//   local      이미 가지고 있는 폴더의 이미지 (운영자가 직접 확보한 파일 — 저작권 확인은 운영자 책임)
//
// 사용 순서:
//  1) 검색:   node scripts/collect_images.mjs search --out collected/food --queries "비빔밥=Bibimbap, 김치찌개=Kimchi jjigae" [--sources commons,openverse] [--per 4]
//             → collected/food/candidates.json + sheet.html (브라우저로 열어 후보를 눈으로 고른다)
//  2) 선택:   collected/food/picks.json 을 만든다:  [ { "label": "비빔밥", "index": 2, "answer": "비빔밥" }, ... ]   (index = sheet.html 의 후보 번호)
//  3) 내려받기: node scripts/collect_images.mjs download --out collected/food
//             → collected/food/images/*.jpg (1MB 이하) + manifest.json (출처·작성자·라이선스가 해설에 들어간다)
//  4) 퀴즈:   manifest.json 의 title/description/revealMode 를 채우고  node scripts/build_image_quiz.mjs collected/food/manifest.json --dry
//
// 로컬 폴더 가져오기:  node scripts/collect_images.mjs local --out collected/mine --dir path/to/folder
//             (파일 이름이 정답이 된다: 루피.png → 정답 "루피". 크레딧은 비워 두니 출처를 직접 적을 것)

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, statSync, copyFileSync } from 'node:fs';
import { join, extname, basename } from 'node:path';

const [cmd, ...rest] = process.argv.slice(2);
const opt = (name, dflt) => { const i = rest.indexOf('--' + name); return i >= 0 && rest[i + 1] ? rest[i + 1] : dflt; };
const out = opt('out');
if (!cmd || !out) { console.error('사용: node scripts/collect_images.mjs <search|download|local> --out <폴더> ... (파일 맨 위 설명 참고)'); process.exit(1); }

const UA = { 'User-Agent': 'QuizRankImageCuration/1.0 (admin@quiz-rank.com)' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const strip = (s) => String(s || '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
const OK_LICENSE = /^(cc0|pdm|public domain|pd|cc[- ]by(?![- ]n[cd])(?:[- ]sa)?)/i;   // by, by-sa, cc0, pdm
const okLicense = (l) => OK_LICENSE.test(l || '') && !/-nc|-nd| nc| nd/i.test(l || '');

async function getJson(url, headers = {}) {
    for (let attempt = 0; attempt < 4; attempt++) {
        const r = await fetch(url, { headers: { ...UA, ...headers } });
        if (r.ok) return r.json();
        if (r.status === 429) { await sleep(3000 * (attempt + 1)); continue; }
        throw new Error(`${r.status} ${url.slice(0, 80)}`);
    }
    throw new Error('rate limited: ' + url.slice(0, 80));
}

// Openverse의 라이선스 코드(by, by-sa, cc0, pdm …)를 'CC BY 2.0' 형태로
function openverseLicense(code, version) {
    const c = String(code || '').toLowerCase();
    if (c === 'pdm') return 'Public domain';
    if (c === 'cc0') return 'CC0';
    return `CC ${c.toUpperCase()}${version ? ' ' + version : ''}`;   // by → CC BY, by-sa → CC BY-SA, by-nc → CC BY-NC (이후 필터에서 제외)
}

// ── 출처별 검색: { source, id, title, thumb, full, w, h, license, creator, page } 배열을 돌려준다
const sources = {
    async commons(q, per) {
        const p = new URLSearchParams({ action: 'query', format: 'json', origin: '*', generator: 'search', gsrnamespace: '6', gsrlimit: String(per * 3), gsrsearch: `${q} filetype:bitmap`, prop: 'imageinfo', iiprop: 'url|size|mime|extmetadata', iiurlwidth: '960' });
        const j = await getJson(`https://commons.wikimedia.org/w/api.php?${p}`);
        return Object.values((j.query && j.query.pages) || {}).sort((a, b) => a.index - b.index).map((pg) => {
            const ii = (pg.imageinfo || [])[0] || {}; const m = ii.extmetadata || {};
            return { source: 'commons', id: pg.title, title: pg.title.replace(/^File:/, ''), thumb: (ii.thumburl || '').replace('https://thumb.wikimedia.org/', 'https://upload.wikimedia.org/').split('?')[0], w: ii.width, h: ii.height, mime: ii.mime, license: strip(m.LicenseShortName && m.LicenseShortName.value), creator: strip(m.Artist && m.Artist.value).slice(0, 80), page: ii.descriptionurl };
        }).filter((c) => /jpeg|png/.test(c.mime || '') && c.w >= 900 && okLicense(c.license)).slice(0, per);
    },
    async openverse(q, per) {
        const p = new URLSearchParams({ q, license: 'cc0,pdm,by,by-sa', page_size: String(Math.min(per * 2, 20)), mature: 'false' });
        const j = await getJson(`https://api.openverse.org/v1/images/?${p}`);
        return (j.results || []).map((r) => ({ source: 'openverse', id: r.id, title: r.title || '', thumb: r.thumbnail || r.url, w: r.width, h: r.height, license: openverseLicense(r.license, r.license_version), creator: (r.creator || '').slice(0, 80), page: r.foreign_landing_url }))
            .filter((c) => okLicense(c.license) && (!c.w || c.w >= 600)).slice(0, per);
    },
    async pixabay(q, per) {
        if (!process.env.PIXABAY_KEY) return [];
        const j = await getJson(`https://pixabay.com/api/?key=${process.env.PIXABAY_KEY}&q=${encodeURIComponent(q)}&image_type=photo&safesearch=true&per_page=${Math.max(3, per)}`);
        return (j.hits || []).slice(0, per).map((h) => ({ source: 'pixabay', id: String(h.id), title: h.tags, thumb: h.webformatURL, w: h.imageWidth, h: h.imageHeight, license: 'Pixabay License', creator: h.user, page: h.pageURL }));
    },
    async pexels(q, per) {
        if (!process.env.PEXELS_KEY) return [];
        const j = await getJson(`https://api.pexels.com/v1/search?query=${encodeURIComponent(q)}&per_page=${per}`, { Authorization: process.env.PEXELS_KEY });
        return (j.photos || []).map((h) => ({ source: 'pexels', id: String(h.id), title: h.alt || '', thumb: h.src.large, w: h.width, h: h.height, license: 'Pexels License', creator: h.photographer, page: h.url }));
    },
    async unsplash(q, per) {
        if (!process.env.UNSPLASH_KEY) return [];
        const j = await getJson(`https://api.unsplash.com/search/photos?query=${encodeURIComponent(q)}&per_page=${per}`, { Authorization: `Client-ID ${process.env.UNSPLASH_KEY}` });
        return (j.results || []).map((h) => ({ source: 'unsplash', id: h.id, title: h.alt_description || '', thumb: h.urls.regular, w: h.width, h: h.height, license: 'Unsplash License', creator: h.user && h.user.name, page: h.links && h.links.html }));
    },
};

mkdirSync(out, { recursive: true });

if (cmd === 'search') {
    const queries = opt('queries', '').split(',').map((s) => s.trim()).filter(Boolean).map((s) => { const [label, ...q] = s.split('='); return [label.trim(), (q.join('=') || label).trim()]; });
    const use = opt('sources', 'commons,openverse').split(',').map((s) => s.trim());
    const per = parseInt(opt('per', '4'), 10);
    if (!queries.length) { console.error('--queries "라벨=검색어, 라벨2=검색어2" 가 필요합니다.'); process.exit(1); }
    const result = [];
    for (const [label, q] of queries) {
        let cands = [];
        for (const s of use) {
            if (!sources[s]) { console.error('알 수 없는 출처:', s); continue; }
            try { cands = cands.concat(await sources[s](q, per)); } catch (e) { console.error(`  ${s} 실패 (${label}): ${e.message}`); }
            await sleep(800);
        }
        result.push({ label, query: q, candidates: cands });
        console.log(`${label}: 후보 ${cands.length}개`);
    }
    writeFileSync(join(out, 'candidates.json'), JSON.stringify(result, null, 1), 'utf8');
    const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
    writeFileSync(join(out, 'sheet.html'), `<!doctype html><meta charset="utf-8"><style>body{font:13px sans-serif;background:#222;color:#eee;margin:8px}.row{margin:10px 0}.c{display:flex;gap:6px;flex-wrap:wrap}figure{margin:0;width:230px}img{width:230px;height:150px;object-fit:cover}figcaption{font-size:11px;color:#aaa}</style>` +
        result.map((r) => `<div class="row"><b>${esc(r.label)}</b> <small>(${esc(r.query)})</small><div class="c">${r.candidates.map((c, i) => `<figure><img src="${esc(c.thumb)}" referrerpolicy="no-referrer"><figcaption>#${i} [${c.source}] ${esc(c.title).slice(0, 40)}<br>${esc(c.license)} · ${esc(c.creator)}</figcaption></figure>`).join('')}</div></div>`).join(''), 'utf8');
    console.log(`\n저장: ${join(out, 'candidates.json')}, ${join(out, 'sheet.html')}\n→ sheet.html을 브라우저로 열어 후보를 고르고 ${join(out, 'picks.json')} 을 만드세요.`);
} else if (cmd === 'download') {
    const cands = JSON.parse(readFileSync(join(out, 'candidates.json'), 'utf8'));
    const picks = JSON.parse(readFileSync(join(out, 'picks.json'), 'utf8'));
    mkdirSync(join(out, 'images'), { recursive: true });
    const questions = [];
    for (const [i, pk] of picks.entries()) {
        const row = cands.find((r) => r.label === pk.label);
        const c = row && row.candidates[pk.index];
        if (!c) { console.error('선택을 찾을 수 없음:', JSON.stringify(pk)); continue; }
        let buf = null, mime = 'image/jpeg';
        for (const w of [960, 720, 520]) {
            const u = c.source === 'commons' ? c.thumb.replace(/\/\d+px-/, `/${w}px-`) : c.thumb;
            for (let attempt = 0; attempt < 4 && !buf; attempt++) {
                const r = await fetch(u, { headers: UA });
                if (r.ok && /image/.test(r.headers.get('content-type') || '')) { const b = Buffer.from(await r.arrayBuffer()); if (b.length <= 1024 * 1024) { buf = b; mime = r.headers.get('content-type').split(';')[0]; } else break; }
                else await sleep(3000 * (attempt + 1));
            }
            if (buf || c.source !== 'commons') break;
        }
        if (!buf) { console.error('내려받기 실패(또는 1MB 초과):', pk.label); continue; }
        const ext = mime === 'image/png' ? '.png' : mime === 'image/webp' ? '.webp' : '.jpg';
        const file = `images/${String(i + 1).padStart(2, '0')}${ext}`;
        writeFileSync(join(out, file), buf);
        questions.push({ file, answer: pk.answer || pk.label, explanation: `정답은 ${pk.answer || pk.label}입니다. 이미지: ${c.creator || '작자 미상'}, ${c.license}, ${c.source} (${(c.title || '').slice(0, 60)}) ${c.page || ''}`.trim().slice(0, 300), ...(pk.reveal ? { reveal: pk.reveal } : {}) });
        console.log('ok', pk.label, Math.round(buf.length / 1024) + 'KB', c.license);
        await sleep(1000);
    }
    writeFileSync(join(out, 'manifest.json'), JSON.stringify({ title: '(제목을 쓰세요 — 8~60자)', description: '(직접 쓴 설명 300~1200자. 이미지 출처가 CC 라이선스라는 점과 해설에서 크레딧을 볼 수 있다는 점을 적으세요)', revealMode: 'zoom', prompt: '이 사진은 무엇일까요?', questions }, null, 1), 'utf8');
    console.log(`\nmanifest.json 생성 (${questions.length}문제) → 제목·설명을 채운 뒤: node scripts/build_image_quiz.mjs ${join(out, 'manifest.json')} --dry`);
} else if (cmd === 'local') {
    const dir = opt('dir');
    if (!dir || !existsSync(dir)) { console.error('--dir 폴더가 필요합니다.'); process.exit(1); }
    mkdirSync(join(out, 'images'), { recursive: true });
    const files = readdirSync(dir).filter((f) => /\.(jpe?g|png|webp)$/i.test(f) && statSync(join(dir, f)).size <= 1024 * 1024).sort();
    const skipped = readdirSync(dir).filter((f) => /\.(jpe?g|png|webp)$/i.test(f) && statSync(join(dir, f)).size > 1024 * 1024);
    const questions = files.map((f, i) => {
        const file = `images/${String(i + 1).padStart(2, '0')}${extname(f).toLowerCase()}`;
        copyFileSync(join(dir, f), join(out, file));
        return { file, answer: basename(f, extname(f)).replace(/^\d+[-_. ]+/, ''), explanation: '' };
    });
    writeFileSync(join(out, 'manifest.json'), JSON.stringify({ title: '(제목을 쓰세요 — 8~60자)', description: '(직접 쓴 설명 300~1200자)', revealMode: 'zoom', prompt: '이 사진은 무엇일까요?', questions }, null, 1), 'utf8');
    console.log(`${questions.length}개 가져옴${skipped.length ? `, 1MB 초과로 제외: ${skipped.join(', ')}` : ''} → ${join(out, 'manifest.json')}`);
} else {
    console.error('알 수 없는 명령:', cmd);
    process.exit(1);
}
