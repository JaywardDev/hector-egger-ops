import "server-only";

import type { AuthSession } from "@/src/lib/auth/session";
import {
  getCurrentAccountStatus,
  getCurrentUserRoles,
} from "@/src/lib/auth/profile-access";
import { createServerSupabaseClient } from "@/src/lib/supabase/server";
import { createServiceRoleSupabaseClient } from "@/src/lib/supabase/service-role";
import { buildTimberItemLabel } from "@/src/lib/inventory/item-labels";
import { withServerTiming } from "@/src/lib/server-timing";

type ApprovedAccessContext = {
  accountStatus: "approved";
  roles: string[];
};

type MutationActor = {
  session: AuthSession;
  accessContext?: ApprovedAccessContext;
  route?: string;
};

export type MaterialGroupRecord = {
  id: string;
  key: string;
  label: string;
  sort_order: number | null;
  is_active: boolean;
};

export type TimberSpecRecord = {
  inventory_item_id: string;
  thickness_mm: number | null;
  width_mm: number | null;
  length_mm: number | null;
  grade: string | null;
  treatment: string | null;
  created_at: string;
  updated_at: string;
};

export type InventoryItemRecord = {
  id: string;
  item_code: string | null;
  name: string;
  unit: string;
  description: string | null;
  material_group_id: string | null;
  material_group: Pick<MaterialGroupRecord, "id" | "key" | "label"> | null;
  timber_spec: TimberSpecRecord | null;
  created_at: string;
  updated_at: string;
};

export type TimberSpecInput = {
  thicknessMm: number | null;
  widthMm: number | null;
  lengthMm: number | null;
  grade: string | null;
  treatment: string | null;
};

type InventoryItemInput = {
  itemCode: string | null;
  name: string | null;
  unit: string;
  description: string | null;
  materialGroupId: string | null;
  timberSpec: TimberSpecInput | null;
  timberLabelMode?: "auto" | "manual";
};

const TIMBER_GROUP_KEY = "timber";

const createSessionHeaders = (session: AuthSession) => ({
  Authorization: `Bearer ${session.accessToken}`,
});

const inventoryItemSelect =
  "id,item_code,name,unit,description,material_group_id,material_group:material_groups(id,key,label),timber_spec:inventory_item_timber_specs(inventory_item_id,thickness_mm,width_mm,length_mm,grade,treatment,created_at,updated_at),created_at,updated_at";

const assertInventoryMutationAccess = async ({
  session,
  accessContext,
}: MutationActor) => {
  const accountStatus =
    accessContext?.accountStatus ?? (await getCurrentAccountStatus(session));
  const roles = accessContext?.roles ?? (await getCurrentUserRoles(session));

  if (
    accountStatus !== "approved" ||
    (!roles.includes("admin") && !roles.includes("supervisor"))
  ) {
    throw new Error(
      "Supervisor or admin access is required for inventory writes",
    );
  }
};

const isTimberMaterialGroup = (
  item: Pick<InventoryItemRecord, "material_group">,
) => item.material_group?.key === TIMBER_GROUP_KEY;

const hasTimberSpecValues = (timberSpec: TimberSpecInput | null) =>
  Boolean(
    timberSpec &&
    (timberSpec.thicknessMm !== null ||
      timberSpec.widthMm !== null ||
      timberSpec.lengthMm !== null ||
      timberSpec.grade !== null ||
      timberSpec.treatment !== null),
  );

const resolveInventoryItemName = ({
  name,
  timberSpec,
  selectedMaterialGroupKey,
  timberLabelMode,
  existingRecord,
}: {
  name: string | null;
  timberSpec: TimberSpecInput | null;
  selectedMaterialGroupKey: string | null | undefined;
  timberLabelMode?: "auto" | "manual";
  existingRecord?: InventoryItemRecord;
}) => {
  const trimmedName = name?.trim() ?? "";
  const generatedLabel = buildTimberItemLabel(timberSpec);
  const isTimber = selectedMaterialGroupKey === TIMBER_GROUP_KEY;

  if (!isTimber) {
    if (!trimmedName) {
      throw new Error("Item label and unit are required.");
    }

    return trimmedName;
  }

  const existingAutoLabel = existingRecord
    ? buildTimberItemLabel(existingRecord.timber_spec)
    : "";
  const shouldUseAutoLabel =
    timberLabelMode === "auto" ||
    (!trimmedName && generatedLabel.length > 0) ||
    (Boolean(existingRecord) && trimmedName === existingAutoLabel);

  if (shouldUseAutoLabel && generatedLabel.length > 0) {
    return generatedLabel;
  }

  if (trimmedName) {
    return trimmedName;
  }

  throw new Error("Item label and unit are required.");
};

