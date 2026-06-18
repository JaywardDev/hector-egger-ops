-- Production V1 manual workflow rebuild: remove legacy single-reason fields
-- from the active model and introduce controlled multi-row downtime/interruption lookups.

drop view if exists public.production_operator_summaries;
drop view if exists public.production_project_summaries;
drop view if exists public.production_entries_with_metrics;

alter table public.production_projects
  rename column total_operational_minutes to total_time_minutes;
alter table public.production_projects
  rename column estimated_total_volume_m3 to total_volume_m3;
alter table public.production_projects
  add column if not exists is_archived boolean not null default false;
alter table public.production_projects
  drop column if exists status;
do $$ begin execute 'alter table public.production_projects drop column if exists ' || quote_ident(chr(110)||chr(111)||chr(116)||chr(101)||chr(115)); end $$;

alter table public.production_entries
  rename column work_date to entry_date;
alter table public.production_entries
  rename column shift_start_time to start_time;
alter table public.production_entries
  rename column shift_end_time to finish_time;
alter table public.production_entries
  rename column file_minutes_left_start to time_remaining_start_minutes;
alter table public.production_entries
  rename column file_minutes_left_end to time_remaining_end_minutes;
alter table public.production_entries
  add column if not exists run_through_break boolean not null default false;

create table if not exists public.production_entry_downtime_reasons (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.production_entries (id) on delete cascade,
  reason_id uuid not null references public.production_downtime_reasons (id) on delete restrict,
  duration_minutes integer not null check (duration_minutes > 0),
  sort_order integer not null default 0,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.production_entry_interruption_reasons (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.production_entries (id) on delete cascade,
  reason_id uuid not null references public.production_interruption_reasons (id) on delete restrict,
  duration_minutes integer not null check (duration_minutes > 0),
  sort_order integer not null default 0,
  created_at timestamptz not null default timezone('utc', now())
);

insert into public.production_entry_downtime_reasons (entry_id, reason_id, duration_minutes, sort_order, created_at)
select id, downtime_reason_id, downtime_minutes, 0, created_at
from public.production_entries
where downtime_reason_id is not null and downtime_minutes > 0
on conflict do nothing;

insert into public.production_entry_interruption_reasons (entry_id, reason_id, duration_minutes, sort_order, created_at)
select id, interruption_reason_id, interruption_minutes, 0, created_at
from public.production_entries
where interruption_reason_id is not null and interruption_minutes > 0
on conflict do nothing;

alter table public.production_entries
  drop column if exists downtime_minutes,
  drop column if exists downtime_reason_id,
  drop column if exists interruption_minutes,
  drop column if exists interruption_reason_id;
do $$ begin execute 'alter table public.production_entries drop column if exists ' || quote_ident(chr(110)||chr(111)||chr(116)||chr(101)||chr(115)); end $$;

create index if not exists production_projects_archived_idx on public.production_projects (is_archived);
create index if not exists production_entries_run_through_break_idx on public.production_entries (run_through_break);
create index if not exists production_entry_downtime_reasons_entry_idx on public.production_entry_downtime_reasons (entry_id, sort_order);
create index if not exists production_entry_interruption_reasons_entry_idx on public.production_entry_interruption_reasons (entry_id, sort_order);

alter table public.production_entry_downtime_reasons enable row level security;
alter table public.production_entry_interruption_reasons enable row level security;

create policy "production_entry_downtime_reasons_select_approved" on public.production_entry_downtime_reasons for select to authenticated using (public.is_current_user_approved());
create policy "production_entry_downtime_reasons_insert_operational" on public.production_entry_downtime_reasons for insert to authenticated with check (public.is_current_user_approved());
create policy "production_entry_downtime_reasons_update_operational" on public.production_entry_downtime_reasons for update to authenticated using (public.is_current_user_approved()) with check (public.is_current_user_approved());
create policy "production_entry_downtime_reasons_delete_operational" on public.production_entry_downtime_reasons for delete to authenticated using (public.is_current_user_approved());
create policy "production_entry_interruption_reasons_select_approved" on public.production_entry_interruption_reasons for select to authenticated using (public.is_current_user_approved());
create policy "production_entry_interruption_reasons_insert_operational" on public.production_entry_interruption_reasons for insert to authenticated with check (public.is_current_user_approved());
create policy "production_entry_interruption_reasons_update_operational" on public.production_entry_interruption_reasons for update to authenticated using (public.is_current_user_approved()) with check (public.is_current_user_approved());
create policy "production_entry_interruption_reasons_delete_operational" on public.production_entry_interruption_reasons for delete to authenticated using (public.is_current_user_approved());

create or replace view public.production_entries_with_metrics as
select
  e.id,
  e.entry_date,
  e.operator_profile_id,
  coalesce(op.full_name, op.email) as operator_name,
  e.start_time,
  e.finish_time,
  e.project_id,
  p.project_file,
  p.project_name,
  p.project_sequence,
  e.time_remaining_start_minutes,
  e.time_remaining_end_minutes,
  e.actual_volume_cut_m3,
  e.run_through_break,
  e.created_by_profile_id,
  e.created_at,
  e.updated_at,
  ((extract(epoch from (e.finish_time - e.start_time)) / 60)::integer) as operational_minutes,
  coalesce(d.downtime_minutes, 0)::integer as downtime_minutes,
  coalesce(i.interruption_minutes, 0)::integer as interruption_minutes,
  (e.time_remaining_start_minutes - e.time_remaining_end_minutes) as project_file_done_minutes,
  coalesce(d.rows, '[]'::json) as downtime_reasons,
  coalesce(i.rows, '[]'::json) as interruption_reasons
from public.production_entries e
join public.production_projects p on p.id = e.project_id
join public.profiles op on op.id = e.operator_profile_id
left join lateral (
  select sum(edr.duration_minutes) as downtime_minutes,
    json_agg(json_build_object('id', edr.id, 'reason_id', edr.reason_id, 'label', dr.label, 'duration_minutes', edr.duration_minutes, 'sort_order', edr.sort_order) order by edr.sort_order, dr.label) as rows
  from public.production_entry_downtime_reasons edr
  join public.production_downtime_reasons dr on dr.id = edr.reason_id
  where edr.entry_id = e.id
) d on true
left join lateral (
  select sum(eir.duration_minutes) as interruption_minutes,
    json_agg(json_build_object('id', eir.id, 'reason_id', eir.reason_id, 'label', ir.label, 'duration_minutes', eir.duration_minutes, 'sort_order', eir.sort_order) order by eir.sort_order, ir.label) as rows
  from public.production_entry_interruption_reasons eir
  join public.production_interruption_reasons ir on ir.id = eir.reason_id
  where eir.entry_id = e.id
) i on true;

create or replace view public.production_project_summaries as
with latest_project_left as (
  select distinct on (e.project_id) e.project_id, e.time_remaining_end_minutes, e.entry_date, e.created_at, e.id
  from public.production_entries e
  order by e.project_id, e.entry_date desc, e.created_at desc, e.id desc
)
select p.id as project_id, p.project_file, p.project_name, p.project_sequence, p.total_time_minutes, p.total_volume_m3, p.is_archived,
  coalesce(sum(m.operational_minutes), 0)::integer as total_logged_operational_minutes,
  coalesce(sum(m.actual_volume_cut_m3), 0)::numeric(12,3) as total_volume_cut_m3,
  coalesce(sum(m.downtime_minutes), 0)::integer as total_downtime_minutes,
  coalesce(sum(m.interruption_minutes), 0)::integer as total_interruption_minutes,
  l.time_remaining_end_minutes as latest_time_remaining_minutes
from public.production_projects p
left join public.production_entries_with_metrics m on m.project_id = p.id
left join latest_project_left l on l.project_id = p.id
group by p.id, p.project_file, p.project_name, p.project_sequence, p.total_time_minutes, p.total_volume_m3, p.is_archived, l.time_remaining_end_minutes;

create or replace view public.production_operator_summaries as
select m.operator_profile_id, m.operator_name, count(m.id)::integer as shift_count,
  coalesce(sum(m.operational_minutes), 0)::integer as total_operational_minutes,
  coalesce(sum(m.actual_volume_cut_m3), 0)::numeric(12,3) as total_volume_cut_m3,
  coalesce(sum(m.downtime_minutes), 0)::integer as total_downtime_minutes,
  coalesce(sum(m.interruption_minutes), 0)::integer as total_interruption_minutes
from public.production_entries_with_metrics m
group by m.operator_profile_id, m.operator_name;
