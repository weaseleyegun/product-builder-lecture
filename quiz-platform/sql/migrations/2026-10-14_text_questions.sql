-- 텍스트 문제 지원: 영상/이미지 없이 질문 문장과 해설만으로 성립하는 문제 (속담·맞춤법·사자성어·초성 등)
-- - question_text : 질문 문장 (영상/이미지 문제에서는 NULL)
-- - explanation   : 정답 공개 후 보여 주는 해설 (오리지널 콘텐츠의 핵심)
-- - video_id      : 텍스트 문제에서는 NULL 허용. 단, 영상/이미지나 질문 문장 둘 중 하나는 반드시 있어야 한다.
-- 기존 행은 모두 video_id가 있어 제약을 만족한다.
-- 되돌리기:
--   alter table quiz_questions drop constraint if exists quiz_questions_has_content;
--   delete from quiz_questions where video_id is null;   -- 텍스트 문제가 있다면 먼저 정리
--   alter table quiz_questions alter column video_id set not null;
--   alter table quiz_questions drop column explanation, drop column question_text;

alter table quiz_questions add column if not exists question_text text;
alter table quiz_questions add column if not exists explanation text;
alter table quiz_questions alter column video_id drop not null;

alter table quiz_questions drop constraint if exists quiz_questions_has_content;
alter table quiz_questions add constraint quiz_questions_has_content
    check (video_id is not null or (question_text is not null and length(btrim(question_text)) > 0));

-- 길이 상한 (API에서도 검증하지만 DB에서도 막는다)
alter table quiz_questions drop constraint if exists quiz_questions_text_len;
alter table quiz_questions add constraint quiz_questions_text_len
    check ((question_text is null or length(question_text) <= 200) and (explanation is null or length(explanation) <= 300));
