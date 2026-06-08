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

const trimRequired = (value: string | null | undefined, label: string) => {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) {
    throw new Error(`${label} is required.`);
  }
  return trimmed;
};

export const normalizeAreaName = (name: string) => trimRequired(name, "Area name");

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
