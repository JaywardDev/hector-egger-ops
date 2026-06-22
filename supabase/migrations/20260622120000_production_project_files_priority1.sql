-- Priority 1: make project files the source of truth for production planned totals.

drop view if exists public.production_operator_summaries;
drop view if exists public.production_project_summaries;
drop view if exists public.production_entries_with_metrics;

create table if not exists public.production_project_files (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.production_projects (id) on delete restrict,
  project_file text not null,
  project_sequence integer,
  total_time_minutes integer,
  total_volume_m3 numeric(12,3),
  is_archived boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint production_project_files_project_file_nonempty check (length(btrim(project_file)) > 0),
  constraint production_project_files_project_sequence_check check (project_sequence is null or project_sequence >= 0),
  constraint production_project_files_total_time_minutes_check check (total_time_minutes is null or total_time_minutes >= 0),
  constraint production_project_files_total_volume_m3_check check (total_volume_m3 is null or total_volume_m3 >= 0),
  constraint production_project_files_project_file_sequence_unique unique (project_id, project_file, project_sequence)
);

create index if not exists production_project_files_project_idx on public.production_project_files (project_id);
create index if not exists production_project_files_archived_idx on public.production_project_files (is_archived);
create index if not exists production_project_files_file_sequence_idx on public.production_project_files (project_file, project_sequence);

drop trigger if exists production_project_files_set_updated_at on public.production_project_files;
create trigger production_project_files_set_updated_at
before update on public.production_project_files
for each row execute function public.set_updated_at();

alter table public.production_project_files enable row level security;

drop policy if exists "production_project_files_select_approved" on public.production_project_files;
drop policy if exists "production_project_files_insert_operational" on public.production_project_files;
drop policy if exists "production_project_files_update_operational" on public.production_project_files;
drop policy if exists "production_project_files_delete_operational" on public.production_project_files;
create policy "production_project_files_select_approved" on public.production_project_files for select to authenticated using (public.is_current_user_approved());
create policy "production_project_files_insert_operational" on public.production_project_files for insert to authenticated with check (public.is_current_user_approved());
create policy "production_project_files_update_operational" on public.production_project_files for update to authenticated using (public.is_current_user_approved()) with check (public.is_current_user_approved());
create policy "production_project_files_delete_operational" on public.production_project_files for delete to authenticated using (public.is_current_user_approved());

insert into public.production_project_files (project_id, project_file, project_sequence, total_time_minutes, total_volume_m3, is_archived, created_at, updated_at)
select p.id, p.project_file, p.project_sequence, p.total_time_minutes, p.total_volume_m3, p.is_archived, p.created_at, p.updated_at
from public.production_projects p
where not exists (
  select 1 from public.production_project_files pf where pf.project_id = p.id and pf.project_file = p.project_file and pf.project_sequence is not distinct from p.project_sequence
);

alter table public.production_entries add column if not exists project_file_id uuid references public.production_project_files (id) on delete restrict;

update public.production_entries e
set project_file_id = pf.id
from public.production_project_files pf
where e.project_file_id is null
  and pf.project_id = e.project_id
  and pf.id = (
    select pf2.id from public.production_project_files pf2
    where pf2.project_id = e.project_id
    order by pf2.created_at asc, pf2.id asc
    limit 1
  );

create index if not exists production_entries_project_file_entry_date_idx on public.production_entries (project_file_id, entry_date);

alter table public.production_entries alter column project_file_id set not null;

create or replace view public.production_entries_with_metrics as
select
  e.id,
  e.entry_date,
  e.operator_profile_id,
  coalesce(op.full_name, op.email) as operator_name,
  e.start_time,
  e.finish_time,
  e.project_id,
  e.project_file_id,
  pf.project_file,
  p.project_name,
  pf.project_sequence,
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
join public.production_project_files pf on pf.id = e.project_file_id
join public.production_projects p on p.id = pf.project_id
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

