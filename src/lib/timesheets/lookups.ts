import "server-only";

import { createServerSupabaseClient } from "@/src/lib/supabase/server";
import { assertTimesheetReadAccess, createSessionHeaders, type TimesheetActor } from "@/src/lib/timesheets/access";
import type { StaffGroup, TimesheetActivityMode, TimesheetLookupOption, TimesheetLookups } from "@/src/lib/timesheets/types";

const select = "id,code,label,is_active,sort_order,visible_to_staff_groups,source_system,source_row_hash,last_seen_at,inactive_reason,inactive_at";
const leaveCodes = ["LA", "LB", "LS", "LSACC", "LSACCNW", "LW", "TIL"] as const;

const staffGroupVisibilityFilter = (staffGroup: StaffGroup) =>
  `visible_to_staff_groups=cs.${encodeURIComponent(`{${staffGroup}}`)}`;

const loadLookup = async (
  path: string,
  actor: TimesheetActor,
  staffGroup: StaffGroup,
): Promise<TimesheetLookupOption[]> => {
  const supabase = createServerSupabaseClient();
  const response = await supabase.request(`${path}?select=${select}&is_active=eq.true&${staffGroupVisibilityFilter(staffGroup)}&order=sort_order.asc,code.asc`, {
    cache: "no-store",
    headers: createSessionHeaders(actor.session),
  });
  if (!response.ok) throw new Error("Failed to load timesheet lookup options");
  return (await response.json()) as TimesheetLookupOption[];
};

export const emptyTimesheetLookups = (): TimesheetLookups => ({ projects: [], tasks: [] });
export const filterLookupsForLocation = (lookups: TimesheetLookups, location: TimesheetActivityMode): TimesheetLookups => ({
  projects: lookups.projects.filter((row) => row.visible_to_staff_groups.includes(location)),
  tasks: lookups.tasks.filter((row) => row.visible_to_staff_groups.includes(location)),
});

export const getLeaveTaskOptions = (lookups: TimesheetLookups) => lookups.tasks.filter((task) => leaveCodes.includes(task.code as (typeof leaveCodes)[number]));
export const hasPublicHolidayTask = (lookups: TimesheetLookups) => lookups.tasks.some((task) => task.code === "PUHO");

export const getTimesheetLookups = async (
  actor: TimesheetActor,
  staffGroup: StaffGroup | null | undefined,
): Promise<TimesheetLookups> => {
  await assertTimesheetReadAccess(actor);
  if (!staffGroup) return emptyTimesheetLookups();

  const [projects, tasks] = await Promise.all([
    loadLookup("/rest/v1/timesheet_projects", actor, staffGroup),
    loadLookup("/rest/v1/timesheet_tasks", actor, staffGroup),
  ]);
  return { projects, tasks };
};

export const getTimesheetLookupsForStaffGroup = getTimesheetLookups;
