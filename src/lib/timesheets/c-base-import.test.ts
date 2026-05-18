import assert from "node:assert/strict";
import test from "node:test";

import { parseSourceRows } from "@/src/lib/timesheets/c-base-import";

test("costcodes rejects invalid Department", () => {
  const result = parseSourceRows([{ rowNumber: 2, values: { COSTCODE_ID: "T1", Description: "Task 1", DisplayAs: "1", Department: "Invalid" } }], "costcodes");
  assert.equal(result.errors.some((error) => error.field === "Department"), true);
});

test("buildings rejects non-boolean TIMESHEET flags", () => {
  const result = parseSourceRows([{ rowNumber: 2, values: { PRODUCTION_SEQUENCE: "P1", TITLE: "Proj 1", DISPLAYAS: "1", TIMESHEET_SITE: "yes", TIMESHEET_FACTORY: "FALSE", TIMESHEET_OFFICE: "FALSE" } }], "buildings");
  assert.equal(result.errors.some((error) => error.field === "TIMESHEET_SITE"), true);
});

test("department ALL maps all staff groups", () => {
  const result = parseSourceRows([{ rowNumber: 2, values: { COSTCODE_ID: "T2", Description: "Task 2", DisplayAs: "1", Department: "ALL" } }], "costcodes");
  assert.deepEqual(result.parsed[0]?.visibleToStaffGroups, ["factory", "site", "office"]);
});
