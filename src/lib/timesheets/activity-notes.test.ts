import assert from "node:assert/strict";
import test from "node:test";
import { hasActivityNotes, toClientSafeTimesheetActivity } from "@/src/lib/timesheets/activity-notes";
import type { TimesheetActivityRecord } from "@/src/lib/timesheets/types";

const base = (): TimesheetActivityRecord => ({
  id: "a1", entry_id: "e1", project_id: "p1", task_id: "t1", project_code_snapshot: null, project_label_snapshot: null, task_code_snapshot: null, task_label_snapshot: null,
  work_mode: "factory", hours: 2, sort_order: 0, client_description: "client ok", internal_note: "secret",
});

test("client safe formatter strips internal_note", () => {
  const safe = toClientSafeTimesheetActivity(base());
  assert.equal("internal_note" in safe, false);
  assert.equal(safe.client_description, "client ok");
});

test("hasActivityNotes is true when either note is present", () => {
  assert.equal(hasActivityNotes({ client_description: " ", internal_note: "x" }), true);
  assert.equal(hasActivityNotes({ client_description: "x", internal_note: null }), true);
  assert.equal(hasActivityNotes({ client_description: " ", internal_note: " " }), false);
});
