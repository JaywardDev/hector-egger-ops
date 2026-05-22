import assert from "node:assert/strict";
import test from "node:test";
import { shouldDisableBreakFields, shouldDisablePaidBreakControl } from "@/src/lib/timesheets/daily-timesheet-ui-rules";

test("partial-day leave does not disable break controls", () => {
  assert.equal(
    shouldDisableBreakFields({
      canEdit: true,
      isPublicHolidayMode: false,
      isFullDayLeaveMode: false,
    }),
    false,
  );
});

test("full day leave disables break controls", () => {
  assert.equal(
    shouldDisableBreakFields({
      canEdit: true,
      isPublicHolidayMode: false,
      isFullDayLeaveMode: true,
    }),
    true,
  );
});

test("public holiday disables break controls", () => {
  assert.equal(
    shouldDisableBreakFields({
      canEdit: true,
      isPublicHolidayMode: true,
      isFullDayLeaveMode: false,
    }),
    true,
  );
});

test("paid break remains disabled when ineligible", () => {
  assert.equal(
    shouldDisablePaidBreakControl({
      disableBreakFields: false,
      paidBreakEligible: false,
    }),
    true,
  );
});
