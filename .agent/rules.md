# 📜 프로젝트 코딩 규칙 (Rules)

이 규칙은 모든 에이전트가 코드를 생성하거나 수정할 때 반드시 준수해야 하는 최상위 지침입니다.

---

## 1. 🛠 기술 스택 및 라이브러리

- **Frontend**: React (Next.js) 기반 (필요시 변경)
- **Styling**: Tailwind CSS를 기본으로 사용 (별도의 CSS 파일 생성 지양)
- **State Management**: 가급적 Context API 또는 컴포넌트 내부 State 사용
- **Backend/DB**: Supabase 또는 Cloudflare Workers (기존 프로젝트 패턴 준수)

---

## 2. ⚡ 바이브 코딩 & 성능 최적화 (글자수 제한 방어)

- **모듈화 우선**: 하나의 파일은 최대 100~150라인을 넘지 않도록 작게 쪼갠다.
- **컴포넌트 분리**: UI 로직과 비즈니스 로직(API 호출 등)은 가능한 분리하여 작성한다.
- **Diff 기반 수정**: 코드를 전체 다시 쓰지 말고, 수정된 부분만 명확하게 보여주거나 인라인 수정을 수행한다.

---

## 3. 🎨 UI/UX 스타일 가이드

- **심플함 유지**: 비전공자 사용자가 봐도 직관적인 깔끔한 UI를 지향한다.
- **반응형 필수**: 모바일과 데스크탑에서 모두 깨지지 않도록 Tailwind의 `sm:`, `md:`, `lg:` 접두사를 활용한다.
- **일관성**: 버튼, 입력창, 카드 등은 프로젝트 내 기존 디자인 시스템(색상, 둥글기 등)을 그대로 따른다.

---

## 4. 📝 코드 작성 스타일

- **언어**: 코멘트(주석)와 변수명은 영문으로 하되, 사용자에게 설명할 때는 한국어를 사용한다.
- **가독성**: 복잡한 화살표 함수보다는 명확한 함수 선언식을 선호하며, 각 함수의 역할을 한 줄 주석으로 남긴다.
- **에러 핸들링**: 모든 API 호출부에는 `try-catch`와 사용자 알림(Toast 등) 로직을 포함한다.

---

## 5. 📂 폴더 관리

프로젝트 파일은 역할별로 명확하게 분리하여 관리한다.

```
quiz-platform/
├── js/                   # 프론트엔드 JavaScript
│   ├── utils/            # 공용 유틸리티 모듈
│   │   ├── config.js     # API URL, 상수 등 설정값 중앙 관리
│   │   └── theme.js      # 테마(다크/라이트) 토글 공용 코드
│   ├── quiz.js           # 퀴즈 페이지 로직
│   ├── worldcup.js       # 월드컵 페이지 로직
│   └── create.js         # 만들기 페이지 로직
├── src/                  # 백엔드 (Cloudflare Worker)
│   ├── helpers/          # 공용 헬퍼 (CORS, 응답 유틸)
│   │   └── cors.js       # CORS 헤더 및 응답 헬퍼
│   ├── routes/           # API 라우트 핸들러
│   │   ├── quiz.js       # /api/daily-quiz, /api/quiz-play
│   │   └── worldcup.js   # /api/worldcups, /api/worldcup-play, /api/user-created-content
│   └── index.js          # 메인 라우터 (진입점)
├── scripts/              # 일회성·자동화 스크립트
│   ├── daily_agent.js    # 자동 콘텐츠 수집 에이전트
│   └── auto_fix_pianos.js # YouTube 영상 교체 스크립트
├── sql/                  # SQL 파일 모음
│   ├── schema.sql        # DB 테이블 설계
│   ├── seed_quizzes.sql  # 초기 퀴즈 시드 데이터
│   └── migrations/       # 스키마 변경 이력
└── .agent/               # 에이전트 워크플로우·규칙
    ├── rules.md
    └── workflows/
```

### 폴더 규칙

- **새 JS 파일 생성 시**: 페이지별 로직은 `js/`, 공용은 `js/utils/`, 백엔드는 `src/routes/`에 배치
- **SQL 파일**: `sql/` 폴더에 모아 관리 (루트에 SQL 파일 산재 금지)
- **스크립트**: 일회성·자동화 스크립트는 `scripts/` 폴더에 배치
- **설정 파일**: 루트에 유지 (`wrangler.toml`, `package.json`, `serve.json` 등)

---

## 6. 🧩 모듈 관리

### 프론트엔드 (Vanilla JS)

- **공용 코드 중복 금지**: 2곳 이상에서 사용되는 코드는 반드시 `js/utils/`에 별도 파일로 추출한다.
- **설정값 하드코딩 금지**: API URL, 상수 등은 `js/utils/config.js`에서 관리한다.
- **script 로드 순서**: HTML에서 반드시 `config.js` → `theme.js` → 페이지 JS 순서로 로드한다.

### 백엔드 (Cloudflare Worker)

- **라우트 분리**: 각 API 경로의 핸들러는 `src/routes/`에 기능별로 분리한다.
- **메인 진입점은 라우터만**: `src/index.js`는 URL 매칭 → 핸들러 위임만 수행한다.
- **공용 헬퍼**: CORS, 응답 포맷 등은 `src/helpers/`에 분리한다.

### 네이밍 컨벤션

| 대상 | 규칙 | 예시 |
|------|------|------|
| 파일명 | 소문자 + 언더스코어(snake_case) | `daily_agent.js`, `seed_quizzes.sql` |
| 폴더명 | 소문자 + 하이픈 또는 언더스코어 | `utils/`, `routes/`, `helpers/` |
| JS 변수/함수 | camelCase | `fetchDailyQuizzes`, `currentRound` |
| 상수 | UPPER_SNAKE_CASE | `API_BASE_URL`, `QUIZ_META` |
| HTML id/class | kebab-case | `theme-toggle`, `quiz-card` |

---

## 7. 🤖 에이전트 협업 규칙

- **확인 절차**: 큰 규모의 코드 수정 전에는 반드시 `/planning` 에이전트를 통해 계획을 컨펌받는다.
- **기억 업데이트**: 주요 작업 완료 후에는 자동으로 `/summary` 에이전트를 호출하여 `progress.md`를 갱신한다.
