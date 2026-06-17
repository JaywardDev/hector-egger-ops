import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import Module from "node:module";
import test from "node:test";
import {
  countChangedStockTakeRows,
  generateTimberMaterialName,
  normalizeAreaNameForLookup,
  normalizeTimberMaterialForLookup,
  rowMatchesStockTakeSearch,
} from "@/src/lib/stock-take/validation";
const originalLoad = Module._load;
Module._load = function loadWithServerOnlyStub(request, parent, isMain) {
  if (request === "server-only") {
    return {};
  }
  return originalLoad.call(this, request, parent, isMain);
};

const getStockTakeClientHelpers = async () => import("@/app/(protected)/stock-take/components/stock-take-client");

const rows = [
  { timberName: "45x90 SG8 H1.2 6.0m", bay: "A1", level: "Top" },
  { timberName: "90x90 SG10 H3.2 4.8m", bay: "B2", level: "Lower" },
];


test("bay tabs include default Bay 1 and Bay 2 with no rows", async () => {
  const { deriveBayTabs } = await getStockTakeClientHelpers();

  assert.deepEqual(deriveBayTabs([]), [
    { key: "1", label: "Bay 1", count: 0 },
    { key: "2", label: "Bay 2", count: 0 },
  ]);
});

test("bay tabs include existing numeric, unusual, and unassigned bays without dropping labels", async () => {
  const { deriveBayTabs, UNASSIGNED_BAY_TAB } = await getStockTakeClientHelpers();

  assert.deepEqual(deriveBayTabs([{ bay: "1" }, { bay: "2" }, { bay: "5" }, { bay: "A1" }, { bay: "" }]), [
    { key: "1", label: "Bay 1", count: 1 },
    { key: "2", label: "Bay 2", count: 1 },
    { key: "5", label: "Bay 5", count: 1 },
    { key: "A1", label: "Bay A1", count: 1 },
    { key: UNASSIGNED_BAY_TAB, label: "Unassigned", count: 1 },
  ]);
});

test("add bay chooses the lowest missing positive numeric bay", async () => {
  const { getLowestMissingPositiveNumericBay } = await getStockTakeClientHelpers();

  assert.equal(getLowestMissingPositiveNumericBay(["1", "2", "5"]), "3");
  assert.equal(getLowestMissingPositiveNumericBay(["1", "2", "3", "5"]), "4");
  assert.equal(getLowestMissingPositiveNumericBay(["1", "2", "3", "4", "5", "A1"]), "6");
});

test("level sorting is numeric ascending with stable fallback for blanks and words", async () => {
  const { compareStockTakeLevels } = await getStockTakeClientHelpers();
  const draftRows = [{ level: "Top" }, { level: "Level 3" }, { level: "" }, { level: "Level 1" }, { level: "2" }];
  const sortedLevels = draftRows
    .map((row, index) => ({ row, index }))
    .sort((left, right) => compareStockTakeLevels(left.row, right.row) || left.index - right.index)
    .map(({ row }) => row.level);

  assert.deepEqual(sortedLevels, ["Level 1", "2", "Level 3", "Top", ""]);
});


test("working-list search input is rendered above the bay selector", () => {
  const source = readFileSync("app/(protected)/stock-take/components/stock-take-client.tsx", "utf8");

  assert.ok(source.indexOf('label="Search working list"') < source.indexOf('role="tablist" aria-label="Bay tabs"'));
});

test("working-list area search derives match badges for non-active bays without changing inline totals", async () => {
  const { deriveBayTabs, deriveSearchMatchCountByBay } = await getStockTakeClientHelpers();
  const draftRows = [
    { key: "row-1", timberMaterialId: "timber-1", bay: "1", level: "Top", quantity: "2", persisted: true },
    { key: "row-2", timberMaterialId: "timber-2", bay: "1", level: "Lower", quantity: "3", persisted: true },
    { key: "row-3", timberMaterialId: "timber-3", bay: "2", level: "Top", quantity: "4", persisted: true },
  ];
  const namesById = new Map([
    ["timber-1", "45x90 SG8 H1.2 6.0m"],
    ["timber-2", "90x90 SG10 H3.2 4.8m"],
    ["timber-3", "140x45 LVL H1.2 6.0m"],
  ]);

  const bayTabs = deriveBayTabs(draftRows);
  const searchMatchCountByBay = deriveSearchMatchCountByBay(draftRows, namesById, "lvl");

  assert.deepEqual(bayTabs, [
    { key: "1", label: "Bay 1", count: 2 },
    { key: "2", label: "Bay 2", count: 1 },
  ]);
  assert.equal(searchMatchCountByBay.get("1") ?? 0, 0);
  assert.equal(searchMatchCountByBay.get("2"), 1);
});

