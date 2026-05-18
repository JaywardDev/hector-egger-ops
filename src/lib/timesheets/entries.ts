import "server-only";

import { nowUtcIso } from "@/src/lib/dateTime";
import { createServerSupabaseClient } from "@/src/lib/supabase/server";
import { createServiceRoleSupabaseClient } from "@/src/lib/supabase/service-role";
import { assertTimesheetReadAccess, assertTimesheetWriteAccess, canEditApprovedTimesheets, createSessionHeaders, type TimesheetActor } from "@/src/lib/timesheets/access";
import { validateTimesheetEntryInput } from "@/src/lib/timesheets/validation";
import type { SaveTimesheetEntryInput, TimesheetActivityRecord, TimesheetEntryRecord, TimesheetEntryWithActivities, TimesheetLookupOption, TimesheetPreferenceRecord, TimesheetWorkMode } from "@/src/lib/timesheets/types";

export const timesheetEntrySelect = "id,profile_id,work_date,status,time_in,time_out,work_mode,leave_type,leave_hours,is_public_holiday,unpaid_break,paid_break,payable_hours,allocation_hours,submitted_at,approved_at,approved_by_profile_id,returned_at,returned_by_profile_id,return_comment,created_at,updated_at";
const entrySelect = timesheetEntrySelect;
export const timesheetActivitySelect = "id,entry_id,project_id,task_id,project_code_snapshot,project_label_snapshot,task_code_snapshot,task_label_snapshot,work_mode,hours,sort_order";
const activitySelect = timesheetActivitySelect;

type ActorWithRoles = TimesheetActor & { accessContext: { accountStatus: "approved"; roles: import("@/src/lib/auth/profile-access").AppRole[] } };

export const normalizeTimesheetEntry = (entry: TimesheetEntryRecord, activities: TimesheetActivityRecord[] = []): TimesheetEntryWithActivities => ({
  ...entry,
  leave_hours: Number(entry.leave_hours),
  payable_hours: Number(entry.payable_hours),
  allocation_hours: Number(entry.allocation_hours),
  activities: activities.map((activity) => ({ ...activity, hours: Number(activity.hours) })),
});

export const getTimesheetPreference = async (actor: TimesheetActor): Promise<TimesheetWorkMode> => {
  await assertTimesheetReadAccess(actor);
  const supabase = createServerSupabaseClient();
  const response = await supabase.request(`/rest/v1/timesheet_preferences?select=profile_id,preferred_work_mode&profile_id=eq.${actor.profileId}&limit=1`, {
    cache: "no-store",
    headers: createSessionHeaders(actor.session),
  });
  if (!response.ok) return "factory";
  const [record] = (await response.json()) as TimesheetPreferenceRecord[];
  return record?.preferred_work_mode ?? "factory";
};

export const listOwnTimesheetEntriesForDates = async (actor: TimesheetActor, dates: string[]): Promise<TimesheetEntryWithActivities[]> => {
  await assertTimesheetReadAccess(actor);
  if (dates.length === 0) return [];
  const supabase = createServerSupabaseClient();
  const response = await supabase.request(
    `/rest/v1/timesheet_entries?select=${entrySelect}&profile_id=eq.${actor.profileId}&work_date=in.(${dates.join(",")})&order=work_date.asc`,
    { cache: "no-store", headers: createSessionHeaders(actor.session) },
  );
  if (!response.ok) throw new Error("Failed to load timesheet entries");
  const entries = (await response.json()) as TimesheetEntryRecord[];
  if (entries.length === 0) return [];

  const activityResponse = await supabase.request(
    `/rest/v1/timesheet_entry_activities?select=${activitySelect}&entry_id=in.(${entries.map((entry) => entry.id).join(",")})&order=sort_order.asc`,
    { cache: "no-store", headers: createSessionHeaders(actor.session) },
  );
  if (!activityResponse.ok) throw new Error("Failed to load timesheet activities");
  const activities = (await activityResponse.json()) as TimesheetActivityRecord[];
  return entries.map((entry) => normalizeTimesheetEntry(entry, activities.filter((activity) => activity.entry_id === entry.id)));
};

const getExistingEntry = async (profileId: string, workDate: string): Promise<TimesheetEntryRecord | null> => {
  const supabase = createServiceRoleSupabaseClient();
  const response = await supabase.request(`/rest/v1/timesheet_entries?select=${entrySelect}&profile_id=eq.${profileId}&work_date=eq.${workDate}&limit=1`);
  if (!response.ok) throw new Error("Failed to load existing timesheet entry");
  const [entry] = (await response.json()) as TimesheetEntryRecord[];
  return entry ?? null;
};

