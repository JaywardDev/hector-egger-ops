alter table public.timesheet_entry_activities
  add column if not exists project_code_snapshot text,
  add column if not exists project_label_snapshot text,
  add column if not exists task_code_snapshot text,
  add column if not exists task_label_snapshot text;

update public.timesheet_entry_activities a
set project_code_snapshot = p.code,
    project_label_snapshot = p.label
from public.timesheet_projects p
where a.project_id = p.id
  and (a.project_code_snapshot is null or a.project_label_snapshot is null);

update public.timesheet_entry_activities a
set task_code_snapshot = t.code,
    task_label_snapshot = t.label
from public.timesheet_tasks t
where a.task_id = t.id
  and (a.task_code_snapshot is null or a.task_label_snapshot is null);

create or replace function public.correct_employee_timesheet_entry_atomic(
  p_actor_profile_id uuid,
  p_target_profile_id uuid,
  p_work_date date,
  p_time_in time,
  p_time_out time,
  p_work_mode text,
  p_leave_type text,
  p_leave_hours numeric,
  p_is_public_holiday boolean,
  p_unpaid_break boolean,
  p_paid_break boolean,
  p_payable_hours numeric,
  p_allocation_hours numeric,
  p_activities jsonb,
  p_comment text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_can_manage boolean;
  v_entry public.timesheet_entries%rowtype;
  v_before_entry jsonb;
  v_before_activities jsonb;
  v_after_entry jsonb;
  v_after_activities jsonb;
  v_activity jsonb;
  v_activity_project_id uuid;
  v_activity_task_id uuid;
  v_activity_work_mode text;
  v_activity_hours numeric;
  v_activity_total numeric := 0;
  v_inserted_count integer := 0;
  v_expected_count integer := 0;
  v_sort_order integer := 0;
  v_calculated_payable numeric;
  v_calculated_allocation numeric;
begin
  if auth.role() <> 'service_role' and not exists (
    select 1
    from public.profiles p
    where p.id = p_actor_profile_id
      and p.auth_user_id = auth.uid()
  ) then
    raise exception 'Actor profile does not match the authenticated user.';
  end if;

  select public.can_approved_actor_manage_timesheet_profile(p_actor_profile_id, p_target_profile_id) into v_actor_can_manage;

  if not v_actor_can_manage then
    raise exception 'Only admins or supervisors assigned to this employee staff group can correct employee timesheets.';
  end if;

  if p_work_date is null then
    raise exception 'A valid work date is required.';
  end if;

  if p_actor_profile_id = p_target_profile_id then
    raise exception 'Supervisors cannot correct their own timesheet through approvals.';
  end if;

  if p_work_mode not in ('factory', 'site', 'office', 'mixed') then
    raise exception 'A valid work mode is required.';
  end if;

  if p_is_public_holiday is null or p_unpaid_break is null or p_paid_break is null then
    raise exception 'Break and public holiday values are required.';
  end if;

  if p_leave_type is not null and p_leave_type not in ('annual', 'sick', 'bereavement', 'unpaid', 'other') then
    raise exception 'A valid leave type is required.';
  end if;

  if p_leave_hours is null or p_payable_hours is null or p_allocation_hours is null
    or p_leave_hours < 0 or p_leave_hours > 24
    or p_payable_hours < 0 or p_payable_hours > 24
    or p_allocation_hours < 0 or p_allocation_hours > 24 then
    raise exception 'Timesheet hours must be between 0 and 24.';
  end if;

  if p_leave_hours > 0 and p_leave_type is null then
    raise exception 'Select a leave type when leave hours are entered.';
  end if;

  if p_activities is null or jsonb_typeof(p_activities) <> 'array' then
    raise exception 'Activities must be a JSON array.';
  end if;

  if p_is_public_holiday then
    if p_time_in is not null or p_time_out is not null
      or p_leave_type is not null or p_leave_hours <> 0
      or p_unpaid_break is not false or p_paid_break is not false
      or p_payable_hours <> 8.0 or p_allocation_hours <> 8.0
      or jsonb_array_length(p_activities) <> 0 then
      raise exception 'Public holiday entries must have the public holiday shape.';
    end if;
  else
    if p_time_in is null or p_time_out is null or p_time_out <= p_time_in then
      raise exception 'Time in and time out must form a valid same-day time span.';
    end if;

    v_calculated_payable := round((extract(epoch from (p_time_out - p_time_in)) / 3600 - case when p_unpaid_break then 0.5 else 0 end)::numeric, 1);
    if v_calculated_payable < 0 or abs(v_calculated_payable - p_payable_hours) > 0.01 then
      raise exception 'Payable hours do not match the supplied time and break values.';
    end if;
  end if;

  select * into v_entry
  from public.timesheet_entries
  where profile_id = p_target_profile_id
    and work_date = p_work_date
  for update;

  if not found then
    raise exception 'No submitted or returned timesheet entry exists for this day.';
  end if;

  if v_entry.profile_id <> p_target_profile_id then
    raise exception 'Timesheet entry is not owned by the target employee.';
  end if;

  if v_entry.status not in ('submitted', 'returned') then
    raise exception 'Only submitted or returned entries can be corrected.';
  end if;

  select to_jsonb(e.*) into v_before_entry
  from public.timesheet_entries e
  where e.id = v_entry.id;

  select coalesce(jsonb_agg(to_jsonb(a.*) order by a.sort_order), '[]'::jsonb) into v_before_activities
  from public.timesheet_entry_activities a
  where a.entry_id = v_entry.id;

  if not p_is_public_holiday then
    for v_activity in select value from jsonb_array_elements(p_activities) loop
      v_expected_count := v_expected_count + 1;
      begin
        v_activity_project_id := (v_activity ->> 'project_id')::uuid;
        v_activity_task_id := (v_activity ->> 'task_id')::uuid;
        v_activity_hours := (v_activity ->> 'hours')::numeric;
      exception when others then
        raise exception 'Invalid activity payload.';
      end;
      v_activity_work_mode := v_activity ->> 'work_mode';

      if v_activity_project_id is null or not exists (
        select 1 from public.timesheet_projects p where p.id = v_activity_project_id and p.is_active = true
      ) then
        raise exception 'Select a valid project for each activity row.';
      end if;

      if v_activity_task_id is null or not exists (
        select 1 from public.timesheet_tasks t where t.id = v_activity_task_id and t.is_active = true
      ) then
        raise exception 'Select a valid task for each activity row.';
      end if;

      if v_activity_work_mode not in ('factory', 'site', 'office') then
        raise exception 'Activity rows must use factory, site, or office work mode.';
      end if;

      if p_work_mode = 'mixed' then
        if v_activity_work_mode not in ('factory', 'site', 'office') then
          raise exception 'Mixed mode rows must choose factory, site, or office.';
        end if;
      elsif v_activity_work_mode <> p_work_mode then
        raise exception 'Non-mixed rows must inherit the selected work mode.';
      end if;

      if v_activity_hours is null or v_activity_hours <= 0 or v_activity_hours > 24 then
        raise exception 'Activity hours must be greater than 0 and no more than 24.';
      end if;

      v_activity_total := v_activity_total + v_activity_hours;
    end loop;

    v_calculated_allocation := round((v_activity_total + p_leave_hours + case when p_paid_break then 0.5 else 0 end)::numeric, 1);
    if abs(v_calculated_allocation - p_allocation_hours) > 0.01 then
      raise exception 'Allocation hours do not match activity, leave, and paid break values.';
    end if;

    if abs(p_allocation_hours - p_payable_hours) > 0.01 then
      raise exception 'Allocation must equal payable total before submitting.';
    end if;
  end if;

  update public.timesheet_entries
  set status = 'submitted',
      submitted_at = timezone('utc', now()),
      time_in = case when p_is_public_holiday then null else p_time_in end,
      time_out = case when p_is_public_holiday then null else p_time_out end,
      work_mode = p_work_mode,
      leave_type = case when p_is_public_holiday then null else p_leave_type end,
      leave_hours = case when p_is_public_holiday then 0 else p_leave_hours end,
      is_public_holiday = p_is_public_holiday,
      unpaid_break = case when p_is_public_holiday then false else p_unpaid_break end,
      paid_break = case when p_is_public_holiday then false else p_paid_break end,
      payable_hours = p_payable_hours,
      allocation_hours = p_allocation_hours,
      approved_at = null,
      approved_by_profile_id = null,
      returned_at = null,
      returned_by_profile_id = null,
      return_comment = null
  where id = v_entry.id;

  delete from public.timesheet_entry_activities
  where entry_id = v_entry.id;

  if not p_is_public_holiday then
    v_sort_order := 0;
    for v_activity in select value from jsonb_array_elements(p_activities) loop
      insert into public.timesheet_entry_activities (
        entry_id,
        project_id,
        task_id,
        project_code_snapshot,
        project_label_snapshot,
        task_code_snapshot,
        task_label_snapshot,
        work_mode,
        hours,
        sort_order
      )
      select
        v_entry.id,
        p.id,
        t.id,
        p.code,
        p.label,
        t.code,
        t.label,
        v_activity ->> 'work_mode',
        (v_activity ->> 'hours')::numeric,
        v_sort_order
      from public.timesheet_projects p
      cross join public.timesheet_tasks t
      where p.id = (v_activity ->> 'project_id')::uuid
        and t.id = (v_activity ->> 'task_id')::uuid;
      v_inserted_count := v_inserted_count + 1;
      v_sort_order := v_sort_order + 1;
    end loop;
  end if;

  if v_inserted_count <> v_expected_count then
    raise exception 'Failed to replace all activity rows.';
  end if;

  select to_jsonb(e.*) into v_after_entry
  from public.timesheet_entries e
  where e.id = v_entry.id;

  select coalesce(jsonb_agg(to_jsonb(a.*) order by a.sort_order), '[]'::jsonb) into v_after_activities
  from public.timesheet_entry_activities a
  where a.entry_id = v_entry.id;

  insert into public.timesheet_entry_change_events (
    entry_id,
    profile_id,
    actor_profile_id,
    action,
    before_entry,
    before_activities,
    after_entry,
    after_activities,
    comment
  ) values (
    v_entry.id,
    p_target_profile_id,
    p_actor_profile_id,
    'supervisor_edited',
    v_before_entry,
    v_before_activities,
    v_after_entry,
    v_after_activities,
    nullif(btrim(p_comment), '')
  );

  return jsonb_build_object(
    'entry', v_after_entry,
    'activities', v_after_activities
  );
end;
$$;

grant execute on function public.correct_employee_timesheet_entry_atomic(
  uuid,
  uuid,
  date,
  time,
  time,
  text,
  text,
  numeric,
  boolean,
  boolean,
  boolean,
  numeric,
  numeric,
  jsonb,
  text
) to authenticated, service_role;
