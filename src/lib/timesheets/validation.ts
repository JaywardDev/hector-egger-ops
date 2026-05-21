import { parseNzDate } from "@/src/lib/dateTime";
import { isSpecialTimesheetCostcode } from "@/src/lib/timesheets/lookup-shared";
import type {
  SaveTimesheetEntryInput,
  TimesheetActivityInput,
  TimesheetActivityMode,
  TimesheetLeaveType,
  TimesheetWorkMode,
} from "@/src/lib/timesheets/types";

const workModes = new Set<TimesheetWorkMode>(["factory", "site", "office", "mixed"]);
const activityModes = new Set<TimesheetActivityMode>(["factory", "site", "office"]);
const leaveTypes = new Set<TimesheetLeaveType>(["annual", "sick", "bereavement", "unpaid", "other"]);
const leaveTypeToTaskCode: Record<TimesheetLeaveType, string[]> = {
  annual: ["LA"],
  bereavement: ["LB"],
  sick: ["LS", "LSACC", "LSACCNW"],
  unpaid: ["LW"],
  other: ["TIL"],
};

export const roundHours = (value: number) => Math.round(value * 10) / 10;
export const PAID_BREAK_THRESHOLD_HOURS = 3.0;
const timeToMinutes = (value: string) => {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
};
const isHalfHourBoundary = (value: string) => {
  const minutes = timeToMinutes(value);
  return minutes !== null && minutes % 30 === 0;
};
export const calculatePayableHours = (input: Pick<SaveTimesheetEntryInput, "isPublicHoliday" | "fullDayLeave" | "timeIn" | "timeOut" | "unpaidBreak">) => {
  if (input.isPublicHoliday || input.fullDayLeave) return 8;
  if (!input.timeIn || !input.timeOut) return null;
  const start = timeToMinutes(input.timeIn);
  const end = timeToMinutes(input.timeOut);
  if (start === null || end === null || end <= start) return null;
  return roundHours((end - start) / 60 - (input.unpaidBreak ? 0.5 : 0));
};
export const derivePaidBreakEntitlement = (input: Pick<SaveTimesheetEntryInput, "isPublicHoliday" | "timeIn" | "timeOut">) => {
  if (input.isPublicHoliday || !input.timeIn || !input.timeOut) return false;
  const start = timeToMinutes(input.timeIn);
  const end = timeToMinutes(input.timeOut);
  if (start === null || end === null || end <= start) return false;
  return roundHours((end - start) / 60) >= PAID_BREAK_THRESHOLD_HOURS;
};
export const calculateAllocationHours = (input: Pick<SaveTimesheetEntryInput, "isPublicHoliday" | "fullDayLeave" | "activities" | "leaveHours">) => {
  if (input.isPublicHoliday || input.fullDayLeave) return 8;
  const activityHours = input.activities.reduce((total, row) => total + row.hours, 0);
  return roundHours(activityHours + input.leaveHours);
};

type IncompleteActivityRow = { index: number; missingProject: boolean; missingTask: boolean; missingLocation: boolean };
export const incompleteActivityMessage = (workMode: TimesheetWorkMode) => workMode === "mixed" ? "Complete project, task, and location for every activity row with hours." : "Complete project and task for every activity row with hours.";
export const getIncompleteActivityRows = (input: Pick<SaveTimesheetEntryInput, "isPublicHoliday" | "workMode" | "activities">): IncompleteActivityRow[] => {
  if (input.isPublicHoliday) return [];
  return input.activities.flatMap((row, index) => {
    if (!(row.hours > 0)) return [];
    const missingProject = row.projectId.trim().length === 0;
    const missingTask = row.taskId.trim().length === 0;
    const missingLocation = input.workMode === "mixed" && !activityModes.has(row.workMode);
    return missingProject || missingTask || missingLocation ? [{ index, missingProject, missingTask, missingLocation }] : [];
  });
};

