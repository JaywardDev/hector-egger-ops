import "server-only";

import { createServiceRoleSupabaseClient } from "@/src/lib/supabase/service-role";
import type { AppRole } from "@/src/lib/auth/profile-access";
import { assertTimesheetApprovalAccess, type TimesheetActor } from "@/src/lib/timesheets/access";
import { addDays, getNzWeekDates } from "@/src/lib/timesheets/date";
import {
  getValidLookupIds,
  normalizeTimesheetEntry,
  timesheetActivitySelect,
  timesheetEntrySelect,
} from "@/src/lib/timesheets/entries";
import type {
  StaffGroup,
  TimesheetActivityRecord,
  TimesheetEntryRecord,
  SaveTimesheetEntryInput,
  TimesheetEntryWithActivities,
} from "@/src/lib/timesheets/types";
import { validateTimesheetEntryInput } from "@/src/lib/timesheets/validation";

export type ApprovalStaffProfile = {
  id: string;
  full_name: string | null;
  email: string;
  role: AppRole;
  staff_group: StaffGroup | null;
};

type ProfileRow = {
  id: string;
  full_name: string | null;
  email: string;
  account_status: "approved" | "pending" | "disabled";
  staff_group: StaffGroup | null;
};

type UserRoleRow = {
  profile_id: string;
  role: AppRole;
};

const roleRank: Record<AppRole, number> = { operator: 0, supervisor: 1, admin: 2 };
const reviewableRoles: AppRole[] = ["operator", "supervisor", "admin"];

const inList = (values: string[]) => values.join(",");

export const getApprovalWeekDates = (weekStart?: string) => {
  const [monday] = getNzWeekDates(weekStart);
  return Array.from({ length: 7 }, (_, index) => addDays(monday, index));
};

export const listApprovedStaffByGroup = async (
  actor: TimesheetActor,
  group: StaffGroup,
): Promise<ApprovalStaffProfile[]> => {
  await assertTimesheetApprovalAccess(actor);

  const supabase = createServiceRoleSupabaseClient();
  const profilesResponse = await supabase.request(
    `/rest/v1/profiles?select=id,full_name,email,account_status,staff_group&account_status=eq.approved&staff_group=eq.${group}&order=full_name.asc,email.asc`,
    { cache: "no-store" },
  );

  if (!profilesResponse.ok) throw new Error("Failed to load approval staff list");
  const profiles = (await profilesResponse.json()) as ProfileRow[];
  if (profiles.length === 0) return [];

  const rolesResponse = await supabase.request(
    `/rest/v1/user_roles?select=profile_id,role&profile_id=in.(${inList(profiles.map((profile) => profile.id))})`,
    { cache: "no-store" },
  );
  if (!rolesResponse.ok) throw new Error("Failed to load staff roles");
  const roles = (await rolesResponse.json()) as UserRoleRow[];

  const roleByProfileId = new Map<string, AppRole>();
  for (const row of roles) {
    if (!reviewableRoles.includes(row.role)) continue;
    const existing = roleByProfileId.get(row.profile_id);
    if (!existing || roleRank[row.role] < roleRank[existing]) {
      roleByProfileId.set(row.profile_id, row.role);
    }
  }

  return profiles
    .map((profile) => {
      const role = roleByProfileId.get(profile.id);
      return role ? { id: profile.id, full_name: profile.full_name, email: profile.email, role, staff_group: profile.staff_group } : null;
    })
    .filter((profile): profile is ApprovalStaffProfile => profile !== null)
    .sort((a, b) => roleRank[a.role] - roleRank[b.role] || (a.full_name ?? a.email).localeCompare(b.full_name ?? b.email));
};

export const listTimesheetEntriesForProfileForDates = async (
  actor: TimesheetActor,
  targetProfileId: string,
  dates: string[],
): Promise<TimesheetEntryWithActivities[]> => {
  await assertTimesheetApprovalAccess(actor);
  if (!targetProfileId) throw new Error("Target profile is required");
  if (dates.length === 0) return [];

  const supabase = createServiceRoleSupabaseClient();
  const entriesResponse = await supabase.request(
    `/rest/v1/timesheet_entries?select=${timesheetEntrySelect}&profile_id=eq.${targetProfileId}&work_date=in.(${inList(dates)})&order=work_date.asc`,
    { cache: "no-store" },
  );
  if (!entriesResponse.ok) throw new Error("Failed to load employee timesheet entries");
  const entries = (await entriesResponse.json()) as TimesheetEntryRecord[];
  if (entries.length === 0) return [];

  const activitiesResponse = await supabase.request(
    `/rest/v1/timesheet_entry_activities?select=${timesheetActivitySelect}&entry_id=in.(${inList(entries.map((entry) => entry.id))})&order=sort_order.asc`,
    { cache: "no-store" },
  );
  if (!activitiesResponse.ok) throw new Error("Failed to load employee timesheet activities");
  const activities = (await activitiesResponse.json()) as TimesheetActivityRecord[];

  return entries.map((entry) => normalizeTimesheetEntry(entry, activities.filter((activity) => activity.entry_id === entry.id)));
};


