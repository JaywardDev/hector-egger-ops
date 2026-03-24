import type { InventoryItemRecord } from "@/src/lib/inventory/items";

export type StockTakeFieldKey =
  | "item_name"
  | "item_code"
  | "unit"
  | "thickness_mm"
  | "width_mm"
  | "length_mm"
  | "grade"
  | "treatment"
  | "counted_quantity"
  | "stock_location_id"
  | "notes";

export type StockTakeFieldKind = "reference" | "editable";
export type StockTakeFieldValueType =
  | "text"
  | "number"
  | "textarea"
  | "location_id";
export type StockTakeFieldSource = "inventory" | "entry";
export type StockTakeFieldControl = "text" | "number" | "textarea" | "select";

export type StockTakeFieldDefinition = {
  key: StockTakeFieldKey;
  label: string;
  kind: StockTakeFieldKind;
  valueType: StockTakeFieldValueType;
  source: StockTakeFieldSource;
  control: StockTakeFieldControl;
  required: boolean;
};

export type StockTakeFieldConfig = {
  materialGroupKey: string;
  referenceFieldKeys: StockTakeFieldKey[];
  editableFieldKeys: StockTakeFieldKey[];
};

export type StockTakeInventoryItemDetail = Pick<
  InventoryItemRecord,
  "id" | "item_code" | "name" | "unit" | "material_group" | "timber_spec"
>;

export const stockTakeFieldLibrary: Record<
  StockTakeFieldKey,
  StockTakeFieldDefinition
> = {
  item_name: {
    key: "item_name",
    label: "Item label",
    kind: "reference",
    valueType: "text",
    source: "inventory",
    control: "text",
    required: false,
  },
  item_code: {
    key: "item_code",
    label: "Item code",
    kind: "reference",
    valueType: "text",
    source: "inventory",
    control: "text",
    required: false,
  },
  unit: {
    key: "unit",
    label: "Unit",
    kind: "reference",
    valueType: "text",
    source: "inventory",
    control: "text",
    required: false,
  },
  thickness_mm: {
    key: "thickness_mm",
    label: "Thickness (mm)",
    kind: "reference",
    valueType: "number",
    source: "inventory",
    control: "text",
    required: false,
  },
  width_mm: {
    key: "width_mm",
    label: "Width (mm)",
    kind: "reference",
    valueType: "number",
    source: "inventory",
    control: "text",
    required: false,
  },
  length_mm: {
    key: "length_mm",
    label: "Length (mm)",
    kind: "reference",
    valueType: "number",
    source: "inventory",
    control: "text",
    required: false,
  },
  grade: {
    key: "grade",
    label: "Grade",
    kind: "reference",
    valueType: "text",
    source: "inventory",
    control: "text",
    required: false,
  },
  treatment: {
    key: "treatment",
    label: "Treatment",
    kind: "reference",
    valueType: "text",
    source: "inventory",
    control: "text",
    required: false,
  },
  counted_quantity: {
    key: "counted_quantity",
    label: "Counted quantity",
    kind: "editable",
    valueType: "number",
    source: "entry",
    control: "number",
    required: true,
  },
  stock_location_id: {
    key: "stock_location_id",
    label: "Location",
    kind: "editable",
    valueType: "location_id",
    source: "entry",
    control: "select",
    required: false,
  },
  notes: {
    key: "notes",
    label: "Notes",
    kind: "editable",
    valueType: "textarea",
    source: "entry",
    control: "textarea",
    required: false,
  },
};

export const timberStockTakeFieldConfig: StockTakeFieldConfig = {
  materialGroupKey: "timber",
  referenceFieldKeys: [
    "item_name",
    "item_code",
    "unit",
    "thickness_mm",
    "width_mm",
    "length_mm",
    "grade",
    "treatment",
  ],
  editableFieldKeys: ["counted_quantity", "stock_location_id", "notes"],
};

const stockTakeGroupConfigByKey: Record<string, StockTakeFieldConfig> = {
  [timberStockTakeFieldConfig.materialGroupKey]: timberStockTakeFieldConfig,
};

export const resolveStockTakeFieldConfigForGroup = (
  materialGroupKey: string | null | undefined,
) => {
  if (!materialGroupKey) {
    return null;
  }

  return stockTakeGroupConfigByKey[materialGroupKey] ?? null;
};

const getInventoryFieldValue = (
  item: StockTakeInventoryItemDetail,
  fieldKey: StockTakeFieldKey,
): string | number | null => {
  switch (fieldKey) {
    case "item_name":
      return item.name;
    case "item_code":
      return item.item_code;
    case "unit":
      return item.unit;
    case "thickness_mm":
      return item.timber_spec?.thickness_mm ?? null;
    case "width_mm":
      return item.timber_spec?.width_mm ?? null;
    case "length_mm":
      return item.timber_spec?.length_mm ?? null;
    case "grade":
      return item.timber_spec?.grade ?? null;
    case "treatment":
      return item.timber_spec?.treatment ?? null;
    default:
      return null;
  }
};

export const resolveStockTakeFieldConfigForItem = (
  item: StockTakeInventoryItemDetail | null | undefined,
) => {
  if (!item) {
    return null;
  }

  const config = resolveStockTakeFieldConfigForGroup(item.material_group?.key);
  if (!config) {
    return null;
  }

  return {
    ...config,
    referenceFields: config.referenceFieldKeys.map((fieldKey) => ({
      definition: stockTakeFieldLibrary[fieldKey],
      value: getInventoryFieldValue(item, fieldKey),
    })),
    editableFields: config.editableFieldKeys.map((fieldKey) => ({
      definition: stockTakeFieldLibrary[fieldKey],
    })),
  };
};

export const getStockTakeFieldDefinition = (fieldKey: StockTakeFieldKey) =>
  stockTakeFieldLibrary[fieldKey];
