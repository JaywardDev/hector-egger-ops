-- QA capture (1b), evidence (1c), and sign-off (1d) foundations.
--
-- * Private storage bucket for evidence photos (same pattern as avatars:
--   bytes live in a private bucket, rows in qa_evidence record the path,
--   uploads/reads go through service-role server routes).
-- * qa_evidence.source_step_id groups photos under the template step they were
--   taken for (steps live in fields_snapshot, not as rows, so the link is the
--   step's stable source id).
-- * answer_qa_check_item: one atomic round-trip per answer — validates the
--   value against the item's options, refuses once signed off, stamps
--   answered_by/at, and moves the checklist not_started -> in_progress.
-- * sign_off_qa_checklist: marks a pending sign-off as signed, appends to the
--   qa_signoff_event ledger, and locks the checklist (signed_off + metadata)
--   once no pending sign-offs remain.
--
-- Both RPCs are service_role-only; the app layer gates capture/sign access,
-- and RLS + CHECK constraints remain the defense-in-depth.

insert into storage.buckets (id, name, public)
values ('qa-evidence', 'qa-evidence', false)
on conflict (id) do nothing;

alter table public.qa_evidence
  add column if not exists source_step_id text;

create index if not exists qa_evidence_step_idx
  on public.qa_evidence (checklist_id, source_step_id);

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
  if v_item.item_type <> 'select' then
    raise exception 'only select items can be answered';
  end if;

  select status into v_checklist_status from public.qa_checklist where id = v_item.checklist_id;
  if v_checklist_status = 'signed_off' then
    raise exception 'checklist is signed off and can no longer be edited';
  end if;

  v_options := coalesce(v_item.options, '[]'::jsonb);
  if v_clean is not null and not (v_options ? v_clean) then
    raise exception 'value is not one of the allowed options';
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

create or replace function public.sign_off_qa_checklist(
  p_signoff_id uuid,
  p_actor_profile_id uuid,
  p_comment text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_signoff public.qa_signoff;
  v_now timestamptz := timezone('utc', now());
  v_pending integer;
  v_checklist_status text;
begin
  select * into v_signoff from public.qa_signoff where id = p_signoff_id;
  if v_signoff.id is null then
    raise exception 'sign-off not found';
  end if;
  if v_signoff.status <> 'pending' then
    raise exception 'sign-off is not pending';
  end if;
  if p_actor_profile_id is null then
    raise exception 'actor is required';
  end if;

  update public.qa_signoff
  set status = 'signed',
      signed_by_profile_id = p_actor_profile_id,
      signed_at = v_now,
      updated_at = v_now
  where id = p_signoff_id;

  insert into public.qa_signoff_event (signoff_id, checklist_id, actor_profile_id, action, comment)
  values (p_signoff_id, v_signoff.checklist_id, p_actor_profile_id, 'signed', nullif(btrim(coalesce(p_comment, '')), ''));

  select count(*) into v_pending
  from public.qa_signoff
  where checklist_id = v_signoff.checklist_id and status = 'pending';

  if v_pending = 0 then
    update public.qa_checklist
    set status = 'signed_off',
        signed_off_at = v_now,
        signed_off_by_profile_id = p_actor_profile_id,
        updated_at = v_now
    where id = v_signoff.checklist_id;
    v_checklist_status := 'signed_off';
  else
    update public.qa_checklist
    set status = 'awaiting_signoff', updated_at = v_now
    where id = v_signoff.checklist_id and status <> 'signed_off';
    v_checklist_status := 'awaiting_signoff';
  end if;

  return jsonb_build_object('checklist_status', v_checklist_status, 'pending_signoffs', v_pending);
end;
$$;

grant execute on function public.sign_off_qa_checklist(uuid, uuid, text) to service_role;
