import assert from "node:assert/strict";
import test from "node:test";
import { isFinalApprovableStatus } from "@/src/lib/timesheets/final-approval-rules";

test("final approval only allows supervisor reviewed entries", () => {
  assert.equal(isFinalApprovableStatus("supervisor_approved"), true);
  assert.equal(isFinalApprovableStatus("submitted"), false);
  assert.equal(isFinalApprovableStatus("returned"), false);
  assert.equal(isFinalApprovableStatus("approved"), false);
});
