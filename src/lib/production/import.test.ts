import assert from "node:assert/strict";
import test from "node:test";

import { normalizeTimeOfDay } from "@/src/lib/production/import";

test("normalizeTimeOfDay supports 24-hour values", () => {
  assert.equal(normalizeTimeOfDay("06:00"), "06:00:00");
  assert.equal(normalizeTimeOfDay("10:15"), "10:15:00");
  assert.equal(normalizeTimeOfDay("06:00:59"), "06:00:59");
});

test("normalizeTimeOfDay supports 12-hour AM/PM values", () => {
  assert.equal(normalizeTimeOfDay("6:00 AM"), "06:00:00");
  assert.equal(normalizeTimeOfDay("10:15 AM"), "10:15:00");
  assert.equal(normalizeTimeOfDay("12:00 AM"), "00:00:00");
  assert.equal(normalizeTimeOfDay("12:00 PM"), "12:00:00");
});

test("normalizeTimeOfDay rejects invalid clock values", () => {
  assert.equal(normalizeTimeOfDay("0:15 PM"), null);
  assert.equal(normalizeTimeOfDay("25:00"), null);
  assert.equal(normalizeTimeOfDay("11:90"), null);
  assert.equal(normalizeTimeOfDay("not-a-time"), null);
});
