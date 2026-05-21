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
  p_full_day_leave boolean,
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
  v_activity_total numeric := 0;
  v_inserted_count integer := 0;
  v_expected_count integer := 0;
  v_sort_order integer := 0;
  v_calculated_payable numeric;
  v_calculated_allocation numeric;
  v_attendance_span numeric := 0;
begin
  if p_work_date is null then raise exception 'A valid work date is required.'; end if;
  if p_actor_profile_id = p_target_profile_id then raise exception 'Supervisors cannot correct their own timesheet through approvals.'; end if;
  if p_work_mode not in ('factory','site','office','mixed') then raise exception 'A valid work mode is required.'; end if;
  if p_is_public_holiday is null or p_full_day_leave is null or p_unpaid_break is null or p_paid_break is null then raise exception 'Break, leave, and public holiday values are required.'; end if;
  if p_leave_type is not null and p_leave_type not in ('annual','sick','bereavement','unpaid','other') then raise exception 'A valid leave type is required.'; end if;
  if p_leave_hours is null or p_payable_hours is null or p_allocation_hours is null or p_leave_hours < 0 or p_leave_hours > 24 or p_payable_hours < 0 or p_payable_hours > 24 or p_allocation_hours < 0 or p_allocation_hours > 24 then raise exception 'Timesheet hours must be between 0 and 24.'; end if;
  if p_full_day_leave and p_leave_type is null then raise exception 'Select a leave type when full-day leave is selected.'; end if;
  if p_leave_hours > 0 and p_leave_type is null then raise exception 'Select a leave type when leave hours are entered.'; end if;
  if p_activities is null or jsonb_typeof(p_activities) <> 'array' then raise exception 'Activities must be a JSON array.'; end if;

  select public.can_approved_actor_manage_timesheet_profile(p_actor_profile_id, p_target_profile_id) into v_actor_can_manage;
  if not v_actor_can_manage then raise exception 'Only admins or supervisors assigned to this employee staff group can correct employee timesheets.'; end if;

  if p_full_day_leave then
    if abs(p_payable_hours - 8.0) > 0.01 then raise exception 'Full-day leave payable hours must be 8.0.'; end if;
    if abs(p_allocation_hours - 8.0) > 0.01 then raise exception 'Full-day leave allocation hours must be 8.0.'; end if;
  elsif not p_is_public_holiday then
    if p_time_in is null or p_time_out is null or p_time_out <= p_time_in then raise exception 'Time in and time out must form a valid same-day time span.'; end if;
    if mod(extract(minute from p_time_in)::int, 30) <> 0 or mod(extract(minute from p_time_out)::int, 30) <> 0 then raise exception 'Time in and time out must be on 30-minute boundaries.'; end if;
    v_calculated_payable := round((extract(epoch from (p_time_out - p_time_in)) / 3600 - case when p_unpaid_break then 0.5 else 0 end)::numeric, 1);
    if abs(v_calculated_payable - p_payable_hours) > 0.01 then raise exception 'Payable hours do not match time range and unpaid break.'; end if;
    v_attendance_span := round((extract(epoch from (p_time_out - p_time_in)) / 3600)::numeric, 1);
    if p_paid_break and v_attendance_span < 3.0 then raise exception 'Paid break is available from 3.0h attendance.'; end if;
  end if;

  for v_activity in select value from jsonb_array_elements(p_activities) loop
    v_expected_count := v_expected_count + 1;
    v_activity_total := v_activity_total + (v_activity ->> 'hours')::numeric;
  end loop;

  v_calculated_allocation := round((v_activity_total + p_leave_hours)::numeric, 1);
  if abs(p_allocation_hours - v_calculated_allocation) > 0.01 and not p_full_day_leave and not p_is_public_holiday then raise exception 'Allocation hours do not match activity and leave values.'; end if;

  select * into v_entry from public.timesheet_entries where profile_id=p_target_profile_id and work_date=p_work_date for update;
  if not found then raise exception 'No submitted or returned timesheet entry exists for this day.'; end if;
  if v_entry.status not in ('submitted','returned') then raise exception 'Only submitted or returned entries can be corrected.'; end if;

  select to_jsonb(e.*) into v_before_entry from public.timesheet_entries e where e.id=v_entry.id;
  select coalesce(jsonb_agg(to_jsonb(a.*) order by a.sort_order),'[]'::jsonb) into v_before_activities from public.timesheet_entry_activities a where a.entry_id=v_entry.id;

  update public.timesheet_entries set status='submitted', submitted_at=timezone('utc', now()), time_in=case when p_is_public_holiday then null else p_time_in end, time_out=case when p_is_public_holiday then null else p_time_out end, work_mode=p_work_mode, leave_type=case when p_is_public_holiday then null else p_leave_type end, leave_hours=case when p_is_public_holiday then 0 when p_full_day_leave then 8 else p_leave_hours end, is_public_holiday=p_is_public_holiday, unpaid_break=case when p_is_public_holiday or p_full_day_leave then false else p_unpaid_break end, paid_break=case when p_is_public_holiday or p_full_day_leave then false else p_paid_break end, payable_hours=case when p_full_day_leave then 8 else p_payable_hours end, allocation_hours=case when p_full_day_leave then 8 else p_allocation_hours end, approved_at=null, approved_by_profile_id=null, returned_at=null, returned_by_profile_id=null, return_comment=null where id=v_entry.id;

  delete from public.timesheet_entry_activities where entry_id=v_entry.id;
  if not p_is_public_holiday and not p_full_day_leave then
    for v_activity in select value from jsonb_array_elements(p_activities) loop
      insert into public.timesheet_entry_activities (entry_id,project_id,task_id,project_code_snapshot,project_label_snapshot,task_code_snapshot,task_label_snapshot,work_mode,hours,client_description,internal_note,sort_order)
      select v_entry.id,p.id,t.id,p.code,p.label,t.code,t.label,v_activity ->> 'work_mode',(v_activity ->> 'hours')::numeric,nullif(btrim(v_activity ->> 'client_description'),''),nullif(btrim(v_activity ->> 'internal_note'),''),v_sort_order
      from public.timesheet_projects p cross join public.timesheet_tasks t
      where p.id=(v_activity ->> 'project_id')::uuid and t.id=(v_activity ->> 'task_id')::uuid;
      v_inserted_count := v_inserted_count + 1;
      v_sort_order := v_sort_order + 1;
    end loop;
  end if;

  if v_inserted_count <> v_expected_count and not p_full_day_leave and not p_is_public_holiday then raise exception 'Failed to replace all activity rows.'; end if;

  select to_jsonb(e.*) into v_after_entry from public.timesheet_entries e where e.id=v_entry.id;
  select coalesce(jsonb_agg(to_jsonb(a.*) order by a.sort_order),'[]'::jsonb) into v_after_activities from public.timesheet_entry_activities a where a.entry_id=v_entry.id;
  insert into public.timesheet_entry_change_events (entry_id,profile_id,actor_profile_id,action,before_entry,before_activities,after_entry,after_activities,comment)
  values (v_entry.id,p_target_profile_id,p_actor_profile_id,'supervisor_edited',v_before_entry,v_before_activities,v_after_entry,v_after_activities,nullif(btrim(p_comment),''));
  return jsonb_build_object('entry', v_after_entry, 'activities', v_after_activities);
end;
$$;
