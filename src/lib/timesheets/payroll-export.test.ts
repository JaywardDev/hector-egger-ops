import assert from "node:assert/strict";
import test from "node:test";
import { aggregatePayrollExport, formatWeekEndingForPayroll, PAYROLL_EXPORT_HEADERS, PAYROLL_EXPORT_INCLUDED_STATUSES } from "@/src/lib/timesheets/payroll-export";

const baseEntry = {
  profile_id: "p1",
  payable_hours: 8.5,
  is_public_holiday: false,
  leave_type: null,
  leave_hours: 0,
  profile: { full_name: "Ada Lovelace", email: "ada@example.com" },
} as const;



test("payroll export eligibility only includes final approved timesheets", () => {
  assert.deepEqual(PAYROLL_EXPORT_INCLUDED_STATUSES, ["approved"]);
  assert.equal(PAYROLL_EXPORT_INCLUDED_STATUSES.includes("supervisor_approved" as never), false);
  assert.equal(PAYROLL_EXPORT_INCLUDED_STATUSES.includes("submitted" as never), false);
  assert.equal(PAYROLL_EXPORT_INCLUDED_STATUSES.includes("returned" as never), false);
});
test("header order is exact", () => {
  assert.deepEqual(PAYROLL_EXPORT_HEADERS, ["WEEK_ENDING", "EMPLOYEE_NAME", "TOTAL_HOUR_WORKED", "COSTCODE", "TOTAL_WORKED_ON_LEAVE", "DESCRIPTION_CHARGEUP", "COMMENT_OTHER"]);
});

test("42.5 and leave aggregation", () => {
  const rows = aggregatePayrollExport({ weekEnding: "2026-05-24", entries: [
    ...Array.from({ length: 5 }, () => ({ ...baseEntry })),
    { ...baseEntry, payable_hours: 0, leave_type: "sick" as const, leave_hours: 2 },
    { ...baseEntry, payable_hours: 0, leave_type: "sick" as const, leave_hours: 1 },
    { ...baseEntry, payable_hours: 0, leave_type: "unpaid" as const, leave_hours: 4 },
  ] });
  assert.equal(rows[0]?.totalHourWorked, 42.5);
  assert.equal(rows[0]?.leaveRows.find((r) => r.leaveType === "sick")?.leaveHours, 3);
  assert.equal(rows[0]?.leaveRows.find((r) => r.leaveType === "unpaid")?.leaveHours, 4);
});

test("all supported leave types are exported with payroll mappings", () => {
  const rows = aggregatePayrollExport({ weekEnding: "2026-05-24", entries: [
    { ...baseEntry, payable_hours: 0, leave_type: "annual" as const, leave_hours: 8 },
    { ...baseEntry, payable_hours: 0, leave_type: "sick" as const, leave_hours: 8 },
    { ...baseEntry, payable_hours: 0, leave_type: "bereavement" as const, leave_hours: 8 },
    { ...baseEntry, payable_hours: 0, leave_type: "unpaid" as const, leave_hours: 8 },
    { ...baseEntry, payable_hours: 0, leave_type: "other" as const, leave_hours: 8 },
  ] });

  const leaveRows = rows[0]?.leaveRows ?? [];
  assert.deepEqual(
    leaveRows.map((row) => ({ leaveType: row.leaveType, costCode: row.costCode, commentOther: row.commentOther })),
    [
      { leaveType: "annual", costCode: "LA - Leave Annual", commentOther: "Leave Annual" },
      { leaveType: "bereavement", costCode: "LB - Leave Bereavement", commentOther: "Leave Bereavement" },
      { leaveType: "other", costCode: "TIL - Time In Lieu", commentOther: "Time In Lieu" },
      { leaveType: "sick", costCode: "LS - Leave Sick", commentOther: "Leave Sick" },
      { leaveType: "unpaid", costCode: "LW - Leave Without Pay", commentOther: "Leave Without Pay" },
    ],
  );
});

test("multiple leave types in same week create separate leave rows", () => {
  const rows = aggregatePayrollExport({ weekEnding: "2026-05-24", entries: [
    { ...baseEntry, payable_hours: 0, leave_type: "annual" as const, leave_hours: 4 },
    { ...baseEntry, payable_hours: 0, leave_type: "other" as const, leave_hours: 2.5 },
    { ...baseEntry, payable_hours: 0, leave_type: "annual" as const, leave_hours: 3 },
  ] });

  const annual = rows[0]?.leaveRows.find((row) => row.leaveType === "annual");
  const other = rows[0]?.leaveRows.find((row) => row.leaveType === "other");
  assert.equal(annual?.leaveHours, 7);
  assert.equal(other?.leaveHours, 2.5);
  assert.equal(rows[0]?.leaveRows.length, 2);
});

test("40 and 48 hour totals", () => {
  const rows = aggregatePayrollExport({ weekEnding: "2026-05-24", entries: [
    { ...baseEntry, profile_id: "p1", payable_hours: 40 },
    { ...baseEntry, profile_id: "p2", payable_hours: 48, profile: { full_name: "Bob", email: "bob@example.com" } },
  ] });
  assert.equal(rows[0]?.totalHourWorked, 40);
  assert.equal(rows[1]?.totalHourWorked, 48);
});


test("public holiday creates a dedicated PUHO detail row aggregated by payable hours", () => {
  const rows = aggregatePayrollExport({ weekEnding: "2026-05-24", entries: [
    { ...baseEntry, is_public_holiday: true, payable_hours: 8 },
    { ...baseEntry, is_public_holiday: true, payable_hours: 8 },
    { ...baseEntry, is_public_holiday: false, payable_hours: 8.5 },
  ] });

  const puho = rows[0]?.leaveRows.find((row) => row.leaveType === "public_holiday");
  assert.equal(puho?.costCode, "PUHO - Public Holiday");
  assert.equal(puho?.leaveHours, 16);
  assert.equal(puho?.commentOther, "Public Holiday");
  assert.equal(rows[0]?.totalHourWorked, 24.5);
});

test("formats NZ week ending dd/mm/yyyy", () => {
  assert.equal(formatWeekEndingForPayroll("2026-05-24"), "24/05/2026");
});
