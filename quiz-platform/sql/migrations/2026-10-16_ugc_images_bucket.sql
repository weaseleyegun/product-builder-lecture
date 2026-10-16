-- 회원이 만든 월드컵 이미지 저장소 (Supabase Storage). 이미 적용됨.
--  - 공개 버킷(주소를 아는 사람이 볼 수 있음), 파일당 1MB, jpeg/png/webp만 (SVG 등 스크립트 가능 형식 불가)
--  - 로그인한 사용자는 자기 폴더(<user id>/…)에만 업로드, 사용자당 최대 130개. 덮어쓰기/삭제 정책은 없다.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('ugc-images', 'ugc-images', true, 1048576, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = true, file_size_limit = 1048576, allowed_mime_types = array['image/jpeg','image/png','image/webp'];

drop policy if exists "ugc images: upload to own folder" on storage.objects;
create policy "ugc images: upload to own folder" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'ugc-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and (select count(*) from storage.objects o
          where o.bucket_id = 'ugc-images' and (storage.foldername(o.name))[1] = (select auth.uid())::text) < 130
  );
