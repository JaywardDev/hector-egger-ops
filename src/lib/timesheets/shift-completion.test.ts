import assert from "node:assert/strict";
import test from "node:test";
import { calculateShiftCompletionHelper, SHIFT_COMPLETION_CONFIG } from "@/src/lib/timesheets/shift-completion";

test("07:00-12:00 suggests 3.5h leave", () => {
  const result = calculateShiftCompletionHelper({ timeIn: "07:00", timeOut: "12:00" });
  assert.equal(result.attendanceSpan, 5);
  assert.equal(result.remainingShiftWindow, 4);
  assert.equal(result.suggestedLeaveHours, 3.5);
});

test("07:00-14:00 suggests 1.5h leave", () => {
  const result = calculateShiftCompletionHelper({ timeIn: "07:00", timeOut: "14:00" });
  assert.equal(result.attendanceSpan, 7);
  assert.equal(result.remainingShiftWindow, 2);
  assert.equal(result.suggestedLeaveHours, 1.5);
});

test("07:00-11:00 suggests 4.5h leave", () => {
  const result = calculateShiftCompletionHelper({ timeIn: "07:00", timeOut: "11:00" });
  assert.equal(result.attendanceSpan, 4);
  assert.equal(result.remainingShiftWindow, 5);
  assert.equal(result.suggestedLeaveHours, 4.5);
});

test("07:00-16:00 suggests 0h leave", () => {
  const result = calculateShiftCompletionHelper({ timeIn: "07:00", timeOut: "16:00" });
  assert.equal(result.attendanceSpan, 9);
  assert.equal(result.remainingShiftWindow, 0);
  assert.equal(result.suggestedLeaveHours, 0);
});

test("no attendance suggests 8h leave", () => {
  const result = calculateShiftCompletionHelper({ timeIn: null, timeOut: null });
  assert.equal(result.attendanceSpan, 0);
  assert.equal(result.remainingShiftWindow, 9);
  assert.equal(result.suggestedLeaveHours, 8);
});

test("paid break claim does not affect helper values", () => {
  const result = calculateShiftCompletionHelper({ timeIn: "07:00", timeOut: "12:00" });
  assert.equal(result.suggestedLeaveHours, 3.5);
  assert.equal(result.expectedFullDayAllocation, SHIFT_COMPLETION_CONFIG.expectedFullDayAllocation);
  assert.equal(result.expectedFullDayPayable, SHIFT_COMPLETION_CONFIG.expectedFullDayPayable);
});
