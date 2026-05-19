import assert from "node:assert/strict";
import test from "node:test";
import { validateTimesheetEntryInput } from "@/src/lib/timesheets/validation";
import type { SaveTimesheetEntryInput, TimesheetActivityMode } from "@/src/lib/timesheets/types";

const baseInput = (): SaveTimesheetEntryInput => ({
  workDate: "2026-05-19",
  timeIn: "07:00",
  timeOut: "16:00",
  workMode: "factory",
  leaveType: null,
  leaveHours: 0,
  isPublicHoliday: false,
  unpaidBreak: true,
  paidBreak: true,
  activities: [{ projectId: "p-f", taskId: "t-f", workMode: "factory", hours: 8, clientDescription: null, internalNote: null }],
});
const byLocation = (f: string[], s: string[], o: string[]) => new Map<TimesheetActivityMode, Set<string>>([
  ["factory", new Set(f)],
  ["site", new Set(s)],
  ["office", new Set(o)],
]);

test("factory allows only factory/all lookups", () => {
  const input = baseInput();
  assert.doesNotThrow(() => validateTimesheetEntryInput(input, new Set(["p-f", "p-s"]), new Set(["t-f", "t-all"]), byLocation(["p-f"], ["p-s"], []), byLocation(["t-f", "t-all"], ["t-all"], [])));
  assert.throws(() => validateTimesheetEntryInput({ ...input, activities: [{ ...input.activities[0], projectId: "p-s" }] }, new Set(["p-f", "p-s"]), new Set(["t-f", "t-all"]), byLocation(["p-f"], ["p-s"], []), byLocation(["t-f", "t-all"], ["t-all"], [])), /Project is not available/);
});

test("mixed validates per-row location", () => {
  const input = { ...baseInput(), workMode: "mixed" as const, activities: [
    { projectId: "p-f", taskId: "t-f", workMode: "factory" as const, hours: 4 },
    { projectId: "p-o", taskId: "t-all", workMode: "office" as const, hours: 4 },
  ] };
  assert.doesNotThrow(() => validateTimesheetEntryInput(input, new Set(["p-f", "p-o"]), new Set(["t-f", "t-all"]), byLocation(["p-f"], [], ["p-o"]), byLocation(["t-f", "t-all"], ["t-all"], ["t-all"])));
  assert.throws(() => validateTimesheetEntryInput({ ...input, activities: [{ projectId: "p-f", taskId: "t-f", workMode: "office", hours: 4 }, input.activities[1]] }, new Set(["p-f", "p-o"]), new Set(["t-f", "t-all"]), byLocation(["p-f"], [], ["p-o"]), byLocation(["t-f", "t-all"], ["t-all"], ["t-all"])), /Project is not available/);
});

test("leave and public holiday require imported costcode availability", () => {
  const leave = { ...baseInput(), leaveType: "annual" as const, leaveHours: 1, activities: [{ projectId: "p-f", taskId: "t-f", workMode: "factory", hours: 7 }] };
  assert.doesNotThrow(() => validateTimesheetEntryInput(leave, new Set(["p-f"]), new Set(["t-f"]), byLocation(["p-f"], [], []), byLocation(["t-f"], [], []), new Set(["LA"]), true));
  assert.throws(() => validateTimesheetEntryInput(leave, new Set(["p-f"]), new Set(["t-f"]), byLocation(["p-f"], [], []), byLocation(["t-f"], [], []), new Set(), true), /leave type is unavailable/i);
  assert.throws(() => validateTimesheetEntryInput({ ...baseInput(), isPublicHoliday: true }, new Set(["p-f"]), new Set(["t-f"]), undefined, undefined, new Set(["LA"]), false), /PUHO/);
});

test("special costcodes cannot be used as normal activity tasks", () => {
  const input = baseInput();
  assert.throws(
    () =>
      validateTimesheetEntryInput(
        input,
        new Set(["p-f"]),
        new Set(["t-f"]),
        byLocation(["p-f"], [], []),
        byLocation(["t-f"], [], []),
        new Set(["LA"]),
        true,
        new Map([["t-f", "LA"]]),
      ),
    /Special timesheet costcodes/,
  );
});


test("single work-location rows validate independently of profile staff group", () => {
  const siteInput = { ...baseInput(), workMode: "site" as const, activities: [{ projectId: "p-site", taskId: "t-site", workMode: "site" as const, hours: 8 }] };
  const officeInput = { ...baseInput(), workMode: "office" as const, activities: [{ projectId: "p-office", taskId: "t-office", workMode: "office" as const, hours: 8 }] };

  assert.doesNotThrow(() =>
    validateTimesheetEntryInput(
      siteInput,
      new Set(["p-site", "p-office"]),
      new Set(["t-site", "t-office"]),
      byLocation([], ["p-site"], ["p-office"]),
      byLocation([], ["t-site"], ["t-office"]),
    ),
  );

  assert.doesNotThrow(() =>
    validateTimesheetEntryInput(
      officeInput,
      new Set(["p-site", "p-office"]),
      new Set(["t-site", "t-office"]),
      byLocation([], ["p-site"], ["p-office"]),
      byLocation([], ["t-site"], ["t-office"]),
    ),
  );

  assert.throws(() =>
    validateTimesheetEntryInput(
      { ...siteInput, activities: [{ ...siteInput.activities[0], projectId: "p-office" }] },
      new Set(["p-site", "p-office"]),
      new Set(["t-site", "t-office"]),
      byLocation([], ["p-site"], ["p-office"]),
      byLocation([], ["t-site"], ["t-office"]),
    ),
  /Project is not available/);
});
