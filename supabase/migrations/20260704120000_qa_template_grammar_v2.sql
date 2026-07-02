-- QA template grammar v2 — support the full C-base checklist grammar the site
-- assembly / work-package templates use (not just the factory-assembly subset).
--
-- New row types the parser now emits into fields_json:
--   * text / date    — free-input items the operator fills in (answerable).
--   * heading         — a subsection heading inside a section (display only,
--                       lives in fields_snapshot, never materialized as a row).
--   * signoff.required + signoff.gate — mandatory hold points that carry the
--                       checkpoint label that gates them.
--
-- This migration:
--   1. widens qa_check_item.item_type to accept 'text' and 'date';
--   2. materializes text/date items and maps required/gated sign-offs when a
--      checklist is started;
--   3. lets answer_qa_check_item accept free text/date values;
--   4. adds a 'replace' mode + 'replaced' action to the import RPC so an admin
--      can heal a version whose parse output legitimately changed (started
--      checklists are unaffected — they run off their frozen snapshot).

-- 1. Widen the check-item type domain (heading stays display-only, so it is not
--    listed here — only answerable/materialized types are).
alter table public.qa_check_item
  drop constraint if exists qa_check_item_item_type_check;
alter table public.qa_check_item
  add constraint qa_check_item_item_type_check
  check (item_type in ('select', 'note', 'signoff', 'text', 'date'));

