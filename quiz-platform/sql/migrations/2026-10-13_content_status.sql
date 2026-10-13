-- 콘텐츠 공개 상태(status)·출처(source) 도입, 문제 콘텐츠 숨김, 공개 읽기는 published만 허용
-- 되돌리기: 파일 맨 아래 ROLLBACK 주석 참고. 데이터는 삭제하지 않는다.

-- 1) 컬럼 추가 (기본값 published → 기존 행은 모두 공개 상태로 시작, 아래에서 문제 행만 hidden)
alter table quizzes
  add column if not exists status text not null default 'published' check (status in ('draft','published','hidden')),
  add column if not exists source text not null default 'curated' check (source in ('curated','daily','ugc')),
  add column if not exists published_at timestamptz,
  add column if not exists hidden_reason text;
alter table worldcups
  add column if not exists status text not null default 'published' check (status in ('draft','published','hidden')),
  add column if not exists source text not null default 'curated' check (source in ('curated','daily','ugc')),
  add column if not exists published_at timestamptz,
  add column if not exists hidden_reason text;

-- 2) 출처 분류 (에이전트 계정 UID는 비밀이 아님)
update quizzes   set source = case when creator_id = 'd7f3bab3-8e84-4f76-bc18-cf496574f005' then (case when created_at >= '2026-03-05' then 'daily' else 'curated' end) else 'ugc' end, published_at = created_at;
update worldcups set source = case when creator_id = 'd7f3bab3-8e84-4f76-bc18-cf496574f005' then (case when created_at >= '2026-03-05' then 'daily' else 'curated' end) else 'ugc' end, published_at = created_at;

-- 3) 숨김: 빈 월드컵 / 같은 설명이 3번 넘게 반복된 자동 생성물 / 연예인 사진 퀴즈
update worldcups w set status = 'hidden', hidden_reason = 'empty'
  where not exists (select 1 from worldcup_items i where i.worldcup_id = w.id);
update worldcups set status = 'hidden', hidden_reason = 'duplicate_description'
  where source = 'daily' and status = 'published'
    and description in (select description from worldcups where source = 'daily' group by 1 having count(*) > 2);
update quizzes set status = 'hidden', hidden_reason = 'duplicate_description'
  where source = 'daily' and status = 'published'
    and description in (select description from quizzes where source = 'daily' group by 1 having count(*) > 2);
update quizzes set status = 'hidden', hidden_reason = 'portrait_rights_review'
  where title like '%연예인 이름 맞추기%';

-- 4) RLS: 공개 읽기는 published만 (anon 키로 REST를 직접 호출해도 hidden/draft는 안 보임).
--    작성자 본인과 관리자(agent@quizrank.com)는 전체를 볼 수 있음.
drop policy if exists "Quizzes are viewable by everyone." on quizzes;
create policy "Published quizzes viewable" on quizzes for select
  using (status = 'published' or creator_id = (select auth.uid()) or (select auth.email()) = 'agent@quizrank.com');

drop policy if exists "Worldcups viewable by everyone." on worldcups;
create policy "Published worldcups viewable" on worldcups for select
  using (status = 'published' or creator_id = (select auth.uid()) or (select auth.email()) = 'agent@quizrank.com');

drop policy if exists "Quiz questions viewable by everyone." on quiz_questions;
create policy "Questions of visible quizzes" on quiz_questions for select
  using (exists (select 1 from quizzes q where q.id = quiz_questions.quiz_id));

drop policy if exists "Worldcup items viewable by everyone." on worldcup_items;
create policy "Items of visible worldcups" on worldcup_items for select
  using (exists (select 1 from worldcups w where w.id = worldcup_items.worldcup_id));

-- 5) 조회 성능 (목록은 status + 정렬 키로 읽음)
create index if not exists quizzes_status_playcount_idx on quizzes (status, play_count desc);
create index if not exists worldcups_status_playcount_idx on worldcups (status, play_count desc);
create index if not exists quiz_questions_quiz_id_idx on quiz_questions (quiz_id);
create index if not exists worldcup_items_worldcup_id_idx on worldcup_items (worldcup_id);

-- ROLLBACK (필요할 때만 수동 실행):
--   update quizzes set status='published', hidden_reason=null;  update worldcups set status='published', hidden_reason=null;
--   drop policy "Published quizzes viewable" on quizzes;  create policy "Quizzes are viewable by everyone." on quizzes for select using (true);
--   drop policy "Published worldcups viewable" on worldcups;  create policy "Worldcups viewable by everyone." on worldcups for select using (true);
--   drop policy "Questions of visible quizzes" on quiz_questions;  create policy "Quiz questions viewable by everyone." on quiz_questions for select using (true);
--   drop policy "Items of visible worldcups" on worldcup_items;  create policy "Worldcup items viewable by everyone." on worldcup_items for select using (true);
