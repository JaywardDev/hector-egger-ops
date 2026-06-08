"use server";

import { revalidatePath } from "next/cache";
import { requireProtectedAccess } from "@/src/lib/auth/guards";
import {
  createStockArea,
  createTimberMaterial,
  updateTimberStockRowsForArea,
} from "@/src/lib/stock-take/data";
import type { TimberStockRowInput } from "@/src/lib/stock-take/types";

export type StockTakeActionState = {
  ok: boolean;
  message: string;
  selectedAreaId?: string;
};

const errorMessage = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

const getString = (formData: FormData, name: string) => String(formData.get(name) ?? "");

export async function createStockAreaAction(
  _previousState: StockTakeActionState,
  formData: FormData,
): Promise<StockTakeActionState> {
  const { session, profile, roles } = await requireProtectedAccess("/stock-take");
  if (!profile) {
    return { ok: false, message: "Authenticated profile is required." };
  }

  try {
    const area = await createStockArea({
      session,
      accessContext: { accountStatus: "approved", roles },
      route: "/stock-take",
      name: getString(formData, "area_name"),
      createdByProfileId: profile.id,
    });
    revalidatePath("/stock-take");
    return { ok: true, message: "Area added.", selectedAreaId: area.id };
  } catch (error) {
    return { ok: false, message: errorMessage(error, "Could not add area.") };
  }
}

export async function createTimberMaterialAction(
  _previousState: StockTakeActionState,
  formData: FormData,
): Promise<StockTakeActionState> {
  const { session, roles } = await requireProtectedAccess("/stock-take");
  const areaId = getString(formData, "selected_area_id") || undefined;

  try {
    const material = await createTimberMaterial({
      session,
      accessContext: { accountStatus: "approved", roles },
      route: "/stock-take",
      input: {
        height: getString(formData, "height"),
        width: getString(formData, "width"),
        length: getString(formData, "length"),
        grade: getString(formData, "grade"),
        treatment: getString(formData, "treatment"),
      },
    });
    revalidatePath("/stock-take");
    return {
      ok: true,
      message: `${material.name} added.`,
      selectedAreaId: areaId,
    };
  } catch (error) {
    return { ok: false, message: errorMessage(error, "Could not add timber material."), selectedAreaId: areaId };
  }
}

export async function updateTimberStockAction(
  _previousState: StockTakeActionState,
  formData: FormData,
): Promise<StockTakeActionState> {
  const { session, profile, roles } = await requireProtectedAccess("/stock-take");
  if (!profile) {
    return { ok: false, message: "Authenticated profile is required." };
  }

  const areaId = getString(formData, "area_id");

  try {
    const rows = JSON.parse(getString(formData, "rows")) as TimberStockRowInput[];
    await updateTimberStockRowsForArea({
      session,
      accessContext: { accountStatus: "approved", roles },
      route: "/stock-take",
      areaId,
      rows,
      updatedByProfileId: profile.id,
    });
    revalidatePath("/stock-take");
    return { ok: true, message: "Stock updated.", selectedAreaId: areaId };
  } catch (error) {
    return { ok: false, message: errorMessage(error, "Could not update stock."), selectedAreaId: areaId };
  }
}