create or replace view public.production_project_file_summaries as
with latest_file_left as (
  select distinct on (e.project_file_id) e.project_file_id, e.time_remaining_end_minutes, e.entry_date, e.created_at, e.id
  from public.production_entries e
  order by e.project_file_id, e.entry_date desc, e.created_at desc, e.id desc
)
select pf.id as project_file_id, p.id as project_id, pf.project_file, p.project_name, pf.project_sequence, pf.total_time_minutes, pf.total_volume_m3, pf.is_archived,
  coalesce(sum(m.operational_minutes), 0)::integer as total_logged_operational_minutes,
  coalesce(sum(m.actual_volume_cut_m3), 0)::numeric(12,3) as total_volume_cut_m3,
  coalesce(sum(m.downtime_minutes), 0)::integer as total_downtime_minutes,
  coalesce(sum(m.interruption_minutes), 0)::integer as total_interruption_minutes,
  l.time_remaining_end_minutes as latest_time_remaining_minutes
from public.production_project_files pf
join public.production_projects p on p.id = pf.project_id
left join public.production_entries_with_metrics m on m.project_file_id = pf.id
left join latest_file_left l on l.project_file_id = pf.id
group by pf.id, p.id, pf.project_file, p.project_name, pf.project_sequence, pf.total_time_minutes, pf.total_volume_m3, pf.is_archived, l.time_remaining_end_minutes;

create or replace view public.production_project_summaries as
select p.id as project_id,
  min(pf.project_file) as project_file,
  p.project_name,
  min(pf.project_sequence) as project_sequence,
  sum(pf.total_time_minutes)::integer as total_time_minutes,
  sum(pf.total_volume_m3)::numeric(12,3) as total_volume_m3,
  p.is_archived,
  coalesce(sum(fs.total_logged_operational_minutes), 0)::integer as total_logged_operational_minutes,
  coalesce(sum(fs.total_volume_cut_m3), 0)::numeric(12,3) as total_volume_cut_m3,
  coalesce(sum(fs.total_downtime_minutes), 0)::integer as total_downtime_minutes,
  coalesce(sum(fs.total_interruption_minutes), 0)::integer as total_interruption_minutes,
  (array_agg(fs.latest_time_remaining_minutes order by fs.latest_time_remaining_minutes nulls last))[1] as latest_time_remaining_minutes,
  count(pf.id)::integer as project_file_count
from public.production_projects p
left join public.production_project_files pf on pf.project_id = p.id
left join public.production_project_file_summaries fs on fs.project_file_id = pf.id
group by p.id, p.project_name, p.is_archived;

create or replace view public.production_operator_summaries as
select m.operator_profile_id, m.operator_name, count(m.id)::integer as shift_count,
  coalesce(sum(m.operational_minutes), 0)::integer as total_operational_minutes,
  coalesce(sum(m.actual_volume_cut_m3), 0)::numeric(12,3) as total_volume_cut_m3,
  coalesce(sum(m.downtime_minutes), 0)::integer as total_downtime_minutes,
  coalesce(sum(m.interruption_minutes), 0)::integer as total_interruption_minutes
from public.production_entries_with_metrics m
group by m.operator_profile_id, m.operator_name;

create or replace function public.create_production_entry_with_reasons(
  p_entry_date date,
  p_operator_profile_id uuid,
  p_start_time time,
  p_finish_time time,
  p_project_file_id uuid,
  p_time_remaining_start_minutes integer,
  p_time_remaining_end_minutes integer,
  p_actual_volume_cut_m3 numeric,
  p_run_through_break boolean,
  p_created_by_profile_id uuid,
  p_downtime_reasons jsonb default '[]'::jsonb,
  p_interruption_reasons jsonb default '[]'::jsonb
) returns public.production_entries
language plpgsql
security definer
set search_path = public
as $$
declare
  created_entry public.production_entries;
  resolved_project_id uuid;
