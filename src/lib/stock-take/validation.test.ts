import assert from "node:assert/strict";
import test from "node:test";
import {
  buildAreaPayload,
  compareTimberMaterialsBySize,
  generateTimberMaterialName,
  getTimberStockRowScopeKey,
  normalizeQuantity,
} from "@/src/lib/stock-take/validation";

test("generates the required timber material name", () => {
  assert.equal(
    generateTimberMaterialName({
      height: "45",
      width: "90",
      grade: "SG8",
      treatment: "H1.2",
      length: "6.0m",
    }),
    "45x90 SG8 H1.2 6.0m",
  );
});

test("trims whitespace before generating timber material name", () => {
  assert.equal(
    generateTimberMaterialName({
      height: " 45 ",
      width: " 90 ",
      grade: " SG8 ",
      treatment: " H1.2 ",
      length: " 6.0m ",
    }),
    "45x90 SG8 H1.2 6.0m",
  );
});

test("rejects missing timber material fields", () => {
  const base = { height: "45", width: "90", grade: "SG8", treatment: "H1.2", length: "6.0m" };
  assert.throws(() => generateTimberMaterialName({ ...base, height: "" }), /Height is required/);
  assert.throws(() => generateTimberMaterialName({ ...base, width: "" }), /Width is required/);
  assert.throws(() => generateTimberMaterialName({ ...base, length: "" }), /Length is required/);
  assert.throws(() => generateTimberMaterialName({ ...base, grade: "" }), /Grade is required/);
  assert.throws(() => generateTimberMaterialName({ ...base, treatment: "" }), /Treatment is required/);
});

test("does not reverse height and width", () => {
  assert.equal(
    generateTimberMaterialName({
      height: "45",
      width: "90",
      grade: "SG8",
      treatment: "H1.2",
      length: "6.0m",
    }).startsWith("45x90"),
    true,
  );
});

test("timber materials sort by cross-section size, not by leading digit", () => {
  const materials = [
    { height: "135", width: "200", length: "12000", name: "135x200 LVL11 H1.2 12000" },
    { height: "45", width: "90", length: "6000", name: "45x90 SG8 H1.2 6000" },
    { height: "90", width: "240", length: "12000", name: "90x240 LVL11 H1.2 12000" },
    { height: "135", width: "240", length: "12000", name: "135x240 LVL11 H1.2 12000" },
  ];

  const sorted = [...materials].sort(compareTimberMaterialsBySize).map((material) => material.name);

  assert.deepEqual(sorted, [
    "45x90 SG8 H1.2 6000",
    "90x240 LVL11 H1.2 12000",
    "135x200 LVL11 H1.2 12000",
    "135x240 LVL11 H1.2 12000",
  ]);
});

test("equal cross-section timber falls back to length then name for stable ordering", () => {
  const shortBoard = { height: "90", width: "90", length: "4800", name: "90x90 SG8 H1.2 4800" };
  const longBoard = { height: "90", width: "90", length: "6000", name: "90x90 SG8 H1.2 6000" };

  assert.ok(compareTimberMaterialsBySize(shortBoard, longBoard) < 0);
  assert.ok(compareTimberMaterialsBySize(longBoard, shortBoard) > 0);
});

test("non-numeric timber dimensions sort after sized materials without throwing", () => {
  const sized = { height: "45", width: "90", length: "6000", name: "45x90 SG8 H1.2 6000" };
  const unsized = { height: "", width: "", length: "", name: "Custom offcut" };

  assert.doesNotThrow(() => compareTimberMaterialsBySize(sized, unsized));
  assert.ok(compareTimberMaterialsBySize(sized, unsized) < 0);
  assert.ok(compareTimberMaterialsBySize(unsized, sized) > 0);
});

test("add area payload accepts name only plus optional creator", () => {
  assert.deepEqual(buildAreaPayload({ name: " Main Yard " }), { name: "Main Yard" });
  assert.deepEqual(buildAreaPayload({ name: "Main Yard" }, "profile-1"), {
    name: "Main Yard",
    created_by_profile_id: "profile-1",
  });
});

test("blank area name is rejected", () => {
  assert.throws(() => buildAreaPayload({ name: " " }), /Area name is required/);
});

test("area payload does not include hidden everyday fields", () => {
  const payload = buildAreaPayload({ name: "Hundegger Area" });
  assert.equal("notes" in payload, false);
  assert.equal("code" in payload, false);
  assert.equal("description" in payload, false);
  assert.equal("metadata" in payload, false);
});

test("duplicate area handling is predictable by normalizing names", () => {
  assert.equal(buildAreaPayload({ name: " Outside Factory " }).name, "Outside Factory");
});

test("quantity cannot be negative", () => {
  assert.equal(normalizeQuantity("0"), 0);
  assert.equal(normalizeQuantity("12.5"), 12.5);
  assert.throws(() => normalizeQuantity("-1"), /Quantity cannot be negative/);
});

test("submit quantity validation rejects blank and invalid numeric input", () => {
  for (const quantity of ["", " ", ".", "e", "1e", Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, NaN, null, undefined]) {
    assert.throws(() => normalizeQuantity(quantity as never), /Quantity must be a number/);
  }
});

test("submit quantity validation remains strict and does not coerce invalid values to zero", () => {
  for (const quantity of ["", " ", ".", "e", "1e", Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, NaN, null, undefined]) {
    assert.throws(() => normalizeQuantity(quantity as never));
  }
  assert.throws(() => normalizeQuantity("-0.001"), /Quantity cannot be negative/);
});


test("rows are scoped to the selected area", () => {
  const hundegger = getTimberStockRowScopeKey({ areaId: "area-1", timberMaterialId: "timber-1", bay: "A", level: "1" });
  const yard = getTimberStockRowScopeKey({ areaId: "area-2", timberMaterialId: "timber-1", bay: "A", level: "1" });
  assert.notEqual(hundegger, yard);
});

test("same timber can exist in different areas independently", () => {
  assert.notEqual(
    getTimberStockRowScopeKey({ areaId: "hundegger", timberMaterialId: "45x90", bay: "", level: "" }),
    getTimberStockRowScopeKey({ areaId: "main-yard", timberMaterialId: "45x90", bay: "", level: "" }),
  );
});

test("same timber can exist in different bay and level positions inside the same area", () => {
  assert.notEqual(
    getTimberStockRowScopeKey({ areaId: "main-yard", timberMaterialId: "45x90", bay: "A", level: "1" }),
    getTimberStockRowScopeKey({ areaId: "main-yard", timberMaterialId: "45x90", bay: "B", level: "1" }),
  );
  assert.notEqual(
    getTimberStockRowScopeKey({ areaId: "main-yard", timberMaterialId: "45x90", bay: "A", level: "1" }),
    getTimberStockRowScopeKey({ areaId: "main-yard", timberMaterialId: "45x90", bay: "A", level: "2" }),
  );
});
