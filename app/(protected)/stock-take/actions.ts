"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  createStockTakeSession,
  upsertStockTakeEntry,
} from "@/src/lib/stock-take/sessions";
import {
  requireOperationalWriteAccess,
  requireProtectedAccess,
} from "@/src/lib/auth/guards";

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
) =>
  redirect(`/stock-take/${sessionId}?${type}=${encodeURIComponent(message)}`);

export async function createStockTakeSessionAction(formData: FormData) {
  const title = normalizeRequired(formData.get("title"));
  const stockLocationId = normalizeRequired(formData.get("stockLocationId"));
  const notes = normalizeOptional(formData.get("notes"));

  if (!title || !stockLocationId) {
    toStockTakeListMessage("Title and stock location are required.", "error");
  }

  const { session, roles } = await requireOperationalWriteAccess();

  try {
    const createdSession = await createStockTakeSession({
      session,
      accessContext: {
        accountStatus: "approved",
        roles,
      },
      input: {
        title,
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
    );
  }

  const { session, roles } = await requireProtectedAccess();

  try {
    await upsertStockTakeEntry({
      session,
      accessContext: {
        accountStatus: "approved",
        roles,
      },
      sessionId,
      input: {
        inventoryItemId,
        countedQuantity,
        notes,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Could not save counted quantity.";
    toStockTakeDetailMessage(sessionId, message, "error");
  }

  revalidatePath("/stock-take");
  revalidatePath(`/stock-take/${sessionId}`);
  toStockTakeDetailMessage(sessionId, "Count saved.", "success");
}
