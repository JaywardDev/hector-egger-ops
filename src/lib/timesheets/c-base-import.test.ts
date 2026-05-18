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

test("buildings accepts native boolean TIMESHEET flags", () => {
  const result = parseSourceRows(
    [{ rowNumber: 2, values: { PRODUCTION_SEQUENCE: "P1", TITLE: "Proj 1", DISPLAYAS: "1", TIMESHEET_SITE: true, TIMESHEET_FACTORY: false, TIMESHEET_OFFICE: true } }],
    "buildings",
  );
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.parsed[0]?.visibleToStaffGroups, ["site", "office"]);
});

test("buildings accepts lowercase and whitespace boolean strings", () => {
  const result = parseSourceRows(
    [{ rowNumber: 2, values: { PRODUCTION_SEQUENCE: "P1", TITLE: "Proj 1", DISPLAYAS: "1", TIMESHEET_SITE: " true ", TIMESHEET_FACTORY: " false ", TIMESHEET_OFFICE: "TRUE" } }],
    "buildings",
  );
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.parsed[0]?.visibleToStaffGroups, ["site", "office"]);
});

test("buildings rejects numeric and numeric-string TIMESHEET flags", () => {
  const numericResult = parseSourceRows(
    [{ rowNumber: 2, values: { PRODUCTION_SEQUENCE: "P1", TITLE: "Proj 1", DISPLAYAS: "1", TIMESHEET_SITE: "1", TIMESHEET_FACTORY: "0", TIMESHEET_OFFICE: "FALSE" } }],
    "buildings",
  );
  assert.equal(numericResult.errors.some((error) => error.field === "TIMESHEET_SITE"), true);
  assert.equal(numericResult.errors.some((error) => error.field === "TIMESHEET_FACTORY"), true);
});

test("department ALL maps all staff groups", () => {
  const result = parseSourceRows([{ rowNumber: 2, values: { COSTCODE_ID: "T2", Description: "Task 2", DisplayAs: "1", Department: "ALL" } }], "costcodes");
  assert.deepEqual(result.parsed[0]?.visibleToStaffGroups, ["factory", "site", "office"]);
});

test("buildings rejects boolean in code field", () => {
  const result = parseSourceRows(
    [{ rowNumber: 2, values: { PRODUCTION_SEQUENCE: true, TITLE: "Proj 1", DISPLAYAS: "1", TIMESHEET_SITE: "TRUE", TIMESHEET_FACTORY: "FALSE", TIMESHEET_OFFICE: "FALSE" } }],
    "buildings",
  );
  assert.equal(result.errors.some((error) => error.field === "code" && error.message === "Code is required."), true);
});

test("costcodes rejects boolean in label field", () => {
  const result = parseSourceRows([{ rowNumber: 2, values: { COSTCODE_ID: "T1", Description: false, DisplayAs: "1", Department: "ALL" } }], "costcodes");
  assert.equal(result.errors.some((error) => error.field === "label" && error.message === "Label is required."), true);
});

test("costcodes string code/label fields still pass", () => {
  const result = parseSourceRows([{ rowNumber: 2, values: { COSTCODE_ID: "T3", Description: "Task 3", DisplayAs: "1", Department: "Factory" } }], "costcodes");
  assert.deepEqual(result.errors, []);
  assert.equal(result.parsed[0]?.code, "T3");
  assert.equal(result.parsed[0]?.label, "Task 3");
});
