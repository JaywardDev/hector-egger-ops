"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  archiveMaterialGroup,
  createMaterialGroup,
  updateMaterialGroup,
} from "@/src/lib/inventory/items";
import { saveStockTakeFieldConfigForGroup } from "@/src/lib/stock-take/group-field-settings";
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

export async function createMaterialGroupAction(formData: FormData) {
  const label = String(formData.get("label") ?? "").trim();
  if (!label) {
    toInventoryMessage("Material group name is required.", "error");
  }

  const { session, roles } = await requireOperationalWriteAccess();

  try {
    await createMaterialGroup({
      session,
      accessContext: {
        accountStatus: "approved",
        roles,
      },
      input: { label },
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Could not create material group.";
    toInventoryMessage(message, "error");
  }

  revalidatePath("/inventory");
  toInventoryMessage("Material group created.", "success");
}

export async function updateMaterialGroupAction(formData: FormData) {
  const materialGroupId = normalizeOptionalUuid(formData.get("materialGroupId"));
  const label = String(formData.get("label") ?? "").trim();

  if (!materialGroupId || !label) {
    return toInventoryMessage("Material group id and name are required.", "error");
  }

  const { session, roles } = await requireOperationalWriteAccess();

  try {
    await updateMaterialGroup({
      session,
      accessContext: {
        accountStatus: "approved",
        roles,
      },
      materialGroupId,
      input: { label },
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Could not update material group.";
    toInventoryMessage(message, "error");
  }

  revalidatePath("/inventory");
  toInventoryMessage("Material group updated.", "success");
}

export async function archiveMaterialGroupAction(formData: FormData) {
  const materialGroupId = normalizeOptionalUuid(formData.get("materialGroupId"));
  if (!materialGroupId) {
    return toInventoryMessage("Material group id is required.", "error");
  }

  const { session, roles } = await requireOperationalWriteAccess();

  try {
    await archiveMaterialGroup({
      session,
      accessContext: {
        accountStatus: "approved",
        roles,
      },
      materialGroupId,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Could not archive material group.";
    toInventoryMessage(message, "error");
  }

  revalidatePath("/inventory");
  toInventoryMessage("Material group archived.", "success");
}

export async function saveGroupStockTakeConfigAction(formData: FormData) {
  const materialGroupId = normalizeOptionalUuid(formData.get("materialGroupId"));
  if (!materialGroupId) {
    return toInventoryMessage("Material group id is required.", "error");
  }

  const enabledFieldKeys = formData
    .getAll("enabledFieldKeys")
    .map((entry) => String(entry))
    .filter(Boolean);
  const requiredFieldKeys = formData
    .getAll("requiredFieldKeys")
    .map((entry) => String(entry))
    .filter(Boolean);

  const { session, roles } = await requireOperationalWriteAccess();

  try {
    await saveStockTakeFieldConfigForGroup({
      session,
      accessContext: {
        accountStatus: "approved",
        roles,
      },
      materialGroupId,
      enabledFieldKeys,
      requiredFieldKeys,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Could not update stock-take form.";
    toInventoryMessage(message, "error");
  }

  revalidatePath("/inventory");
  revalidatePath("/stock-take");
  toInventoryMessage("Stock-take form updated.", "success");
}
