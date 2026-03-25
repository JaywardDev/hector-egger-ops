"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  createStockTakeSession,
  createStockTakeEntry,
  getStockTakeTransitionActionMetadata,
  transitionStockTakeSession,
  type StockTakeTransitionAction,
} from "@/src/lib/stock-take/sessions";
import {
  requireOperationalWriteAccess,
  requireProtectedAccess,
} from "@/src/lib/auth/guards";
import {
  listStockTakeGroupFieldSettings,
  resolveStockTakeFieldConfigForGroup,
  resolveStockTakeFieldConfigForItem,
  stockTakeFieldLibrary,
  type StockTakeFieldKey,
} from "@/src/lib/stock-take/field-config";
import {
  createInventoryItem,
  listMaterialGroups,
  listStockTakeInventoryItems,
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

export async function saveStockTakeEntryAction(formData: FormData) {
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
    toStockTakeDetailMessage(
      sessionId,
      "Counted quantity is required.",
      "error",
      selectedInventoryItemId ?? undefined,
    );
  }

  if (!selectedInventoryItemId && !createNewMaterial) {
    toStockTakeDetailMessage(
      sessionId,
      "Select a material before saving a count.",
      "error",
    );
  }

  if (createNewMaterial && !materialGroupId) {
    toStockTakeDetailMessage(
      sessionId,
      "Material group is required when capturing a new material.",
      "error",
    );
  }

  const { session, roles } = await requireProtectedAccess();
  const route = `/stock-take/${sessionId}`;

  let finalInventoryItemId: string | null = null;

  try {
    const [inventoryItems, materialGroups, groupSettings] = await Promise.all([
      listStockTakeInventoryItems({ session, route }),
      listMaterialGroups({ session, route }),
      listStockTakeGroupFieldSettings({ session, route }),
    ]);

    const selectedItem =
      inventoryItems.find((item) => item.id === selectedInventoryItemId) ?? null;
    const selectedGroup = materialGroups.find(
      (group) => group.id === materialGroupId,
    );

    const config = createNewMaterial
      ? selectedGroup
        ? resolveStockTakeFieldConfigForGroup({
            group: selectedGroup,
            groupSettings,
          })
        : null
      : resolveStockTakeFieldConfigForItem({
          item: selectedItem,
          materialGroups,
          groupSettings,
        });

    if (!config) {
      toStockTakeDetailMessage(
        sessionId,
        "This material group has no stock-take field configuration.",
        "error",
        selectedInventoryItemId ?? undefined,
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
        toStockTakeDetailMessage(
          sessionId,
          `${stockTakeFieldLibrary[fieldKey].label} is required for this material group.`,
          "error",
          selectedInventoryItemId ?? undefined,
        );
      }
    }

    const resolvedInventoryItemId = createNewMaterial
      ? (
          await createInventoryItem({
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
        ).id
      : selectedInventoryItemId;

    if (resolvedInventoryItemId === null) {
      toStockTakeDetailMessage(
        sessionId,
        "Select a material before saving a count.",
        "error",
      );
      throw new Error("Unreachable: stock take entry requires a material id.");
    }

    finalInventoryItemId = resolvedInventoryItemId;

    await createStockTakeEntry({
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

    revalidatePath("/stock-take");
    revalidatePath(`/stock-take/${sessionId}`);
  } catch {
    toStockTakeDetailMessage(
      sessionId,
      toUserSafeErrorMessage("Could not save counted quantity."),
      "error",
      selectedInventoryItemId ?? undefined,
    );
  }

  revalidatePath("/stock-take");
  revalidatePath(`/stock-take/${sessionId}`);
  toStockTakeDetailMessage(
    sessionId,
    "Count saved.",
    "success",
    finalInventoryItemId ?? undefined,
  );
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
  toStockTakeDetailMessage(sessionId, successMessage, "success");
}