test("working-list search derives match badges across non-active areas", async () => {
  const { deriveSearchMatchCountByArea } = await getStockTakeClientHelpers();
  const namesById = new Map([
    ["timber-1", "45x90 SG8 H1.2 6.0m"],
    ["timber-2", "90x90 LVL11 H1.2 4.8m"],
  ]);
  const rowsByAreaId = {
    "area-1": [{ key: "row-1", timberMaterialId: "timber-1", bay: "1", level: "Top", quantity: "2", persisted: true }],
    "area-2": [{ key: "row-2", timberMaterialId: "timber-2", bay: "1", level: "Lower", quantity: "3", persisted: true }],
  };

  const counts = deriveSearchMatchCountByArea(rowsByAreaId, namesById, "lvl");

  assert.equal(counts.get("area-1") ?? 0, 0);
  assert.equal(counts.get("area-2"), 1);
  assert.equal(deriveSearchMatchCountByArea(rowsByAreaId, namesById, "").size, 0);
});

test("clearing working-list area search removes derived floating badge counts", async () => {
  const { deriveSearchMatchCountByBay } = await getStockTakeClientHelpers();
  const draftRows = [{ key: "row-1", timberMaterialId: "timber-1", bay: "2", level: "Top", quantity: "2", persisted: true }];
  const namesById = new Map([["timber-1", "45x90 SG8 H1.2 6.0m"]]);

  assert.equal(deriveSearchMatchCountByBay(draftRows, namesById, "sg8").get("2"), 1);
  assert.equal(deriveSearchMatchCountByBay(draftRows, namesById, "").size, 0);
});

test("active bay display is filtered by area search while update payload still includes every row", () => {
  const draftRows = [
    { timberMaterialId: "timber-1", bay: "1", level: "Top", quantity: "2" },
    { timberMaterialId: "timber-2", bay: "1", level: "Lower", quantity: "3" },
    { timberMaterialId: "timber-3", bay: "2", level: "Top", quantity: "4" },
  ];
  const namesById = new Map([
    ["timber-1", "45x90 SG8 H1.2 6.0m"],
    ["timber-2", "90x90 SG10 H3.2 4.8m"],
    ["timber-3", "140x45 LVL H1.2 6.0m"],
  ]);
  const visibleActiveBayRows = draftRows.filter((row) =>
    row.bay === "1" &&
    rowMatchesStockTakeSearch({ timberName: namesById.get(row.timberMaterialId), bay: row.bay, level: row.level }, "sg10"),
  );
  const stockRowsPayload = draftRows.map((row) => ({
    timberMaterialId: row.timberMaterialId,
    bay: row.bay,
    level: row.level,
    quantity: row.quantity,
  }));

  assert.deepEqual(visibleActiveBayRows, [draftRows[1]]);
  assert.equal(stockRowsPayload.length, 3);
  assert.deepEqual(stockRowsPayload, draftRows);
});

test("unsaved-change indicator still counts all changed rows while search is active", () => {
  const loadedRows = [
    { timberMaterialId: "timber-1", bay: "1", level: "Top", quantity: 10 },
    { timberMaterialId: "timber-2", bay: "2", level: "Lower", quantity: 5 },
  ];
  const searchedRows = [
    { timberMaterialId: "timber-1", bay: "1", level: "Top", quantity: 11 },
    { timberMaterialId: "timber-2", bay: "2", level: "Lower", quantity: 6 },
  ];

  assert.equal(rowMatchesStockTakeSearch({ timberName: "45x90 SG8 H1.2 6.0m", bay: "1", level: "Top" }, "sg8"), true);
  assert.equal(countChangedStockTakeRows(loadedRows, searchedRows), 2);
});

