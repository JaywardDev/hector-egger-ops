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
  bay: "1",
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
  const { focusStockTakeRowField } = await import("@/app/(protected)/stock-take/components/stock-take-client");
  const root = {
    querySelector() {
      return null;
    },
  } as unknown as ParentNode;

  assert.doesNotThrow(() => focusStockTakeRowField("missing-row", "timber", root));
  assert.equal(focusStockTakeRowField("missing-row", "timber", root), false);
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
  assert.match(source, /getRowBayTabKey\(row\.bay\) === activeBay/);
  assert.match(source, /\[activeBay, namesById, rows, search\]/);
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


test("stock-take client renders default bay tabs and removes Bay from row headers", async () => {
  const { StockTakeClient } = await import("@/app/(protected)/stock-take/components/stock-take-client");
  const html = renderToStaticMarkup(
    createElement(StockTakeClient, {
      areas: [area],
      materials: [material],
      initialAreaId: area.id,
      initialRows: [],
    }),
  );

  assert.match(html, /Bay 1/);
  assert.match(html, /Bay 2/);
  assert.match(html, /aria-label="Add next bay"/);
  assert.match(html, /Search timber or level in this bay/);
  assert.match(html, />Timber<\/th>/);
  assert.match(html, />Level<\/th>/);
  assert.match(html, />Quantity<\/th>/);
  assert.doesNotMatch(html, />Bay<\/th>/);
});

test("stock-take client renders saved numeric, unusual, and unassigned bay tabs", async () => {
  const { StockTakeClient } = await import("@/app/(protected)/stock-take/components/stock-take-client");
  const makeRow = (id: string, bay: string): TimberStockWorkingRow => ({
    ...existingRow,
    id,
    bay,
  });
  const html = renderToStaticMarkup(
    createElement(StockTakeClient, {
      areas: [area],
      materials: [material],
      initialAreaId: area.id,
      initialRows: [makeRow("row-1", "1"), makeRow("row-2", "2"), makeRow("row-5", "5"), makeRow("row-a", "A1"), makeRow("row-blank", "")],
    }),
  );

  assert.match(html, /Bay 1/);
  assert.match(html, /Bay 2/);
  assert.match(html, /Bay 5/);
  assert.match(html, /Bay A1/);
  assert.match(html, /Unassigned/);
});

test("stock-take client source assigns active bay to new rows and preserves flat payload", () => {
  const source = readFileSync("app/(protected)/stock-take/components/stock-take-client.tsx", "utf8");

  assert.match(source, /bay: activeBay === UNASSIGNED_BAY_TAB \? "" : activeBay/);
  assert.match(source, /setFocusTarget\(\{ rowKey: newKey, field: "timber" \}\)/);
  assert.match(source, /setFocusTarget\(\{ rowKey: newKey, field: "level" \}\)/);
  assert.match(source, /timberMaterialId: row\.timberMaterialId,[\s\S]*bay: row\.bay,[\s\S]*level: row\.level,[\s\S]*quantity: row\.quantity/);
});
