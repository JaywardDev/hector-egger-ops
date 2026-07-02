-- Phase: "start a checklist from a template". Atomically instantiate a
-- qa_checklist from a qa_template_version: snapshot the version's fields_json
-- onto the checklist (frozen), then materialize a qa_check_item per select/note
-- item and a qa_signoff per signoff item. Mirrors the production atomic
-- create-with-children RPCs; service_role-only, app-layer gates capture access.

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
        insert into public.qa_signoff (checklist_id, source_item_id, label, kind, status)
        values (v_checklist_id, v_item ->> 'id', coalesce(nullif(btrim(v_item ->> 'label'), ''), 'Sign off'), 'signoff', 'pending');
      elsif v_type in ('select', 'note') then
        insert into public.qa_check_item (checklist_id, source_item_id, item_type, label, options, sort_order)
        values (
          v_checklist_id, v_item ->> 'id', v_type, coalesce(v_item ->> 'label', ''),
          case when v_item ? 'options' then v_item -> 'options' else null end, v_sort
        );
      end if;
      v_sort := v_sort + 1;
    end loop;
  end loop;

  return v_checklist_id;
end;
$$;

grant execute on function public.create_qa_checklist_from_version(uuid, uuid, uuid, text, uuid) to service_role;
