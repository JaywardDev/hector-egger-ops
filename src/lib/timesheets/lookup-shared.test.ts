import assert from "node:assert/strict";
import test from "node:test";
import { getLeaveTaskOptions, hasPublicHolidayTask, isWorkActivityTask } from "@/src/lib/timesheets/lookup-shared";
import type { TimesheetLookups } from "@/src/lib/timesheets/types";

const lookups: TimesheetLookups = {
  projects: [],
  tasks: [
    { id: "t1", code: "LA", label: "Annual Leave", is_active: true, sort_order: 1, visible_to_staff_groups: ["factory"], source_system: "manual", source_row_hash: null, last_seen_at: null, inactive_reason: null, inactive_at: null },
    { id: "t2", code: "LS", label: "Sick Leave", is_active: true, sort_order: 2, visible_to_staff_groups: ["factory"], source_system: "manual", source_row_hash: null, last_seen_at: null, inactive_reason: null, inactive_at: null },
    { id: "t3", code: "PUHO", label: "Public Holiday", is_active: true, sort_order: 3, visible_to_staff_groups: ["factory"], source_system: "manual", source_row_hash: null, last_seen_at: null, inactive_reason: null, inactive_at: null },
    { id: "t4", code: "WK", label: "Standard Work", is_active: true, sort_order: 4, visible_to_staff_groups: ["factory"], source_system: "manual", source_row_hash: null, last_seen_at: null, inactive_reason: null, inactive_at: null },
  ],
};

test("normal work task filtering excludes leave and PUHO", () => {
  const codes = lookups.tasks.filter(isWorkActivityTask).map((task) => task.code);
  assert.deepEqual(codes, ["WK"]);
});

test("leave dropdown options still include mapped leave codes", () => {
  const leaveCodes = getLeaveTaskOptions(lookups).map((task) => task.code);
  assert.deepEqual(leaveCodes, ["LA", "LS"]);
});

test("public holiday availability still detects PUHO", () => {
  assert.equal(hasPublicHolidayTask(lookups), true);
});
