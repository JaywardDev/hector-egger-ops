import assert from "node:assert/strict";
import test from "node:test";
import { calculateAllocationHours, calculatePayableHours, derivePaidBreakEntitlement, validateTimesheetEntryInput } from "@/src/lib/timesheets/validation";
import type { SaveTimesheetEntryInput, TimesheetActivityMode } from "@/src/lib/timesheets/types";

const baseInput = (): SaveTimesheetEntryInput => ({
  workDate: "2026-05-19",
  timeIn: "07:00",
  timeOut: "16:00",
  workMode: "factory",
  leaveType: null,
  leaveHours: 0,
  isPublicHoliday: false,
  fullDayLeave: false,
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

test("normal leave allocation uses leaveHours only with no hidden +8", () => {
  const fullDayLeave = {
    ...baseInput(),
    timeOut: "15:00",
    leaveType: "annual" as const,
    leaveHours: 8,
    paidBreak: false,
    unpaidBreak: false,
    activities: [],
  };
  assert.equal(calculateAllocationHours(fullDayLeave), 8);
  assert.doesNotThrow(() =>
    validateTimesheetEntryInput(
      fullDayLeave,
      new Set(["p-f"]),
      new Set(["t-f"]),
      byLocation(["p-f"], [], []),
      byLocation(["t-f"], [], []),
      new Set(["LA"]),
      true,
    ),
  );

  const partialLeave = { ...fullDayLeave, leaveHours: 4 };
  assert.equal(calculateAllocationHours(partialLeave), 4);
});

test("inside-attendance paid break math examples hold", () => {
  const fullNormal = baseInput();
  assert.equal(calculatePayableHours(fullNormal), 8.5);
  assert.equal(derivePaidBreakEntitlement(fullNormal), true);
  assert.equal(calculateAllocationHours(fullNormal), 8);

  const fullNoUnpaid = { ...baseInput(), unpaidBreak: false, activities: [{ ...baseInput().activities[0], hours: 9 }] };
  assert.equal(calculatePayableHours(fullNoUnpaid), 9);
  assert.equal(derivePaidBreakEntitlement(fullNoUnpaid), true);

  const partialWithLeave = { ...baseInput(), timeOut: "12:00", unpaidBreak: false, leaveType: "annual" as const, leaveHours: 3.5, paidBreak: true, activities: [{ ...baseInput().activities[0], hours: 1 }] };
  const validatedPartial = validateTimesheetEntryInput(partialWithLeave, new Set(["p-f"]), new Set(["t-f"]), byLocation(["p-f"], [], []), byLocation(["t-f"], [], []), new Set(["LA"]), true);
  assert.equal(validatedPartial.payableHours, 5);
  assert.equal(validatedPartial.leaveHours, 3.5);
  assert.equal(validatedPartial.paidBreak, true);
  assert.equal(validatedPartial.allocationHours, 4.5);

  const shortWithLeave = { ...baseInput(), timeOut: "15:00", unpaidBreak: false, leaveType: "annual" as const, leaveHours: 6, paidBreak: false, activities: [{ ...baseInput().activities[0], hours: 2 }] };
  const validatedShort = validateTimesheetEntryInput(shortWithLeave, new Set(["p-f"]), new Set(["t-f"]), byLocation(["p-f"], [], []), byLocation(["t-f"], [], []), new Set(["LA"]), true);
  assert.equal(validatedShort.allocationHours, 8);
  assert.equal(validatedShort.paidBreak, false);
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


test("derived paid break threshold model: 2.5h attendance is false and 3.0h is true", () => {
  assert.equal(derivePaidBreakEntitlement({ isPublicHoliday: false, timeIn: "07:00", timeOut: "09:30" }), false);
  assert.equal(derivePaidBreakEntitlement({ isPublicHoliday: false, timeIn: "07:00", timeOut: "10:00" }), true);
});

test("validation rejects non-30-minute attendance times", () => {
  const input = baseInput();
  assert.throws(
    () => validateTimesheetEntryInput({ ...input, timeIn: "09:31" }, new Set(["p-f"]), new Set(["t-f"]), byLocation(["p-f"], [], []), byLocation(["t-f"], [], [])),
    /30-minute boundaries/,
  );
  assert.throws(
    () => validateTimesheetEntryInput({ ...input, timeOut: "10:45" }, new Set(["p-f"]), new Set(["t-f"]), byLocation(["p-f"], [], []), byLocation(["t-f"], [], [])),
    /30-minute boundaries/,
  );
});


test("phase 3 paid break claimed validation scenarios", () => {
  const validProjectIds = new Set(["p-f"]);
  const validTaskIds = new Set(["t-f"]);
  const projectsByLoc = byLocation(["p-f"], [], []);
  const tasksByLoc = byLocation(["t-f"], [], []);

  assert.doesNotThrow(() => validateTimesheetEntryInput({ ...baseInput(), timeOut: "09:30", paidBreak: false, unpaidBreak: false, activities: [{ ...baseInput().activities[0], hours: 2.5 }] }, validProjectIds, validTaskIds, projectsByLoc, tasksByLoc));
  assert.throws(() => validateTimesheetEntryInput({ ...baseInput(), timeOut: "09:30", paidBreak: true, unpaidBreak: false, activities: [{ ...baseInput().activities[0], hours: 2.5 }] }, validProjectIds, validTaskIds, projectsByLoc, tasksByLoc), /3.0h attendance/);
  assert.doesNotThrow(() => validateTimesheetEntryInput({ ...baseInput(), timeOut: "10:00", paidBreak: false, unpaidBreak: false, activities: [{ ...baseInput().activities[0], hours: 3 }] }, validProjectIds, validTaskIds, projectsByLoc, tasksByLoc));
  assert.doesNotThrow(() => validateTimesheetEntryInput({ ...baseInput(), timeOut: "10:00", paidBreak: true, unpaidBreak: false, activities: [{ ...baseInput().activities[0], hours: 2.5 }] }, validProjectIds, validTaskIds, projectsByLoc, tasksByLoc));
  assert.doesNotThrow(() => validateTimesheetEntryInput({ ...baseInput(), timeOut: "10:30", paidBreak: true, unpaidBreak: false, activities: [{ ...baseInput().activities[0], hours: 3.0 }] }, validProjectIds, validTaskIds, projectsByLoc, tasksByLoc));

  const full = validateTimesheetEntryInput(baseInput(), validProjectIds, validTaskIds, projectsByLoc, tasksByLoc);
  assert.equal(full.payableHours, 8.5);
  assert.equal(full.allocationHours, 8.0);

  assert.throws(() => validateTimesheetEntryInput({ ...baseInput(), paidBreak: false, activities: [{ ...baseInput().activities[0], hours: 8 }] }, validProjectIds, validTaskIds, projectsByLoc, tasksByLoc), /Allocation must equal attendance span minus claimed paid break and unpaid break/);
});


test("full-day leave enforces fixed 8h and clears breaks", () => {
  const input = { ...baseInput(), fullDayLeave: true, leaveType: "annual" as const, leaveHours: 2, paidBreak: true, unpaidBreak: true, activities: [{ ...baseInput().activities[0], hours: 1 }] };
  const validated = validateTimesheetEntryInput(input, new Set(["p-f"]), new Set(["t-f"]), byLocation(["p-f"], [], []), byLocation(["t-f"], [], []), new Set(["LA"]), true);
  assert.equal(validated.payableHours, 8);
  assert.equal(validated.allocationHours, 8);
  assert.equal(validated.requiredAllocationHours, 8);
  assert.equal(validated.leaveHours, 8);
  assert.equal(validated.paidBreak, false);
  assert.equal(validated.unpaidBreak, false);
  assert.equal(validated.activities.length, 0);
});
