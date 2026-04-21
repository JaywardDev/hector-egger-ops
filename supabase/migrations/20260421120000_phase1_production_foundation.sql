create table public.production_projects (
  id uuid primary key default gen_random_uuid(),
  project_file text not null,
  project_name text not null,
  project_sequence integer not null,
  total_operational_minutes integer,
  estimated_total_volume_m3 numeric(12,3),
  status text not null default 'active',
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint production_projects_file_sequence_unique unique (project_file, project_sequence),
  constraint production_projects_status_check check (status in ('active', 'completed', 'archived')),
  constraint production_projects_total_operational_minutes_check check (
    total_operational_minutes is null or total_operational_minutes >= 0
  ),
  constraint production_projects_estimated_total_volume_m3_check check (
    estimated_total_volume_m3 is null or estimated_total_volume_m3 >= 0
  )
);

create table public.production_downtime_reasons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  label text not null,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default timezone('utc', now())
);

create table public.production_interruption_reasons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  label text not null,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default timezone('utc', now())
);

create table public.production_entries (
  id uuid primary key default gen_random_uuid(),
  work_date date not null,
  operator_profile_id uuid not null references public.profiles (id) on delete restrict,
  shift_start_time time not null,
  shift_end_time time not null,
  project_id uuid not null references public.production_projects (id) on delete restrict,
  file_minutes_left_start integer not null,
  file_minutes_left_end integer not null,
  actual_volume_cut_m3 numeric(12,3) not null default 0,
  downtime_minutes integer not null default 0,
  downtime_reason_id uuid references public.production_downtime_reasons (id) on delete restrict,
  interruption_minutes integer not null default 0,
  interruption_reason_id uuid references public.production_interruption_reasons (id) on delete restrict,
  notes text,
  created_by_profile_id uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint production_entries_file_minutes_left_start_check check (file_minutes_left_start >= 0),
  constraint production_entries_file_minutes_left_end_check check (file_minutes_left_end >= 0),
  constraint production_entries_actual_volume_cut_m3_check check (actual_volume_cut_m3 >= 0),
  constraint production_entries_downtime_minutes_check check (downtime_minutes >= 0),
  constraint production_entries_interruption_minutes_check check (interruption_minutes >= 0),
  constraint production_entries_shift_window_check check (shift_end_time > shift_start_time),
  constraint production_entries_downtime_reason_required_check check (
    (downtime_minutes > 0 and downtime_reason_id is not null)
    or (downtime_minutes = 0 and downtime_reason_id is null)
  ),
  constraint production_entries_interruption_reason_required_check check (
    (interruption_minutes > 0 and interruption_reason_id is not null)
    or (interruption_minutes = 0 and interruption_reason_id is null)
  )
);

create index production_projects_file_sequence_idx
  on public.production_projects (project_file, project_sequence);
create index production_projects_status_idx
  on public.production_projects (status);

create index production_entries_work_date_idx
  on public.production_entries (work_date);
create index production_entries_project_work_date_idx
  on public.production_entries (project_id, work_date);
create index production_entries_operator_work_date_idx
  on public.production_entries (operator_profile_id, work_date);
create index production_entries_created_at_idx
  on public.production_entries (created_at desc);

create index production_downtime_reasons_sort_idx
  on public.production_downtime_reasons (is_active desc, sort_order asc, label asc);
create index production_interruption_reasons_sort_idx
  on public.production_interruption_reasons (is_active desc, sort_order asc, label asc);

create trigger production_projects_set_updated_at
before update on public.production_projects
for each row
execute function public.set_current_timestamp_updated_at();

create trigger production_entries_set_updated_at
before update on public.production_entries
for each row
execute function public.set_current_timestamp_updated_at();

alter table public.production_projects enable row level security;
alter table public.production_downtime_reasons enable row level security;
alter table public.production_interruption_reasons enable row level security;
alter table public.production_entries enable row level security;

create policy "production_projects_select_approved"
on public.production_projects
for select
to authenticated
using (public.is_current_user_approved());

create policy "production_projects_insert_admin_or_supervisor"
on public.production_projects
for insert
to authenticated
with check (public.is_current_user_admin_or_supervisor());

create policy "production_projects_update_admin_or_supervisor"
on public.production_projects
for update
to authenticated
using (public.is_current_user_admin_or_supervisor())
with check (public.is_current_user_admin_or_supervisor());

create policy "production_projects_delete_admin_or_supervisor"
on public.production_projects
for delete
to authenticated
using (public.is_current_user_admin_or_supervisor());

