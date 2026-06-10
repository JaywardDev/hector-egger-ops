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
  timberName?: string | null;
  bay?: string | null;
  level?: string | null;
};

export type StockTakeComparableRow = {
  timberMaterialId?: string | null | undefined;
  bay?: string | null | undefined;
  level?: string | null | undefined;
  quantity?: string | number | null | undefined;
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

export const normalizeBayLevelValue = (value: string | null | undefined) => value == null ? "" : String(value).trim();

export const normalizeQuantity = (quantity: unknown) => {
  if (quantity === null || quantity === undefined) {
    throw new Error("Quantity must be a number.");
  }
  if (typeof quantity !== "string" && typeof quantity !== "number") {
    throw new Error("Quantity must be a number.");
  }
  if (typeof quantity === "string" && !quantity.trim()) {
    throw new Error("Quantity must be a number.");
  }

  const value = typeof quantity === "number" ? quantity : Number(quantity);
  if (!Number.isFinite(value)) {
    throw new Error("Quantity must be a number.");
  }
  if (value < 0) {
    throw new Error("Quantity cannot be negative.");
  }
  return value;
};

type QuantityComparisonValue =
  | { valid: true; value: string }
  | { valid: false };

export const normalizeQuantityForComparison = (quantity: string | number | null | undefined): QuantityComparisonValue => {
  if (quantity === null || quantity === undefined) {
    return { valid: false };
  }

  try {
    return { valid: true, value: String(normalizeQuantity(quantity)) };
  } catch {
    return { valid: false };
  }
};

const normalizeSearchValue = (value: string | null | undefined) => value == null ? "" : String(value).toLowerCase();

export const rowMatchesStockTakeSearch = (row: StockTakeFilterableRow | null | undefined, search: string) => {
  const term = search.trim().toLowerCase();
  if (!term) {
    return true;
  }
  return [row?.timberName, row?.level].some((value) => normalizeSearchValue(value).includes(term));
};

const normalizeComparableRow = (row: StockTakeComparableRow | null | undefined) => ({
  timberMaterialId: row?.timberMaterialId ?? "",
  bay: normalizeBayLevelValue(row?.bay),
  level: normalizeBayLevelValue(row?.level),
  quantity: normalizeQuantityForComparison(row?.quantity),
});

export const normalizeRowsForChangeComparison = (rows: readonly StockTakeComparableRow[] | null | undefined) =>
  (Array.isArray(rows) ? rows : []).map((row) => normalizeComparableRow(row));

export const countChangedStockTakeRows = (
  loadedRows: readonly StockTakeComparableRow[] | null | undefined,
  draftRows: readonly StockTakeComparableRow[] | null | undefined,
) => {
  const loaded = normalizeRowsForChangeComparison(loadedRows);
  const draft = normalizeRowsForChangeComparison(draftRows);
  const maxLength = Math.max(loaded.length, draft.length);
  let changed = 0;

  for (let index = 0; index < maxLength; index += 1) {
    const loadedRow = loaded[index];
    const draftRow = draft[index];

    if (loadedRow?.quantity.valid === false || draftRow?.quantity.valid === false) {
      changed += 1;
      continue;
    }

    if (JSON.stringify(loadedRow ?? null) !== JSON.stringify(draftRow ?? null)) {
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
