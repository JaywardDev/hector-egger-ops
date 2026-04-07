type TimberLabelSource = {
  thicknessMm?: number | null;
  widthMm?: number | null;
  lengthMm?: number | null;
  grade?: string | null;
  treatment?: string | null;
  thickness_mm?: number | null;
  width_mm?: number | null;
  length_mm?: number | null;
};

type ResolveInventoryItemNameInput = {
  name: string | null;
  timberSpec: TimberLabelSource | null;
  selectedMaterialGroupKey: string | null | undefined;
  timberLabelMode?: "auto" | "manual";
  existingAutoLabel?: string;
};

export const TIMBER_MATERIAL_GROUP_KEY = "timber";

const formatTimberDimensionPart = (timberSpec: TimberLabelSource | null) => {
  const thickness = timberSpec?.thicknessMm ?? timberSpec?.thickness_mm ?? null;
  const width = timberSpec?.widthMm ?? timberSpec?.width_mm ?? null;

  if (thickness !== null && width !== null) {
    return `${thickness}x${width}`;
  }

  if (thickness !== null) {
    return `${thickness}`;
  }

  if (width !== null) {
    return `${width}`;
  }

  return null;
};

export const buildTimberItemLabel = (timberSpec: TimberLabelSource | null) => {
  const parts = [
    formatTimberDimensionPart(timberSpec),
    timberSpec?.grade ?? null,
    timberSpec?.treatment ?? null,
    timberSpec?.lengthMm ?? timberSpec?.length_mm ?? null,
  ]
    .map((part) => (part === null ? null : String(part).trim()))
    .filter((part): part is string => Boolean(part));

  return parts.join(" ");
};

export const resolveInventoryItemNameCandidate = ({
  name,
  timberSpec,
  selectedMaterialGroupKey,
  timberLabelMode,
  existingAutoLabel,
}: ResolveInventoryItemNameInput) => {
  const trimmedName = name?.trim() ?? "";
  const generatedLabel = buildTimberItemLabel(timberSpec);
  const isTimber = selectedMaterialGroupKey === TIMBER_MATERIAL_GROUP_KEY;

  if (!isTimber) {
    return trimmedName || null;
  }

  const shouldUseAutoLabel =
    timberLabelMode === "auto" ||
    (!trimmedName && generatedLabel.length > 0) ||
    (existingAutoLabel !== undefined && trimmedName === existingAutoLabel);

  if (shouldUseAutoLabel && generatedLabel.length > 0) {
    return generatedLabel;
  }

  return trimmedName || null;
};