create policy "production_downtime_reasons_select_approved"
on public.production_downtime_reasons
for select
to authenticated
using (public.is_current_user_approved());

create policy "production_downtime_reasons_insert_admin_or_supervisor"
on public.production_downtime_reasons
for insert
to authenticated
with check (public.is_current_user_admin_or_supervisor());

create policy "production_downtime_reasons_update_admin_or_supervisor"
on public.production_downtime_reasons
for update
to authenticated
using (public.is_current_user_admin_or_supervisor())
with check (public.is_current_user_admin_or_supervisor());

create policy "production_downtime_reasons_delete_admin_or_supervisor"
on public.production_downtime_reasons
for delete
to authenticated
using (public.is_current_user_admin_or_supervisor());

create policy "production_interruption_reasons_select_approved"
on public.production_interruption_reasons
for select
to authenticated
using (public.is_current_user_approved());

create policy "production_interruption_reasons_insert_admin_or_supervisor"
on public.production_interruption_reasons
for insert
to authenticated
with check (public.is_current_user_admin_or_supervisor());

create policy "production_interruption_reasons_update_admin_or_supervisor"
on public.production_interruption_reasons
for update
to authenticated
using (public.is_current_user_admin_or_supervisor())
with check (public.is_current_user_admin_or_supervisor());

create policy "production_interruption_reasons_delete_admin_or_supervisor"
on public.production_interruption_reasons
for delete
to authenticated
using (public.is_current_user_admin_or_supervisor());

create policy "production_entries_select_approved"
on public.production_entries
for select
to authenticated
using (public.is_current_user_approved());

create policy "production_entries_insert_operational"
on public.production_entries
for insert
to authenticated
with check (
  public.is_current_user_approved()
  and exists (
    select 1
    from public.user_roles ur
    join public.profiles p on p.id = ur.profile_id
    where p.auth_user_id = auth.uid()
      and p.account_status = 'approved'
      and ur.role in ('admin', 'supervisor', 'operator')
  )
);

create policy "production_entries_update_operational"
on public.production_entries
for update
to authenticated
using (
  public.is_current_user_approved()
  and exists (
    select 1
    from public.user_roles ur
    join public.profiles p on p.id = ur.profile_id
    where p.auth_user_id = auth.uid()
      and p.account_status = 'approved'
      and ur.role in ('admin', 'supervisor', 'operator')
  )
)
with check (
  public.is_current_user_approved()
  and exists (
    select 1
    from public.user_roles ur
    join public.profiles p on p.id = ur.profile_id
    where p.auth_user_id = auth.uid()
      and p.account_status = 'approved'
      and ur.role in ('admin', 'supervisor', 'operator')
  )
);

create policy "production_entries_delete_operational"
on public.production_entries
for delete
to authenticated
using (
  public.is_current_user_approved()
  and exists (
    select 1
    from public.user_roles ur
    join public.profiles p on p.id = ur.profile_id
    where p.auth_user_id = auth.uid()
      and p.account_status = 'approved'
      and ur.role in ('admin', 'supervisor', 'operator')
  )
);

create or replace view public.production_entries_with_metrics as
select
  e.id,
  e.work_date,
  e.operator_profile_id,
  coalesce(op.full_name, op.email) as operator_name,
  e.shift_start_time,
  e.shift_end_time,
  e.project_id,
  p.project_file,
  p.project_name,
  p.project_sequence,
  e.file_minutes_left_start,
  e.file_minutes_left_end,
  e.actual_volume_cut_m3,
  e.downtime_minutes,
  e.downtime_reason_id,
  dr.code as downtime_reason_code,
  dr.label as downtime_reason_label,
  e.interruption_minutes,
  e.interruption_reason_id,
  ir.code as interruption_reason_code,
  ir.label as interruption_reason_label,
  e.notes,
  e.created_by_profile_id,
  e.created_at,
  e.updated_at,
  ((extract(epoch from (e.shift_end_time - e.shift_start_time)) / 60)::integer) as operational_minutes,
  (((extract(epoch from (e.shift_end_time - e.shift_start_time)) / 60)::integer) - e.downtime_minutes) as productive_minutes,
  (e.file_minutes_left_start - e.file_minutes_left_end) as project_file_done_minutes,
  case
    when extract(epoch from (e.shift_end_time - e.shift_start_time)) <= 0 then null
    else (e.actual_volume_cut_m3 / (extract(epoch from (e.shift_end_time - e.shift_start_time)) / 3600.0))::numeric
  end as cutting_rate_m3_per_hour,
  case
    when extract(epoch from (e.shift_end_time - e.shift_start_time)) <= 0 then null
    else ((e.file_minutes_left_start - e.file_minutes_left_end - e.downtime_minutes)::numeric
      / (extract(epoch from (e.shift_end_time - e.shift_start_time)) / 60.0))
  end as machine_efficiency_pct,
  case
    when extract(epoch from (e.shift_end_time - e.shift_start_time)) <= 0 then null
    else ((e.file_minutes_left_start - e.file_minutes_left_end - e.downtime_minutes - e.interruption_minutes)::numeric
      / (extract(epoch from (e.shift_end_time - e.shift_start_time)) / 60.0))
  end as project_efficiency_pct
