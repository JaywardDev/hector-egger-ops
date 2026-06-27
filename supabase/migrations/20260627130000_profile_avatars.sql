-- Profile avatars. The image bytes live in a private Storage bucket; the profile
-- row records the object path. Uploads and reads go through service-role server
-- routes (so no per-object RLS is required on the bucket).

alter table public.profiles
  add column if not exists avatar_path text;

-- Private bucket for avatar images.
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', false)
on conflict (id) do nothing;