const assertTargetProfileApproved = async (targetProfileId: string) => {
  const supabase = createServiceRoleSupabaseClient();
  const response = await supabase.request(
    `/rest/v1/profiles?select=id,account_status&account_status=eq.approved&id=eq.${targetProfileId}&limit=1`,
    { cache: "no-store" },
  );
  if (!response.ok) throw new Error("Failed to verify target employee profile");
  const rows = (await response.json()) as { id: string; account_status: "approved" }[];
  if (rows.length === 0) throw new Error("Target employee is not approved or does not exist.");
};

const getSubmittedEntriesForWeek = async (targetProfileId: string, weekDates: string[]) => {
  const supabase = createServiceRoleSupabaseClient();
  const response = await supabase.request(
    `/rest/v1/timesheet_entries?select=id,status&profile_id=eq.${targetProfileId}&work_date=in.(${inList(weekDates)})`,
    { cache: "no-store" },
  );
  if (!response.ok) throw new Error("Failed to load target week entries");
  return (await response.json()) as { id: string; status: string }[];
};

export const approveEmployeeTimesheetWeek = async (
  actor: TimesheetActor,
  targetProfileId: string,
  weekStart: string,
) => {
  await assertTimesheetApprovalAccess(actor);
  if (!targetProfileId || targetProfileId === actor.profileId) throw new Error("Select an employee timesheet to approve.");

  await assertTargetProfileApproved(targetProfileId);
  const weekDates = getApprovalWeekDates(weekStart);
  const entries = await getSubmittedEntriesForWeek(targetProfileId, weekDates);
  const affectedEntryIds = entries.filter((entry) => entry.status === "submitted").map((entry) => entry.id);
  if (affectedEntryIds.length === 0) throw new Error("No submitted entries are available to approve for this week.");

  const supabase = createServiceRoleSupabaseClient();
  const now = new Date().toISOString();
  const updateResponse = await supabase.request(
    `/rest/v1/timesheet_entries?id=in.(${inList(affectedEntryIds)})&profile_id=eq.${targetProfileId}&work_date=in.(${inList(weekDates)})`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({
        status: "supervisor_approved",
        approved_at: now,
        approved_by_profile_id: actor.profileId,
        returned_at: null,
        returned_by_profile_id: null,
        return_comment: null,
      }),
    },
  );
  if (!updateResponse.ok) throw new Error("Failed to approve submitted entries");

  const eventResponse = await supabase.request("/rest/v1/timesheet_approval_events", {
    method: "POST",
    headers: { "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify({
      profile_id: targetProfileId,
      actor_profile_id: actor.profileId,
      week_start: weekDates[0],
      week_end: weekDates[6],
      action: "approved",
      affected_entry_ids: affectedEntryIds,
    }),
  });
  if (!eventResponse.ok) throw new Error("Failed to record approval event");

  return { affectedEntryIds };
};

