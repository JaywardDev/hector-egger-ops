import "server-only";

import type { AuthSession } from "@/src/lib/auth/session";
import { getCurrentAccountStatus, getCurrentUserRoles } from "@/src/lib/auth/profile-access";
import { createServerSupabaseClient } from "@/src/lib/supabase/server";
import { createServiceRoleSupabaseClient } from "@/src/lib/supabase/service-role";

type MutationActor = {
  session: AuthSession;
};

export type MaterialGroupRecord = {
  id: string;
  key: string;
  label: string;
  sort_order: number | null;
  is_active: boolean;
};

export type InventoryItemRecord = {
  id: string;
  item_code: string | null;
  name: string;
  unit: string;
  description: string | null;
  material_group_id: string | null;
  material_group: Pick<MaterialGroupRecord, "id" | "key" | "label"> | null;
  created_at: string;
  updated_at: string;
};

type InventoryItemInput = {
  itemCode: string | null;
  name: string;
  unit: string;
  description: string | null;
  materialGroupId: string | null;
};

const createSessionHeaders = (session: AuthSession) => ({
  Authorization: `Bearer ${session.accessToken}`,
});

const inventoryItemSelect =
  "id,item_code,name,unit,description,material_group_id,material_group:material_groups(id,key,label),created_at,updated_at";

const assertInventoryMutationAccess = async ({ session }: MutationActor) => {
  const [accountStatus, roles] = await Promise.all([
    getCurrentAccountStatus(session),
    getCurrentUserRoles(session),
  ]);

  if (accountStatus !== "approved" || (!roles.includes("admin") && !roles.includes("supervisor"))) {
    throw new Error("Supervisor or admin access is required for inventory writes");
  }
};

export const listInventoryItems = async ({ session }: MutationActor): Promise<InventoryItemRecord[]> => {
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
};

export const listMaterialGroups = async ({ session }: MutationActor): Promise<MaterialGroupRecord[]> => {
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
};

export const createInventoryItem = async ({
  session,
  input,
}: MutationActor & { input: InventoryItemInput }): Promise<InventoryItemRecord> => {
  await assertInventoryMutationAccess({ session });

  const supabase = createServiceRoleSupabaseClient();
  const response = await supabase.request(`/rest/v1/inventory_items?select=${inventoryItemSelect}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify({
      item_code: input.itemCode,
      name: input.name,
      unit: input.unit,
      description: input.description,
      material_group_id: input.materialGroupId,
    }),
  });

  if (!response.ok) {
    throw new Error("Failed to create inventory item");
  }

  const [createdRecord] = (await response.json()) as InventoryItemRecord[];

  const eventResponse = await supabase.request("/rest/v1/stock_admin_events", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({
      event_type: "inventory_item_created",
      entity_type: "inventory_item",
      entity_id: createdRecord.id,
      actor_auth_user_id: session.user.id,
      payload: {
        name: createdRecord.name,
        unit: createdRecord.unit,
        item_code: createdRecord.item_code,
        material_group_id: createdRecord.material_group_id,
        material_group_key: createdRecord.material_group?.key ?? null,
        material_group_label: createdRecord.material_group?.label ?? null,
      },
    }),
  });

  if (!eventResponse.ok) {
    throw new Error("Failed to log inventory item create event");
  }

  return createdRecord;
};

export const updateInventoryItem = async ({
  session,
  itemId,
  input,
}: MutationActor & { itemId: string; input: InventoryItemInput }): Promise<void> => {
  await assertInventoryMutationAccess({ session });

  const supabase = createServiceRoleSupabaseClient();
  const response = await supabase.request(`/rest/v1/inventory_items?id=eq.${itemId}&select=${inventoryItemSelect}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify({
      item_code: input.itemCode,
      name: input.name,
      unit: input.unit,
      description: input.description,
      material_group_id: input.materialGroupId,
    }),
  });

  if (!response.ok) {
    throw new Error("Failed to update inventory item");
  }

  const [updatedRecord] = (await response.json()) as InventoryItemRecord[];

  const eventResponse = await supabase.request("/rest/v1/stock_admin_events", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({
      event_type: "inventory_item_updated",
      entity_type: "inventory_item",
      entity_id: itemId,
      actor_auth_user_id: session.user.id,
      payload: {
        name: updatedRecord.name,
        unit: updatedRecord.unit,
        item_code: updatedRecord.item_code,
        material_group_id: updatedRecord.material_group_id,
        material_group_key: updatedRecord.material_group?.key ?? null,
        material_group_label: updatedRecord.material_group?.label ?? null,
      },
    }),
  });

  if (!eventResponse.ok) {
    throw new Error("Failed to log inventory item update event");
  }
};
