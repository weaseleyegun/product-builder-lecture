---
description: DB 무결성 점검 — YouTube 링크 유효성, 이미지 엑박, 데이터 정합성을 일괄 검사하고 오염 데이터를 자동 청소하는 건강검진 에이전트
---

# 🏥 DB 건강검진 에이전트 (Health Check Agent)

데이터베이스의 **무결성 점검** + **오염 데이터 청소**를 한 번에 수행합니다.

## 실행 방법

사용자가 `/health` 또는 `/health [범위]` 형태로 입력합니다.
예시:
- `/health` — 전체 점검 + 청소
- `/health youtube` — YouTube 링크 유효성만 점검
- `/health image` — 이미지 엑박만 점검
- `/health cleanup` — 오염 데이터 청소만 실행

## 워크플로우 단계

// turbo-all

### 1단계: 데이터베이스 무결성 점검

DB 내 데이터 이상(빈 값, 중복 레코드, 잘못된 참조 등)을 검사합니다.

```sh
cd C:\Users\main\Desktop\Dev\products\quiz-platform
node scripts/heal_database.js
```

### 2단계: YouTube 링크 유효성 검증

퀴즈에 등록된 YouTube 영상이 현재도 유효한지 확인합니다.

```sh
cd C:\Users\main\Desktop\Dev\products\quiz-platform
node scripts/verify_youtube.js
```

### 3단계: 썸네일/이미지 점검

월드컵 및 티어리스트 이미지 URL이 정상 응답하는지 확인합니다.

```sh
cd C:\Users\main\Desktop\Dev\products\quiz-platform
node scripts/check_thumbnails.js
```

### 4단계: 오염 데이터 자동 청소

퀴즈 보기의 버그 데이터(의미 없는 영단어 `A`, `B`, `Ad` 등)와 가수명 형식(`가수 - 노래제목` → `노래제목`)을 일괄 정제합니다.

```sh
cd C:\Users\main\Desktop\Dev\products\quiz-platform
node scripts/db_cleanup.js
```

### 5단계: 결과 통합 보고

모든 점검·청소 결과를 아래 형식으로 통합 보고합니다:

```markdown
## 🏥 DB 건강검진 보고서

### 📊 종합 현황
| 항목 | 전체 | 정상 | 이상 | 자동수정 |
|------|------|------|------|----------|
| YouTube 링크 | N | N | N | — |
| 이미지 URL | N | N | N | — |
| 데이터 정합성 | N | N | N | — |
| 오염 보기 청소 | N | — | N | N |
| 가수명 파싱 | N | — | N | N |

### ❌ 발견된 문제 (N건)
1. **[문제 유형]** — [상세 설명]
2. ...

### ✅ 자동 수정 완료 (N건)
- [자동으로 수정된 항목 목록]

### ⚠️ 수동 확인 필요 항목
- [사람이 직접 판단해야 하는 항목]
```

## 핵심 규칙
1. **범위 지정 시 해당 단계만 실행**: 사용자가 `youtube`, `image`, `cleanup` 등을 지정하면 관련 단계만 실행합니다.
2. **점검 → 청소 순서 고정**: 항상 점검을 먼저 수행한 뒤 청소를 실행합니다.
3. **한국어로**: 모든 보고를 한국어로 작성합니다.
