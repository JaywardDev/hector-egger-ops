"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  createStockTakeSession,
  createStockTakeEntry,
  getStockTakeTransitionActionMetadata,
  type StockTakeEntryRecord,
  transitionStockTakeSession,
  type StockTakeTransitionAction,
} from "@/src/lib/stock-take/sessions";
import {
  requireOperationalWriteAccess,
  requireProtectedAccess,
} from "@/src/lib/auth/guards";
import {
  listStockTakeGroupFieldSettingsForMaterialGroup,
  resolveStockTakeFieldConfigForGroup,
  stockTakeFieldLibrary,
  type StockTakeFieldKey,
} from "@/src/lib/stock-take/field-config";
import {
  createInventoryItem,
  getActiveMaterialGroupById,
  getStockTakeInventoryItemById,
  type TimberSpecInput,
} from "@/src/lib/inventory/items";

const normalizeOptional = (value: FormDataEntryValue | null) => {
  const normalized = String(value ?? "").trim();
  return normalized.length > 0 ? normalized : null;
};

const normalizeRequired = (value: FormDataEntryValue | null) =>
  String(value ?? "").trim();

const normalizeNonNegativeNumber = (value: FormDataEntryValue | null) => {
  const normalized = normalizeRequired(value);
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
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

const readFieldValueForValidation = ({
  fieldKey,
  countedQuantity,
  stockLocationId,
  notes,
}: {
  fieldKey: StockTakeFieldKey;
  countedQuantity: number;
  stockLocationId: string | null;
  notes: string | null;
}) => {
  switch (fieldKey) {
    case "counted_quantity":
      return Number.isFinite(countedQuantity) && countedQuantity >= 0
        ? String(countedQuantity)
        : "";
    case "stock_location_id":
      return stockLocationId ?? "";
    case "notes":
      return notes ?? "";
    default:
      return "";
  }
};

const toStockTakeListMessage = (message: string, type: "success" | "error") =>
  redirect(`/stock-take?${type}=${encodeURIComponent(message)}`);

const toStockTakeDetailMessage = (
  sessionId: string,
  message: string,
  type: "success" | "error",
  inventoryItemId?: string,
): never => {
  const params = new URLSearchParams({
    [type]: message,
  });

  if (inventoryItemId) {
    params.set("inventoryItemId", inventoryItemId);
  }

  redirect(`/stock-take/${sessionId}?${params.toString()}`);
};

const toUserSafeErrorMessage = (fallback: string) => fallback;

type SaveStockTakeEntryClientRow = {
  id: string;
  inventory_item: {
    id: string;
    name: string;
    item_code: string | null;
    unit: string;
    material_group: { label: string | null } | null;
  } | null;
  counted_quantity: number;
  stock_location: { name: string; code: string | null } | null;
  notes: string | null;
  updated_at: string | null;
  entered_at: string;
};

export type SaveStockTakeEntryActionResult =
  | {
      ok: true;
      message: string;
      entry: SaveStockTakeEntryClientRow;
      createdInventoryItem: {
        id: string;
        name: string;
        item_code: string | null;
        unit: string;
        material_group: { label: string | null } | null;
      } | null;
    }
  | {
      ok: false;
      message: string;
      inventoryItemId: string | null;
    };

const toSaveEntryErrorResult = (
  message: string,
  inventoryItemId?: string | null,
): SaveStockTakeEntryActionResult => ({
  ok: false,
  message,
  inventoryItemId: inventoryItemId ?? null,
});

const toClientEntryRow = ({
  entry,
  materialGroupLabel,
}: {
  entry: StockTakeEntryRecord;
  materialGroupLabel: string | null;
}): SaveStockTakeEntryClientRow => ({
  id: entry.id,
  inventory_item: entry.inventory_item
    ? {
        ...entry.inventory_item,
        material_group: {
          label: materialGroupLabel,
        },
      }
    : null,
  counted_quantity: entry.counted_quantity,
  stock_location: entry.stock_location
    ? {
        name: entry.stock_location.name,
        code: entry.stock_location.code,
      }
    : null,
  notes: entry.notes,
  updated_at: entry.updated_at,
  entered_at: entry.entered_at,
});

export async function createStockTakeSessionAction(formData: FormData) {
  const stockLocationId = normalizeOptional(formData.get("stockLocationId"));
  const notes = normalizeOptional(formData.get("notes"));

  const { session, roles } = await requireOperationalWriteAccess();

  let createdSessionId: string | null = null;

  try {
    const createdSession = await createStockTakeSession({
      session,
      accessContext: {
        accountStatus: "approved",
        roles,
      },
      input: {
        stockLocationId,
        notes,
      },
    });

    createdSessionId = createdSession.id;
  } catch {
    toStockTakeListMessage(
      toUserSafeErrorMessage("Could not create stock take session."),
      "error",
    );
  }

  revalidatePath("/stock-take");
  if (!createdSessionId) {
    toStockTakeListMessage(
      toUserSafeErrorMessage("Unable to create stock take session."),
      "error",
    );
  }
  redirect(
    `/stock-take/${createdSessionId}?success=${encodeURIComponent("Stock take session created.")}`,
  );
}

export async function saveStockTakeEntryAction(
  formData: FormData,
): Promise<SaveStockTakeEntryActionResult> {
  const sessionId = normalizeRequired(formData.get("sessionId"));
  const selectedInventoryItemId = normalizeOptional(formData.get("inventoryItemId"));
  const createNewMaterial =
    normalizeRequired(formData.get("entryMode")) === "create-material";
  const countedQuantity = normalizeNonNegativeNumber(
    formData.get("countedQuantity"),
  );
  const stockLocationId = normalizeOptional(formData.get("stockLocationId"));
  const notes = normalizeOptional(formData.get("notes"));

  const itemCode = normalizeOptional(formData.get("itemCode"));
  const name = normalizeOptional(formData.get("name"));
  const unit = normalizeOptional(formData.get("unit"));
  const description = normalizeOptional(formData.get("description"));
  const materialGroupId = normalizeOptional(formData.get("materialGroupId"));
  const timberSpec = readTimberSpec(formData);

  const timberLabelMode =
    String(formData.get("timberLabelMode") ?? "manual") === "auto"
      ? "auto"
      : "manual";

  if (!sessionId || Number.isNaN(countedQuantity) || countedQuantity < 0) {
    return toSaveEntryErrorResult(
      "Counted quantity is required.",
      selectedInventoryItemId,
    );
  }

  if (!selectedInventoryItemId && !createNewMaterial) {
    return toSaveEntryErrorResult("Select a material before saving a count.");
  }

  if (createNewMaterial && !materialGroupId) {
    return toSaveEntryErrorResult(
      "Material group is required when capturing a new material.",
    );
  }

  const { session, roles } = await requireProtectedAccess();
  const route = `/stock-take/${sessionId}`;

  let finalInventoryItemId: string | null = null;
  let createdInventoryItem:
    | {
        id: string;
        name: string;
        item_code: string | null;
        unit: string;
        material_group: { label: string | null } | null;
      }
    | null = null;

  try {
    const selectedItem =
      !createNewMaterial && selectedInventoryItemId
        ? await getStockTakeInventoryItemById({
            session,
            route,
            itemId: selectedInventoryItemId,
          })
        : null;
    const selectedGroup =
      createNewMaterial && materialGroupId
        ? await getActiveMaterialGroupById({
            session,
            route,
            materialGroupId,
          })
        : selectedItem?.material_group ?? null;
    const groupSettings = selectedGroup
      ? await listStockTakeGroupFieldSettingsForMaterialGroup({
          session,
          route,
          materialGroupId: selectedGroup.id,
        })
      : [];

    const config = selectedGroup
      ? resolveStockTakeFieldConfigForGroup({
          group: selectedGroup,
          groupSettings,
        })
      : null;

    if (!config) {
      return toSaveEntryErrorResult(
        "This material group has no stock-take field configuration.",
        selectedInventoryItemId,
      );
    }
    const resolvedConfig = config as NonNullable<typeof config>;

    for (const fieldKey of resolvedConfig.requiredEditableFieldKeys) {
      const value = readFieldValueForValidation({
        fieldKey,
        countedQuantity,
        stockLocationId,
        notes,
      });
      if (!String(value).trim()) {
        return toSaveEntryErrorResult(
          `${stockTakeFieldLibrary[fieldKey].label} is required for this material group.`,
          selectedInventoryItemId,
        );
      }
    }

    const createdItem = createNewMaterial
      ? await createInventoryItem({
          session,
          accessContext: {
            accountStatus: "approved",
            roles,
          },
          allowOperatorWrite: true,
          input: {
            itemCode,
            name,
            unit: unit ?? "",
            description,
            materialGroupId,
            timberSpec,
            timberLabelMode,
          },
        })
      : null;
    const resolvedInventoryItemId = createdItem?.id ?? selectedInventoryItemId;

    if (resolvedInventoryItemId === null) {
      return toSaveEntryErrorResult("Select a material before saving a count.");
    }

    finalInventoryItemId = resolvedInventoryItemId;
    if (createdItem) {
      createdInventoryItem = {
        id: createdItem.id,
        name: createdItem.name,
        item_code: createdItem.item_code,
        unit: createdItem.unit,
        material_group: {
          label: selectedGroup?.label ?? null,
        },
      };
    }

    const createdEntry = await createStockTakeEntry({
      session,
      accessContext: {
        accountStatus: "approved",
        roles,
      },
      sessionId,
      input: {
        inventoryItemId: finalInventoryItemId,
        stockLocationId,
        countedQuantity,
        notes,
      },
    });

    const entryMaterialGroupLabel = createNewMaterial
      ? (selectedGroup?.label ?? null)
      : (selectedItem?.material_group?.label ?? null);

    return {
      ok: true,
      message: "Count saved.",
      entry: toClientEntryRow({
        entry: createdEntry,
        materialGroupLabel: entryMaterialGroupLabel,
      }),
      createdInventoryItem,
    };
  } catch {
    return toSaveEntryErrorResult(
      toUserSafeErrorMessage("Could not save counted quantity."),
      finalInventoryItemId ?? selectedInventoryItemId,
    );
  }
}

export async function transitionStockTakeSessionAction(formData: FormData) {
  const sessionId = normalizeRequired(formData.get("sessionId"));
  const action = normalizeRequired(
    formData.get("transitionAction"),
  ) as StockTakeTransitionAction;

  if (!sessionId || !(action in { start: true, submit: true, review: true, close: true })) {
    toStockTakeListMessage("A valid stock take transition is required.", "error");
  }

  const { session, roles } = await requireOperationalWriteAccess();

  let successMessage: string | null = null;

  try {
    await transitionStockTakeSession({
      session,
      accessContext: {
        accountStatus: "approved",
        roles,
      },
      sessionId,
      action,
    });

    const metadata = getStockTakeTransitionActionMetadata(action);
    successMessage = metadata.successMessage;
  } catch {
    toStockTakeDetailMessage(
      sessionId,
      toUserSafeErrorMessage("Could not update stock take session status."),
      "error",
    );
  }

  if (!successMessage) {
    toStockTakeDetailMessage(
      sessionId,
      "Unable to complete the stock take action.",
      "error",
    );
    return;
  }

  revalidatePath("/stock-take");
  revalidatePath(`/stock-take/${sessionId}`);
  if (action === "close") {
    revalidatePath("/inventory");
  }
  toStockTakeDetailMessage(sessionId, successMessage, "success");
}