export const validateTimesheetEntryInput = (
  input: SaveTimesheetEntryInput,
  validProjectIds: Set<string>,
  validTaskIds: Set<string>,
  validProjectIdsByLocation?: Map<TimesheetActivityMode, Set<string>>,
  validTaskIdsByLocation?: Map<TimesheetActivityMode, Set<string>>,
  leaveTaskCodes?: Set<string>,
  hasPublicHolidayTask = true,
  taskCodeById?: Map<string, string>,
) => {
  const workDate = parseNzDate(input.workDate);
  if (!workDate) throw new Error("A valid work date is required.");
  if (!workModes.has(input.workMode)) throw new Error("A valid work mode is required.");
  if (input.isPublicHoliday) {
    if (!hasPublicHolidayTask) throw new Error("Public holiday is unavailable because the PUHO costcode is not active for this profile.");
    return { workDate, payableHours: 8, allocationHours: 8, activities: [] as TimesheetActivityInput[], leaveType: null, leaveHours: 0 };
  }

  const payableHours = calculatePayableHours(input);
  if (!input.isPublicHoliday && input.timeIn && input.timeOut && (!isHalfHourBoundary(input.timeIn) || !isHalfHourBoundary(input.timeOut))) throw new Error("Time in and time out must be on 30-minute boundaries.");
  if (payableHours === null || payableHours < 0) throw new Error("Time in and time out must form a valid same-day time span.");
  if (input.leaveType !== null && !leaveTypes.has(input.leaveType)) throw new Error("A valid leave type is required.");
  if (input.fullDayLeave && input.leaveType === null) throw new Error("Select a leave type when full-day leave is selected.");
  if (!Number.isFinite(input.leaveHours) || input.leaveHours < 0 || input.leaveHours > 24) throw new Error("Leave hours must be between 0 and 24.");
  if (input.leaveHours > 0 && input.leaveType === null) throw new Error("Select a leave type when leave hours are entered.");
  const derivedPaidBreak = derivePaidBreakEntitlement(input);
  if (input.paidBreak && !derivedPaidBreak) throw new Error("Paid break is available from 3.0h attendance.");
  if (input.leaveType && leaveTaskCodes) {
    const hasMappedLeaveCode = leaveTypeToTaskCode[input.leaveType].some((code) => leaveTaskCodes.has(code));
    if (!hasMappedLeaveCode) throw new Error("Selected leave type is unavailable for this profile.");
  }

  const incompleteActivityRows = getIncompleteActivityRows(input);
  if (incompleteActivityRows.length > 0) throw new Error(incompleteActivityMessage(input.workMode));

  const activities = input.activities.filter((row) => row.hours > 0);
  for (const row of activities) {
    if (!validProjectIds.has(row.projectId)) throw new Error("Select a valid project for each activity row.");
    if (!validTaskIds.has(row.taskId)) throw new Error("Select a valid task for each activity row.");
    if (taskCodeById && isSpecialTimesheetCostcode(taskCodeById.get(row.taskId) ?? "")) throw new Error("Special timesheet costcodes cannot be used as normal work tasks.");
    if (!Number.isFinite(row.hours) || row.hours <= 0 || row.hours > 24) throw new Error("Activity hours must be greater than 0 and no more than 24.");
    const effectiveLocation = input.workMode === "mixed" ? row.workMode : input.workMode;
    if (input.workMode === "mixed" && !activityModes.has(row.workMode)) throw new Error("Mixed mode rows must choose factory, site, or office.");
    if (input.workMode !== "mixed" && row.workMode !== input.workMode) throw new Error("Non-mixed rows must inherit the selected work mode.");
    if (validProjectIdsByLocation && !validProjectIdsByLocation.get(effectiveLocation)?.has(row.projectId)) throw new Error("Project is not available for the selected work location.");
    if (validTaskIdsByLocation && !validTaskIdsByLocation.get(effectiveLocation)?.has(row.taskId)) throw new Error("Task is not available for the selected work location.");
  }

  if (input.fullDayLeave) {
    const allocationHours = 8;
    return { workDate, payableHours: 8, allocationHours, activities: [] as TimesheetActivityInput[], leaveType: input.leaveType, leaveHours: 8, paidBreak: false, unpaidBreak: false, requiredAllocationHours: 8 };
  }

  const allocationHours = calculateAllocationHours({ ...input, activities });
  const requiredAllocationHours = roundHours(payableHours - (input.paidBreak ? 0.5 : 0));
  if (Math.abs(allocationHours - requiredAllocationHours) > 0.01) throw new Error("Allocation must equal attendance span minus claimed paid break and unpaid break before submitting.");
  return { workDate, payableHours, allocationHours, activities, leaveType: input.leaveType, leaveHours: roundHours(input.leaveHours), paidBreak: input.paidBreak, unpaidBreak: input.unpaidBreak, requiredAllocationHours };
};
