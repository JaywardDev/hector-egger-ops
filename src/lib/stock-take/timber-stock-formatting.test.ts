import assert from "node:assert/strict";
import test from "node:test";

import {
  buildStockTakeExportHref,
  formatStockLocationLabel,
  formatTimberStockLabel,
  NO_LOCATION_RECORDED_LABEL,
} from "./timber-stock-formatting";

test("null stock location displays a clear no-location label", () => {
  assert.equal(formatStockLocationLabel(null), NO_LOCATION_RECORDED_LABEL);
});

test("location display includes code when available", () => {
  assert.equal(
    formatStockLocationLabel({ name: "Main Yard", code: "MY" }),
    "Main Yard (MY)",
  );
});

test("timber stock label prefers generated spec label and includes item code", () => {
  assert.equal(
    formatTimberStockLabel({
      name: "Fallback name",
      itemCode: "T-90-45",
      timberSpec: {
        thickness_mm: 90,
        width_mm: 45,
        length_mm: 6000,
        grade: "SG8",
        treatment: "H1.2",
      },
    }),
    "90x45 SG8 H1.2 6000 · T-90-45",
  );
});

test("export href targets latest finalized session when available", () => {
  assert.equal(
    buildStockTakeExportHref({ id: "11111111-1111-4111-8111-111111111111" }),
    "/stock-take/11111111-1111-4111-8111-111111111111/export",
  );
});

test("export href is absent when there is no finalized session", () => {
  assert.equal(buildStockTakeExportHref(null), null);
});
