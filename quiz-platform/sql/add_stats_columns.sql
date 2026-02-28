-- SQL: quizzes 테이블에 통계 컬럼 추가
-- Supabase SQL Editor에서 실행하세요

ALTER TABLE quizzes
  ADD COLUMN IF NOT EXISTS correct_count BIGINT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS incorrect_count BIGINT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS game_count BIGINT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS correct_rate NUMERIC(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS incorrect_rate NUMERIC(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rank INTEGER DEFAULT NULL;

-- play_count는 이미 있으므로 존재 확인 후 추가 (없으면 추가)
ALTER TABLE quizzes
  ADD COLUMN IF NOT EXISTS play_count BIGINT DEFAULT 0;

-- rank를 play_count 기준으로 초기 업데이트
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY play_count DESC) AS rn
  FROM quizzes
)
UPDATE quizzes
SET rank = ranked.rn
FROM ranked
WHERE quizzes.id = ranked.id;
