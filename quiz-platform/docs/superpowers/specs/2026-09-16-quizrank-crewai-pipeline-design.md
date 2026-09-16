# QuizRank CrewAI 콘텐츠 파이프라인 설계

> 작성일: 2026-09-16

## 배경 & 현재 상태 조사 결과

- `scripts/gas/quizrank_agent.js`(GAS, 무료)가 매일 새벽 3시(KST)에 자동 실행되어 퀴즈 1개 + 월드컵 2개(트렌드 기반 1개, 강아지 보너스 1개)를 생성해 Supabase에 적재 중.
- 코드 상단에 `✨ Gemini 완전 제거 — 데이터 기반 자동 퀴즈/월드컵/티어 생성`이라고 명시되어 있으며, 실제로 Gemini(또는 다른 LLM) 호출이 전혀 없음. 유튜브 트렌딩 영상 제목/Jikan 애니메이션 API/dog.ceo API 데이터를 기계적으로 조합하는 "No-AI v4" 방식.
- `results.tierlist`는 실제 티어리스트가 아니라 강아지 월드컵 결과를 이름만 바꿔 채운 것. `sql/schema.sql`에 티어리스트 전용 테이블이 없음 — 실제 티어리스트 생성은 스키마 설계부터 필요한 별도 작업.
- `scripts/`에는 이 GAS 에이전트 외에도 Node.js 기반의 구식/실험용 자동화(`daily_agent.js`, `crawling_agent.js`, `fix_*.js`, `temp_*.js` 등)가 정리되지 않은 채 쌓여 있음.
- 배포 구조(`.agent/workflows/deploy.md` 참고): Cloudflare Workers가 `/api/*`만 처리하고, 루트의 HTML/CSS/JS는 Cloudflare Pages가 `master` 브랜치 루트를 그대로 라이브 사이트(`quiz-rank.com`)로 빌드. 즉 루트 정적 파일 이동은 링크 파손 위험이 있는 별도 작업.

## 목적

기존 "No-AI" 템플릿 방식 대신, CrewAI 멀티에이전트(기획→작성→SEO→검수)로 퀴즈/월드컵 콘텐츠 품질을 높인다. 학습 목적을 겸하되, 최종적으로는 실제 프로덕션 파이프라인으로 GAS 에이전트를 대체하는 것이 목표.

**1차 범위:** 퀴즈 + 월드컵만. 티어리스트는 DB 스키마 설계가 선행되어야 하므로 이번 범위에서 제외 (후속 작업으로 남김).

## 아키텍처

### 에이전트 구조 (단일 Crew, 콘텐츠 타입으로 파라미터화)

퀴즈용/월드컵용 Crew를 별도로 중복 작성하지 않고, 기획·SEO·검수 역할은 공유하고 "작성" 태스크만 콘텐츠 타입별로 분기한다. 이렇게 하면 나중에 티어리스트를 추가할 때도 동일 구조를 확장하면 된다.

| 에이전트 | 역할 |
|---|---|
| 기획자 (Planner) | 트렌딩 데이터(유튜브 트렌딩 영상, 구글 트렌드 키워드)를 보고 오늘의 주제·앵글 선정 |
| 작성자 (Writer) | 기획안을 받아 제목, 300자 이상 설명, 콘텐츠 본문 초안 작성 (퀴즈: 문항+선택지 / 월드컵: 후보 16개) |
| SEO 전문가 | 제목·설명을 검색 유입 관점에서 다듬음 (구조·데이터는 건드리지 않음) |
| 검수자 (Reviewer) | JSON 스키마 준수, 설명 글자수, 중복 선택지 등 체크 → `APPROVE` 또는 `REVISE`(사유) |

**중요 제약 — LLM 환각 방지:** 실제 유튜브 `video_id`나 `image_url`은 LLM이 생성하지 않는다. 기존 GAS 코드의 `fetchTrendingVideos_`/`searchYouTube_`와 동일한 역할을 하는 **결정론적 Python 도구(tool)**가 실제 데이터를 가져오고, LLM은 그 안에서 선택·문장 작성만 담당한다.

### LLM

기존과 동일하게 Gemini Free Tier 사용 (LiteLLM 경유, CrewAI 기본 지원). 신규 API 키 발급 불필요, 기존 Gemini API 키 재사용.

### 재시도 로직

검수자가 `REVISE`를 반환하면 사유를 포함해 작성자 태스크를 재실행 (최대 2회). 2회 초과 시 해당 콘텐츠 타입은 그날 스킵하고 로그만 남김 — 기존 GAS 스크립트의 "영상/데이터 부족 시 스킵" 방어 패턴과 동일한 철학.

## 데이터 흐름

