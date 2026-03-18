"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createInventoryItem, updateInventoryItem } from "@/src/lib/inventory/items";
import { requireOperationalWriteAccess } from "@/src/lib/auth/guards";

const toInventoryMessage = (message: string, type: "success" | "error") =>
  redirect(`/inventory?${type}=${encodeURIComponent(message)}`);

const normalizeOptional = (value: FormDataEntryValue | null) => {
  const normalized = String(value ?? "").trim();
  return normalized.length > 0 ? normalized : null;
};

const normalizeOptionalUuid = (value: FormDataEntryValue | null) => {
  const normalized = normalizeOptional(value);
  return normalized && /^[0-9a-f-]{36}$/i.test(normalized) ? normalized : null;
};

export async function createInventoryItemAction(formData: FormData) {
  const itemCode = normalizeOptional(formData.get("itemCode"));
  const name = String(formData.get("name") ?? "").trim();
  const unit = String(formData.get("unit") ?? "").trim();
  const description = normalizeOptional(formData.get("description"));
  const materialGroupId = normalizeOptionalUuid(formData.get("materialGroupId"));

  if (!name || !unit) {
    toInventoryMessage("Name and unit are required.", "error");
  }

  const { session } = await requireOperationalWriteAccess();

  try {
    await createInventoryItem({
      session,
      input: {
        itemCode,
        name,
        unit,
        description,
        materialGroupId,
      },
    });
  } catch {
    toInventoryMessage("Could not create inventory item.", "error");
  }

  revalidatePath("/inventory");
  toInventoryMessage("Inventory item created.", "success");
}

export async function updateInventoryItemAction(formData: FormData) {
  const itemId = String(formData.get("itemId") ?? "").trim();
  const itemCode = normalizeOptional(formData.get("itemCode"));
  const name = String(formData.get("name") ?? "").trim();
  const unit = String(formData.get("unit") ?? "").trim();
  const description = normalizeOptional(formData.get("description"));
  const materialGroupId = normalizeOptionalUuid(formData.get("materialGroupId"));

  if (!itemId || !name || !unit) {
    toInventoryMessage("Item id, name, and unit are required.", "error");
  }

  const { session } = await requireOperationalWriteAccess();

  try {
    await updateInventoryItem({
      session,
      itemId,
      input: {
        itemCode,
        name,
        unit,
        description,
        materialGroupId,
      },
    });
  } catch {
    toInventoryMessage("Could not update inventory item.", "error");
  }

  revalidatePath("/inventory");
  toInventoryMessage("Inventory item updated.", "success");
}
