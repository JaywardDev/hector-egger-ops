import assert from "node:assert/strict";
import test from "node:test";

import { buildProductionSourceRowHash, prepareProductionImport } from "@/src/lib/production/import-server";

test("row hash is deterministic", () => {
  const row = { b: "2", a: "1" };
  const first = buildProductionSourceRowHash("daily_registry", row);
  const second = buildProductionSourceRowHash("daily_registry", { a: "1", b: "2" });
  assert.equal(first, second);
});

test("prepare does not write and returns metadata", async () => {
  const csv = Buffer.from(
    "Date,Operator,Start Time,Finish Time,Project File,Project Sequence,Project Name,Time Remaining Start,Time Remaining End,Actual Volume Cut m3,Downtime Hours,Downtime Reason,Interruption Hours,Interruption Reason\n2026-01-01,Op One,06:00,14:00,PF,1,Project A,02:00:00,01:30:00,1.2,0,,0,"
  );
  const prepared = await prepareProductionImport(csv);
  assert.equal(prepared.summary.rowCount, 1);
  assert.equal(typeof prepared.normalizedRows[0].source_row_hash, "string");
});

test("downtime and interruption remain separate fields", async () => {
  const csv = Buffer.from(
    "Date,Operator,Start Time,Finish Time,Project File,Project Sequence,Project Name,Time Remaining Start,Time Remaining End,Actual Volume Cut m3,Downtime Hours,Downtime Reason,Interruption Hours,Interruption Reason\n2026-01-01,Op One,06:00,14:00,PF,1,Project A,02:00:00,01:30:00,1.2,1,Maintenance,2,Wrong Project"
  );
  const prepared = await prepareProductionImport(csv);
  assert.equal(prepared.normalizedRows[0].downtime_reason_label, "Maintenance");
  assert.equal(prepared.normalizedRows[0].interruption_reason_label, "Wrong Project");
});

test("csv parser supports commas and escaped quotes inside quoted fields", async () => {
  const csv = Buffer.from(
    'Date,Operator,Start Time,Finish Time,Project File,Project Sequence,Project Name,Time Remaining Start,Time Remaining End,Actual Volume Cut m3,Downtime Hours,Downtime Reason,Interruption Hours,Interruption Reason\n2026-01-01,Op One,06:00,14:00,PF,1,Project A,02:00:00,01:30:00,1.2,1,"Maintenance, line 1 ""urgent""",2,"Wrong Project, staging"'
  );
  const prepared = await prepareProductionImport(csv);
  assert.equal(prepared.normalizedRows[0].downtime_reason_label, 'Maintenance, line 1 "urgent"');
  assert.equal(prepared.normalizedRows[0].interruption_reason_label, "Wrong Project, staging");
});

test("duplicate source rows in one payload produce row-scoped errors", async () => {
  const csv = Buffer.from(
    "Date,Operator,Start Time,Finish Time,Project File,Project Sequence,Project Name,Time Remaining Start,Time Remaining End,Actual Volume Cut m3,Downtime Hours,Downtime Reason,Interruption Hours,Interruption Reason\n2026-01-01,Op One,06:00,14:00,PF,1,Project A,02:00:00,01:30:00,1.2,0,,0,\n2026-01-01,Op One,06:00,14:00,PF,1,Project A,02:00:00,01:30:00,1.2,0,,0,"
  );
  const prepared = await prepareProductionImport(csv);
  assert.equal(prepared.validationErrors.some((error) => error.code === "duplicate_source_row"), true);
});

test("prepare validates invalid date and number fields before RPC", async () => {
  const csv = Buffer.from(
    "Date,Operator,Start Time,Finish Time,Project File,Project Sequence,Project Name,Time Remaining Start,Time Remaining End,Actual Volume Cut m3,Downtime Hours,Downtime Reason,Interruption Hours,Interruption Reason\nbad-date,Op One,06:00,14:00,PF,abc,Project A,02:00:00,bad,not-a-number,-1,,x,"
  );
  const prepared = await prepareProductionImport(csv);
  assert.equal(prepared.validationErrors.some((error) => error.field === "Date" && error.code === "required"), true);
  assert.equal(prepared.validationErrors.some((error) => error.field === "Project Sequence"), true);
  assert.equal(prepared.validationErrors.some((error) => error.field === "Actual Volume Cut m3"), true);
});
