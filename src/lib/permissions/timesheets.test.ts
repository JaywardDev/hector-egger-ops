import assert from "node:assert/strict";
import test from "node:test";
import { canFinalApproveTimesheets } from "@/src/lib/permissions/timesheets";

test("final approval requires admin role", () => {
  assert.equal(canFinalApproveTimesheets({ accountStatus: "approved", roles: ["admin"] }), true);
  assert.equal(canFinalApproveTimesheets({ accountStatus: "approved", roles: ["supervisor"] }), false);
  assert.equal(canFinalApproveTimesheets({ accountStatus: "approved", roles: ["operator"] }), false);
});
