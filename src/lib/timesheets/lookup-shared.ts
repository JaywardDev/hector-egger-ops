import type { TimesheetActivityMode, TimesheetLookupOption, TimesheetLookups } from "@/src/lib/timesheets/types";

export const leaveCodes = ["LA", "LB", "LS", "LSACC", "LSACCNW", "LW", "TIL"] as const;

export const filterLookupsForLocation = (lookups: TimesheetLookups, location: TimesheetActivityMode): TimesheetLookups => ({
  projects: lookups.projects.filter((row) => row.visible_to_staff_groups.includes(location)),
  tasks: lookups.tasks.filter((row) => row.visible_to_staff_groups.includes(location)),
});

export const getLeaveTaskOptions = (lookups: TimesheetLookups): TimesheetLookupOption[] =>
  lookups.tasks.filter((task) => leaveCodes.includes(task.code as (typeof leaveCodes)[number]));

export const hasPublicHolidayTask = (lookups: TimesheetLookups) =>
  lookups.tasks.some((task) => task.code === "PUHO");