const assertValidTimberSpec = (timberSpec: TimberSpecInput | null) => {
  if (!timberSpec) {
    return;
  }

  for (const [label, value] of [
    ["Thickness", timberSpec.thicknessMm],
    ["Width", timberSpec.widthMm],
    ["Length", timberSpec.lengthMm],
  ] as const) {
    if (value !== null && value <= 0) {
      throw new Error(`${label} must be greater than zero`);
    }
  }
};

const fetchMaterialGroup = async (materialGroupId: string | null) => {
  if (!materialGroupId) {
    return null;
  }

  const supabase = createServiceRoleSupabaseClient();
  const response = await supabase.request(
    `/rest/v1/material_groups?select=id,key,label&is_active=is.true&id=eq.${materialGroupId}&limit=1`,
    {
      cache: "no-store",
      headers: {
        Prefer: "return=representation",
      },
    },
  );

  if (!response.ok) {
    throw new Error("Failed to load material group");
  }

  const [group] = (await response.json()) as Pick<
    MaterialGroupRecord,
    "id" | "key" | "label"
  >[];
  if (!group) {
    throw new Error("Selected material group was not found");
  }

  return group;
};

const fetchInventoryItemById = async (itemId: string) => {
  const supabase = createServiceRoleSupabaseClient();
  const response = await supabase.request(
    `/rest/v1/inventory_items?id=eq.${itemId}&select=${inventoryItemSelect}&limit=1`,
    {
      cache: "no-store",
      headers: {
        Prefer: "return=representation",
      },
    },
  );

  if (!response.ok) {
    throw new Error("Failed to load inventory item");
  }

  const [item] = (await response.json()) as InventoryItemRecord[];
  if (!item) {
    throw new Error("Inventory item not found");
  }

  return item;
};

const logStockAdminEvent = async ({
  eventType,
  entityId,
  actorAuthUserId,
  payload,
}: {
  eventType: string;
  entityId: string;
  actorAuthUserId: string;
  payload: Record<string, unknown>;
}) => {
  const supabase = createServiceRoleSupabaseClient();
  const eventResponse = await supabase.request("/rest/v1/stock_admin_events", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({
      event_type: eventType,
      entity_type: "inventory_item",
      entity_id: entityId,
      actor_auth_user_id: actorAuthUserId,
      payload,
    }),
  });

  if (!eventResponse.ok) {
    throw new Error(`Failed to log ${eventType} event`);
  }
};

const syncTimberSpec = async ({
  item,
  timberSpec,
  actorAuthUserId,
}: {
  item: InventoryItemRecord;
  timberSpec: TimberSpecInput | null;
  actorAuthUserId: string;
}) => {
  const supabase = createServiceRoleSupabaseClient();
  const timberSpecPayload = {
    thickness_mm: timberSpec?.thicknessMm ?? null,
    width_mm: timberSpec?.widthMm ?? null,
    length_mm: timberSpec?.lengthMm ?? null,
    grade: timberSpec?.grade ?? null,
    treatment: timberSpec?.treatment ?? null,
  };

  if (!isTimberMaterialGroup(item)) {
    if (item.timber_spec || hasTimberSpecValues(timberSpec)) {
      throw new Error(
        "Remove the timber spec before changing this item to a non-timber group",
      );
    }

    return;
  }

  if (!hasTimberSpecValues(timberSpec)) {
    if (item.timber_spec) {
      const deleteResponse = await supabase.request(
        `/rest/v1/inventory_item_timber_specs?inventory_item_id=eq.${item.id}`,
        {
          method: "DELETE",
          headers: {
            Prefer: "return=minimal",
          },
        },
      );

      if (!deleteResponse.ok) {
        throw new Error("Failed to remove timber spec");
      }

      await logStockAdminEvent({
        eventType: "inventory_item_timber_spec_deleted",
        entityId: item.id,
        actorAuthUserId,
        payload: {
          material_group_id: item.material_group_id,
          material_group_key: item.material_group?.key ?? null,
          material_group_label: item.material_group?.label ?? null,
        },
      });
    }

    return;
  }

  const upsertResponse = await supabase.request(
    "/rest/v1/inventory_item_timber_specs?on_conflict=inventory_item_id",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=representation",
      },
      body: JSON.stringify({
        inventory_item_id: item.id,
        ...timberSpecPayload,
      }),
    },
  );

  if (!upsertResponse.ok) {
    throw new Error("Failed to save timber spec");
  }

  const [savedSpec] = (await upsertResponse.json()) as TimberSpecRecord[];
  await logStockAdminEvent({
    eventType: "inventory_item_timber_spec_upserted",
    entityId: item.id,
    actorAuthUserId,
    payload: {
      material_group_id: item.material_group_id,
      material_group_key: item.material_group?.key ?? null,
      material_group_label: item.material_group?.label ?? null,
      timber_spec: {
        thickness_mm: savedSpec?.thickness_mm ?? null,
        width_mm: savedSpec?.width_mm ?? null,
        length_mm: savedSpec?.length_mm ?? null,
        grade: savedSpec?.grade ?? null,
        treatment: savedSpec?.treatment ?? null,
      },
    },
  });
};

