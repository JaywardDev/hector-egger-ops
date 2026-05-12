"use server";

import { revalidatePath } from "next/cache";
import { requireTimesheetApprovalAccess } from "@/src/lib/auth/guards";
import { parseNzDate } from "@/src/lib/dateTime";
import {
  approveEmployeeTimesheetWeek,
  returnEmployeeTimesheetWeek,
  saveEmployeeTimesheetCorrectionAtomic,
} from "@/src/lib/timesheets/approvals";
import type { SaveTimesheetEntryInput } from "@/src/lib/timesheets/types";

export type ApprovalActionResult =
  | { ok: true; message: string }
  | { ok: false; message: string };

const actorFromContext = async () => {
  const { session, profile, roles } = await requireTimesheetApprovalAccess();
  if (!profile) throw new Error("Authenticated profile is required.");
  return {
    session,
    profileId: profile.id,
    accessContext: { accountStatus: "approved" as const, roles },
    route: "/approvals",
  };
};

export async function approveEmployeeTimesheetWeekAction(
  targetProfileId: string,
  weekStart: string,
): Promise<ApprovalActionResult> {
  try {
    const parsedWeekStart = parseNzDate(weekStart);
    if (!parsedWeekStart) throw new Error("A valid week start date is required.");
    const actor = await actorFromContext();
    const result = await approveEmployeeTimesheetWeek(actor, targetProfileId, parsedWeekStart);
    revalidatePath("/approvals");
    revalidatePath("/timesheet");
    return { ok: true, message: `Approved ${result.affectedEntryIds.length} submitted entr${result.affectedEntryIds.length === 1 ? "y" : "ies"}.` };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Could not approve timesheet week." };
  }
}

export async function returnEmployeeTimesheetWeekAction(
  targetProfileId: string,
  weekStart: string,
  comment: string,
): Promise<ApprovalActionResult> {
  try {
    const parsedWeekStart = parseNzDate(weekStart);
    if (!parsedWeekStart) throw new Error("A valid week start date is required.");
    const actor = await actorFromContext();
    const result = await returnEmployeeTimesheetWeek(actor, targetProfileId, parsedWeekStart, comment);
    revalidatePath("/approvals");
    revalidatePath("/timesheet");
    return { ok: true, message: `Returned ${result.affectedEntryIds.length} entr${result.affectedEntryIds.length === 1 ? "y" : "ies"} for correction.` };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Could not return timesheet week." };
  }
}


export async function saveEmployeeTimesheetCorrectionAction(
  targetProfileId: string,
  input: SaveTimesheetEntryInput,
  comment?: string,
): Promise<ApprovalActionResult> {
  try {
    const actor = await actorFromContext();
    await saveEmployeeTimesheetCorrectionAtomic(actor, targetProfileId, input, comment);
    revalidatePath("/approvals");
    revalidatePath("/timesheet");
    return { ok: true, message: "Timesheet correction saved." };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Could not save timesheet correction." };
  }
}
