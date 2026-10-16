// submit_drafts.mjs - content/text_quizzes.mjs 의 퀴즈를 "초안"으로 제출한다. 공개는 하지 않는다.
//
// 사용:
//   node scripts/submit_drafts.mjs --dry     로컬에서 검증기만 돌린다 (네트워크/로그인 없음)
//   node scripts/submit_drafts.mjs           관리자 계정으로 로그인해 워커의 /api/admin/drafts 에 제출한다
//
// - 관리자 이메일/비밀번호는 .dev.vars (ADMIN_EMAIL, ADMIN_PASSWORD) 에서 읽고 화면에 출력하지 않는다.
// - 같은 제목이 이미 있으면 서버가 422(duplicate_title)로 거절하므로 다시 실행해도 중복 생성되지 않는다.
// - 제출된 초안은 관리자 대시보드의 "검수 대기 초안"에서 사람이 확인하고 공개/반려한다.

import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { TEXT_QUIZZES as TEXT_SET } from '../content/text_quizzes.mjs';
import { YEAR_QUIZZES } from '../content/year_quizzes.mjs';
import { AUDIENCE_QUIZZES } from '../content/audience_quizzes.mjs';
import { validateQuizDraft } from '../src/quality/validate.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dry = process.argv.includes('--dry');
// --set=year : 발매 연도 맞추기(영상) 퀴즈, --set=audience : 타깃 맞춤 텍스트 퀴즈, 기본값은 기본 텍스트 퀴즈
const TEXT_QUIZZES = process.argv.includes('--set=year') ? YEAR_QUIZZES : process.argv.includes('--set=audience') ? AUDIENCE_QUIZZES : TEXT_SET;
const API = process.env.QUIZRANK_API || 'https://quiz-platform-worker.rlaehrjs03.workers.dev';

// 1) 로컬 검증 (서버도 같은 검증기를 쓰지만, 제출 전에 미리 걸러서 원인을 바로 보여 준다)
let localFailed = false;
TEXT_QUIZZES.forEach((quiz, i) => {
    const others = TEXT_QUIZZES.filter((_, j) => j !== i).map((o) => o.draft);
    const r = validateQuizDraft(quiz.draft, { existingTitles: others.map((o) => o.title), existingDescriptions: others.map((o) => o.description) });
    console.log(`${r.ok ? '✅' : '❌'} [${i + 1}/${TEXT_QUIZZES.length}] ${quiz.draft.title}  (문제 ${quiz.draft.questions.length}개, 설명 ${quiz.draft.description.length}자)`);
    if (!r.ok) { localFailed = true; r.errors.forEach((e) => console.log('     - ' + e)); }
});
if (localFailed) { console.error('\n로컬 검증 실패 — 제출하지 않습니다.'); process.exit(1); }
if (dry) { console.log('\n--dry: 제출하지 않았습니다.'); process.exit(0); }

// 2) 관리자 로그인
dotenv.config({ path: join(root, '.dev.vars'), quiet: true });
const { SUPABASE_URL, SUPABASE_ANON_KEY, ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;
if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !ADMIN_EMAIL || !ADMIN_PASSWORD) { console.error('.dev.vars 에 SUPABASE_URL / SUPABASE_ANON_KEY / ADMIN_EMAIL / ADMIN_PASSWORD 가 필요합니다.'); process.exit(1); }
const { data, error } = await createClient(SUPABASE_URL, SUPABASE_ANON_KEY).auth.signInWithPassword({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
if (error) { console.error('관리자 로그인 실패:', error.message); process.exit(1); }
const headers = { Authorization: `Bearer ${data.session.access_token}`, 'Content-Type': 'application/json' };

// 3) 제출
console.log('\n제출 중…');
let created = 0, duplicates = 0, failed = 0;
for (const quiz of TEXT_QUIZZES) {
    const res = await fetch(`${API}/api/admin/drafts`, { method: 'POST', headers, body: JSON.stringify({ kind: quiz.kind, draft: quiz.draft, source: quiz.source }) });
    const body = await res.json().catch(() => ({}));
    if (res.status === 201) { created++; console.log(`  ✅ 초안 등록: ${quiz.draft.title}  (id ${body.id})`); }
    else if (res.status === 422 && (body.errors || []).includes('duplicate_title')) { duplicates++; console.log(`  ↩︎ 이미 있음: ${quiz.draft.title}`); }
    else { failed++; console.log(`  ❌ ${res.status}: ${quiz.draft.title}  ${JSON.stringify(body.errors || body.error || body)}`); }
}
console.log(`\n등록 ${created} · 이미 있음 ${duplicates} · 실패 ${failed}`);
console.log('다음: 관리자 대시보드(admin-dashboard)의 "검수 대기 초안"에서 내용을 확인하고 공개/반려하세요.');
process.exit(failed ? 1 : 0);
