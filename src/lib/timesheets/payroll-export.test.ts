import assert from "node:assert/strict";
import test from "node:test";
import { aggregatePayrollExport, formatWeekEndingForPayroll, PAYROLL_EXPORT_HEADERS } from "@/src/lib/timesheets/payroll-export";

const baseEntry = {
  profile_id: "p1",
  payable_hours: 8.5,
  leave_type: null,
  leave_hours: 0,
  profile: { full_name: "Ada Lovelace", email: "ada@example.com" },
} as const;

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

test("40 and 48 hour totals", () => {
  const rows = aggregatePayrollExport({ weekEnding: "2026-05-24", entries: [
    { ...baseEntry, profile_id: "p1", payable_hours: 40 },
    { ...baseEntry, profile_id: "p2", payable_hours: 48, profile: { full_name: "Bob", email: "bob@example.com" } },
  ] });
  assert.equal(rows[0]?.totalHourWorked, 40);
  assert.equal(rows[1]?.totalHourWorked, 48);
});

test("formats NZ week ending dd/mm/yyyy", () => {
  assert.equal(formatWeekEndingForPayroll("2026-05-24"), "24/05/2026");
});
