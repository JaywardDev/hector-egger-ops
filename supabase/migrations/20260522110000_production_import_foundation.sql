create table if not exists public.production_import_batches (
  id uuid primary key default gen_random_uuid(),
  source_system text not null,
  file_name text not null,
  mode text not null check (mode in ('dry_run','apply')),
  status text not null check (status in ('prepared','applied','failed')),
  row_count integer not null default 0 check (row_count >= 0),
  inserted_count integer not null default 0 check (inserted_count >= 0),
  updated_count integer not null default 0 check (updated_count >= 0),
  skipped_count integer not null default 0 check (skipped_count >= 0),
  error_count integer not null default 0 check (error_count >= 0),
  imported_by_profile_id uuid references public.profiles(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  completed_at timestamptz
);

alter table public.production_entries
  add column if not exists import_batch_id uuid references public.production_import_batches(id) on delete set null,
  add column if not exists source_system text,
  add column if not exists source_row_hash text,
  add column if not exists source_row_number integer,
  add column if not exists source_file_name text,
  add column if not exists imported_at timestamptz,
  add column if not exists imported_by_profile_id uuid references public.profiles(id) on delete set null;

create index if not exists production_entries_import_batch_idx on public.production_entries(import_batch_id);
create index if not exists production_entries_source_lookup_idx on public.production_entries(source_system, source_row_hash);
create unique index if not exists production_entries_source_hash_unique_imported
  on public.production_entries(source_system, source_row_hash)
  where source_system is not null and source_row_hash is not null;

create or replace function public.apply_production_import(
  p_import_batch_id uuid,
  p_actor_profile_id uuid,
  p_source_system text,
  p_file_name text,
  p_rows jsonb,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := timezone('utc', now());
  v_row jsonb;
  v_project_id uuid;
  v_inserted int := 0;
  v_updated int := 0;
  v_skipped int := 0;
begin
  if jsonb_typeof(p_rows) <> 'array' then
    raise exception 'Rows payload must be an array';
  end if;

  insert into public.production_import_batches (id, source_system, file_name, mode, status, row_count, imported_by_profile_id, metadata)
  values (p_import_batch_id, p_source_system, p_file_name, 'apply', 'prepared', jsonb_array_length(p_rows), p_actor_profile_id, coalesce(p_metadata, '{}'::jsonb))
  on conflict (id) do update set source_system=excluded.source_system, file_name=excluded.file_name, metadata=excluded.metadata;

  for v_row in select * from jsonb_array_elements(p_rows)
  loop
    insert into public.production_projects (project_file, project_name, project_sequence, total_operational_minutes, estimated_total_volume_m3, notes)
    values (
      v_row->>'project_file',
      v_row->>'project_name',
      (v_row->>'project_sequence')::integer,
      nullif(v_row->>'total_operational_minutes','')::integer,
      nullif(v_row->>'estimated_total_volume_m3','')::numeric,
      null
    )
    on conflict (project_file, project_sequence)
    do update set project_name = excluded.project_name, total_operational_minutes = excluded.total_operational_minutes, estimated_total_volume_m3 = excluded.estimated_total_volume_m3
    returning id into v_project_id;

    insert into public.production_entries (
      work_date, operator_profile_id, shift_start_time, shift_end_time, project_id,
      file_minutes_left_start, file_minutes_left_end, actual_volume_cut_m3,
      downtime_minutes, downtime_reason_id, interruption_minutes, interruption_reason_id,
      notes, created_by_profile_id, import_batch_id, source_system, source_row_hash,
      source_row_number, source_file_name, imported_at, imported_by_profile_id
    ) values (
      (v_row->>'work_date')::date, (v_row->>'operator_profile_id')::uuid, (v_row->>'shift_start_time')::time, (v_row->>'shift_end_time')::time,
      v_project_id, (v_row->>'file_minutes_left_start')::integer, (v_row->>'file_minutes_left_end')::integer,
      coalesce(nullif(v_row->>'actual_volume_cut_m3','')::numeric, 0), coalesce((v_row->>'downtime_minutes')::integer, 0),
      nullif(v_row->>'downtime_reason_id','')::uuid, coalesce((v_row->>'interruption_minutes')::integer, 0), nullif(v_row->>'interruption_reason_id','')::uuid,
      nullif(v_row->>'notes',''), p_actor_profile_id, p_import_batch_id, p_source_system, v_row->>'source_row_hash',
      (v_row->>'source_row_number')::integer, p_file_name, v_now, p_actor_profile_id
    ) on conflict (source_system, source_row_hash)
    do update set
      work_date = excluded.work_date,
      operator_profile_id = excluded.operator_profile_id,
      shift_start_time = excluded.shift_start_time,
      shift_end_time = excluded.shift_end_time,
      project_id = excluded.project_id,
      file_minutes_left_start = excluded.file_minutes_left_start,
      file_minutes_left_end = excluded.file_minutes_left_end,
      actual_volume_cut_m3 = excluded.actual_volume_cut_m3,
      downtime_minutes = excluded.downtime_minutes,
      downtime_reason_id = excluded.downtime_reason_id,
      interruption_minutes = excluded.interruption_minutes,
      interruption_reason_id = excluded.interruption_reason_id,
      notes = excluded.notes,
      import_batch_id = excluded.import_batch_id,
      source_file_name = excluded.source_file_name,
      imported_at = excluded.imported_at,
      imported_by_profile_id = excluded.imported_by_profile_id,
      updated_at = v_now;
    v_inserted := v_inserted + 1;
  end loop;

  update public.production_import_batches
  set status='applied', inserted_count=v_inserted, updated_count=v_updated, skipped_count=v_skipped, error_count=0, completed_at=v_now
  where id = p_import_batch_id;

  return jsonb_build_object('insertedCount', v_inserted, 'updatedCount', v_updated, 'skippedCount', v_skipped, 'errorCount', 0);
exception when others then
  update public.production_import_batches
  set status='failed', error_count=row_count, completed_at=v_now
  where id = p_import_batch_id;
  raise;
end;
$$;

grant execute on function public.apply_production_import(uuid, uuid, text, text, jsonb, jsonb) to service_role;