export const returnEmployeeTimesheetWeek = async (
  actor: TimesheetActor,
  targetProfileId: string,
  weekStart: string,
  comment: string,
) => {
  await assertTimesheetApprovalAccess(actor);
  if (!targetProfileId || targetProfileId === actor.profileId) throw new Error("Select an employee timesheet to return.");
  const cleanComment = comment.trim();
  if (!cleanComment) throw new Error("A return comment is required.");

  await assertTargetProfileApproved(targetProfileId);
  const weekDates = getApprovalWeekDates(weekStart);
  const entries = await getSubmittedEntriesForWeek(targetProfileId, weekDates);
  const affectedEntryIds = entries
    .filter((entry) => entry.status === "submitted" || entry.status === "supervisor_approved")
    .map((entry) => entry.id);
  if (affectedEntryIds.length === 0) throw new Error("No submitted or approved entries are available to return for this week.");

  const supabase = createServiceRoleSupabaseClient();
  const updateResponse = await supabase.request(
    `/rest/v1/timesheet_entries?id=in.(${inList(affectedEntryIds)})&profile_id=eq.${targetProfileId}&work_date=in.(${inList(weekDates)})`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({
        status: "returned",
        returned_at: new Date().toISOString(),
        returned_by_profile_id: actor.profileId,
        return_comment: cleanComment,
        approved_at: null,
        approved_by_profile_id: null,
      }),
    },
  );
  if (!updateResponse.ok) throw new Error("Failed to return entries for correction");

  const eventResponse = await supabase.request("/rest/v1/timesheet_approval_events", {
    method: "POST",
    headers: { "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify({
      profile_id: targetProfileId,
      actor_profile_id: actor.profileId,
      week_start: weekDates[0],
      week_end: weekDates[6],
      action: "returned",
      comment: cleanComment,
      affected_entry_ids: affectedEntryIds,
    }),
  });
  if (!eventResponse.ok) throw new Error("Failed to record return event");

  return { affectedEntryIds };
};


type CorrectionRpcResponse = {
  entry: TimesheetEntryRecord;
  activities: TimesheetActivityRecord[];
};

const parseSupabaseError = async (response: Response, fallback: string) => {
  try {
    const body = (await response.json()) as { message?: string; details?: string };
    return body.message || body.details || fallback;
  } catch {
    return fallback;
  }
};

export const saveEmployeeTimesheetCorrectionAtomic = async (
  actor: TimesheetActor,
  targetProfileId: string,
  input: SaveTimesheetEntryInput,
  comment?: string,
): Promise<TimesheetEntryWithActivities> => {
  await assertTimesheetApprovalAccess(actor);
  if (!targetProfileId) throw new Error("Target employee is required.");
  if (targetProfileId === actor.profileId) {
    throw new Error("Supervisors cannot correct their own timesheet through approvals.");
  }

  await assertTargetProfileApproved(targetProfileId);

  const supabase = createServiceRoleSupabaseClient();
  const existingResponse = await supabase.request(
    `/rest/v1/timesheet_entries?select=id,status&profile_id=eq.${targetProfileId}&work_date=eq.${input.workDate}&limit=1`,
    { cache: "no-store" },
  );
  if (!existingResponse.ok) throw new Error("Failed to verify target timesheet entry");
  const [existing] = (await existingResponse.json()) as { id: string; status: string }[];
  if (!existing) throw new Error("No submitted or returned timesheet entry exists for this day.");
  if (existing.status !== "submitted" && existing.status !== "returned") {
    throw new Error("Only submitted or returned entries can be corrected.");
  }

  const { projectIds, taskIds } = await getValidLookupIds();
  const validated = validateTimesheetEntryInput(input, projectIds, taskIds);

  const response = await supabase.request("/rest/v1/rpc/correct_employee_timesheet_entry_atomic", {
    method: "POST",
    headers: { "Content-Type": "application/json", Prefer: "return=representation" },
    body: JSON.stringify({
      p_actor_profile_id: actor.profileId,
      p_target_profile_id: targetProfileId,
      p_work_date: input.workDate,
      p_time_in: input.isPublicHoliday ? null : input.timeIn,
      p_time_out: input.isPublicHoliday ? null : input.timeOut,
      p_work_mode: input.workMode,
      p_leave_type: validated.leaveType,
      p_leave_hours: validated.leaveHours,
      p_is_public_holiday: input.isPublicHoliday,
      p_unpaid_break: input.isPublicHoliday ? false : input.unpaidBreak,
      p_paid_break: input.isPublicHoliday ? false : input.paidBreak,
      p_payable_hours: validated.payableHours,
      p_allocation_hours: validated.allocationHours,
      p_activities: validated.activities.map((activity) => ({
        project_id: activity.projectId,
        task_id: activity.taskId,
        work_mode: input.workMode === "mixed" ? activity.workMode : input.workMode,
        hours: activity.hours,
      })),
      p_comment: comment?.trim() || null,
    }),
  });

  if (!response.ok) {
    throw new Error(await parseSupabaseError(response, "Failed to save timesheet correction."));
  }

  const result = (await response.json()) as CorrectionRpcResponse;
  if (!result.entry) throw new Error("Corrected timesheet entry was not returned");
  return normalizeTimesheetEntry(result.entry, result.activities ?? []);
};
