-- 회원 제출(UGC)을 DB 함수 하나로 모은다 (독립 리뷰 반영)
--  - 일반 사용자는 테이블에 직접 INSERT/UPDATE 할 수 없다. 오직 아래 함수로만 초안을 제출한다.
--  - 함수는 모든 칼럼(상태·출처·조회수·통계 등)을 서버 값으로 고정하고, 부모+자식을 한 트랜잭션으로 저장한다(반쪽 초안 없음).
--  - 사용자별 어드바이저리 락 아래에서 대기 개수(3개)를 센다 → 동시 요청으로 상한을 넘길 수 없다.
--  - 제출 후에는 질문/후보를 사용자가 고칠 수 없다(검수한 내용이 바뀌지 않는다). 수정이 필요하면 관리자가 한다.

-- 직접 쓰기 정책 정리 (다시 실행해도 안전하도록 모두 drop if exists)
drop policy if exists "Authenticated users can create draft quizzes" on quizzes;
drop policy if exists "Authenticated users can create draft worldcups" on worldcups;
drop policy if exists "Insert questions into own draft quiz" on quiz_questions;
drop policy if exists "Update questions of own draft quiz" on quiz_questions;
drop policy if exists "Insert items into own draft worldcup" on worldcup_items;
drop policy if exists "Admin can insert quizzes" on quizzes;
drop policy if exists "Admin can insert worldcups" on worldcups;
drop policy if exists "Admin can insert questions" on quiz_questions;
drop policy if exists "Admin can update questions" on quiz_questions;
drop policy if exists "Admin can insert worldcup items" on worldcup_items;

create policy "Admin can insert quizzes" on quizzes for insert to authenticated
  with check ((select auth.email()) = 'agent@quizrank.com');
create policy "Admin can insert worldcups" on worldcups for insert to authenticated
  with check ((select auth.email()) = 'agent@quizrank.com');
create policy "Admin can insert questions" on quiz_questions for insert to authenticated
  with check ((select auth.email()) = 'agent@quizrank.com');
create policy "Admin can update questions" on quiz_questions for update to authenticated
  using ((select auth.email()) = 'agent@quizrank.com') with check ((select auth.email()) = 'agent@quizrank.com');
create policy "Admin can insert worldcup items" on worldcup_items for insert to authenticated
  with check ((select auth.email()) = 'agent@quizrank.com');

create or replace function public.submit_ugc_quiz(p_title text, p_description text, p_questions jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  qid uuid;
  q jsonb;
  vid text;
  ans text;
  opts jsonb;
  n int;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  perform pg_advisory_xact_lock(hashtext('ugc:' || uid::text));
  if (select count(*) from quizzes where creator_id = uid and status = 'draft' and source = 'ugc') >= 3 then
    raise exception 'pending_limit';
  end if;
  if p_title is null or char_length(btrim(p_title)) not between 2 and 60 then raise exception 'invalid_title'; end if;
  if p_description is not null and char_length(p_description) > 1200 then raise exception 'invalid_description'; end if;
  if p_questions is null or jsonb_typeof(p_questions) <> 'array' or jsonb_array_length(p_questions) not between 6 and 30 then
    raise exception 'invalid_questions';
  end if;

  insert into quizzes (title, description, creator_id, status, source)
    values (btrim(p_title), coalesce(p_description, ''), uid, 'draft', 'ugc')
    returning id into qid;

  for q in select * from jsonb_array_elements(p_questions) loop
    if jsonb_typeof(q) <> 'object' then raise exception 'invalid_questions'; end if;
    vid := q->>'video_id';
    ans := btrim(coalesce(q->>'answer', ''));
    opts := q->'options';
    if vid is null or not (vid ~ '^[A-Za-z0-9_-]{11}$' or (vid ~ '^https://[^[:space:]]+$' and char_length(vid) <= 500)) then
      raise exception 'invalid_media';
    end if;
    if char_length(ans) not between 1 and 60 then raise exception 'invalid_answer'; end if;
    if opts is null or jsonb_typeof(opts) <> 'array' or jsonb_array_length(opts) <> 4 then raise exception 'invalid_options'; end if;
    select count(*) into n from jsonb_array_elements(opts) o
      where jsonb_typeof(o) = 'object' and jsonb_typeof(o->'text') = 'string'
        and char_length(btrim(o->>'text')) between 1 and 60;
    if n <> 4 then raise exception 'invalid_options'; end if;
    select count(*) into n from jsonb_array_elements(opts) o
      where (o->>'isCorrect') = 'true' and btrim(o->>'text') = ans;
    if n <> 1 then raise exception 'invalid_options'; end if;
    if (select count(distinct lower(btrim(o->>'text'))) from jsonb_array_elements(opts) o) <> 4 then raise exception 'invalid_options'; end if;

    insert into quiz_questions (quiz_id, video_id, start_time, end_time, answer, options, is_embeddable)
    values (qid, vid, 0, 15, ans,
      (select jsonb_agg(jsonb_build_object('id', chr(64 + t.ord::int), 'text', btrim(t.o->>'text'), 'isCorrect', (t.o->>'isCorrect') = 'true') order by t.ord)
         from jsonb_array_elements(opts) with ordinality as t(o, ord)),
      true);
  end loop;
  return qid;
end $$;

create or replace function public.submit_ugc_worldcup(p_title text, p_description text, p_items jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  wid uuid;
  it jsonb;
  cnt int;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  perform pg_advisory_xact_lock(hashtext('ugc:' || uid::text));
  if (select count(*) from worldcups where creator_id = uid and status = 'draft' and source = 'ugc') >= 3 then
    raise exception 'pending_limit';
  end if;
  if p_title is null or char_length(btrim(p_title)) not between 2 and 60 then raise exception 'invalid_title'; end if;
  if p_description is not null and char_length(p_description) > 1200 then raise exception 'invalid_description'; end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' then raise exception 'invalid_items'; end if;
  cnt := jsonb_array_length(p_items);
  if cnt not in (8, 16, 32, 64) then raise exception 'invalid_items'; end if;

  insert into worldcups (title, description, creator_id, status, source)
    values (btrim(p_title), coalesce(p_description, ''), uid, 'draft', 'ugc')
    returning id into wid;

  for it in select * from jsonb_array_elements(p_items) loop
    if jsonb_typeof(it) <> 'object' or jsonb_typeof(it->'name') <> 'string' or jsonb_typeof(it->'image_url') <> 'string'
       or char_length(btrim(it->>'name')) not between 1 and 60
       or not ((it->>'image_url') ~ '^https://[^[:space:]]+$' and char_length(it->>'image_url') <= 500) then
      raise exception 'invalid_items';
    end if;
    insert into worldcup_items (worldcup_id, name, image_url) values (wid, btrim(it->>'name'), it->>'image_url');
  end loop;
  return wid;
end $$;

revoke all on function public.submit_ugc_quiz(text, text, jsonb) from public, anon;
revoke all on function public.submit_ugc_worldcup(text, text, jsonb) from public, anon;
grant execute on function public.submit_ugc_quiz(text, text, jsonb) to authenticated;
grant execute on function public.submit_ugc_worldcup(text, text, jsonb) to authenticated;
