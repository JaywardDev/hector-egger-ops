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

test("stock-take client renders compact stock-take actions without full modal forms by default", async () => {
  const { StockTakeClient } = await import("@/app/(protected)/stock-take/components/stock-take-client");
  const html = renderToStaticMarkup(
    createElement(StockTakeClient, {
      areas: [area],
      materials: [material],
      initialAreaId: area.id,
      initialRows: [existingRow],
    }),
  );

  assert.match(html, />Choose area</);
  assert.match(html, />Add new material</);
  assert.match(html, /Working list for Main Yard/);
  assert.match(html, /45x90 SG8 H1.2 6.0m/);
  assert.doesNotMatch(html, /id="area_selector"/);
  assert.doesNotMatch(html, /id="area_name"/);

  for (const field of ADD_MATERIAL_FIELDS.map((label) => label.toLowerCase())) {
    assert.doesNotMatch(html, new RegExp(`id="${field}"`));
    assert.doesNotMatch(html, new RegExp(`name="${field}"`));
  }
});

test("stock-take client source keeps Choose area controls inside an accessible modal", () => {
  const source = readFileSync("app/(protected)/stock-take/components/stock-take-client.tsx", "utf8");

  assert.match(source, /const \[isAreaModalOpen, setIsAreaModalOpen\] = useState\(false\)/);
  assert.match(source, /<Button type="button" variant="secondary" size="lg" onClick=\{\(\) => setIsAreaModalOpen\(true\)\}>\s*Choose area\s*<\/Button>/);
  assert.match(source, /<FullScreenDialog[\s\S]*open=\{isAreaModalOpen\}[\s\S]*title="Choose area"[\s\S]*closeLabel="Close area chooser"/);
  assert.match(source, /<Select[\s\S]*id="area_selector"[\s\S]*navigateToArea\(readStockTakeChangeValue\(event\)\)/);
  assert.match(source, /<Input id="area_name" name="area_name" required \/>/);
  assert.match(source, /<PendingSubmitButton type="submit" variant="secondary">\s*Add area\s*<\/PendingSubmitButton>/);
});

