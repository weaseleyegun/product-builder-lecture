# 📋 프로젝트 진행 상황
> 마지막 업데이트: 2026-03-07 23:45 (KST)

## 🔑 현재 맥락 (AI가 이어받기 위한 핵심 정보)
- **QuizRank.io** — 월드컵 및 퀴즈 데이터의 대규모 이미지 복구와 인기순 정렬 시스템이 구축되었습니다.
- **안정적인 이미지 로딩**: `SafeImageLoader` 유틸리티와 `dbkpop.com` 등 안정적인 소스를 사용하여 엑박(Broken Image) 문제를 근본적으로 해결했습니다.
- **인기순 랭킹 시스템**: 유저가 플레이할 때마다 `play_count`가 즉시 증가하며, 메인 페이지에서 실제 인기 순서대로 콘텐츠가 배치됩니다.
- **배포 상태**: 모든 데이터 수정 및 인기 정렬 로직이 `master` 브랜치를 통해 `quizrank.pages.dev`에 완벽히 배포되었습니다.

## ✅ 최근 완료된 작업
1. **인기순(Play Count) 정렬 시스템 구축**: 백엔드 API 및 프론트엔드 연동을 완료하여 조회수가 높은 월드컵과 티어가 메인 상단에 오도록 개선했습니다.
2. **나연(TWICE), 유나(ITZY) 등 핵심 아이돌 이미지 복구**: 40여 명 이상의 핵심 아이돌 이미지 주소를 `dbkpop.com` 고화질 원본으로 전면 교체했습니다.
3. **이미지 렌더링 최적화**: `SafeImageLoader`를 통해 다음 라운드 전환 시 이전 사진이 남는 '잔상 버그'를 수정하고 폴백 이미지를 적용했습니다.
4. **실시간 통계 표시**: 월드컵/티어 리스트 카드에 누적 플레이 횟수(예: ▶ 1,200회 실행)를 표시하여 신뢰도를 높였습니다.
5. **프로덕션(Master) 배포 성공**: `wrangler`를 사용하여 API 서버와 프론트엔드 정적 파일을 실서비스 환경에 즉시 반영했습니다.

## ⚠️ 현재 이슈 / 알려진 버그
- 현재 알려진 이슈 없음 (대규모 이미지 전수 조사 및 매칭 검증 완료).

## 📋 다음에 할 일
1. **로그인 기능 구현**: 구글/이메일 기반 가입 시스템 연동.
2. **결과 공유 최적화**: SNS(카톡 등)로 결과 이미지를 전송하는 기능.
3. **관리자 대시보드 강화**: 브라우저에서 편리하게 콘텐츠를 관리하는 어드민 UI.

## 📁 최근 변경된 파일
- `app.js` — 메인 페이지 인기순 정렬 로직 및 플레이 횟수 표시 기능 추가
- `js/utils/image-loader.js` — 이미지 로딩 안정화 및 잔상 제거를 위한 유틸리티 생성
- `src/routes/worldcup.js` — 월드컵 플레이 시 조회수(`play_count`) 자동 증가 로직 추가
- `scripts/fix_all_idols.js` — 40여 명의 아이돌 이미지 주소 일괄 교체 및 엄격한 매칭 로직 적용

---

## 🗂️ 핵심 파일 및 폴더 아키텍처 (유지 보수용)
> AI 에이전트는 이 섹션을 지우지 않고, 새로운 구조적 파일이 추가될 때마다 이곳에 역할을 업데이트합니다.

**Root (최상단 로직 & UI)**
- `app.js` — 웹 애플리케이션의 프론트엔드 라우팅 및 전역 상태(유저 세션 등)를 관리하는 메인 진입점.
- `index.html` — 서비스의 메인 홈 화면 (퀴즈 플랫폼 대문).
- `quiz-play.html`, `quiz-list.html`, `quiz-create.html` — 노래/영상 퀴즈 관련 플레이, 목록, 생성 UI.
- `worldcup-play.html`, `worldcup-list.html`, `worldcup-create.html` — 이상형 월드컵 관련 플레이, 목록, 생성 UI.
- `admin-dashboard.html`, `admin-edit.html` — 관리자 대시보드 및 콘텐츠 수정 권한 UI.
- `login.html`, `ad-inquiry.html`, `privacy.html`, `terms.html` — 로그인 및 약관 등 기본 페이지.
- `style.css` — 플랫폼 전역 스타일링 (바닐라 CSS).
- `package.json`, `wrangler.toml`, `.dev.vars` — 프로젝트 의존성, 환경 변수, Cloudflare Workers 배포 설정 파일.

**Directories**
- `js/` (프론트엔드 액션 로직) — `quiz.js`, `multiplayer.js`, `worldcup.js` 등 페이지별 DOM 조작 및 Supabase 통신 스크립트.
- `src/` (백엔드 API / Cloudflare Workers) — `index.js`, `routes/` 등 서버리스 클라우드 환경에서 동작하는 라우팅 및 보호된 로직.
- `sql/` (데이터베이스) — `schema.sql`, `rls_policies.sql` 등 Supabase 테이블, 함수, 정책(RLS) 파피루스.
- `scripts/` (자동화 및 유틸리티 스크립트 모음)
   - `crawling_agent.js` — AI 기반 퀴즈 콘텐츠 대량 스크래핑/유효성 체크 컨텐츠 메이커 (메인 실행 파일).
   - `prompt_templates.js` — 크롤링 에이전트가 사용하는 LLM 프롬프트 및 파싱 모듈.
   - `link_validator.js` — 크롤링 에이전트가 사용하는 유튜브/미디어 유효성 검증 모듈.
   - `daily_agent.js` — 매일 정기적으로 실행되어 특정 테스크를 수행하는 크론 에이전트.
   - `db_cleanup.js`, `preview_db_cleanup.js` — DB 데이터 정합성 검사 및 쓸데없는 쓰레기 값 청소 스크립트.
   - `heal_database.js` — DB 무결성을 재검증하고 손상된 곳을 복구하는 스크립트.
   - `verify_youtube.js` — DB에 저장된 예전 비디오들이 여전히 존재하는지 일괄 검증.
   - `server.js` — 필요시 로컬 환경에서 테스트 목적으로 구동하는 노드 서버.
   - `seed_data/` — JSON 또는 정적 객체 형태로 저장된 초기 아카이빙 데이터 폴더.
