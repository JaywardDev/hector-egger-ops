import assert from "node:assert/strict";
import test from "node:test";
import { TIMESHEET_STATUS_LABELS } from "@/src/lib/timesheets/formatting";

test("status labels distinguish supervisor reviewed and approved", () => {
  assert.equal(TIMESHEET_STATUS_LABELS.supervisor_approved, "Supervisor reviewed");
  assert.equal(TIMESHEET_STATUS_LABELS.approved, "Approved");
});