test("stock-take client source keeps Add new material controls inside an accessible modal", () => {
  const source = readFileSync("app/(protected)/stock-take/components/stock-take-client.tsx", "utf8");

  assert.match(source, /const \[isMaterialModalOpen, setIsMaterialModalOpen\] = useState\(false\)/);
  assert.match(source, /<Button type="button" variant="secondary" size="lg" onClick=\{\(\) => setIsMaterialModalOpen\(true\)\} disabled=\{!selectedAreaId\}>\s*Add new material\s*<\/Button>/);
  assert.match(source, /<FullScreenDialog[\s\S]*open=\{isMaterialModalOpen\}[\s\S]*title="Add new material"[\s\S]*closeLabel="Close material form"/);
  assert.match(source, /ADD_MATERIAL_FIELDS\.map\(\(field\) => \{/);
  assert.match(source, /<FormField label="Generated timber name" className="sm:col-span-2">/);
  assert.match(source, /<Button type="button" variant="secondary" onClick=\{\(\) => setIsMaterialModalOpen\(false\)\}>\s*Cancel\s*<\/Button>/);
});

test("stock-take client source preserves dirty guards and draft rows while modals open or close", () => {
  const source = readFileSync("app/(protected)/stock-take/components/stock-take-client.tsx", "utf8");

  assert.match(source, /if \(hasUnsavedChanges && !window\.confirm\("You have unsaved stock changes\. Leave this area without updating stock\?"\)\) \{/);
  assert.match(source, /onClose=\{\(\) => setIsAreaModalOpen\(false\)\}/);
  assert.match(source, /onClose=\{\(\) => setIsMaterialModalOpen\(false\)\}/);
  assert.doesNotMatch(source, /setRows\(toDraftRows|setRows\(\[\]\)|setLoadedRows\(\[\]\)/);
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
  assert.match(html, /Search timber, bay, or level in this area/);
  assert.match(html, /No timber rows in this bay yet\./);
  assert.match(html, /aria-label="Add row to Bay 1"/);
  assert.doesNotMatch(html, /<th/);
  assert.doesNotMatch(html, /<table/);
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

test("stock-take working rows render read-only by default with row action buttons", async () => {
  const { StockTakeClient } = await import("@/app/(protected)/stock-take/components/stock-take-client");
  const html = renderToStaticMarkup(
    createElement(StockTakeClient, {
      areas: [area],
      materials: [material],
      initialAreaId: area.id,
      initialRows: [existingRow],
    }),
  );

  assert.match(html, /45x90 SG8 H1\.2 6\.0m/);
  assert.match(html, />Top</);
  assert.match(html, />10</);
  assert.match(html, /aria-label="Actions for 45x90 SG8 H1\.2 6\.0m"/);
  assert.match(html, /aria-haspopup="menu"/);
  assert.doesNotMatch(html, /data-stock-field="level"/);
  assert.doesNotMatch(html, /data-stock-field="quantity"/);
});

test("stock-take client source uses a floating row action menu for edit and delete", () => {
  const source = readFileSync("app/(protected)/stock-take/components/stock-take-client.tsx", "utf8");

  assert.match(source, /const \[openRowActionsKey, setOpenRowActionsKey\] = useState<string \| null>\(null\)/);
  assert.match(source, /aria-haspopup="menu"/);
  assert.match(source, /role="menu"/);
  assert.match(source, /role="menuitem"[\s\S]*Edit/);
  assert.match(source, /role="menuitem"[\s\S]*Delete/);
  assert.match(source, /className="absolute right-0 top-9 z-20/);
  assert.match(source, /document\.addEventListener\("mousedown", onPointerDown\)/);
  assert.match(source, /event\.key === "Escape"/);
});

test("stock-take client source puts only one row into edit mode with Done and Cancel", () => {
  const source = readFileSync("app/(protected)/stock-take/components/stock-take-client.tsx", "utf8");

  assert.match(source, /const \[editingRowKey, setEditingRowKey\] = useState<string \| null>\(null\)/);
  assert.match(source, /const editingRow = useMemo\(\s*\(\) => \(editingRowKey \? rows\.find\(\(row\) => row\.key === editingRowKey\) \?\? null : null\)/);
  assert.match(source, /setEditSessionStartRow\(\{ \.\.\.row \}\)/);
  assert.match(source, /open=\{editingRow !== null\}/);
  assert.match(source, /data-stock-field="timber"/);
  assert.match(source, /data-stock-field="level"/);
  assert.match(source, /data-stock-field="quantity"/);
  assert.match(source, /onClick=\{finishEditingRow\}[\s\S]*Done/);
  assert.match(source, /onClick=\{cancelEditingRow\}[\s\S]*Cancel/);
  assert.match(source, /currentRows\.map\(\(row\) => \(row\.key === editSessionStartRow\.key \? editSessionStartRow : row\)\)/);
});

test("stock-take client moves Add row into the active bay as a bottom plus row", () => {
  const source = readFileSync("app/(protected)/stock-take/components/stock-take-client.tsx", "utf8");

  assert.doesNotMatch(source, /<Button type="button" variant="secondary" onClick=\{addWorkingRow\} disabled=\{localMaterials\.length === 0\}>\s*Add row\s*<\/Button>/);
  assert.match(source, /aria-label=\{`Add row to \$\{formatBayTabLabel\(activeBay\)\}`\}/);
  assert.match(source, /<span aria-hidden="true">\+<\/span>/);
  assert.match(source, /bay: activeBay === UNASSIGNED_BAY_TAB \? "" : activeBay/);
  assert.match(source, /setEditingRowKey\(newKey\)/);
  assert.match(source, /setFocusTarget\(\{ rowKey: newKey, field: "timber" \}\)/);
  assert.doesNotMatch(source, /disabled=\{!selectedAreaId \|\| rows\.length === 0\}/);
});

test("stock-take update flow replaces the area row set through the atomic RPC", () => {
  const dataSource = readFileSync("src/lib/stock-take/data.ts", "utf8");
  const clientSource = readFileSync("app/(protected)/stock-take/components/stock-take-client.tsx", "utf8");

  assert.match(dataSource, /\/rest\/v1\/rpc\/replace_timber_stock_rows_for_area\?select=\$\{rowSelect\}/);
  assert.doesNotMatch(dataSource, /method: "DELETE"/);
  assert.doesNotMatch(dataSource, /\/rest\/v1\/timber_stock_rows\?\$\{deleteSearchParams\.toString\(\)\}/);
  assert.match(dataSource, /p_rows: payload/);
  assert.match(clientSource, /timberMaterialId: row\.timberMaterialId/);
  assert.match(clientSource, /bay: row\.bay/);
  assert.match(clientSource, /level: row\.level/);
  assert.match(clientSource, /quantity: row\.quantity/);
});

test("stock-take top toolbar renders all-areas Excel export link without area, bay, or search parameters", async () => {
  const { StockTakeClient } = await import("@/app/(protected)/stock-take/components/stock-take-client");
  const html = renderToStaticMarkup(
    createElement(StockTakeClient, {
      areas: [area],
      materials: [material],
      initialAreaId: area.id,
      initialRows: [existingRow],
    }),
  );

  assert.match(html, />Export Excel</);
  assert.match(html, /href="\/stock-take\/export"/);
  assert.doesNotMatch(html, /href="\/stock-take\/export\?area=/);
  assert.doesNotMatch(html, /activeBay|search=/);
});

test("stock-take export helper copy is shown only from the unsaved-changes state and does not block export", () => {
  const source = readFileSync("app/(protected)/stock-take/components/stock-take-client.tsx", "utf8");

  assert.match(source, /href="\/stock-take\/export"/);
  assert.match(source, /Export uses saved stock only\. Update stock first to include your latest edits\./);
  assert.match(source, /\{hasUnsavedChanges \? \(/);
  assert.doesNotMatch(source, /href=\{`\/stock-take\/export\?area=/);
  assert.doesNotMatch(source, /preventDefault\(\)[\s\S]*Export Excel|disabled=\{hasUnsavedChanges\}/);
});