1. GitHub Actions 스케줄 트리거 (매일 KST 04:00 — 기존 GAS 03:00 실행과 겹치지 않게 1시간 차이)
2. Supabase 인증 (Service Key 사용)
3. `for content_type in [quiz, worldcup]:`
   - 기획자: 트렌딩 데이터 기반 주제 선정
   - 작성자: 콘텐츠 초안 생성 (도구로 실제 영상/이미지 매칭)
   - SEO 전문가: 제목/설명 다듬기
   - 검수자: 검증 → 승인 시 다음 단계, 반려 시 작성자 재실행(최대 2회)
   - 승인된 콘텐츠를 기존 스키마 그대로 Supabase에 적재:
     - `quizzes`(title, description, creator_id) + `quiz_questions`(quiz_id, video_id, start_time, end_time, answer, options, is_embeddable)
     - `worldcups`(title, description, play_count, creator_id) + `worldcup_items`(worldcup_id, name, image_url)
4. 결과를 GitHub Actions Job Summary에 기록 (성공/실패/스킵 여부, 제목)

## 에러 처리

- 트렌딩 데이터 수집 자체가 실패하면 해당 콘텐츠 타입만 스킵 (전체 job은 계속 진행) — 기존 GAS의 `try/catch`별 스킵 패턴 유지.
- Gemini API 429(할당량 초과) 시 해당 콘텐츠 타입 스킵 후 명확히 로그.
- Supabase insert 실패 시 재시도 없이 즉시 실패 로그 (데이터 정합성 우선).

## 롤아웃 전략

GAS 에이전트는 그대로 유지한 채 GitHub Actions CrewAI 파이프라인을 병행 운영. 약 1~2주간 두 파이프라인이 각자 생성한 콘텐츠 품질(설명 길이/SEO 메타데이터/문항 완성도)을 비교한 뒤, CrewAI 쪽이 더 낫다고 판단되면 GAS의 `setupDailyTrigger`를 해제하고 GitHub Actions로 완전 전환.

## 테스트 방법

- `workflow_dispatch`(수동 트리거)로 먼저 1회 실행해 Supabase에 정상 적재되는지 확인 후 스케줄 활성화.
- 로컬에서는 `.env` + `--dry-run` 플래그로 Supabase insert 없이 콘솔 출력만 확인 가능하게 구현.

## 폴더 구조

### 신규 CrewAI 파이프라인

```
scripts/crewai/
  ├── agents.py       # 기획자/작성자/SEO/검수자 정의
  ├── tools.py        # 결정론적 도구: 유튜브 트렌딩/검색 (기존 fetchTrendingVideos_ 포팅)
  ├── crew.py         # Crew 조립 (콘텐츠 타입 파라미터화)
  ├── supabase_io.py  # Supabase insert (기존 스키마 그대로 사용)
  ├── main.py         # 진입점: quiz + worldcup 순차 실행, 재시도/스킵 로직
  └── requirements.txt
.github/workflows/
  └── crewai-agent.yml   # 매일 KST 04:00 실행, workflow_dispatch 지원
```

GitHub Actions Secrets: `GEMINI_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`.

### 기존 `scripts/` 정리 (범위 확정)

- **정리 대상 (라이브 사이트와 무관, 안전):**
  - `scripts/agents/` 신설 → `daily_agent.js`, `crawling_agent.js`, 신규 `crewai/` 이동
  - `scripts/maintenance/` 신설 → `fix_all_idols.js`, `fix_all_thumbnails.js`, `fix_cafe_thumbnails.js`, `heal_database.js`, `db_cleanup.js`, `migrate_answers.js`, `check_thumbnails.js`, `verify_youtube.js`, `link_validator.js`, `remove_theme_switch.js`, `update_nav_icons.js`
  - `scripts/seed_data/` 유지 (그대로)
  - `scripts/gas/` 유지 (그대로, GAS 병행 운영 중이므로 건드리지 않음)
  - `temp_check.js`, `temp_check_columns.js`, `temp_list_content_models.js`, `temp_list_models.js`, `temp_test_gemini.js` — **삭제** (일회성 디버그 스크립트, git 히스토리에 남아있어 복구 가능)
  - `prompt_templates.js`, `server.js`는 `scripts/agents/` 소속 파일들이 참조하므로 함께 `scripts/agents/`로 이동
- **정리 범위 제외 (확정, 이번엔 건드리지 않음):**
  - 루트의 `index.html`, `quiz-play.html` 등 모든 정적 페이지, `app.js`, `style.css`, `js/`, `images/` — Cloudflare Pages가 루트를 그대로 배포하므로 이동 시 내부 링크(`href="quiz-play.html"` 등) 파손 위험. 필요 시 별도 작업으로 링크 전체 업데이트 + 배포 검증까지 포함해 진행.

## 확인이 필요한 사항 (실행 전 마지막 체크)

- `scripts/agents/` 이동 시 `daily_agent.js`/`crawling_agent.js`가 `require`/`import`하는 상대 경로(`./prompt_templates.js`, `./link_validator.js` 등)도 같이 옮기면서 깨지지 않는지 확인 필요.
- `package.json`에 이 스크립트들을 가리키는 npm script가 있다면 경로 업데이트 필요 (현재 `package.json`엔 `scripts` 필드가 비어있어 해당 없음, 확인 완료).