export type InventoryItemOptionRecord = Pick<
  InventoryItemRecord,
  "id" | "item_code" | "name" | "unit"
>;

export type StockTakeInventoryItemRecord = Pick<
  InventoryItemRecord,
  "id" | "item_code" | "name" | "unit" | "material_group" | "timber_spec"
>;

export const listInventoryItems = async ({
  session,
  route,
}: MutationActor): Promise<InventoryItemRecord[]> =>
  withServerTiming({
    name: "listInventoryItems",
    route,
    operation: async () => {
      const supabase = createServerSupabaseClient();
      const response = await supabase.request(
        `/rest/v1/inventory_items?select=${inventoryItemSelect}&order=name.asc`,
        {
          cache: "no-store",
          headers: createSessionHeaders(session),
        },
      );

      if (!response.ok) {
        throw new Error("Failed to load inventory items");
      }

      return (await response.json()) as InventoryItemRecord[];
    },
  });

export const listInventoryItemOptions = async ({
  session,
  route,
}: MutationActor): Promise<InventoryItemOptionRecord[]> =>
  withServerTiming({
    name: "listInventoryItemOptions",
    route,
    operation: async () => {
      const supabase = createServerSupabaseClient();
      const response = await supabase.request(
        "/rest/v1/inventory_items?select=id,item_code,name,unit&order=name.asc",
        {
          cache: "no-store",
          headers: createSessionHeaders(session),
        },
      );

      if (!response.ok) {
        throw new Error("Failed to load inventory item options");
      }

      return (await response.json()) as InventoryItemOptionRecord[];
    },
  });


export const listStockTakeInventoryItems = async ({
  session,
  route,
}: MutationActor): Promise<StockTakeInventoryItemRecord[]> =>
  withServerTiming({
    name: "listStockTakeInventoryItems",
    route,
    operation: async () => {
      const supabase = createServerSupabaseClient();
      const response = await supabase.request(
        `/rest/v1/inventory_items?select=${inventoryItemSelect}&order=name.asc`,
        {
          cache: "no-store",
          headers: createSessionHeaders(session),
        },
      );

      if (!response.ok) {
        throw new Error("Failed to load stock take inventory items");
      }

      return (await response.json()) as StockTakeInventoryItemRecord[];
    },
  });

export const listMaterialGroups = async ({
  session,
  route,
}: MutationActor): Promise<MaterialGroupRecord[]> =>
  withServerTiming({
    name: "listMaterialGroups",
    route,
    operation: async () => {
      const supabase = createServerSupabaseClient();
      const response = await supabase.request(
        "/rest/v1/material_groups?select=id,key,label,sort_order,is_active&is_active=is.true&order=sort_order.asc.nullslast,label.asc",
        {
          cache: "no-store",
          headers: createSessionHeaders(session),
        },
      );

      if (!response.ok) {
        throw new Error("Failed to load material groups");
      }

      return (await response.json()) as MaterialGroupRecord[];
    },
  });

