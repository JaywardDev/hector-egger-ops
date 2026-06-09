import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  countChangedStockTakeRows,
  generateTimberMaterialName,
  normalizeAreaNameForLookup,
  normalizeTimberMaterialForLookup,
  rowMatchesStockTakeSearch,
} from "@/src/lib/stock-take/validation";

const rows = [
  { timberName: "45x90 SG8 H1.2 6.0m", bay: "A1", level: "Top" },
  { timberName: "90x90 SG10 H3.2 4.8m", bay: "B2", level: "Lower" },
];

test("working-list search matches timber name", () => {
  assert.equal(rowMatchesStockTakeSearch(rows[0], "sg8"), true);
  assert.equal(rowMatchesStockTakeSearch(rows[1], "sg8"), false);
});

test("working-list search matches bay", () => {
  assert.equal(rowMatchesStockTakeSearch(rows[0], "a1"), true);
  assert.equal(rowMatchesStockTakeSearch(rows[1], "a1"), false);
});

test("working-list search matches level", () => {
  assert.equal(rowMatchesStockTakeSearch(rows[0], "top"), true);
  assert.equal(rowMatchesStockTakeSearch(rows[1], "top"), false);
});

test("working-list search can produce the no-match state without changing rows", () => {
  const savedRows = [
    { timberMaterialId: "timber-1", bay: "A1", level: "Top", quantity: 10 },
    { timberMaterialId: "timber-2", bay: "B2", level: "Lower", quantity: 5 },
  ];
  const matchingRows = rows.filter((row) => rowMatchesStockTakeSearch(row, "does-not-exist"));

  assert.equal(matchingRows.length, 0);
  assert.equal(countChangedStockTakeRows(savedRows, savedRows), 0);
});

test("add-material flow appends an unsaved row using the created or reused material", () => {
  const createdMaterial = { id: "timber-3", name: "140x45 SG8 H1.2 6.0m" };
  const appendedRow = {
    timberMaterialId: createdMaterial.id,
    bay: "",
    level: "",
    quantity: "0",
  };

  assert.equal(appendedRow.timberMaterialId, createdMaterial.id);
  assert.equal(appendedRow.bay, "");
  assert.equal(appendedRow.level, "");
  assert.equal(appendedRow.quantity, "0");
  assert.equal(countChangedStockTakeRows([], [appendedRow]), 1);
});

test("appended material row supports immediate bay, level, and quantity edits", () => {
  const loadedRows: Array<{ timberMaterialId: string; bay: string; level: string; quantity: string }> = [];
  const draftRows = [{ timberMaterialId: "timber-3", bay: "C3", level: "Middle", quantity: "12" }];

  assert.equal(countChangedStockTakeRows(loadedRows, draftRows), 1);
});

test("editing quantity shows unsaved-change state and saving clears it", () => {
  const loadedRows = [{ timberMaterialId: "timber-1", bay: "A1", level: "Top", quantity: 10 }];
  const draftRows = [{ timberMaterialId: "timber-1", bay: "A1", level: "Top", quantity: 11 }];

  assert.equal(countChangedStockTakeRows(loadedRows, draftRows), 1);
  assert.equal(countChangedStockTakeRows(draftRows, draftRows), 0);
});

test("editing bay or level on draft rows shows unsaved-change state", () => {
  const loadedRows = [{ timberMaterialId: "timber-1", bay: "A1", level: "Top", quantity: 10 }];

  assert.equal(
    countChangedStockTakeRows(loadedRows, [{ timberMaterialId: "timber-1", bay: "B1", level: "Top", quantity: 10 }]),
    1,
  );
  assert.equal(
    countChangedStockTakeRows(loadedRows, [{ timberMaterialId: "timber-1", bay: "A1", level: "Lower", quantity: 10 }]),
    1,
  );
});

test("area duplicate normalization uses lower trimmed names", () => {
  assert.equal(normalizeAreaNameForLookup("Hundegger Area"), "hundegger area");
  assert.equal(normalizeAreaNameForLookup(" hundegger area "), "hundegger area");
});

test("material duplicate normalization uses lower trimmed structured fields", () => {
  assert.deepEqual(
    normalizeTimberMaterialForLookup({
      height: " 45 ",
      width: " 90 ",
      length: " 6.0m ",
      grade: " SG8 ",
      treatment: " H1.2 ",
    }),
    { height: "45", width: "90", length: "6.0m", grade: "sg8", treatment: "h1.2" },
  );
});

test("generated timber names remain canonical after app normalization", () => {
  assert.equal(
    generateTimberMaterialName({ height: " 45 ", width: " 90 ", grade: " SG8 ", treatment: " H1.2 ", length: " 6.0m " }),
    "45x90 SG8 H1.2 6.0m",
  );
});

test("database migration rejects leading or trailing timber material whitespace", () => {
  const migration = readFileSync("supabase/migrations/20260609110000_timber_material_trim_checks.sql", "utf8");

  for (const field of ["height", "width", "length", "grade", "treatment"]) {
    assert.match(migration, new RegExp(`${field} = btrim\\(${field}\\)`));
  }
});
