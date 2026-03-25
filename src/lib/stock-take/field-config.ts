import "server-only";

import type { AuthSession } from "@/src/lib/auth/session";
import { createServerSupabaseClient } from "@/src/lib/supabase/server";
import type { InventoryItemRecord, MaterialGroupRecord } from "@/src/lib/inventory/items";
import { withServerTiming } from "@/src/lib/server-timing";

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
  supportsRequiredToggle?: boolean;
};

export type StockTakeFieldConfig = {
  materialGroupKey: string;
  referenceFieldKeys: StockTakeFieldKey[];
  editableFieldKeys: StockTakeFieldKey[];
  requiredEditableFieldKeys: StockTakeFieldKey[];
};

export type StockTakeInventoryItemDetail = Pick<
  InventoryItemRecord,
  "id" | "item_code" | "name" | "unit" | "material_group" | "timber_spec"
>;

type GroupFieldSettingRecord = {
  material_group_id: string;
  field_key: StockTakeFieldKey;
  is_enabled: boolean;
  is_required: boolean;
};

const createSessionHeaders = (session: AuthSession) => ({
  Authorization: `Bearer ${session.accessToken}`,
});

export const stockTakeFieldLibrary: Record<
  StockTakeFieldKey,
  StockTakeFieldDefinition
> = {
  item_name: {
    key: "item_name",
    label: "Material label",
    kind: "reference",
    valueType: "text",
    source: "inventory",
    control: "text",
    required: false,
  },
  item_code: {
    key: "item_code",
    label: "Code",
    kind: "reference",
    valueType: "text",
    source: "inventory",
    control: "text",
    required: false,
  },
  unit: {
    key: "unit",
    label: "Quantity label",
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
    label: "Storage location",
    kind: "editable",
    valueType: "location_id",
    source: "entry",
    control: "select",
    required: false,
    supportsRequiredToggle: true,
  },
  notes: {
    key: "notes",
    label: "Notes",
    kind: "editable",
    valueType: "textarea",
    source: "entry",
    control: "textarea",
    required: false,
    supportsRequiredToggle: true,
  },
};

const timberDefaultConfig: StockTakeFieldConfig = {
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
  requiredEditableFieldKeys: ["counted_quantity"],
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

const normalizeEditableConfig = (
  editableFieldKeys: StockTakeFieldKey[],
  requiredEditableFieldKeys: StockTakeFieldKey[],
) => {
  const editableSet = new Set(editableFieldKeys);
  editableSet.add("counted_quantity");

  const requiredSet = new Set(
    requiredEditableFieldKeys.filter((key) => editableSet.has(key)),
  );
  requiredSet.add("counted_quantity");

  return {
    editableFieldKeys: Array.from(editableSet),
    requiredEditableFieldKeys: Array.from(requiredSet),
  };
};

const resolveStockTakeFieldConfigForGroupInternal = ({
  group,
  groupSettings,
}: {
  group: Pick<MaterialGroupRecord, "id" | "key">;
  groupSettings: GroupFieldSettingRecord[];
}): StockTakeFieldConfig | null => {
  const settings = groupSettings.filter(
    (setting) => setting.material_group_id === group.id,
  );

  if (settings.length === 0) {
    return group.key === "timber" ? timberDefaultConfig : null;
  }

  const referenceFieldKeys = settings
    .filter(
      (setting) =>
        setting.is_enabled && stockTakeFieldLibrary[setting.field_key].kind === "reference",
    )
    .map((setting) => setting.field_key);

  const editableFieldKeys = settings
    .filter(
      (setting) =>
        setting.is_enabled && stockTakeFieldLibrary[setting.field_key].kind === "editable",
    )
    .map((setting) => setting.field_key);

  const requiredEditableFieldKeys = settings
    .filter(
      (setting) =>
        setting.is_enabled &&
        setting.is_required &&
        stockTakeFieldLibrary[setting.field_key].kind === "editable",
    )
    .map((setting) => setting.field_key);

  const normalizedEditableConfig = normalizeEditableConfig(
    editableFieldKeys,
    requiredEditableFieldKeys,
  );

  return {
    materialGroupKey: group.key,
    referenceFieldKeys,
    editableFieldKeys: normalizedEditableConfig.editableFieldKeys,
    requiredEditableFieldKeys: normalizedEditableConfig.requiredEditableFieldKeys,
  };
};

export const listStockTakeGroupFieldSettings = async ({
  session,
  route,
}: {
  session: AuthSession;
  route?: string;
}): Promise<GroupFieldSettingRecord[]> =>
  withServerTiming({
    name: "listStockTakeGroupFieldSettings",
    route,
    operation: async () => {
      const supabase = createServerSupabaseClient();
      const response = await supabase.request(
        "/rest/v1/stock_take_group_field_settings?select=material_group_id,field_key,is_enabled,is_required",
        {
          cache: "no-store",
          headers: createSessionHeaders(session),
        },
      );

      if (!response.ok) {
        throw new Error("Failed to load stock-take field settings");
      }

      return (await response.json()) as GroupFieldSettingRecord[];
    },
  });

export const resolveStockTakeFieldConfigForGroup = ({
  group,
  groupSettings,
}: {
  group: Pick<MaterialGroupRecord, "id" | "key">;
  groupSettings: GroupFieldSettingRecord[];
}) => resolveStockTakeFieldConfigForGroupInternal({ group, groupSettings });

export const resolveStockTakeFieldConfigForItem = ({
  item,
  materialGroups,
  groupSettings,
}: {
  item: StockTakeInventoryItemDetail | null | undefined;
  materialGroups: Pick<MaterialGroupRecord, "id" | "key">[];
  groupSettings: GroupFieldSettingRecord[];
}) => {
  if (!item || !item.material_group?.id) {
    return null;
  }

  const matchedGroup = materialGroups.find(
    (group) => group.id === item.material_group?.id,
  );

  if (!matchedGroup) {
    return null;
  }

  const config = resolveStockTakeFieldConfigForGroupInternal({
    group: matchedGroup,
    groupSettings,
  });

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
      definition: {
        ...stockTakeFieldLibrary[fieldKey],
        required: config.requiredEditableFieldKeys.includes(fieldKey),
      },
    })),
  };
};

export const getStockTakeFieldDefinition = (fieldKey: StockTakeFieldKey) =>
  stockTakeFieldLibrary[fieldKey];
