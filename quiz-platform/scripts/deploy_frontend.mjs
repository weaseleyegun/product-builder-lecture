// deploy_frontend.mjs - 프론트엔드(Cloudflare Pages `quizrank`)를 안전하게 직접 배포한다.
//
// 왜 필요한가: Pages 프로젝트 quizrank는 Git 연동이 없어 `git push`로는 배포되지 않는다.
// 프로젝트 폴더를 통째로 올리면 .dev.vars·docs/private·sql 같은 비공개 파일이 함께 공개될 수 있으므로,
// 공개해도 되는 파일만 임시 폴더에 복사하고 비밀 문자열이 섞였는지 검사한 뒤에만 배포한다.
//
// 사용: node scripts/deploy_frontend.mjs [--dry] [--keep]   (--dry: 검사만 하고 배포하지 않음, --keep: 임시 폴더 유지)

import { cpSync, mkdirSync, rmSync, readdirSync, readFileSync, statSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dry = process.argv.includes('--dry');
const keep = process.argv.includes('--keep');   // 검사를 통과한 공개 복사본을 지우지 않고 경로를 알려 준다 (wrangler pages dev 로 로컬 확인용)

const PUBLIC_ROOT_FILES = (f) => /\.(html|css)$/.test(f) || f === 'app.js' || f === 'ads.txt' || f === 'robots.txt';
const PUBLIC_DIRS = ['js', 'images'];
const FORBIDDEN_NAMES = /(^|[\\/])(\.dev\.vars|\.env.*|wrangler\.toml|package(-lock)?\.json|.*\.sql|.*\.md)$/i;
const SECRET_PATTERNS = [/ADMIN_PASSWORD/, /AGENT_PASSWORD/, /service_role/, /sb_secret_/, /BEGIN (RSA |EC )?PRIVATE KEY/];

const stage = mkdtempSync(join(tmpdir(), 'quizrank-site-'));
try {
    for (const f of readdirSync(root)) {
        if (statSync(join(root, f)).isFile() && PUBLIC_ROOT_FILES(f)) cpSync(join(root, f), join(stage, f));
    }
    for (const d of PUBLIC_DIRS) cpSync(join(root, d), join(stage, d), { recursive: true });

    const files = [];
    (function walk(dir) {
        for (const e of readdirSync(dir, { withFileTypes: true })) {
            const p = join(dir, e.name);
            e.isDirectory() ? walk(p) : files.push(p);
        }
    })(stage);

    const bad = [];
    for (const p of files) {
        const rel = p.slice(stage.length + 1);
        if (FORBIDDEN_NAMES.test(rel)) bad.push(`${rel} (금지된 파일 이름)`);
        if (/\.(html|js|css|txt|json|svg)$/i.test(extname(p) ? p : '')) {
            const text = readFileSync(p, 'utf8');
            for (const re of SECRET_PATTERNS) if (re.test(text)) bad.push(`${rel} (비밀 패턴 ${re})`);
        }
    }
    if (bad.length) {
        console.error('❌ 배포 중단 — 공개하면 안 되는 내용이 섞였습니다:\n  ' + bad.join('\n  '));
        process.exitCode = 1;
    } else if (!files.some((p) => p.endsWith('index.html'))) {
        console.error('❌ 배포 중단 — index.html이 없습니다.');
        process.exitCode = 1;
    } else {
        console.log(`✅ 검사 통과: 파일 ${files.length}개 (${stage})`);
        if (dry) {
            console.log('--dry: 배포하지 않았습니다.');
        } else {
            const r = spawnSync('npx', ['wrangler', 'pages', 'deploy', stage, '--project-name', 'quizrank', '--branch', 'master', '--commit-dirty=true'], { stdio: 'inherit', shell: true, cwd: root });
            process.exitCode = r.status ?? 1;
        }
    }
} finally {
    if (keep) console.log(`KEPT_STAGE=${stage}`);
    else rmSync(stage, { recursive: true, force: true });
}
