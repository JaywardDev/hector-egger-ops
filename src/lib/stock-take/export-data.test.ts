import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import Module from "node:module";
import test from "node:test";

import type { StockAreaRecord } from "@/src/lib/stock-take/types";

const originalLoad = Module._load;
Module._load = function loadWithServerOnlyStub(request, parent, isMain) {
  if (request === "server-only") {
    return {};
  }
  return originalLoad.call(this, request, parent, isMain);
};

const areas: StockAreaRecord[] = [
  {
    id: "area-1",
    name: "Rack A",
    is_active: true,
    created_by_profile_id: null,
    created_at: "2026-06-09T00:00:00.000Z",
    updated_at: "2026-06-09T00:00:00.000Z",
  },
  {
    id: "area-2",
    name: "Rack B",
    is_active: true,
    created_by_profile_id: null,
    created_at: "2026-06-09T00:00:00.000Z",
    updated_at: "2026-06-09T00:00:00.000Z",
  },
  {
    id: "empty-area",
    name: "Empty Yard",
    is_active: true,
    created_by_profile_id: null,
    created_at: "2026-06-09T00:00:00.000Z",
    updated_at: "2026-06-09T00:00:00.000Z",
  },
];

test("stock-take export data groups saved rows by accessible area and bay with all-stock totals", async () => {
  const { buildStockTakeExportData } = await import("@/src/lib/stock-take/export-data");
  const data = buildStockTakeExportData(areas, [
    { area_id: "area-1", bay: "10", level: "2", quantity: "2", timber_materials: { name: "90x45 H1.2 SG8 6.0" } },
    { area_id: "area-1", bay: "2", level: "1", quantity: 4, timber_materials: { name: "140x45 H3.2 SG8 4.8" } },
    { area_id: "area-2", bay: "1", level: "Top", quantity: 6, timber_materials: { name: "90x45 H1.2 SG8 6.0" } },
    { area_id: "inaccessible-area", bay: "1", level: "Top", quantity: 99, timber_materials: { name: "Hidden timber" } },
  ]);

  assert.deepEqual(data.summaryRows, [
    { timberName: "90x45 H1.2 SG8 6.0", quantity: 8 },
    { timberName: "140x45 H3.2 SG8 4.8", quantity: 4 },
  ]);
  assert.deepEqual(data.areas.map((area) => area.name), ["Rack A", "Rack B", "Empty Yard"]);
  assert.deepEqual(data.areas[0].bays.map((bay) => bay.bay), ["2", "10"]);
  assert.equal(data.areas[0].bays[0].rows[0].timberName, "140x45 H3.2 SG8 4.8");
  assert.deepEqual(data.areas[2].bays, []);
  assert.equal(JSON.stringify(data).includes("Hidden timber"), false);
});

test("stock-take export data handles no saved stock rows while preserving empty areas", async () => {
  const { buildStockTakeExportData } = await import("@/src/lib/stock-take/export-data");
  const data = buildStockTakeExportData(areas, []);

  assert.deepEqual(data.summaryRows, []);
  assert.deepEqual(data.areas.map((area) => ({ name: area.name, bays: area.bays })), [
    { name: "Rack A", bays: [] },
    { name: "Rack B", bays: [] },
    { name: "Empty Yard", bays: [] },
  ]);
});

test("stock-take export loader uses all accessible stock areas, session RLS headers, and saved database rows only", () => {
  const source = readFileSync("src/lib/stock-take/export-data.ts", "utf8");

  assert.match(source, /await assertTimberStockReadAccess\(actor\)/);
  assert.match(source, /\/rest\/v1\/stock_areas\?\$\{areaSearchParams\.toString\(\)\}/);
  assert.match(source, /\/rest\/v1\/timber_stock_rows\?\$\{searchParams\.toString\(\)\}/);
  assert.match(source, /area_id: toAreaIdFilter\(areas\)/);
  assert.match(source, /headers: createSessionHeaders\(actor\.session\)/);
  assert.doesNotMatch(source, /clientRows|activeBay|selectedAreaId/);
  assert.doesNotMatch(source, /updated_by_profile_id/);
});
