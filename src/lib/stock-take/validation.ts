export type TimberMaterialInput = {
  height: string;
  width: string;
  length: string;
  grade: string;
  treatment: string;
};

export type AreaInput = {
  name: string;
};

export type MinimalAreaPayload = {
  name: string;
  created_by_profile_id?: string;
};

export type StockTakeFilterableRow = {
  timberName: string;
  bay: string;
  level: string;
};

export type StockTakeComparableRow = {
  timberMaterialId: string;
  bay: string;
  level: string;
  quantity: string | number;
};

const trimRequired = (value: string | null | undefined, label: string) => {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) {
    throw new Error(`${label} is required.`);
  }
  return trimmed;
};

export const normalizeDuplicateLookupValue = (value: string) => value.trim().toLowerCase();

export const normalizeAreaName = (name: string) => trimRequired(name, "Area name");

export const normalizeAreaNameForLookup = (name: string) => normalizeDuplicateLookupValue(normalizeAreaName(name));

export const buildAreaPayload = (
  input: AreaInput,
  createdByProfileId?: string,
): MinimalAreaPayload => {
  const payload: MinimalAreaPayload = { name: normalizeAreaName(input.name) };
  if (createdByProfileId) {
    payload.created_by_profile_id = createdByProfileId;
  }
  return payload;
};

export const normalizeTimberMaterialInput = (input: TimberMaterialInput): TimberMaterialInput => ({
  height: trimRequired(input.height, "Height"),
  width: trimRequired(input.width, "Width"),
  length: trimRequired(input.length, "Length"),
  grade: trimRequired(input.grade, "Grade"),
  treatment: trimRequired(input.treatment, "Treatment"),
});

export const normalizeTimberMaterialForLookup = (input: TimberMaterialInput): TimberMaterialInput => {
  const material = normalizeTimberMaterialInput(input);
  return {
    height: normalizeDuplicateLookupValue(material.height),
    width: normalizeDuplicateLookupValue(material.width),
    length: normalizeDuplicateLookupValue(material.length),
    grade: normalizeDuplicateLookupValue(material.grade),
    treatment: normalizeDuplicateLookupValue(material.treatment),
  };
};

export const generateTimberMaterialName = (input: TimberMaterialInput) => {
  const material = normalizeTimberMaterialInput(input);
  return `${material.height}x${material.width} ${material.grade} ${material.treatment} ${material.length}`;
};

export const normalizeBayLevelValue = (value: string | null | undefined) => value?.trim() ?? "";

export const normalizeQuantity = (quantity: string | number) => {
  const value = typeof quantity === "number" ? quantity : Number(quantity);
  if (!Number.isFinite(value)) {
    throw new Error("Quantity must be a number.");
  }
  if (value < 0) {
    throw new Error("Quantity cannot be negative.");
  }
  return value;
};

export const normalizeQuantityForComparison = (quantity: string | number) => String(normalizeQuantity(quantity));

export const rowMatchesStockTakeSearch = (row: StockTakeFilterableRow, search: string) => {
  const term = search.trim().toLowerCase();
  if (!term) {
    return true;
  }
  return [row.timberName, row.bay, row.level].some((value) => value.toLowerCase().includes(term));
};

export const normalizeRowsForChangeComparison = (rows: StockTakeComparableRow[]) =>
  rows.map((row) => ({
    timberMaterialId: row.timberMaterialId,
    bay: normalizeBayLevelValue(row.bay),
    level: normalizeBayLevelValue(row.level),
    quantity: normalizeQuantityForComparison(row.quantity),
  }));

export const countChangedStockTakeRows = (
  loadedRows: StockTakeComparableRow[],
  draftRows: StockTakeComparableRow[],
) => {
  const loaded = normalizeRowsForChangeComparison(loadedRows);
  const draft = normalizeRowsForChangeComparison(draftRows);
  const maxLength = Math.max(loaded.length, draft.length);
  let changed = 0;

  for (let index = 0; index < maxLength; index += 1) {
    if (JSON.stringify(loaded[index] ?? null) !== JSON.stringify(draft[index] ?? null)) {
      changed += 1;
    }
  }

  return changed;
};

export const getTimberStockRowScopeKey = ({
  areaId,
  timberMaterialId,
  bay,
  level,
}: {
  areaId: string;
  timberMaterialId: string;
  bay: string;
  level: string;
}) =>
  [
    areaId,
    timberMaterialId,
    normalizeBayLevelValue(bay),
    normalizeBayLevelValue(level),
  ].join("::");
