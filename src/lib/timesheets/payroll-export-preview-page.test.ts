import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

import { PAYROLL_EXPORT_HEADERS } from "@/src/lib/timesheets/payroll-export";
import { buildPreviewRows } from "@/app/(protected)/admin/payroll-export/page";

const PAGE_PATH = "app/(protected)/admin/payroll-export/page.tsx";
const ROUTE_PATH = "app/(protected)/admin/payroll-export/export/route.ts";

test("preview row builder matches logical payroll export row structure", () => {
  const rows = buildPreviewRows("2026-05-24", [
    {
      weekEnding: "2026-05-24",
      employeeName: "Ada",
      totalHourWorked: 42.5,
      descriptionChargeup: "ORDINARY HOURS",
      leaveRows: [
        { leaveType: "sick", costCode: "LS - Leave Sick", leaveHours: 8, commentOther: "Leave Sick" },
      ],
    },
  ]);

  assert.equal(rows.length, 2);
  assert.deepEqual(Object.keys(rows[0] ?? {}), [
    "weekEnding",
    "employeeName",
    "totalHourWorked",
    "costCode",
    "totalWorkedOnLeave",
    "descriptionChargeup",
    "commentOther",
  ]);
  assert.equal(rows[0]?.employeeName, "Ada");
  assert.equal(rows[1]?.employeeName, "");
  assert.equal(rows[1]?.costCode, "LS - Leave Sick");
  assert.equal(rows[1]?.totalWorkedOnLeave, 8);
});

test("payroll export page renders preview button and uses shared payroll export data source", () => {
  const source = readFileSync(PAGE_PATH, "utf8");

  assert.match(source, /Preview<\/button>/);
  assert.match(source, /getPayrollExportData\(session, selectedWeekEnding\)/);
  for (const header of PAYROLL_EXPORT_HEADERS) {
    assert.match(source, new RegExp(header));
  }
});

test("preview path stays admin-only and does not build xlsx", () => {
  const source = readFileSync(PAGE_PATH, "utf8");
  assert.match(source, /requireAdminAccess\(\)/);
  assert.equal(source.includes("buildPayrollExportXlsx"), false);
});

test("xlsx export route still uses getPayrollExportData and buildPayrollExportXlsx", () => {
  const source = readFileSync(ROUTE_PATH, "utf8");

  assert.match(source, /const data = await getPayrollExportData\(session, weekEnding\)/);
  assert.match(source, /const workbook = buildPayrollExportXlsx\(data\.weekEnding, data\.rows\)/);
});
