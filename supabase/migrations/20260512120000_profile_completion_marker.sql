alter table public.profiles
  add column if not exists profile_completed_at timestamptz null;

update public.profiles
set profile_completed_at = now()
where profile_completed_at is null
  and nullif(btrim(first_name), '') is not null
  and nullif(btrim(last_name), '') is not null;
