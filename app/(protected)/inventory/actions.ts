"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  archiveMaterialGroup,
  createMaterialGroup,
  createInventoryItem,
  updateMaterialGroup,
  updateInventoryItem,
  type TimberSpecInput,
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

const normalizeOptionalPositiveNumber = (value: FormDataEntryValue | null) => {
  const normalized = normalizeOptional(value);
  if (!normalized) {
    return null;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

const readTimberSpec = (formData: FormData): TimberSpecInput | null => {
  const timberSpec = {
    thicknessMm: normalizeOptionalPositiveNumber(
      formData.get("timberThicknessMm"),
    ),
    widthMm: normalizeOptionalPositiveNumber(formData.get("timberWidthMm")),
    lengthMm: normalizeOptionalPositiveNumber(formData.get("timberLengthMm")),
    grade: normalizeOptional(formData.get("timberGrade")),
    treatment: normalizeOptional(formData.get("timberTreatment")),
  } satisfies TimberSpecInput;

  return timberSpec;
};

export async function createInventoryItemAction(formData: FormData) {
  const itemCode = normalizeOptional(formData.get("itemCode"));
  const name = normalizeOptional(formData.get("name"));
  const unit = String(formData.get("unit") ?? "").trim();
  const description = normalizeOptional(formData.get("description"));
  const materialGroupId = normalizeOptionalUuid(
    formData.get("materialGroupId"),
  );
  const timberSpec = readTimberSpec(formData);

  const timberLabelMode =
    String(formData.get("timberLabelMode") ?? "manual") === "auto"
      ? "auto"
      : "manual";

  if (!unit) {
    toInventoryMessage("Unit is required.", "error");
  }

  const { session, roles } = await requireOperationalWriteAccess();

  try {
    await createInventoryItem({
      session,
      accessContext: {
        accountStatus: "approved",
        roles,
      },
      input: {
        itemCode,
        name,
        unit,
        description,
        materialGroupId,
        timberSpec,
        timberLabelMode,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Could not create inventory item.";
    toInventoryMessage(message, "error");
  }

  revalidatePath("/inventory");
  toInventoryMessage("Inventory item created.", "success");
}

export async function updateInventoryItemAction(formData: FormData) {
  const itemId = String(formData.get("itemId") ?? "").trim();
  const itemCode = normalizeOptional(formData.get("itemCode"));
  const name = normalizeOptional(formData.get("name"));
  const unit = String(formData.get("unit") ?? "").trim();
  const description = normalizeOptional(formData.get("description"));
  const materialGroupId = normalizeOptionalUuid(
    formData.get("materialGroupId"),
  );
  const timberSpec = readTimberSpec(formData);

  const timberLabelMode =
    String(formData.get("timberLabelMode") ?? "manual") === "auto"
      ? "auto"
      : "manual";

  if (!itemId || !unit) {
    toInventoryMessage("Item id and unit are required.", "error");
  }

  const { session, roles } = await requireOperationalWriteAccess();

  try {
    await updateInventoryItem({
      session,
      accessContext: {
        accountStatus: "approved",
        roles,
      },
      itemId,
      input: {
        itemCode,
        name,
        unit,
        description,
        materialGroupId,
        timberSpec,
        timberLabelMode,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Could not update inventory item.";
    toInventoryMessage(message, "error");
  }

  revalidatePath("/inventory");
  toInventoryMessage("Inventory item updated.", "success");
}

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