-- 2. Start-a-checklist: materialize select/note/text/date as check items and map
--    every sign-off (plain or required) to a qa_signoff row. A required sign-off
--    becomes kind='hold'; the gate label (the checkpoint that certifies it) is
--    preferred as the sign-off's display label so multi-hold-point sections read
--    clearly ("Final Installer Signoff" vs "Structural Engineer Inspection").
create or replace function public.create_qa_checklist_from_version(
  p_project_id uuid,
  p_section_id uuid,
  p_template_version_id uuid,
  p_code text,
  p_created_by_profile_id uuid
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_fields jsonb;
  v_name text;
  v_checklist_id uuid;
  v_step jsonb;
  v_item jsonb;
  v_type text;
  v_sort integer := 0;
  v_signoff_label text;
  v_signoff_kind text;
begin
  if p_project_id is null then
    raise exception 'project is required';
  end if;
  if not exists (select 1 from public.qa_project where id = p_project_id) then
    raise exception 'project not found';
  end if;
  if p_section_id is not null
     and not exists (select 1 from public.qa_section where id = p_section_id and project_id = p_project_id) then
    raise exception 'section does not belong to project';
  end if;

  select fields_json, name into v_fields, v_name
  from public.qa_template_version where id = p_template_version_id;
  if v_fields is null then
    raise exception 'template version not found';
  end if;

  insert into public.qa_checklist (
    project_id, section_id, template_version_id, fields_snapshot, code, title, status, created_by_profile_id
  ) values (
    p_project_id, p_section_id, p_template_version_id, v_fields,
    coalesce(nullif(btrim(p_code), ''), v_name), v_name, 'not_started', p_created_by_profile_id
  )
  returning id into v_checklist_id;

  for v_step in select * from jsonb_array_elements(coalesce(v_fields -> 'steps', '[]'::jsonb)) loop
    for v_item in select * from jsonb_array_elements(coalesce(v_step -> 'items', '[]'::jsonb)) loop
      v_type := v_item ->> 'type';
      if v_type = 'signoff' then
        v_signoff_label := coalesce(
          nullif(btrim(v_item ->> 'gate'), ''),
          nullif(btrim(v_item ->> 'label'), ''),
          'Sign off'
        );
        v_signoff_kind := case when coalesce((v_item ->> 'required')::boolean, false) then 'hold' else 'signoff' end;
        insert into public.qa_signoff (checklist_id, source_item_id, label, kind, status)
        values (v_checklist_id, v_item ->> 'id', v_signoff_label, v_signoff_kind, 'pending');
      elsif v_type in ('select', 'note', 'text', 'date') then
        insert into public.qa_check_item (checklist_id, source_item_id, item_type, label, options, sort_order)
        values (
          v_checklist_id, v_item ->> 'id', v_type, coalesce(v_item ->> 'label', ''),
          case when v_item ? 'options' then v_item -> 'options' else null end, v_sort
        );
      end if;
      -- 'heading' items are display-only; they render from fields_snapshot and
      -- are intentionally not materialized as rows.
      v_sort := v_sort + 1;
    end loop;
  end loop;

  return v_checklist_id;
end;
$$;

grant execute on function public.create_qa_checklist_from_version(uuid, uuid, uuid, text, uuid) to service_role;

-- 3. Answering: select items validate against their options; text/date items are
--    free input, so any value (or clearing it) is accepted.
create or replace function public.answer_qa_check_item(
  p_check_item_id uuid,
  p_value text,
  p_actor_profile_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item public.qa_check_item;
  v_checklist_status text;
  v_options jsonb;
  v_clean text := nullif(btrim(coalesce(p_value, '')), '');
begin
  select * into v_item from public.qa_check_item where id = p_check_item_id;
  if v_item.id is null then
    raise exception 'check item not found';
  end if;
  if v_item.item_type not in ('select', 'text', 'date') then
    raise exception 'this item cannot be answered';
  end if;

  select status into v_checklist_status from public.qa_checklist where id = v_item.checklist_id;
  if v_checklist_status = 'signed_off' then
    raise exception 'checklist is signed off and can no longer be edited';
  end if;

  if v_item.item_type = 'select' then
    v_options := coalesce(v_item.options, '[]'::jsonb);
    if v_clean is not null and not (v_options ? v_clean) then
      raise exception 'value is not one of the allowed options';
    end if;
  end if;

  update public.qa_check_item
  set selected_value = v_clean,
      answered_by_profile_id = case when v_clean is null then null else p_actor_profile_id end,
      answered_at = case when v_clean is null then null else timezone('utc', now()) end,
      updated_at = timezone('utc', now())
  where id = p_check_item_id;

  if v_checklist_status = 'not_started' then
    update public.qa_checklist
    set status = 'in_progress', updated_at = timezone('utc', now())
    where id = v_item.checklist_id and status = 'not_started';
    v_checklist_status := 'in_progress';
  end if;

  return jsonb_build_object('checklist_status', v_checklist_status);
end;
$$;

grant execute on function public.answer_qa_check_item(uuid, text, uuid) to service_role;

-- 4. Import replace mode. The default 'skip' keeps the append-only behaviour
--    (a changed template at the same version is refused as 'version_conflict').
--    'replace' overwrites that version's definition in place and logs 'replaced'
--    — used to heal versions whose parse output changed after a parser upgrade,
--    without inventing a fake version bump. Safe because in-progress and
--    signed-off checklists carry their own fields_snapshot.
alter table public.qa_template_import_history
  drop constraint if exists qa_template_import_history_action_check;
alter table public.qa_template_import_history
  add constraint qa_template_import_history_action_check
  check (action in ('inserted', 'unchanged', 'version_conflict', 'replaced'));

drop function if exists public.apply_qa_template_import(uuid, text, text, text, integer, jsonb, jsonb, text);

create or replace function public.apply_qa_template_import(
  p_actor_profile_id uuid,
  p_filename text,
  p_source_id text,
  p_name text,
  p_version integer,
  p_fields_json jsonb,
  p_raw_rows jsonb,
  p_source_row_hash text,
  p_mode text default 'skip'
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
  if coalesce(p_mode, 'skip') not in ('skip', 'replace') then
    raise exception 'mode must be skip or replace';
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
      v_version_id := v_existing_version_id;
    elsif coalesce(p_mode, 'skip') = 'replace' then
      update public.qa_template_version
      set name = p_name,
          fields_json = p_fields_json,
          raw_rows = p_raw_rows,
          source_row_hash = p_source_row_hash,
          imported_by_profile_id = p_actor_profile_id,
          imported_at = v_now
      where id = v_existing_version_id;
      v_action := 'replaced';
      v_version_id := v_existing_version_id;
    else
      v_action := 'version_conflict';
      v_version_id := v_existing_version_id;
    end if;
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

grant execute on function public.apply_qa_template_import(uuid, text, text, text, integer, jsonb, jsonb, text, text) to service_role;

-- Reload PostgREST's schema cache so the changed RPC signature is picked up.
notify pgrst, 'reload schema';