test("working-list search matches timber name", () => {
  assert.equal(rowMatchesStockTakeSearch(rows[0], "sg8"), true);
  assert.equal(rowMatchesStockTakeSearch(rows[1], "sg8"), false);
});

test("working-list search matches bay text across the selected area", () => {
  assert.equal(rowMatchesStockTakeSearch(rows[0], "a1"), true);
  assert.equal(rowMatchesStockTakeSearch(rows[1], "a1"), false);
});

test("working-list search matches level", () => {
  assert.equal(rowMatchesStockTakeSearch(rows[0], "top"), true);
  assert.equal(rowMatchesStockTakeSearch(rows[1], "top"), false);
});

test("working-list search is null-safe and still matches timber, bay, and level fields", () => {
  assert.equal(rowMatchesStockTakeSearch({ timberName: "45x90 SG8 H1.2 6.0m", bay: null, level: undefined }, "sg8"), true);
  assert.equal(rowMatchesStockTakeSearch({ timberName: "45x90 SG8 H1.2 6.0m", bay: null, level: undefined }, "a1"), false);
  assert.equal(rowMatchesStockTakeSearch({ timberName: "", bay: "A1", level: null }, "a1"), true);
  assert.equal(rowMatchesStockTakeSearch({ timberName: undefined, bay: null, level: "Top" }, "top"), true);
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

test("add-material flow appends an unsaved row using the active bay", () => {
  const createdMaterial = { id: "timber-3", name: "140x45 SG8 H1.2 6.0m" };
  const activeBay = "3";
  const appendedRow = {
    timberMaterialId: createdMaterial.id,
    bay: activeBay,
    level: "",
    quantity: "0",
  };

  assert.equal(appendedRow.timberMaterialId, createdMaterial.id);
  assert.equal(appendedRow.bay, "3");
  assert.equal(appendedRow.level, "");
  assert.equal(appendedRow.quantity, "0");
  assert.equal(countChangedStockTakeRows([], [appendedRow]), 1);
});

test("rows added from the Unassigned tab keep a blank bay", async () => {
  const { UNASSIGNED_BAY_TAB } = await getStockTakeClientHelpers();
  const appendedRow = {
    timberMaterialId: "timber-3",
    bay: UNASSIGNED_BAY_TAB === "__unassigned__" ? "" : "unexpected",
    level: "",
    quantity: "0",
  };

  assert.equal(appendedRow.bay, "");
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

test("dirty counting treats transient UI quantity values as changed without throwing", () => {
  const loadedRows = [{ timberMaterialId: "timber-1", bay: "A1", level: "Top", quantity: 10 }];

  for (const quantity of ["", ".", "e", "1e", undefined, null, NaN]) {
    assert.doesNotThrow(() => {
      assert.equal(
        countChangedStockTakeRows(loadedRows, [{ timberMaterialId: "timber-1", bay: "A1", level: "Top", quantity }]),
        1,
      );
    });
  }
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

test("dirty counting is defensive for missing row collections and malformed rows", () => {
  assert.doesNotThrow(() => {
    assert.equal(countChangedStockTakeRows(null, undefined), 0);
  });
  assert.doesNotThrow(() => {
    assert.equal(
      countChangedStockTakeRows(
        [{ timberMaterialId: "timber-1", bay: "A1", level: "Top", quantity: 10 }],
        [{ timberMaterialId: undefined, bay: undefined, level: undefined, quantity: undefined }],
      ),
      1,
    );
  });
});

test("dirty counting marks timber edits and deleted persisted rows as changes", () => {
  const loadedRows = [
    { timberMaterialId: "timber-1", bay: "1", level: "Top", quantity: 10 },
    { timberMaterialId: "timber-2", bay: "1", level: "Lower", quantity: 5 },
  ];

  assert.equal(
    countChangedStockTakeRows(loadedRows, [
      { timberMaterialId: "timber-3", bay: "1", level: "Top", quantity: 10 },
      loadedRows[1],
    ]),
    1,
  );
  assert.equal(countChangedStockTakeRows(loadedRows, [loadedRows[0]]), 1);
});
