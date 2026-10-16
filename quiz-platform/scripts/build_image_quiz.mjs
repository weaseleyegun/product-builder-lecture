// build_image_quiz.mjs - 이미지 파일 + 매니페스트(JSON)로 "일부만 보여 주는" 이미지 퀴즈 초안을 만든다.
//
// 사용:
//   node scripts/build_image_quiz.mjs path/to/manifest.json --dry     검증만 (업로드·제출 안 함)
//   node scripts/build_image_quiz.mjs path/to/manifest.json           이미지를 업로드하고 초안으로 제출 → 대시보드에서 검수 후 공개
//
// 매니페스트 형식 (예시는 content/image_quiz.example.json):
//   {
//     "title": "애니 캐릭터 줌 아웃 퀴즈 — 눈만 보고 맞혀 보세요",    (8~60자)
//     "description": "...",                                          (300~1200자, 직접 쓴 설명)
//     "revealMode": "zoom" | "blur" | "mosaic" | "silhouette" | "mask",   퀴즈 기본 공개 방식
//     "prompt": "이곳은 어디일까요?",        (선택) 문제 문장. 생략하면 '사진을 보고 누군지 맞혀보세요!'. 문제별 "prompt"로 바꿀 수도 있다
//     "questions": [
//        { "file": "images/rem.png", "answer": "Rem", "wrongs": ["Emilia", "Ram", "Beatrice"],
//          "reveal": { "x": 55, "y": 35 } }              // 선택: 줌/가림의 초점(%) 등. 방식을 문제마다 바꿀 수도 있다 ("mode")
//        { "url": "https://upload.wikimedia.org/...", "answer": "..." }   // 이미 올라가 있는 https 이미지 주소도 가능
//     ]                                                              (6~30문제)
//   }
//  - "wrongs"를 생략하면 같은 퀴즈의 다른 문제 정답 중에서 3개를 골라 오답 보기로 쓴다.
//  - 파일은 jpeg/png/webp, 1MB 이하. 관리자 폴더(<admin id>/)에 올라가고 공개 https 주소로 쓰인다.
//  - 저작권은 제작자 책임이다. 출처·허가가 확실한 이미지만 쓰고, 신체 특정 부위만 보여 주는 방식은 쓰지 않는다.

import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { dirname, join, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateQuizDraft } from '../src/quality/validate.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const manifestPath = args.find((a) => !a.startsWith('--'));
const dry = args.includes('--dry');
if (!manifestPath) { console.error('사용: node scripts/build_image_quiz.mjs <manifest.json> [--dry]'); process.exit(1); }

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const baseDir = dirname(resolve(manifestPath));
const API = process.env.QUIZRANK_API || 'https://quiz-platform-worker.rlaehrjs03.workers.dev';
const MIME = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };

const qs = Array.isArray(manifest.questions) ? manifest.questions : [];
const problems = [];
qs.forEach((q, i) => {
    if (q.file) {
        const p = resolve(baseDir, q.file);
        if (!existsSync(p)) problems.push(`Q${i + 1}: 파일 없음 ${q.file}`);
        else {
            if (!MIME[extname(p).toLowerCase()]) problems.push(`Q${i + 1}: jpeg/png/webp만 가능 (${q.file})`);
            if (statSync(p).size > 1024 * 1024) problems.push(`Q${i + 1}: 1MB 초과 (${q.file}) — 줄여서 다시 만들어 주세요`);
        }
    } else if (!q.url) problems.push(`Q${i + 1}: file 또는 url이 필요합니다`);
});
if (problems.length) { console.error(problems.join('\n')); process.exit(1); }

// 오답 보기 자동 선택: 다른 문제의 정답에서 결정적으로 3개
const answers = qs.map((q) => q.answer);
const pickWrongs = (i) => {
    const pool = [...new Set(answers.filter((a, k) => k !== i && a !== answers[i]))];
    if (pool.length < 3) return pool;                       // 후보가 모자라면 검증에서 걸러진다
    return [0, 1, 2].map((k) => pool[(i * 2 + k) % pool.length]);   // 연속한 3개 → 서로 다르다
};

function buildDraft(urls) {
    return {
        title: manifest.title,
        description: manifest.description,
        ...(manifest.revealMode ? { revealMode: manifest.revealMode } : {}),
        questions: qs.map((q, i) => {
            const wrongs = Array.isArray(q.wrongs) && q.wrongs.length === 3 ? q.wrongs : pickWrongs(i);
            const pos = i % 4;
            const texts = [...wrongs];
            texts.splice(pos, 0, q.answer);
            return {
                answer: q.answer,
                videoId: urls[i],
                startTime: 0, endTime: 15,
                options: texts.map((text, k) => ({ id: 'ABCD'[k], text, isCorrect: k === pos })),
                ...((q.prompt || manifest.prompt) ? { questionText: q.prompt || manifest.prompt } : {}),
                ...(q.explanation ? { explanation: q.explanation } : {}),
                ...(q.reveal ? { reveal: q.reveal } : {}),
            };
        }),
    };
}

dotenv.config({ path: join(root, '.dev.vars'), quiet: true });
const { SUPABASE_URL, SUPABASE_ANON_KEY, ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;

// 1) 로컬 검증 (파일은 아직 올리지 않았으므로 자리표시 주소로 검사)
const placeholder = qs.map((q, i) => q.url || `https://${new URL(SUPABASE_URL).hostname}/storage/v1/object/public/ugc-images/preview/${i}.jpg`);
const check = validateQuizDraft(buildDraft(placeholder), { existingTitles: [], existingDescriptions: [] });
console.log(check.ok ? `✅ 검증 통과 (문제 ${qs.length}개)` : '❌ 검증 실패');
if (!check.ok) { check.errors.forEach((e) => console.log('   - ' + e)); process.exit(1); }
if (dry) { console.log('--dry: 업로드·제출하지 않았습니다.'); process.exit(0); }

// 2) 로그인 → 이미지 업로드 → 초안 제출
const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });
const { data: auth, error: le } = await sb.auth.signInWithPassword({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
if (le) { console.error('관리자 로그인 실패'); process.exit(1); }
const token = auth.session.access_token, uid = auth.user.id;

const urls = [];
for (const [i, q] of qs.entries()) {
    if (q.url) { urls.push(q.url); continue; }
    const p = resolve(baseDir, q.file);
    const name = `${uid}/${Date.now().toString(36)}-${i}-${Math.random().toString(36).slice(2, 8)}${extname(p).toLowerCase()}`;
    const res = await fetch(`${SUPABASE_URL}/storage/v1/object/ugc-images/${name}`, {
        method: 'POST',
        headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}`, 'Content-Type': MIME[extname(p).toLowerCase()], 'x-upsert': 'false' },
        body: readFileSync(p),
    });
    if (!res.ok) { console.error(`업로드 실패 Q${i + 1}: ${res.status} ${(await res.text()).slice(0, 200)}`); process.exit(1); }
    urls.push(`${SUPABASE_URL}/storage/v1/object/public/ugc-images/${name}`);
    console.log(`  ⬆ ${i + 1}/${qs.length} ${q.file}`);
}

const res = await fetch(`${API}/api/admin/drafts`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ kind: 'quiz', draft: buildDraft(urls), source: 'curated' }),
});
const body = await res.json().catch(() => ({}));
if (res.status === 201) console.log(`✅ 초안 등록: ${manifest.title} (id ${body.id}) — 대시보드에서 검수 후 공개하세요.`);
else { console.error(`❌ ${res.status}`, JSON.stringify(body.errors || body.error || body)); process.exit(1); }
