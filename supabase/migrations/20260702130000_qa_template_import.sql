-- QA module — Phase 1a apply layer: import parsed checklist templates into
-- qa_template / qa_template_version (append-only, change-detected by hash),
-- with an import history ledger. Cloned from the timesheet C-base import
-- (apply_c_base_timesheet_lookup_import): the RPC is granted to service_role
-- only and trusts the caller — the app layer gates admin access before calling,
-- exactly as the timesheet import does.

create table if not exists public.qa_template_import_history (
  id uuid primary key default gen_random_uuid(),
  actor_profile_id uuid references public.profiles (id) on delete set null,
  filename text not null,
  source_id text not null,
  version integer,
  action text not null check (action in ('inserted', 'unchanged', 'version_conflict')),
  source_row_hash text,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists qa_template_import_history_source_idx
  on public.qa_template_import_history (source_id, created_at desc);
create index if not exists qa_template_import_history_created_idx
  on public.qa_template_import_history (created_at desc);

alter table public.qa_template_import_history enable row level security;

-- Read for approved users; rows are written only by the security-definer RPC.
create policy "qa_template_import_history_select" on public.qa_template_import_history
  for select to authenticated using (public.qa_can_read());

grant select on public.qa_template_import_history to authenticated;

-- Apply one parsed checklist template. Idempotent by (source_id, version,
-- source_row_hash):
--   * new version number            -> insert a new version row  ('inserted')
--   * same version, same hash        -> no-op                     ('unchanged')
--   * same version, different hash   -> refuse (append-only)      ('version_conflict')
-- The last case means CONQA edited a template without bumping its version; we
-- keep the last-known-good row and surface it rather than overwrite history.
create or replace function public.apply_qa_template_import(
  p_actor_profile_id uuid,
  p_filename text,
  p_source_id text,
  p_name text,
  p_version integer,
  p_fields_json jsonb,
  p_raw_rows jsonb,
  p_source_row_hash text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := timezone('utc', now());
  v_template_id uuid;
  v_existing_version_id uuid;
  v_existing_hash text;
  v_action text;
  v_version_id uuid;
begin
  if p_source_id is null or length(btrim(p_source_id)) = 0 then
    raise exception 'source_id is required';
  end if;
  if p_version is null or p_version < 1 then
    raise exception 'version must be >= 1';
  end if;
  if p_source_row_hash is null or length(btrim(p_source_row_hash)) = 0 then
    raise exception 'source_row_hash is required';
  end if;

  insert into public.qa_template (source_id, name)
  values (p_source_id, p_name)
  on conflict (source_id) do update set name = excluded.name, updated_at = v_now
  returning id into v_template_id;

  select id, source_row_hash
  into v_existing_version_id, v_existing_hash
  from public.qa_template_version
  where template_id = v_template_id and version = p_version
  limit 1;

  if v_existing_version_id is not null then
    if v_existing_hash = p_source_row_hash then
      v_action := 'unchanged';
    else
      v_action := 'version_conflict';
    end if;
    v_version_id := v_existing_version_id;
  else
    insert into public.qa_template_version (
      template_id, source_id, version, name, fields_json, raw_rows, source_row_hash, imported_by_profile_id, imported_at
    ) values (
      v_template_id, p_source_id, p_version, p_name, p_fields_json, p_raw_rows, p_source_row_hash, p_actor_profile_id, v_now
    )
    returning id into v_version_id;
    v_action := 'inserted';
  end if;

  insert into public.qa_template_import_history (actor_profile_id, filename, source_id, version, action, source_row_hash)
  values (p_actor_profile_id, p_filename, p_source_id, p_version, v_action, p_source_row_hash);

  return jsonb_build_object('action', v_action, 'template_id', v_template_id, 'version_id', v_version_id);
end;
$$;

grant execute on function public.apply_qa_template_import(uuid, text, text, text, integer, jsonb, jsonb, text) to service_role;
