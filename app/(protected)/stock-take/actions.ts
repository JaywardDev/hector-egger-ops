"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  createStockTakeSession,
  getStockTakeTransitionActionMetadata,
  transitionStockTakeSession,
  upsertStockTakeEntry,
  type StockTakeTransitionAction,
} from "@/src/lib/stock-take/sessions";
import {
  requireOperationalWriteAccess,
  requireProtectedAccess,
} from "@/src/lib/auth/guards";
import {
  listStockTakeGroupFieldSettings,
  resolveStockTakeFieldConfigForItem,
} from "@/src/lib/stock-take/field-config";
import {
  listMaterialGroups,
  listStockTakeInventoryItems,
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

const toStockTakeListMessage = (message: string, type: "success" | "error") =>
  redirect(`/stock-take?${type}=${encodeURIComponent(message)}`);

const toStockTakeDetailMessage = (
  sessionId: string,
  message: string,
  type: "success" | "error",
  inventoryItemId?: string,
) => {
  const params = new URLSearchParams({
    [type]: message,
  });

  if (inventoryItemId) {
    params.set("inventoryItemId", inventoryItemId);
  }

  redirect(`/stock-take/${sessionId}?${params.toString()}`);
};

export async function createStockTakeSessionAction(formData: FormData) {
  const stockLocationId = normalizeOptional(formData.get("stockLocationId"));
  const notes = normalizeOptional(formData.get("notes"));

  const { session, roles } = await requireOperationalWriteAccess();

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

    revalidatePath("/stock-take");
    redirect(
      `/stock-take/${createdSession.id}?success=${encodeURIComponent("Stock take session created.")}`,
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Could not create stock take session.";
    toStockTakeListMessage(message, "error");
  }
}

export async function saveStockTakeEntryAction(formData: FormData) {
  const sessionId = normalizeRequired(formData.get("sessionId"));
  const inventoryItemId = normalizeRequired(formData.get("inventoryItemId"));
  const countedQuantity = normalizeNonNegativeNumber(
    formData.get("countedQuantity"),
  );
  const stockLocationId = normalizeOptional(formData.get("stockLocationId"));
  const notes = normalizeOptional(formData.get("notes"));

  if (
    !sessionId ||
    !inventoryItemId ||
    Number.isNaN(countedQuantity) ||
    countedQuantity < 0
  ) {
    toStockTakeDetailMessage(
      sessionId,
      "Item and counted quantity are required.",
      "error",
      inventoryItemId,
    );
  }

  const { session, roles } = await requireProtectedAccess();
  const route = `/stock-take/${sessionId}`;

  try {
    const [inventoryItems, materialGroups, groupSettings] = await Promise.all([
      listStockTakeInventoryItems({ session, route }),
      listMaterialGroups({ session, route }),
      listStockTakeGroupFieldSettings({ session, route }),
    ]);

    const selectedItem =
      inventoryItems.find((item) => item.id === inventoryItemId) ?? null;
    const config = resolveStockTakeFieldConfigForItem({
      item: selectedItem,
      materialGroups,
      groupSettings,
    });
    const locationRequired = Boolean(
      config?.requiredEditableFieldKeys.includes("stock_location_id"),
    );
    const notesRequired = Boolean(
      config?.requiredEditableFieldKeys.includes("notes"),
    );

    if (locationRequired && !stockLocationId) {
      toStockTakeDetailMessage(
        sessionId,
        "Counted location is required for this material group.",
        "error",
        inventoryItemId,
      );
    }

    if (notesRequired && !notes) {
      toStockTakeDetailMessage(
        sessionId,
        "Notes are required for this material group.",
        "error",
        inventoryItemId,
      );
    }

    await upsertStockTakeEntry({
      session,
      accessContext: {
        accountStatus: "approved",
        roles,
      },
      sessionId,
      input: {
        inventoryItemId,
        stockLocationId,
        countedQuantity,
        notes,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Could not save counted quantity.";
    toStockTakeDetailMessage(sessionId, message, "error", inventoryItemId);
  }

  revalidatePath("/stock-take");
  revalidatePath(`/stock-take/${sessionId}`);
  toStockTakeDetailMessage(sessionId, "Count saved.", "success", inventoryItemId);
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

  try {
    const updatedSession = await transitionStockTakeSession({
      session,
      accessContext: {
        accountStatus: "approved",
        roles,
      },
      sessionId,
      action,
    });

    const metadata = getStockTakeTransitionActionMetadata(action);

    revalidatePath("/stock-take");
    revalidatePath(`/stock-take/${sessionId}`);
    toStockTakeDetailMessage(updatedSession.id, metadata.successMessage, "success");
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Could not update stock take session status.";
    toStockTakeDetailMessage(sessionId, message, "error");
  }
}
