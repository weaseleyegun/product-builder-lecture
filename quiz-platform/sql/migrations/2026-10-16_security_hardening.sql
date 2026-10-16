-- 보안 정비 (2026-10-16)
-- 1) 새 콘텐츠는 기본이 초안(draft). 공개는 관리자가 검수 후에만 한다.
alter table quizzes   alter column status set default 'draft';
alter table worldcups alter column status set default 'draft';

-- 2) 누구나(비로그인 포함) 월드컵 후보의 이름/이미지를 고칠 수 있던 정책 제거 (승/매치 수를 올리는 코드는 어디에도 없다)
drop policy if exists "Anyone can update win/match counts" on worldcup_items;

-- 3) 로그인한 아무 사용자나 '모든' 퀴즈의 문제를 추가/수정할 수 있던 정책 → 본인 초안(또는 관리자)만
drop policy if exists "Authenticated users can insert quiz questions" on quiz_questions;
drop policy if exists "Authenticated users can update quiz questions" on quiz_questions;
create policy "Insert questions into own draft quiz" on quiz_questions for insert to authenticated
  with check (exists (select 1 from quizzes q where q.id = quiz_questions.quiz_id
     and ((q.creator_id = (select auth.uid()) and q.status = 'draft') or (select auth.email()) = 'agent@quizrank.com')));
create policy "Update questions of own draft quiz" on quiz_questions for update to authenticated
  using (exists (select 1 from quizzes q where q.id = quiz_questions.quiz_id
     and ((q.creator_id = (select auth.uid()) and q.status = 'draft') or (select auth.email()) = 'agent@quizrank.com')))
  with check (exists (select 1 from quizzes q where q.id = quiz_questions.quiz_id
     and ((q.creator_id = (select auth.uid()) and q.status = 'draft') or (select auth.email()) = 'agent@quizrank.com')));

-- 4) 일반 사용자는 초안으로만 만들 수 있다 (직접 REST로 status='published' 삽입 방지). 관리자는 제한 없음.
drop policy if exists "Authenticated users can create quizzes." on quizzes;
create policy "Authenticated users can create draft quizzes" on quizzes for insert to authenticated
  with check ((select auth.uid()) = creator_id and (status = 'draft' or (select auth.email()) = 'agent@quizrank.com'));
drop policy if exists "Allow authenticated insert" on worldcups;
create policy "Authenticated users can create draft worldcups" on worldcups for insert to authenticated
  with check (creator_id = (select auth.uid()) and (status = 'draft' or (select auth.email()) = 'agent@quizrank.com'));
drop policy if exists "Allow authenticated insert" on worldcup_items;
create policy "Insert items into own draft worldcup" on worldcup_items for insert to authenticated
  with check (worldcup_id in (select w.id from worldcups w
     where (w.creator_id = (select auth.uid()) and w.status = 'draft') or (select auth.email()) = 'agent@quizrank.com'));

-- 5) 외부에서 호출할 이유가 없는 SECURITY DEFINER 함수의 실행 권한 회수 (트리거/미사용 함수)
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.increment_play_count(uuid) from public, anon, authenticated;

-- 6) 퀴즈 결과 집계: 공개된 퀴즈에만, 한 판의 범위(0~100문제) 안에서만 올릴 수 있다
create or replace function public.update_quiz_stats(q_id uuid, add_correct integer, add_incorrect integer)
returns void language plpgsql security definer set search_path to 'public' as $$
declare
  cc int; ic int; gc int; nc int; ni int; total int;
begin
  if add_correct is null or add_incorrect is null or add_correct < 0 or add_incorrect < 0
     or add_correct > 100 or add_incorrect > 100 or add_correct + add_incorrect = 0 then
    return;
  end if;
  select correct_count, incorrect_count, game_count into cc, ic, gc
    from quizzes where id = q_id and status = 'published' for update;
  if not found then return; end if;
  nc := coalesce(cc, 0) + add_correct;
  ni := coalesce(ic, 0) + add_incorrect;
  total := nc + ni;
  update quizzes set correct_count = nc, incorrect_count = ni, game_count = coalesce(gc, 0) + 1,
    correct_rate = case when total > 0 then round(nc::numeric / total * 100, 2) else 0 end,
    incorrect_rate = case when total > 0 then round(ni::numeric / total * 100, 2) else 0 end
  where id = q_id;
end $$;
