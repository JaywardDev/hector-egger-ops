create table public.timesheet_projects (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  label text not null,
  is_active boolean not null default true,
  sort_order integer not null default 100,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.timesheet_tasks (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  label text not null,
  is_active boolean not null default true,
  sort_order integer not null default 100,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.timesheet_preferences (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  preferred_work_mode text not null default 'factory' check (preferred_work_mode in ('factory', 'site', 'mixed')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.timesheet_entries (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  work_date date not null,
  status text not null default 'submitted' check (status in ('submitted', 'approved')),
  time_in time,
  time_out time,
  work_mode text not null default 'factory' check (work_mode in ('factory', 'site', 'mixed')),
  leave_type text check (leave_type in ('annual', 'sick', 'bereavement', 'unpaid', 'other')),
  leave_hours numeric(4,1) not null default 0 check (leave_hours >= 0 and leave_hours <= 24),
  is_public_holiday boolean not null default false,
  unpaid_break boolean not null default true,
  paid_break boolean not null default true,
  payable_hours numeric(4,1) not null check (payable_hours >= 0 and payable_hours <= 24),
  allocation_hours numeric(4,1) not null check (allocation_hours >= 0 and allocation_hours <= 24),
  submitted_at timestamptz not null default timezone('utc', now()),
  approved_at timestamptz,
  approved_by_profile_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (profile_id, work_date),
  constraint timesheet_entries_public_holiday_shape check (
    (is_public_holiday = false)
    or (
      time_in is null
      and time_out is null
      and leave_type is null
      and leave_hours = 0
      and unpaid_break = false
      and paid_break = false
      and payable_hours = 8.0
      and allocation_hours = 8.0
    )
  ),
  constraint timesheet_entries_normal_time_required check (
    is_public_holiday = true or (time_in is not null and time_out is not null)
  ),
  constraint timesheet_entries_approved_metadata check (
    (status = 'submitted' and approved_at is null and approved_by_profile_id is null)
    or (status = 'approved' and approved_at is not null and approved_by_profile_id is not null)
  )
);

create table public.timesheet_entry_activities (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.timesheet_entries (id) on delete cascade,
  project_id uuid not null references public.timesheet_projects (id),
  task_id uuid not null references public.timesheet_tasks (id),
  work_mode text not null check (work_mode in ('factory', 'site')),
  hours numeric(4,1) not null check (hours > 0 and hours <= 24),
  sort_order integer not null default 0,
  created_at timestamptz not null default timezone('utc', now())
);

create index timesheet_entries_profile_work_date_idx on public.timesheet_entries (profile_id, work_date);
create index timesheet_entries_work_date_idx on public.timesheet_entries (work_date);
create index timesheet_entries_status_idx on public.timesheet_entries (status);
create index timesheet_entry_activities_entry_id_idx on public.timesheet_entry_activities (entry_id, sort_order);
create index timesheet_projects_active_sort_idx on public.timesheet_projects (is_active desc, sort_order asc, code asc);
create index timesheet_tasks_active_sort_idx on public.timesheet_tasks (is_active desc, sort_order asc, code asc);

create trigger timesheet_projects_set_updated_at
before update on public.timesheet_projects
for each row execute function public.set_current_timestamp_updated_at();

create trigger timesheet_tasks_set_updated_at
before update on public.timesheet_tasks
for each row execute function public.set_current_timestamp_updated_at();

create trigger timesheet_preferences_set_updated_at
before update on public.timesheet_preferences
for each row execute function public.set_current_timestamp_updated_at();

create trigger timesheet_entries_set_updated_at
before update on public.timesheet_entries
for each row execute function public.set_current_timestamp_updated_at();

create or replace function public.current_profile_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select p.id from public.profiles p where p.auth_user_id = auth.uid() limit 1;
$$;

grant execute on function public.current_profile_id() to authenticated;

alter table public.timesheet_projects enable row level security;
alter table public.timesheet_tasks enable row level security;
alter table public.timesheet_preferences enable row level security;
alter table public.timesheet_entries enable row level security;
alter table public.timesheet_entry_activities enable row level security;

create policy "timesheet_projects_select_approved"
on public.timesheet_projects for select to authenticated
using (public.is_current_user_approved());

create policy "timesheet_tasks_select_approved"
on public.timesheet_tasks for select to authenticated
using (public.is_current_user_approved());

create policy "timesheet_projects_admin_all"
on public.timesheet_projects for all to authenticated
using (public.is_current_user_admin())
with check (public.is_current_user_admin());

create policy "timesheet_tasks_admin_all"
on public.timesheet_tasks for all to authenticated
using (public.is_current_user_admin())
with check (public.is_current_user_admin());

create policy "timesheet_preferences_select_own"
on public.timesheet_preferences for select to authenticated
using (profile_id = public.current_profile_id());

create policy "timesheet_preferences_insert_own"
on public.timesheet_preferences for insert to authenticated
with check (profile_id = public.current_profile_id());

create policy "timesheet_preferences_update_own"
on public.timesheet_preferences for update to authenticated
using (profile_id = public.current_profile_id())
with check (profile_id = public.current_profile_id());

create policy "timesheet_entries_select_own_or_admin_supervisor"
on public.timesheet_entries for select to authenticated
using (profile_id = public.current_profile_id() or public.is_current_user_admin_or_supervisor());

create policy "timesheet_entries_insert_own"
on public.timesheet_entries for insert to authenticated
with check (profile_id = public.current_profile_id() and status = 'submitted');

create policy "timesheet_entries_update_own_submitted_or_admin_supervisor"
on public.timesheet_entries for update to authenticated
using ((profile_id = public.current_profile_id() and status = 'submitted') or public.is_current_user_admin_or_supervisor())
with check ((profile_id = public.current_profile_id() and status = 'submitted') or public.is_current_user_admin_or_supervisor());

create policy "timesheet_activities_select_visible_entries"
on public.timesheet_entry_activities for select to authenticated
using (exists (
  select 1 from public.timesheet_entries e
  where e.id = timesheet_entry_activities.entry_id
    and (e.profile_id = public.current_profile_id() or public.is_current_user_admin_or_supervisor())
));

create policy "timesheet_activities_insert_own_submitted_entry"
on public.timesheet_entry_activities for insert to authenticated
with check (exists (
  select 1 from public.timesheet_entries e
  where e.id = timesheet_entry_activities.entry_id
    and e.profile_id = public.current_profile_id()
    and e.status = 'submitted'
));

create policy "timesheet_activities_update_own_submitted_or_admin_supervisor"
on public.timesheet_entry_activities for update to authenticated
using (exists (
  select 1 from public.timesheet_entries e
  where e.id = timesheet_entry_activities.entry_id
    and ((e.profile_id = public.current_profile_id() and e.status = 'submitted') or public.is_current_user_admin_or_supervisor())
))
with check (exists (
  select 1 from public.timesheet_entries e
  where e.id = timesheet_entry_activities.entry_id
    and ((e.profile_id = public.current_profile_id() and e.status = 'submitted') or public.is_current_user_admin_or_supervisor())
));

create policy "timesheet_activities_delete_own_submitted_or_admin_supervisor"
on public.timesheet_entry_activities for delete to authenticated
using (exists (
  select 1 from public.timesheet_entries e
  where e.id = timesheet_entry_activities.entry_id
    and ((e.profile_id = public.current_profile_id() and e.status = 'submitted') or public.is_current_user_admin_or_supervisor())
));

insert into public.timesheet_projects (code, label, sort_order) values
  ('general', 'General / unassigned', 10),
  ('factory', 'Factory production', 20),
  ('site', 'Site work', 30)
on conflict (code) do update set label = excluded.label, sort_order = excluded.sort_order, is_active = true;

insert into public.timesheet_tasks (code, label, sort_order) values
  ('manufacturing', 'Manufacturing', 10),
  ('installation', 'Installation', 20),
  ('cleanup', 'Clean up', 30),
  ('training', 'Training', 40)
on conflict (code) do update set label = excluded.label, sort_order = excluded.sort_order, is_active = true;
