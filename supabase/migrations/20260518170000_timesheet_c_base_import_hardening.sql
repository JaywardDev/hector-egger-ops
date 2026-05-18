alter table public.timesheet_projects drop constraint if exists timesheet_projects_code_key;
alter table public.timesheet_tasks drop constraint if exists timesheet_tasks_code_key;

alter table public.timesheet_projects add constraint timesheet_projects_source_code_unique unique (source_system, code);
alter table public.timesheet_tasks add constraint timesheet_tasks_source_code_unique unique (source_system, code);

create table if not exists public.timesheet_lookup_import_history (
  id uuid primary key default gen_random_uuid(),
  actor_profile_id uuid not null references public.profiles(id),
  mode text not null check (mode in ('dry_run','apply')),
  source_system text not null default 'c_base' check (source_system in ('c_base')),
  buildings_filename text not null,
  costcodes_filename text not null,
  summary jsonb not null default '{}'::jsonb,
  validation_errors jsonb not null default '[]'::jsonb,
  duplicate_codes jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create or replace function public.apply_c_base_timesheet_lookup_import(
  p_actor_profile_id uuid,
  p_buildings_filename text,
  p_costcodes_filename text,
  p_projects jsonb,
  p_tasks jsonb,
  p_missing_project_codes jsonb,
  p_missing_task_codes jsonb,
  p_summary jsonb,
  p_validation_errors jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := timezone('utc', now());
begin
  if jsonb_typeof(p_projects) <> 'array' or jsonb_typeof(p_tasks) <> 'array' then
    raise exception 'Projects and tasks payloads must be arrays.';
  end if;

  insert into public.timesheet_projects (code, label, is_active, sort_order, visible_to_staff_groups, source_system, source_row_hash, last_seen_at, inactive_reason, inactive_at, updated_at)
  select
    x->>'code',
    x->>'label',
    (x->>'is_active')::boolean,
    (x->>'sort_order')::integer,
    array(select jsonb_array_elements_text(x->'visible_to_staff_groups')),
    'c_base',
    x->>'source_row_hash',
    v_now,
    nullif(x->>'inactive_reason',''),
    case when (x->>'inactive_at') is null or (x->>'inactive_at') = '' then null else (x->>'inactive_at')::timestamptz end,
    v_now
  from jsonb_array_elements(p_projects) x
  on conflict (source_system, code)
  do update set
    label = excluded.label,
    is_active = excluded.is_active,
    sort_order = excluded.sort_order,
    visible_to_staff_groups = excluded.visible_to_staff_groups,
    source_row_hash = excluded.source_row_hash,
    last_seen_at = excluded.last_seen_at,
    inactive_reason = excluded.inactive_reason,
    inactive_at = excluded.inactive_at,
    updated_at = excluded.updated_at;

  insert into public.timesheet_tasks (code, label, is_active, sort_order, visible_to_staff_groups, source_system, source_row_hash, last_seen_at, inactive_reason, inactive_at, updated_at)
  select
    x->>'code', x->>'label', (x->>'is_active')::boolean, (x->>'sort_order')::integer,
    array(select jsonb_array_elements_text(x->'visible_to_staff_groups')),
    'c_base', x->>'source_row_hash', v_now,
    nullif(x->>'inactive_reason',''),
    case when (x->>'inactive_at') is null or (x->>'inactive_at') = '' then null else (x->>'inactive_at')::timestamptz end,
    v_now
  from jsonb_array_elements(p_tasks) x
  on conflict (source_system, code)
  do update set
    label = excluded.label,
    is_active = excluded.is_active,
    sort_order = excluded.sort_order,
    visible_to_staff_groups = excluded.visible_to_staff_groups,
    source_row_hash = excluded.source_row_hash,
    last_seen_at = excluded.last_seen_at,
    inactive_reason = excluded.inactive_reason,
    inactive_at = excluded.inactive_at,
    updated_at = excluded.updated_at;

  update public.timesheet_projects p
  set is_active = false, inactive_reason = 'missing_from_c_base_export', inactive_at = v_now, updated_at = v_now
  where p.source_system = 'c_base'
    and p.is_active = true
    and p.code in (select jsonb_array_elements_text(p_missing_project_codes));

  update public.timesheet_tasks t
  set is_active = false, inactive_reason = 'missing_from_c_base_export', inactive_at = v_now, updated_at = v_now
  where t.source_system = 'c_base'
    and t.is_active = true
    and t.code in (select jsonb_array_elements_text(p_missing_task_codes));

  insert into public.timesheet_lookup_import_history (
    actor_profile_id, mode, buildings_filename, costcodes_filename, summary, validation_errors, duplicate_codes
  ) values (
    p_actor_profile_id,
    'apply',
    p_buildings_filename,
    p_costcodes_filename,
    coalesce(p_summary, '{}'::jsonb),
    coalesce(p_validation_errors, '[]'::jsonb),
    jsonb_build_object(
      'duplicateProjectCodes', coalesce(p_summary->'duplicateProjectCodes', '[]'::jsonb),
      'duplicateCostCodes', coalesce(p_summary->'duplicateCostCodes', '[]'::jsonb)
    )
  );
end;
$$;

grant execute on function public.apply_c_base_timesheet_lookup_import(uuid, text, text, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb) to service_role;
