-- 오늘의 퀴즈 후보: 공개된 퀴즈 중 영상 없이 질문 문장이 있는 문제(텍스트 문제)를 가진 퀴즈. id 순으로 고정.
-- security invoker: 호출자(anon)의 RLS를 그대로 따른다.
create or replace function public.daily_candidates()
returns table (id uuid, slug text, title text)
language sql
stable
security invoker
set search_path = public
as $$
    select q.id, q.slug, q.title
    from quizzes q
    where q.status = 'published'
      and exists (
          select 1 from quiz_questions qq
          where qq.quiz_id = q.id and qq.question_text is not null and qq.video_id is null
      )
    order by q.id
$$;
grant execute on function public.daily_candidates() to anon, authenticated;
