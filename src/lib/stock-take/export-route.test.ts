import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("stock-take export route requires protected access, uses saved export data, and returns XLSX attachment headers", () => {
  const source = readFileSync("app/(protected)/stock-take/export/route.ts", "utf8");

  assert.match(source, /await requireProtectedAccess\(route\)/);
  assert.match(source, /getStockTakeExportData\(\{[\s\S]*route: "\/stock-take"/);
  assert.match(source, /buildStockTakeExportXlsx\(data\)/);
  assert.match(source, /"Content-Type": "application\/vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet"/);
  assert.match(source, /"Content-Disposition": `attachment; filename="\$\{workbook\.filename\}"`/);
  assert.match(source, /"Cache-Control": "no-store"/);
  assert.doesNotMatch(source, /searchParams|get\("area"\)|activeBay|selectedArea|clientRows|draft/);
});
