import type { SaveTimesheetEntryInput, TimesheetActivityInput, TimesheetActivityMode, TimesheetLeaveType, TimesheetWorkMode } from "@/src/lib/timesheets/types";

const workModes = new Set<TimesheetWorkMode>(["factory", "site", "mixed"]);
const activityModes = new Set<TimesheetActivityMode>(["factory", "site"]);
const leaveTypes = new Set<TimesheetLeaveType>(["annual", "sick", "bereavement", "unpaid", "other"]);

export const roundHours = (value: number) => Math.round(value * 10) / 10;

const timeToMinutes = (value: string) => {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
};

export const calculatePayableHours = (input: Pick<SaveTimesheetEntryInput, "isPublicHoliday" | "timeIn" | "timeOut" | "unpaidBreak">) => {
  if (input.isPublicHoliday) return 8;
  if (!input.timeIn || !input.timeOut) return null;
  const start = timeToMinutes(input.timeIn);
  const end = timeToMinutes(input.timeOut);
  if (start === null || end === null || end <= start) return null;
  return roundHours((end - start) / 60 - (input.unpaidBreak ? 0.5 : 0));
};

export const calculateAllocationHours = (input: Pick<SaveTimesheetEntryInput, "isPublicHoliday" | "activities" | "leaveHours" | "paidBreak">) => {
  if (input.isPublicHoliday) return 8;
  const activityHours = input.activities.reduce((total, row) => total + row.hours, 0);
  return roundHours(activityHours + input.leaveHours + (input.paidBreak ? 0.5 : 0));
};

export const validateTimesheetEntryInput = (input: SaveTimesheetEntryInput, validProjectIds: Set<string>, validTaskIds: Set<string>) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.workDate)) {
    throw new Error("A valid work date is required.");
  }
  if (!workModes.has(input.workMode)) {
    throw new Error("A valid work mode is required.");
  }

  if (input.isPublicHoliday) {
    return { payableHours: 8, allocationHours: 8, activities: [] as TimesheetActivityInput[], leaveType: null, leaveHours: 0 };
  }

  const payableHours = calculatePayableHours(input);
  if (payableHours === null || payableHours < 0) {
    throw new Error("Time in and time out must form a valid same-day time span.");
  }

  if (input.leaveType !== null && !leaveTypes.has(input.leaveType)) {
    throw new Error("A valid leave type is required.");
  }
  if (!Number.isFinite(input.leaveHours) || input.leaveHours < 0 || input.leaveHours > 24) {
    throw new Error("Leave hours must be between 0 and 24.");
  }
  if (input.leaveHours > 0 && input.leaveType === null) {
    throw new Error("Select a leave type when leave hours are entered.");
  }

  const activities = input.activities.filter((row) => row.hours > 0);
  for (const row of activities) {
    if (!validProjectIds.has(row.projectId)) throw new Error("Select a valid project for each activity row.");
    if (!validTaskIds.has(row.taskId)) throw new Error("Select a valid task for each activity row.");
    if (!Number.isFinite(row.hours) || row.hours <= 0 || row.hours > 24) throw new Error("Activity hours must be greater than 0 and no more than 24.");
    if (input.workMode === "mixed") {
      if (!activityModes.has(row.workMode)) throw new Error("Mixed mode rows must choose factory or site.");
    } else if (row.workMode !== input.workMode) {
      throw new Error("Factory/site rows must inherit the selected work mode.");
    }
  }

  const allocationHours = calculateAllocationHours({ ...input, activities });
  if (Math.abs(allocationHours - payableHours) > 0.01) {
    throw new Error("Allocation must equal payable total before submitting.");
  }

  return { payableHours, allocationHours, activities, leaveType: input.leaveType, leaveHours: roundHours(input.leaveHours) };
};
