"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireOperationalWriteAccess } from "@/src/lib/auth/guards";
import {
  createStockLocation,
  updateStockLocation,
} from "@/src/lib/inventory/locations";

const toLocationsMessage = (message: string, type: "success" | "error") =>
  redirect(`/locations?${type}=${encodeURIComponent(message)}`);

const normalizeOptional = (value: FormDataEntryValue | null) => {
  const normalized = String(value ?? "").trim();
  return normalized.length > 0 ? normalized : null;
};

export async function createStockLocationAction(formData: FormData) {
  const code = String(formData.get("code") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const description = normalizeOptional(formData.get("description"));

  if (!code || !name) {
    toLocationsMessage("Code and name are required.", "error");
  }

  const { session, roles } = await requireOperationalWriteAccess();

  try {
    await createStockLocation({
      session,
      accessContext: {
        accountStatus: "approved",
        roles,
      },
      input: {
        code,
        name,
        description,
      },
    });
  } catch {
    toLocationsMessage("Could not create stock location.", "error");
  }

  revalidatePath("/locations");
  toLocationsMessage("Stock location created.", "success");
}

export async function updateStockLocationAction(formData: FormData) {
  const locationId = String(formData.get("locationId") ?? "").trim();
  const code = String(formData.get("code") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const description = normalizeOptional(formData.get("description"));

  if (!locationId || !code || !name) {
    toLocationsMessage("Location id, code, and name are required.", "error");
  }

  const { session, roles } = await requireOperationalWriteAccess();

  try {
    await updateStockLocation({
      session,
      accessContext: {
        accountStatus: "approved",
        roles,
      },
      locationId,
      input: {
        code,
        name,
        description,
      },
    });
  } catch {
    toLocationsMessage("Could not update stock location.", "error");
  }

  revalidatePath("/locations");
  toLocationsMessage("Stock location updated.", "success");
}
