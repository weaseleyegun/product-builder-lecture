-- 플레이 집계: (콘텐츠, 세션, KST 날짜)당 1회만 play_count를 올린다.
-- 기존 문제: 월드컵용 RPC(increment_worldcup_play_count)가 DB에 없었고 직접 UPDATE는 RLS에 막혀 월드컵 플레이가 집계되지 않았음.
-- 되돌리기: drop function register_play(text, uuid, text); drop table play_events;

create table if not exists play_events (
  content_type text not null check (content_type in ('quiz','worldcup')),
  content_id   uuid not null,
  session_hash text not null,
  day          date not null default ((now() at time zone 'Asia/Seoul')::date),
  created_at   timestamptz not null default now(),
  primary key (content_type, content_id, session_hash, day)
);
alter table play_events enable row level security;   -- 정책 없음 = REST로 직접 접근 불가
create index if not exists play_events_day_idx on play_events (day);

create or replace function register_play(p_type text, p_id uuid, p_session text) returns boolean
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if p_type not in ('quiz','worldcup') or p_session is null or length(p_session) < 8 then
    return false;
  end if;
  -- 존재하고 공개된 콘텐츠에만 집계
  if p_type = 'quiz' then
    if not exists (select 1 from quizzes where id = p_id and status = 'published') then return false; end if;
  else
    if not exists (select 1 from worldcups where id = p_id and status = 'published') then return false; end if;
  end if;

  insert into play_events(content_type, content_id, session_hash) values (p_type, p_id, left(p_session, 64))
    on conflict do nothing;
  get diagnostics n = row_count;

  if n = 1 then
    if p_type = 'quiz' then update quizzes set play_count = coalesce(play_count, 0) + 1 where id = p_id;
    else update worldcups set play_count = coalesce(play_count, 0) + 1 where id = p_id; end if;
  end if;
  return n = 1;
end $$;

revoke all on function register_play(text, uuid, text) from public;
grant execute on function register_play(text, uuid, text) to anon, authenticated;
