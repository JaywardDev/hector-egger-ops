alter table public.profiles
add column if not exists staff_group text;

alter table public.profiles
drop constraint if exists profiles_staff_group_check;

alter table public.profiles
add constraint profiles_staff_group_check
check (staff_group in ('factory', 'site') or staff_group is null);

create index if not exists profiles_staff_group_idx
on public.profiles (staff_group)
where staff_group is not null;

alter table public.timesheet_entries
drop constraint if exists timesheet_entries_status_check;

alter table public.timesheet_entries
drop constraint if exists timesheet_entries_approved_metadata;

alter table public.timesheet_entries
add column if not exists returned_at timestamptz,
add column if not exists returned_by_profile_id uuid references public.profiles (id) on delete set null,
add column if not exists return_comment text;

alter table public.timesheet_entries
add constraint timesheet_entries_status_check
check (status in ('submitted', 'approved', 'returned', 'supervisor_approved'));

alter table public.timesheet_entries
add constraint timesheet_entries_approval_return_metadata check (
  (
    status in ('submitted')
    and approved_at is null
    and approved_by_profile_id is null
  )
  or (
    status in ('approved', 'supervisor_approved')
    and approved_at is not null
    and approved_by_profile_id is not null
  )
  or (
    status = 'returned'
    and approved_at is null
    and approved_by_profile_id is null
    and returned_at is not null
    and returned_by_profile_id is not null
    and nullif(btrim(return_comment), '') is not null
  )
);

create table if not exists public.timesheet_approval_events (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  actor_profile_id uuid not null references public.profiles (id) on delete cascade,
  week_start date not null,
  week_end date not null,
  action text not null check (action in ('approved', 'returned', 'resubmitted')),
  comment text,
  affected_entry_ids uuid[],
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists timesheet_approval_events_profile_week_idx
on public.timesheet_approval_events (profile_id, week_start desc);

create index if not exists timesheet_approval_events_actor_created_idx
on public.timesheet_approval_events (actor_profile_id, created_at desc);

alter table public.timesheet_approval_events enable row level security;

create policy "timesheet_approval_events_select_own_or_admin_supervisor"
on public.timesheet_approval_events for select to authenticated
using (profile_id = public.current_profile_id() or public.is_current_user_admin_or_supervisor());

create policy "timesheet_approval_events_insert_admin_supervisor"
on public.timesheet_approval_events for insert to authenticated
with check (public.is_current_user_admin_or_supervisor());

drop policy if exists "timesheet_entries_update_own_submitted_or_admin_supervisor" on public.timesheet_entries;

create policy "timesheet_entries_update_own_submitted_returned_or_admin_supervisor"
on public.timesheet_entries for update to authenticated
using ((profile_id = public.current_profile_id() and status in ('submitted', 'returned')) or public.is_current_user_admin_or_supervisor())
with check ((profile_id = public.current_profile_id() and status in ('submitted', 'returned')) or public.is_current_user_admin_or_supervisor());

drop policy if exists "timesheet_activities_insert_own_submitted_entry" on public.timesheet_entry_activities;

create policy "timesheet_activities_insert_own_editable_entry"
on public.timesheet_entry_activities for insert to authenticated
with check (exists (
  select 1 from public.timesheet_entries e
  where e.id = timesheet_entry_activities.entry_id
    and e.profile_id = public.current_profile_id()
    and e.status in ('submitted', 'returned')
));

drop policy if exists "timesheet_activities_update_own_submitted_or_admin_supervisor" on public.timesheet_entry_activities;

create policy "timesheet_activities_update_own_editable_or_admin_supervisor"
on public.timesheet_entry_activities for update to authenticated
using (exists (
  select 1 from public.timesheet_entries e
  where e.id = timesheet_entry_activities.entry_id
    and ((e.profile_id = public.current_profile_id() and e.status in ('submitted', 'returned')) or public.is_current_user_admin_or_supervisor())
))
with check (exists (
  select 1 from public.timesheet_entries e
  where e.id = timesheet_entry_activities.entry_id
    and ((e.profile_id = public.current_profile_id() and e.status in ('submitted', 'returned')) or public.is_current_user_admin_or_supervisor())
));

drop policy if exists "timesheet_activities_delete_own_submitted_or_admin_supervisor" on public.timesheet_entry_activities;

create policy "timesheet_activities_delete_own_editable_or_admin_supervisor"
on public.timesheet_entry_activities for delete to authenticated
using (exists (
  select 1 from public.timesheet_entries e
  where e.id = timesheet_entry_activities.entry_id
    and ((e.profile_id = public.current_profile_id() and e.status in ('submitted', 'returned')) or public.is_current_user_admin_or_supervisor())
));

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

    if new.staff_group is not null then
      raise exception 'staff_group is admin controlled';
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
      or new.staff_group is distinct from old.staff_group
    then
      raise exception 'this profile change requires admin privileges';
    end if;
  end if;

  return new;
end;
$$;
