-- quiz_questions INSERT 권한 추가 (인증된 사용자가 문제를 추가할 수 있도록)
-- Supabase SQL Editor에서 실행

-- 1. quiz_questions INSERT 허용 (인증된 사용자)
CREATE POLICY "Authenticated users can insert quiz questions"
  ON quiz_questions FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- 2. quiz_questions UPDATE 허용 (is_embeddable 업데이트용)
CREATE POLICY "Authenticated users can update quiz questions"
  ON quiz_questions FOR UPDATE
  USING (auth.uid() IS NOT NULL);

-- 3. is_embeddable 컬럼 추가 (이전에 실행 안 했다면)
ALTER TABLE quiz_questions
ADD COLUMN IF NOT EXISTS is_embeddable BOOLEAN DEFAULT true;
