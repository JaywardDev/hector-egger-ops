"use server";

import { revalidatePath } from "next/cache";
import { requireProtectedAccess } from "@/src/lib/auth/guards";
import { isAdminOrSupervisor, isOperator } from "@/src/lib/permissions/roles";
import { answerQaCheckItem, signOffQaChecklist } from "@/src/lib/qa/capture";

export type QaCaptureResult = {
  ok: boolean;
  message?: string;
  checklistStatus?: string;
};

// Save one answer. Capture-level (admin/supervisor/operator); the RPC
// re-validates options and refuses once the checklist is signed off.
export async function answerQaCheckItemAction(
  checkItemId: string,
  value: string | null,
): Promise<QaCaptureResult> {
  try {
    const context = await requireProtectedAccess();
    if (!context.profile) throw new Error("Profile could not be resolved.");
    if (!isAdminOrSupervisor(context) && !isOperator(context)) {
      return { ok: false, message: "You do not have capture access." };
    }
    const result = await answerQaCheckItem({
      checkItemId,
      value,
      actorProfileId: context.profile.id,
    });
    return { ok: true, checklistStatus: result.checklist_status };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Could not save the answer." };
  }
}

// Sign off a pending hold point. Admin/supervisor for now — replaced by the
// C-base-driven per-hold-point authority in a later phase (design §3).
export async function signOffQaChecklistAction(
  checklistId: string,
  signoffId: string,
  comment?: string,
): Promise<QaCaptureResult> {
  try {
    const context = await requireProtectedAccess();
    if (!context.profile) throw new Error("Profile could not be resolved.");
    if (!isAdminOrSupervisor(context)) {
      return { ok: false, message: "Only a supervisor or admin can sign off." };
    }
    const result = await signOffQaChecklist({
      signoffId,
      actorProfileId: context.profile.id,
      comment,
    });
    revalidatePath(`/qa/checklists/${checklistId}`);
    revalidatePath("/qa");
    return { ok: true, checklistStatus: result.checklist_status };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Could not sign off." };
  }
}
