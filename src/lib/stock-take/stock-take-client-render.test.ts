import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import Module from "node:module";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { ADD_MATERIAL_FIELDS } from "@/src/lib/stock-take/ui-contract";
import type { StockAreaRecord, TimberMaterialRecord, TimberStockWorkingRow } from "@/src/lib/stock-take/types";

const originalLoad = Module._load;
Module._load = function loadWithServerOnlyStub(request, parent, isMain) {
  if (request === "server-only") {
    return {};
  }
  return originalLoad.call(this, request, parent, isMain);
};

const area: StockAreaRecord = {
  id: "area-1",
  name: "Main Yard",
  is_active: true,
  created_by_profile_id: null,
  created_at: "2026-06-09T00:00:00.000Z",
  updated_at: "2026-06-09T00:00:00.000Z",
};

const material: TimberMaterialRecord = {
  id: "timber-1",
  height: "45",
  width: "90",
  length: "6.0m",
  grade: "SG8",
  treatment: "H1.2",
  name: "45x90 SG8 H1.2 6.0m",
  is_active: true,
  created_at: "2026-06-09T00:00:00.000Z",
  updated_at: "2026-06-09T00:00:00.000Z",
};

const existingRow: TimberStockWorkingRow = {
  id: "row-1",
  area_id: area.id,
  timber_material_id: material.id,
  timber_name: material.name,
  bay: "A1",
  level: "Top",
  quantity: 10,
  updated_by_profile_id: null,
  created_at: "2026-06-09T00:00:00.000Z",
  updated_at: "2026-06-09T00:00:00.000Z",
};

test("stock-take client renders add-material fields with an existing row", async () => {
  const { StockTakeClient } = await import("@/app/(protected)/stock-take/components/stock-take-client");
  const html = renderToStaticMarkup(
    createElement(StockTakeClient, {
      areas: [area],
      materials: [material],
      initialAreaId: area.id,
      initialRows: [existingRow],
    }),
  );

  assert.match(html, /Add new material/);
  assert.match(html, /45x90 SG8 H1.2 6.0m/);

  for (const field of ADD_MATERIAL_FIELDS.map((label) => label.toLowerCase())) {
    assert.match(html, new RegExp(`id="${field}"`));
    assert.match(html, new RegExp(`name="${field}"`));
  }
});

test("add-material height then width typing captures event values before React clears currentTarget", async () => {
  const { readStockTakeChangeValue } = await import("@/app/(protected)/stock-take/components/stock-take-client");
  const consoleErrors: unknown[] = [];
  const originalConsoleError = console.error;
  const draft = { height: "", width: "", length: "", grade: "", treatment: "" };

  console.error = (...args: unknown[]) => {
    consoleErrors.push(args);
  };

  try {
    const typeField = (field: keyof typeof draft, value: string) => {
      const event = { currentTarget: { value }, target: null };
      const nextValue = readStockTakeChangeValue(event);

      event.currentTarget = null;
      draft[field] = nextValue;
    };

    typeField("height", "45");
    typeField("width", "90");
  } finally {
    console.error = originalConsoleError;
  }

  assert.deepEqual(draft, { height: "45", width: "90", length: "", grade: "", treatment: "" });
  assert.deepEqual(consoleErrors, []);
});

test("stock-take change value helper tolerates missing currentTarget and target", async () => {
  const { readStockTakeChangeValue } = await import("@/app/(protected)/stock-take/components/stock-take-client");

  assert.doesNotThrow(() => readStockTakeChangeValue({ currentTarget: null, target: null }));
  assert.equal(readStockTakeChangeValue({ currentTarget: null, target: null }), "");
  assert.equal(readStockTakeChangeValue({ currentTarget: null, target: { value: "90" } as never }), "90");
});

test("stock-take focus helper tolerates a missing querySelector match", async () => {
  const { focusStockTakeBayInput } = await import("@/app/(protected)/stock-take/components/stock-take-client");
  const root = {
    querySelector() {
      return null;
    },
  } as unknown as ParentNode;

  assert.doesNotThrow(() => focusStockTakeBayInput("missing-row", root));
  assert.equal(focusStockTakeBayInput("missing-row", root), false);
});

test("stock-take client isolates add-material typing from working-list dirty comparison", () => {
  const source = readFileSync("app/(protected)/stock-take/components/stock-take-client.tsx", "utf8");

  assert.match(
    source,
    /const changedRowCount = useMemo\(\(\) => countChangedStockTakeRows\(loadedRows, rows\), \[loadedRows, rows\]\)/,
  );
  assert.doesNotMatch(
    source,
    /countChangedStockTakeRows\(loadedRows, rows\);/,
  );
  assert.match(source, /const visibleRows = useMemo\(/);
  assert.match(source, /\[namesById, rows, search\]/);
  assert.match(source, /const stockRowsPayload = useMemo\(/);
  assert.match(source, /const stockRowsPayloadJson = useMemo\(\(\) => JSON\.stringify\(stockRowsPayload\), \[stockRowsPayload\]\)/);
  assert.match(source, /name="rows" value=\{stockRowsPayloadJson\}/);
});

test("add-material typing uses local draft state and does not wire server actions to normal input changes", () => {
  const source = readFileSync("app/(protected)/stock-take/components/stock-take-client.tsx", "utf8");

  assert.match(source, /value=\{materialPreviewInput\[key\]\}/);
  assert.match(source, /const nextValue = readStockTakeChangeValue\(event\);/);
  assert.match(source, /\[key\]: nextValue/);
  assert.doesNotMatch(source, /currentTarget\.value|target\.value/);
  assert.match(source, /<form action=\{addMaterialAction\}/);
  assert.doesNotMatch(source, /onChange=\{addMaterialAction\}/);
  assert.doesNotMatch(source, /formAction=\{addMaterialAction\}/);
});
