# 🤖 QuizRank Auto Agent — GAS 세팅 가이드

## 📋 개요

**`quizrank_agent.js`** 파일 **하나**를 GAS에 복사-붙여넣기하면 끝!

매일 새벽 자동으로:
1. 🔥 Google Trends에서 핫 키워드 수집
2. 🎵 퀴즈 1개 + 🏆 월드컵 1개 + 📊 티어리스트 1개 생성
3. 🎬 YouTube 영상/이미지 자동 매칭
4. 💾 Supabase DB에 적재
5. 🧹 30일 지난 비인기 콘텐츠 자동 삭제

**총 비용: ₩0/월** (모든 API 무료)

---

## 🚀 세팅 (3분)

### 1. [script.google.com](https://script.google.com) 접속 → 새 프로젝트

### 2. 기존 `코드.gs`의 내용을 전부 지우고, `quizrank_agent.js` 내용을 통째로 복사-붙여넣기

### 3. 함수 드롭다운 → `testRun` 선택 → ▶ 실행 → 권한 승인

### 4. 정상 작동 확인 후 → `setupDailyTrigger` 선택 → ▶ 실행 → 끝! 🎉

---

## 🧪 테스트 함수

| 함수 | 용도 |
|------|------|
| `testRun` | ⭐ 전체 파이프라인 즉시 실행 |
| `testTrends` | 트렌드 키워드 수집만 |
| `testYouTubeSearch` | YouTube 검색만 |
| `testSupabaseAuth` | DB 인증만 |
| `testGemini` | Gemini API만 |
| `setupDailyTrigger` | 매일 새벽 3시 자동 실행 설정 |
| `listTriggers` | 현재 트리거 확인 |
