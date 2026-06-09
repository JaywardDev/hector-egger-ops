import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import Module from "node:module";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

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
  assert.match(html, /name="height"/);
  assert.match(html, /name="width"/);
  assert.match(html, /45x90 SG8 H1.2 6.0m/);
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
  assert.match(source, /onChange=\{\(event\) =>\s*setMaterialPreviewInput/);
  assert.match(source, /<form action=\{addMaterialAction\}/);
  assert.doesNotMatch(source, /onChange=\{addMaterialAction\}/);
  assert.doesNotMatch(source, /formAction=\{addMaterialAction\}/);
});
