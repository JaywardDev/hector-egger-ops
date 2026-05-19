import type { TimesheetActivityMode, TimesheetLookupOption, TimesheetLookups } from "@/src/lib/timesheets/types";

export const leaveCodes = ["LA", "LB", "LS", "LSACC", "LSACCNW", "LW", "TIL"] as const;
export const specialTimesheetCostcodes = [...leaveCodes, "PUHO"] as const;

const specialCostcodeSet = new Set<string>(specialTimesheetCostcodes);
const leaveCodeSet = new Set<string>(leaveCodes);

export const isSpecialTimesheetCostcode = (codeOrTask: string | Pick<TimesheetLookupOption, "code">) =>
  specialCostcodeSet.has(typeof codeOrTask === "string" ? codeOrTask : codeOrTask.code);

export const isWorkActivityTask = (task: Pick<TimesheetLookupOption, "code">) =>
  !isSpecialTimesheetCostcode(task);

export const filterLookupsForLocation = (lookups: TimesheetLookups, location: TimesheetActivityMode): TimesheetLookups => ({
  projects: lookups.projects.filter((row) => row.visible_to_staff_groups.includes(location)),
  tasks: lookups.tasks.filter((row) => row.visible_to_staff_groups.includes(location)),
});

export const getLeaveTaskOptions = (lookups: TimesheetLookups): TimesheetLookupOption[] =>
  lookups.tasks.filter((task) => leaveCodeSet.has(task.code));

export const hasPublicHolidayTask = (lookups: TimesheetLookups) =>
  lookups.tasks.some((task) => isSpecialTimesheetCostcode(task.code) && task.code === "PUHO");
