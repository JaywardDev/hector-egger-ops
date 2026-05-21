export const SHIFT_COMPLETION_CONFIG = {
  shiftStart: "07:00",
  shiftFinish: "16:00",
  shiftSpanHours: 9,
  standardUnpaidBreakHours: 0.5,
  expectedFullDayPayable: 8.5,
  expectedFullDayAllocation: 8,
} as const;

const roundHours = (value: number) => Math.round(value * 10) / 10;

const timeToMinutes = (value: string) => {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
};

const attendanceSpanHours = (timeIn: string | null, timeOut: string | null) => {
  if (!timeIn || !timeOut) return 0;
  const start = timeToMinutes(timeIn);
  const end = timeToMinutes(timeOut);
  if (start === null || end === null || end <= start) return 0;
  return roundHours((end - start) / 60);
};

export type ShiftCompletionHelper = {
  attendanceSpan: number;
  remainingShiftWindow: number;
  suggestedLeaveHours: number;
  expectedFullDayAllocation: number;
  expectedFullDayPayable: number;
};

export const calculateShiftCompletionHelper = (input: { timeIn: string | null; timeOut: string | null }): ShiftCompletionHelper => {
  const attendanceSpan = attendanceSpanHours(input.timeIn, input.timeOut);
  const remainingShiftWindow = roundHours(Math.max(0, SHIFT_COMPLETION_CONFIG.shiftSpanHours - attendanceSpan));
  const suggestedLeaveHours = remainingShiftWindow === 0
    ? 0
    : roundHours(Math.max(0, remainingShiftWindow - SHIFT_COMPLETION_CONFIG.standardUnpaidBreakHours));

  return {
    attendanceSpan,
    remainingShiftWindow,
    suggestedLeaveHours,
    expectedFullDayAllocation: SHIFT_COMPLETION_CONFIG.expectedFullDayAllocation,
    expectedFullDayPayable: SHIFT_COMPLETION_CONFIG.expectedFullDayPayable,
  };
};
