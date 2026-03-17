create or replace function public.is_current_user_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    join public.user_roles ur on ur.profile_id = p.id
    where p.auth_user_id = auth.uid()
      and p.account_status = 'approved'
      and ur.role = 'admin'
  );
$$;

grant execute on function public.is_current_user_admin() to authenticated;

create or replace function public.enforce_profile_self_service_guards()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() = 'service_role' then
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

drop trigger if exists profiles_enforce_self_service_guards on public.profiles;

create trigger profiles_enforce_self_service_guards
before insert or update on public.profiles
for each row
execute function public.enforce_profile_self_service_guards();

drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_insert_own" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;

drop policy if exists "user_roles_select_own" on public.user_roles;

create policy "profiles_select_own"
on public.profiles
for select
to authenticated
using (auth.uid() = auth_user_id);

create policy "profiles_select_admin"
on public.profiles
for select
to authenticated
using (public.is_current_user_admin());

create policy "profiles_insert_own"
on public.profiles
for insert
to authenticated
with check (auth.uid() = auth_user_id);

create policy "profiles_update_own"
on public.profiles
for update
to authenticated
using (auth.uid() = auth_user_id)
with check (auth.uid() = auth_user_id);

create policy "profiles_update_admin"
on public.profiles
for update
to authenticated
using (public.is_current_user_admin())
with check (public.is_current_user_admin());

create policy "user_roles_select_own"
on public.user_roles
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = user_roles.profile_id
      and p.auth_user_id = auth.uid()
  )
);

create policy "user_roles_select_admin"
on public.user_roles
for select
to authenticated
using (public.is_current_user_admin());

create policy "user_roles_insert_admin"
on public.user_roles
for insert
to authenticated
with check (public.is_current_user_admin());

create policy "user_roles_update_admin"
on public.user_roles
for update
to authenticated
using (public.is_current_user_admin())
with check (public.is_current_user_admin());

create policy "user_roles_delete_admin"
on public.user_roles
for delete
to authenticated
using (public.is_current_user_admin());
