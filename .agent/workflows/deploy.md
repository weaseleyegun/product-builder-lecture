---
description: Cloudflare Workers 백엔드 + Pages 프론트엔드를 한 번에 배포하고 라이브 사이트에서 검증하는 배포 에이전트
---

# 🚀 배포 에이전트 (Deploy Agent)

코드 변경 사항을 Cloudflare Workers(백엔드 API) 및 Pages(프론트엔드)에 한 번에 배포하고, 라이브 사이트에서 정상 동작을 확인합니다.

## 실행 방법

사용자가 `/deploy` 또는 `/deploy [메시지]` 형태로 입력합니다.
예시: `/deploy 이미지 수정 반영`

## 워크플로우 단계

// turbo-all

### 1단계: 변경 사항 확인

```sh
cd C:\Users\main\Desktop\Dev\products\quiz-platform
git status
```

- 변경된 파일이 없으면 "배포할 변경 사항이 없습니다"를 알리고 종료합니다.

### 2단계: 백엔드 API 배포 (Cloudflare Workers)

```sh
cd C:\Users\main\Desktop\Dev\products\quiz-platform
npx wrangler deploy
```

- 배포 성공/실패 메시지를 확인합니다.
- 실패 시 에러 로그를 사용자에게 보여주고 중단합니다.

### 3단계: 프론트엔드 배포 (Git Push → Cloudflare Pages)

```sh
cd C:\Users\main\Desktop\Dev\products\quiz-platform
git add -A
git commit -m "[사용자가 입력한 메시지 또는 자동 생성 커밋 메시지]"
git push origin master
```

- Cloudflare Pages는 `master` 브랜치 push 시 자동 빌드/배포됩니다.

### 4단계: 라이브 사이트 검증

- 브라우저로 `https://quizrank.pages.dev`에 접속하여 페이지가 정상 로드되는지 확인합니다.
- 메인 페이지의 주요 요소(퀴즈 카드, 월드컵 카드 등)가 표시되는지 확인합니다.

### 5단계: 결과 보고

사용자에게 아래 형식으로 보고합니다:

```
✅ 배포 완료!
- Workers API: 배포 성공
- Pages 프론트엔드: push 완료 (자동 빌드 진행 중)
- 라이브 확인: https://quizrank.pages.dev
- 커밋: [커밋 메시지]
```

## 주의사항
- 배포 전 로컬에서 빌드 에러가 없는지 확인합니다.
- `wrangler.toml` 설정이 올바른지 사전에 점검합니다.
- 한국어로 결과를 보고합니다.