export const getValidLookupIds = async () => {
  const supabase = createServiceRoleSupabaseClient();
  const [projectsResponse, tasksResponse] = await Promise.all([
    supabase.request("/rest/v1/timesheet_projects?select=id,code,label,is_active,sort_order&is_active=eq.true"),
    supabase.request("/rest/v1/timesheet_tasks?select=id,code,label,is_active,sort_order&is_active=eq.true"),
  ]);
  if (!projectsResponse.ok || !tasksResponse.ok) throw new Error("Failed to validate lookup options");
  const projects = (await projectsResponse.json()) as TimesheetLookupOption[];
  const tasks = (await tasksResponse.json()) as TimesheetLookupOption[];
  return {
    projectIds: new Set(projects.map((row) => row.id)),
    taskIds: new Set(tasks.map((row) => row.id)),
    projectById: new Map(projects.map((row) => [row.id, row])),
    taskById: new Map(tasks.map((row) => [row.id, row])),
  };
};

export const saveOwnTimesheetEntry = async (actor: ActorWithRoles, input: SaveTimesheetEntryInput): Promise<TimesheetEntryWithActivities> => {
  await assertTimesheetWriteAccess(actor);
  const { projectIds, taskIds, projectById, taskById } = await getValidLookupIds();
  const validated = validateTimesheetEntryInput(input, projectIds, taskIds);
  const existing = await getExistingEntry(actor.profileId, validated.workDate);
  if (existing?.status === "supervisor_approved" || (existing?.status === "approved" && !canEditApprovedTimesheets(actor.accessContext.roles))) {
    throw new Error("Supervisor-approved timesheet entries are locked.");
  }
  const wasReturned = existing?.status === "returned";

  const supabase = createServiceRoleSupabaseClient();
  const entryPayload = {
    profile_id: actor.profileId,
    work_date: validated.workDate,
    status: "submitted",
    time_in: input.isPublicHoliday ? null : input.timeIn,
    time_out: input.isPublicHoliday ? null : input.timeOut,
    work_mode: input.workMode,
    leave_type: validated.leaveType,
    leave_hours: validated.leaveHours,
    is_public_holiday: input.isPublicHoliday,
    unpaid_break: input.isPublicHoliday ? false : input.unpaidBreak,
    paid_break: input.isPublicHoliday ? false : input.paidBreak,
    payable_hours: validated.payableHours,
    allocation_hours: validated.allocationHours,
    submitted_at: nowUtcIso(),
    approved_at: null,
    approved_by_profile_id: null,
    returned_at: null,
    returned_by_profile_id: null,
    return_comment: null,
  };

  const entryResponse = await supabase.request(
    existing ? `/rest/v1/timesheet_entries?id=eq.${existing.id}&select=${entrySelect}` : `/rest/v1/timesheet_entries?select=${entrySelect}`,
    {
      method: existing ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json", Prefer: "return=representation" },
      body: JSON.stringify(entryPayload),
    },
  );
  if (!entryResponse.ok) throw new Error("Failed to save timesheet entry");
  const [entry] = (await entryResponse.json()) as TimesheetEntryRecord[];
  if (!entry) throw new Error("Timesheet entry was not returned");

  const deleteResponse = await supabase.request(`/rest/v1/timesheet_entry_activities?entry_id=eq.${entry.id}`, { method: "DELETE" });
  if (!deleteResponse.ok) throw new Error("Failed to replace timesheet activity rows");

  let activities: TimesheetActivityRecord[] = [];
  if (!input.isPublicHoliday && validated.activities.length > 0) {
    const activityResponse = await supabase.request(`/rest/v1/timesheet_entry_activities?select=${activitySelect}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Prefer: "return=representation" },
      body: JSON.stringify(validated.activities.map((activity, index) => {
        const project = projectById.get(activity.projectId);
        const task = taskById.get(activity.taskId);
        return {
          entry_id: entry.id,
          project_id: activity.projectId,
          task_id: activity.taskId,
          project_code_snapshot: project?.code ?? null,
          project_label_snapshot: project?.label ?? null,
          task_code_snapshot: task?.code ?? null,
          task_label_snapshot: task?.label ?? null,
          work_mode: input.workMode === "mixed" ? activity.workMode : input.workMode,
          hours: activity.hours,
          sort_order: index,
        };
      })),
    });
    if (!activityResponse.ok) throw new Error("Failed to save timesheet activity rows");
    activities = (await activityResponse.json()) as TimesheetActivityRecord[];
  }

  if (wasReturned) {
    const weekDates = (await import("@/src/lib/timesheets/date")).getNzWeekDates(validated.workDate);
    await supabase.request("/rest/v1/timesheet_approval_events", {
      method: "POST",
      headers: { "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({
        profile_id: actor.profileId,
        actor_profile_id: actor.profileId,
        week_start: weekDates[0],
        week_end: weekDates[6],
        action: "resubmitted",
        affected_entry_ids: [entry.id],
      }),
    });
  }

  const prefResponse = await supabase.request("/rest/v1/timesheet_preferences?on_conflict=profile_id", {
    method: "POST",
    headers: { "Content-Type": "application/json", Prefer: "resolution=merge-duplicates" },
    body: JSON.stringify({ profile_id: actor.profileId, preferred_work_mode: input.workMode }),
  });
  if (!prefResponse.ok) throw new Error("Failed to save timesheet preference");

  return normalizeTimesheetEntry(entry, activities);
};