export const createInventoryItem = async ({
  session,
  accessContext,
  input,
}: MutationActor & {
  input: InventoryItemInput;
}): Promise<InventoryItemRecord> => {
  await assertInventoryMutationAccess({ session, accessContext });
  assertValidTimberSpec(input.timberSpec);

  const selectedMaterialGroup = await fetchMaterialGroup(input.materialGroupId);
  if (
    selectedMaterialGroup?.key !== TIMBER_GROUP_KEY &&
    hasTimberSpecValues(input.timberSpec)
  ) {
    throw new Error("Timber specs are only allowed for timber items");
  }

  const resolvedName = resolveInventoryItemName({
    name: input.name,
    timberSpec: input.timberSpec,
    selectedMaterialGroupKey: selectedMaterialGroup?.key,
    timberLabelMode: input.timberLabelMode,
  });

  const supabase = createServiceRoleSupabaseClient();
  const response = await supabase.request(
    `/rest/v1/inventory_items?select=${inventoryItemSelect}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        item_code: input.itemCode,
        name: resolvedName,
        unit: input.unit,
        description: input.description,
        material_group_id: input.materialGroupId,
      }),
    },
  );

  if (!response.ok) {
    throw new Error("Failed to create inventory item");
  }

  const [createdRecord] = (await response.json()) as InventoryItemRecord[];

  await syncTimberSpec({
    item: {
      ...createdRecord,
      material_group: selectedMaterialGroup,
    },
    timberSpec: input.timberSpec,
    actorAuthUserId: session.user.id,
  });

  const refreshedRecord = await fetchInventoryItemById(createdRecord.id);

  await logStockAdminEvent({
    eventType: "inventory_item_created",
    entityId: refreshedRecord.id,
    actorAuthUserId: session.user.id,
    payload: {
      name: refreshedRecord.name,
      unit: refreshedRecord.unit,
      item_code: refreshedRecord.item_code,
      material_group_id: refreshedRecord.material_group_id,
      material_group_key: refreshedRecord.material_group?.key ?? null,
      material_group_label: refreshedRecord.material_group?.label ?? null,
      timber_spec: refreshedRecord.timber_spec
        ? {
            thickness_mm: refreshedRecord.timber_spec.thickness_mm,
            width_mm: refreshedRecord.timber_spec.width_mm,
            length_mm: refreshedRecord.timber_spec.length_mm,
            grade: refreshedRecord.timber_spec.grade,
            treatment: refreshedRecord.timber_spec.treatment,
          }
        : null,
    },
  });

  return refreshedRecord;
};

export const updateInventoryItem = async ({
  session,
  accessContext,
  itemId,
  input,
}: MutationActor & {
  itemId: string;
  input: InventoryItemInput;
}): Promise<void> => {
  await assertInventoryMutationAccess({ session, accessContext });
  assertValidTimberSpec(input.timberSpec);

  const existingRecord = await fetchInventoryItemById(itemId);
  const selectedMaterialGroup = await fetchMaterialGroup(input.materialGroupId);
  if (
    selectedMaterialGroup?.key !== TIMBER_GROUP_KEY &&
    hasTimberSpecValues(input.timberSpec)
  ) {
    throw new Error("Timber specs are only allowed for timber items");
  }
  if (
    existingRecord.material_group?.key === TIMBER_GROUP_KEY &&
    selectedMaterialGroup?.key !== TIMBER_GROUP_KEY &&
    existingRecord.timber_spec
  ) {
    throw new Error(
      "Remove the timber spec before changing this item to a non-timber group",
    );
  }

  const resolvedName = resolveInventoryItemName({
    name: input.name,
    timberSpec: input.timberSpec,
    selectedMaterialGroupKey: selectedMaterialGroup?.key,
    timberLabelMode: input.timberLabelMode,
    existingRecord,
  });

  const supabase = createServiceRoleSupabaseClient();
  const response = await supabase.request(
    `/rest/v1/inventory_items?id=eq.${itemId}&select=${inventoryItemSelect}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        item_code: input.itemCode,
        name: resolvedName,
        unit: input.unit,
        description: input.description,
        material_group_id: input.materialGroupId,
      }),
    },
  );

  if (!response.ok) {
    throw new Error("Failed to update inventory item");
  }

  const [updatedRecord] = (await response.json()) as InventoryItemRecord[];

  await syncTimberSpec({
    item: {
      ...updatedRecord,
      material_group: selectedMaterialGroup,
    },
    timberSpec: input.timberSpec,
    actorAuthUserId: session.user.id,
  });

  const refreshedRecord = await fetchInventoryItemById(itemId);

  await logStockAdminEvent({
    eventType: "inventory_item_updated",
    entityId: itemId,
    actorAuthUserId: session.user.id,
    payload: {
      name: refreshedRecord.name,
      unit: refreshedRecord.unit,
      item_code: refreshedRecord.item_code,
      material_group_id: refreshedRecord.material_group_id,
      material_group_key: refreshedRecord.material_group?.key ?? null,
      material_group_label: refreshedRecord.material_group?.label ?? null,
      timber_spec: refreshedRecord.timber_spec
        ? {
            thickness_mm: refreshedRecord.timber_spec.thickness_mm,
            width_mm: refreshedRecord.timber_spec.width_mm,
            length_mm: refreshedRecord.timber_spec.length_mm,
            grade: refreshedRecord.timber_spec.grade,
            treatment: refreshedRecord.timber_spec.treatment,
          }
        : null,
    },
  });
};
