-- base64(data:) 썸네일을 별도 컬럼으로 분리: 목록/상세 쿼리가 수 MB짜리 값을 매번 읽지 않도록 한다.
-- thumbnail_url에는 일반 URL만 남기고, base64는 thumbnail_data에 보관(GET /api/thumb/:kind/:id 로만 서빙).
-- 되돌리기:
--   update quizzes set thumbnail_url = thumbnail_data where thumbnail_data is not null and thumbnail_url is null;
--   update worldcups set thumbnail_url = thumbnail_data where thumbnail_data is not null and thumbnail_url is null;
--   alter table quizzes drop column has_thumbnail_data, drop column thumbnail_data;
--   alter table worldcups drop column has_thumbnail_data, drop column thumbnail_data;

alter table quizzes   add column if not exists thumbnail_data text;
alter table worldcups add column if not exists thumbnail_data text;

update quizzes   set thumbnail_data = thumbnail_url, thumbnail_url = null where thumbnail_url like 'data:%' and thumbnail_data is null;
update worldcups set thumbnail_data = thumbnail_url, thumbnail_url = null where thumbnail_url like 'data:%' and thumbnail_data is null;

-- 목록에서 base64를 읽지 않고도 "썸네일 데이터가 있는지"만 알 수 있게 하는 파생 컬럼
alter table quizzes   add column if not exists has_thumbnail_data boolean generated always as (thumbnail_data is not null) stored;
alter table worldcups add column if not exists has_thumbnail_data boolean generated always as (thumbnail_data is not null) stored;
