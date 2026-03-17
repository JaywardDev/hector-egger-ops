create or replace function public.is_trusted_profile_write_context()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select (
    auth.role() = 'service_role'
    or session_user in ('postgres', 'supabase_admin', 'supabase_auth_admin')
  );
$$;

create or replace function public.enforce_profile_self_service_guards()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_trusted_profile_write_context() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if auth.uid() is null or new.auth_user_id is distinct from auth.uid() then
      raise exception 'profiles can only be inserted for the authenticated user';
    end if;

    if new.account_status <> 'pending' then
      raise exception 'account_status is admin controlled';
    end if;

    if new.approved_at is not null or new.disabled_at is not null then
      raise exception 'approval and disable timestamps are admin controlled';
    end if;

    if new.invited_by_auth_user_id is not null then
      raise exception 'invited_by_auth_user_id is admin controlled';
    end if;

    if new.onboarding_source <> 'self_registration' then
      raise exception 'onboarding_source is admin controlled';
    end if;

    return new;
  end if;

  if tg_op = 'UPDATE'
    and auth.uid() is not null
    and old.auth_user_id = auth.uid()
    and not public.is_current_user_admin()
  then
    if new.account_status is distinct from old.account_status
      or new.approved_at is distinct from old.approved_at
      or new.disabled_at is distinct from old.disabled_at
      or new.invited_by_auth_user_id is distinct from old.invited_by_auth_user_id
      or new.onboarding_source is distinct from old.onboarding_source
      or new.auth_user_id is distinct from old.auth_user_id
      or new.email is distinct from old.email
    then
      raise exception 'this profile change requires admin privileges';
    end if;
  end if;

  return new;
end;
$$;
