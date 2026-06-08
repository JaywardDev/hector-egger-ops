export const NO_LOCATION_RECORDED_LABEL = "No location recorded";

type TimberSpecLabelSource = {
  thicknessMm?: number | null;
  widthMm?: number | null;
  lengthMm?: number | null;
  grade?: string | null;
  treatment?: string | null;
  thickness_mm?: number | null;
  width_mm?: number | null;
  length_mm?: number | null;
} | null;

const formatTimberDimensionPart = (timberSpec: TimberSpecLabelSource) => {
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

export const buildTimberStockSpecLabel = (timberSpec: TimberSpecLabelSource) => {
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

export const formatStockLocationLabel = (
  location: { name: string; code: string | null } | null,
) => {
  if (!location) {
    return NO_LOCATION_RECORDED_LABEL;
  }

  return location.code ? `${location.name} (${location.code})` : location.name;
};

export const formatTimberStockLabel = ({
  name,
  itemCode,
  timberSpec,
}: {
  name: string;
  itemCode: string | null;
  timberSpec: TimberSpecLabelSource;
}) => {
  const specLabel = buildTimberStockSpecLabel(timberSpec);
  const primaryLabel = specLabel || name;

  return itemCode ? `${primaryLabel} · ${itemCode}` : primaryLabel;
};

export const buildStockTakeExportHref = (
  session: { id: string } | null,
) => session ? `/stock-take/${session.id}/export` : null;