from public.production_entries e
join public.production_projects p on p.id = e.project_id
join public.profiles op on op.id = e.operator_profile_id
left join public.production_downtime_reasons dr on dr.id = e.downtime_reason_id
left join public.production_interruption_reasons ir on ir.id = e.interruption_reason_id;

create or replace view public.production_project_summaries as
with latest_project_left as (
  select distinct on (e.project_id)
    e.project_id,
    e.file_minutes_left_end,
    e.work_date,
    e.created_at,
    e.id
  from public.production_entries e
  order by e.project_id, e.work_date desc, e.created_at desc, e.id desc
)
select
  p.id as project_id,
  p.project_file,
  p.project_name,
  p.project_sequence,
  p.total_operational_minutes,
  coalesce(sum(m.operational_minutes), 0)::integer as total_logged_operational_minutes,
  coalesce(sum(m.actual_volume_cut_m3), 0)::numeric(12,3) as total_volume_cut_m3,
  coalesce(sum(m.downtime_minutes), 0)::integer as total_downtime_minutes,
  coalesce(sum(m.interruption_minutes), 0)::integer as total_interruption_minutes,
  avg(m.machine_efficiency_pct)::numeric as avg_machine_efficiency_pct,
  avg(m.project_efficiency_pct)::numeric as avg_project_efficiency_pct,
  l.file_minutes_left_end as latest_file_minutes_left,
  case
    when p.total_operational_minutes is null or p.total_operational_minutes <= 0 or l.file_minutes_left_end is null then null
    else (l.file_minutes_left_end::numeric / p.total_operational_minutes::numeric)
  end as remaining_pct,
  case
    when p.total_operational_minutes is null or p.total_operational_minutes <= 0 or l.file_minutes_left_end is null then null
    else (1 - (l.file_minutes_left_end::numeric / p.total_operational_minutes::numeric))
  end as progress_pct
from public.production_projects p
left join public.production_entries_with_metrics m on m.project_id = p.id
left join latest_project_left l on l.project_id = p.id
group by
  p.id,
  p.project_file,
  p.project_name,
  p.project_sequence,
  p.total_operational_minutes,
  l.file_minutes_left_end;

create or replace view public.production_operator_summaries as
select
  m.operator_profile_id,
  m.operator_name,
  count(m.id)::integer as shift_count,
  coalesce(sum(m.operational_minutes), 0)::integer as total_operational_minutes,
  coalesce(sum(m.actual_volume_cut_m3), 0)::numeric(12,3) as total_volume_cut_m3,
  avg(m.machine_efficiency_pct)::numeric as avg_machine_efficiency_pct,
  avg(m.project_efficiency_pct)::numeric as avg_project_efficiency_pct,
  coalesce(sum(m.downtime_minutes), 0)::integer as total_downtime_minutes,
  coalesce(sum(m.interruption_minutes), 0)::integer as total_interruption_minutes
from public.production_entries_with_metrics m
group by m.operator_profile_id, m.operator_name;

insert into public.production_downtime_reasons (code, label, sort_order)
values
  ('maintenance', 'Maintenance', 10),
  ('breakdown', 'Breakdown', 20),
  ('setup', 'Setup', 30)
on conflict (code) do update
set
  label = excluded.label,
  sort_order = excluded.sort_order,
  is_active = true;

insert into public.production_interruption_reasons (code, label, sort_order)
values
  ('power_outage', 'Power outage', 10),
  ('material_delay', 'Material delay', 20),
  ('operator_break', 'Operator break', 30)
on conflict (code) do update
set
  label = excluded.label,
  sort_order = excluded.sort_order,
  is_active = true;
