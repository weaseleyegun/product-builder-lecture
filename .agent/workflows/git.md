---
description: 변경 사항 확인 → 커밋 → 푸시를 한 번에 수행하는 Git 에이전트
---

# 📦 Git 에이전트 (Git Agent)

코드 변경 사항을 확인하고, 의미 있는 커밋 메시지를 작성하여 `master` 브랜치에 push합니다.

## 실행 방법

사용자가 `/git` 또는 `/git [커밋 메시지]` 형태로 입력합니다.
예시:
- `/git` — 변경 내용을 분석하여 자동으로 커밋 메시지 생성
- `/git 월드컵 이미지 수정` — 지정된 커밋 메시지 사용

## 워크플로우 단계

// turbo-all

### 1단계: 변경 사항 확인

```sh
cd C:\Users\main\Desktop\Dev\products
git status
git diff --stat
```

- 변경된 파일이 없으면 "커밋할 변경 사항이 없습니다"를 알리고 종료합니다.
- 변경된 파일 목록을 사용자에게 보여줍니다.

### 2단계: 커밋 메시지 생성

- 사용자가 커밋 메시지를 지정한 경우 → 그대로 사용
- 지정하지 않은 경우 → 변경 내용을 분석하여 아래 규칙으로 자동 생성:

**커밋 메시지 규칙:**
```
[타입] 한국어 설명

타입 종류:
- feat: 새로운 기능
- fix: 버그 수정
- style: UI/CSS 변경
- refactor: 코드 리팩토링
- data: 데이터/DB 수정
- deploy: 배포 관련
- docs: 문서 변경
```

예시: `feat: 월드컵 인기순 정렬 기능 추가`

### 3단계: 스테이징 및 커밋

```sh
cd C:\Users\main\Desktop\Dev\products
git add -A
git commit -m "[생성된 커밋 메시지]"
```

### 4단계: 푸시

```sh
cd C:\Users\main\Desktop\Dev\products
git push origin master
```

### 5단계: 결과 보고

```
✅ Git 작업 완료!
- 변경 파일: N개
- 커밋: [커밋 메시지]
- 브랜치: master → origin/master
```

## 주의사항
- `.dev.vars`, `node_modules/` 등 민감 파일이 커밋에 포함되지 않도록 `.gitignore`를 확인합니다.
- 충돌(conflict)이 발생하면 사용자에게 알리고 수동 해결을 안내합니다.
- 한국어로 결과를 보고합니다.