begin
  select project_id into resolved_project_id from public.production_project_files where id = p_project_file_id;
  if p_entry_date is null or p_operator_profile_id is null or p_start_time is null or p_finish_time is null or p_project_file_id is null or p_created_by_profile_id is null then
    raise exception 'Date, operator, start time, finish time, project file, and creator are required';
  end if;
  if resolved_project_id is null then raise exception 'Production project file not found'; end if;
  if p_finish_time <= p_start_time then raise exception 'Finish Time must be after Start Time'; end if;
  if p_time_remaining_start_minutes is null or p_time_remaining_start_minutes < 0 or p_time_remaining_end_minutes is null or p_time_remaining_end_minutes < 0 or p_actual_volume_cut_m3 is null or p_actual_volume_cut_m3 < 0 then
    raise exception 'Production entry numeric fields must be non-negative';
  end if;
  perform public.validate_production_entry_reason_rows(p_downtime_reasons, 'public.production_downtime_reasons'::regclass, 'Downtime');
  perform public.validate_production_entry_reason_rows(p_interruption_reasons, 'public.production_interruption_reasons'::regclass, 'Interruption');
  insert into public.production_entries (entry_date, operator_profile_id, start_time, finish_time, project_id, project_file_id, time_remaining_start_minutes, time_remaining_end_minutes, actual_volume_cut_m3, run_through_break, created_by_profile_id)
  values (p_entry_date, p_operator_profile_id, p_start_time, p_finish_time, resolved_project_id, p_project_file_id, p_time_remaining_start_minutes, p_time_remaining_end_minutes, p_actual_volume_cut_m3, coalesce(p_run_through_break, false), p_created_by_profile_id)
  returning * into created_entry;
  perform public.insert_production_entry_reason_rows(created_entry.id, p_downtime_reasons, p_interruption_reasons);
  return created_entry;
end;
$$;

create or replace function public.update_production_entry_with_reasons(
  p_entry_id uuid,
  p_entry_date date,
  p_operator_profile_id uuid,
  p_start_time time,
  p_finish_time time,
  p_project_file_id uuid,
  p_time_remaining_start_minutes integer,
  p_time_remaining_end_minutes integer,
  p_actual_volume_cut_m3 numeric,
  p_run_through_break boolean,
  p_downtime_reasons jsonb default '[]'::jsonb,
  p_interruption_reasons jsonb default '[]'::jsonb
) returns public.production_entries
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_entry public.production_entries;
  resolved_project_id uuid;
begin
  select project_id into resolved_project_id from public.production_project_files where id = p_project_file_id;
  if p_entry_id is null then raise exception 'Production entry id is required'; end if;
  if not exists (select 1 from public.production_entries where id = p_entry_id) then raise exception 'Production entry not found'; end if;
  if p_entry_date is null or p_operator_profile_id is null or p_start_time is null or p_finish_time is null or p_project_file_id is null then
    raise exception 'Date, operator, start time, finish time, and project file are required';
  end if;
  if resolved_project_id is null then raise exception 'Production project file not found'; end if;
  if p_finish_time <= p_start_time then raise exception 'Finish Time must be after Start Time'; end if;
  if p_time_remaining_start_minutes is null or p_time_remaining_start_minutes < 0 or p_time_remaining_end_minutes is null or p_time_remaining_end_minutes < 0 or p_actual_volume_cut_m3 is null or p_actual_volume_cut_m3 < 0 then
    raise exception 'Production entry numeric fields must be non-negative';
  end if;
  perform public.validate_production_entry_reason_rows(p_downtime_reasons, 'public.production_downtime_reasons'::regclass, 'Downtime');
  perform public.validate_production_entry_reason_rows(p_interruption_reasons, 'public.production_interruption_reasons'::regclass, 'Interruption');
  update public.production_entries
  set entry_date = p_entry_date, operator_profile_id = p_operator_profile_id, start_time = p_start_time, finish_time = p_finish_time,
      project_id = resolved_project_id, project_file_id = p_project_file_id, time_remaining_start_minutes = p_time_remaining_start_minutes,
      time_remaining_end_minutes = p_time_remaining_end_minutes, actual_volume_cut_m3 = p_actual_volume_cut_m3,
      run_through_break = coalesce(p_run_through_break, false), updated_at = timezone('utc', now())
  where id = p_entry_id
  returning * into updated_entry;
  delete from public.production_entry_downtime_reasons where entry_id = p_entry_id;
  delete from public.production_entry_interruption_reasons where entry_id = p_entry_id;
  perform public.insert_production_entry_reason_rows(p_entry_id, p_downtime_reasons, p_interruption_reasons);
  return updated_entry;
end;
$$;

grant select, insert, update, delete on public.production_project_files to authenticated;
grant execute on function public.create_production_entry_with_reasons(date, uuid, time, time, uuid, integer, integer, numeric, boolean, uuid, jsonb, jsonb) to service_role;
grant execute on function public.update_production_entry_with_reasons(uuid, date, uuid, time, time, uuid, integer, integer, numeric, boolean, jsonb, jsonb) to service_role;
