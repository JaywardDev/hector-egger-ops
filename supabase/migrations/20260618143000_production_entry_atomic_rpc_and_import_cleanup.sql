-- Atomic Manual V1 production entry writes and legacy import RPC cleanup.

create or replace function public.validate_production_entry_reason_rows(
  p_rows jsonb,
  p_reason_table regclass,
  p_label text
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  row_data jsonb;
  reason_uuid uuid;
  duration_value integer;
begin
  if p_rows is null then
    raise exception '% reason rows are required', p_label;
  end if;
  if jsonb_typeof(p_rows) <> 'array' then
    raise exception '% reason rows must be an array', p_label;
  end if;

  for row_data in select value from jsonb_array_elements(p_rows)
  loop
    begin
      reason_uuid := (row_data->>'reason_id')::uuid;
      duration_value := (row_data->>'duration_minutes')::integer;
    exception when others then
      raise exception '% reason rows require a valid reason and positive duration', p_label;
    end;

    if reason_uuid is null or duration_value is null or duration_value <= 0 then
      raise exception '% reason rows require a valid reason and positive duration', p_label;
    end if;

    if p_reason_table = 'public.production_downtime_reasons'::regclass then
      if not exists (select 1 from public.production_downtime_reasons where id = reason_uuid) then
        raise exception 'Invalid downtime reason';
      end if;
    elsif p_reason_table = 'public.production_interruption_reasons'::regclass then
      if not exists (select 1 from public.production_interruption_reasons where id = reason_uuid) then
        raise exception 'Invalid interruption reason';
      end if;
    else
      raise exception 'Unsupported production reason table';
    end if;
  end loop;
end;
$$;

create or replace function public.insert_production_entry_reason_rows(
  p_entry_id uuid,
  p_downtime_rows jsonb,
  p_interruption_rows jsonb
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.production_entry_downtime_reasons (entry_id, reason_id, duration_minutes, sort_order)
  select p_entry_id, (row_data.value->>'reason_id')::uuid, (row_data.value->>'duration_minutes')::integer, coalesce((row_data.value->>'sort_order')::integer, row_data.ordinality::integer - 1)
  from jsonb_array_elements(p_downtime_rows) with ordinality as row_data(value, ordinality);

  insert into public.production_entry_interruption_reasons (entry_id, reason_id, duration_minutes, sort_order)
  select p_entry_id, (row_data.value->>'reason_id')::uuid, (row_data.value->>'duration_minutes')::integer, coalesce((row_data.value->>'sort_order')::integer, row_data.ordinality::integer - 1)
  from jsonb_array_elements(p_interruption_rows) with ordinality as row_data(value, ordinality);
end;
$$;

create or replace function public.create_production_entry_with_reasons(
  p_entry_date date,
  p_operator_profile_id uuid,
  p_start_time time,
  p_finish_time time,
  p_project_id uuid,
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
begin
  if p_entry_date is null or p_operator_profile_id is null or p_start_time is null or p_finish_time is null or p_project_id is null or p_created_by_profile_id is null then
    raise exception 'Date, operator, start time, finish time, project, and creator are required';
  end if;
  if p_finish_time <= p_start_time then
    raise exception 'Finish Time must be after Start Time';
  end if;
  if p_time_remaining_start_minutes is null or p_time_remaining_start_minutes < 0 or p_time_remaining_end_minutes is null or p_time_remaining_end_minutes < 0 or p_actual_volume_cut_m3 is null or p_actual_volume_cut_m3 < 0 then
    raise exception 'Production entry numeric fields must be non-negative';
  end if;

  perform public.validate_production_entry_reason_rows(p_downtime_reasons, 'public.production_downtime_reasons'::regclass, 'Downtime');
  perform public.validate_production_entry_reason_rows(p_interruption_reasons, 'public.production_interruption_reasons'::regclass, 'Interruption');

  insert into public.production_entries (entry_date, operator_profile_id, start_time, finish_time, project_id, time_remaining_start_minutes, time_remaining_end_minutes, actual_volume_cut_m3, run_through_break, created_by_profile_id)
  values (p_entry_date, p_operator_profile_id, p_start_time, p_finish_time, p_project_id, p_time_remaining_start_minutes, p_time_remaining_end_minutes, p_actual_volume_cut_m3, coalesce(p_run_through_break, false), p_created_by_profile_id)
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
  p_project_id uuid,
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
begin
  if p_entry_id is null then
    raise exception 'Production entry id is required';
  end if;
  if not exists (select 1 from public.production_entries where id = p_entry_id) then
    raise exception 'Production entry not found';
  end if;
  if p_entry_date is null or p_operator_profile_id is null or p_start_time is null or p_finish_time is null or p_project_id is null then
    raise exception 'Date, operator, start time, finish time, and project are required';
  end if;
  if p_finish_time <= p_start_time then
    raise exception 'Finish Time must be after Start Time';
  end if;
  if p_time_remaining_start_minutes is null or p_time_remaining_start_minutes < 0 or p_time_remaining_end_minutes is null or p_time_remaining_end_minutes < 0 or p_actual_volume_cut_m3 is null or p_actual_volume_cut_m3 < 0 then
    raise exception 'Production entry numeric fields must be non-negative';
  end if;

  -- Validate all replacement rows before deleting current rows so a failed replacement leaves current children intact.
  perform public.validate_production_entry_reason_rows(p_downtime_reasons, 'public.production_downtime_reasons'::regclass, 'Downtime');
  perform public.validate_production_entry_reason_rows(p_interruption_reasons, 'public.production_interruption_reasons'::regclass, 'Interruption');

  update public.production_entries
  set entry_date = p_entry_date,
      operator_profile_id = p_operator_profile_id,
      start_time = p_start_time,
      finish_time = p_finish_time,
      project_id = p_project_id,
      time_remaining_start_minutes = p_time_remaining_start_minutes,
      time_remaining_end_minutes = p_time_remaining_end_minutes,
      actual_volume_cut_m3 = p_actual_volume_cut_m3,
      run_through_break = coalesce(p_run_through_break, false),
      updated_at = timezone('utc', now())
  where id = p_entry_id
  returning * into updated_entry;

  delete from public.production_entry_downtime_reasons where entry_id = p_entry_id;
  delete from public.production_entry_interruption_reasons where entry_id = p_entry_id;
  perform public.insert_production_entry_reason_rows(p_entry_id, p_downtime_reasons, p_interruption_reasons);
  return updated_entry;
end;
$$;

grant execute on function public.create_production_entry_with_reasons(date, uuid, time, time, uuid, integer, integer, numeric, boolean, uuid, jsonb, jsonb) to service_role;
grant execute on function public.update_production_entry_with_reasons(uuid, date, uuid, time, time, uuid, integer, integer, numeric, boolean, jsonb, jsonb) to service_role;

-- Legacy import RPCs referenced removed single-reason/manual-import fields after Manual V1.
drop function if exists public.apply_production_import(uuid, uuid, text, text, jsonb, jsonb);
do $$
declare
  legacy_function record;
begin
  for legacy_function in
    select n.nspname, p.proname, p.oid::regprocedure as signature
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('apply_production_import')
  loop
    execute format('drop function if exists %s', legacy_function.signature);
  end loop;
end;
$$;
