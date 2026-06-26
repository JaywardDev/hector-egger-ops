"use server";

import { revalidatePath } from "next/cache";
import { requireTimesheetApprovalAccess } from "@/src/lib/auth/guards";
import { getNzWeekStart, parseNzDate } from "@/src/lib/dateTime";
import {
  approveEmployeeTimesheetWeek,
  finalApproveEmployeeTimesheetWeek,
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

const parseApprovalWeekStart = (weekStart: string) => {
  const parsedWeekStart = parseNzDate(weekStart);
  if (!parsedWeekStart) throw new Error("A valid week start date is required.");
  if (parsedWeekStart !== getNzWeekStart(parsedWeekStart)) {
    throw new Error("Select the Monday week start date for approvals.");
  }
  return parsedWeekStart;
};

export async function approveEmployeeTimesheetWeekAction(
  targetProfileId: string,
  weekStart: string,
): Promise<ApprovalActionResult> {
  try {
    const parsedWeekStart = parseApprovalWeekStart(weekStart);
    const actor = await actorFromContext();
    const result = await approveEmployeeTimesheetWeek(actor, targetProfileId, parsedWeekStart);
    revalidatePath("/approvals");
    revalidatePath("/timesheet");
    return { ok: true, message: `Reviewed ${result.affectedEntryIds.length} submitted entr${result.affectedEntryIds.length === 1 ? "y" : "ies"}.` };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Could not review timesheet week." };
  }
}

export async function returnEmployeeTimesheetWeekAction(
  targetProfileId: string,
  weekStart: string,
  comment: string,
): Promise<ApprovalActionResult> {
  try {
    const parsedWeekStart = parseApprovalWeekStart(weekStart);
    const actor = await actorFromContext();
    const result = await returnEmployeeTimesheetWeek(actor, targetProfileId, parsedWeekStart, comment);
    revalidatePath("/approvals");
    revalidatePath("/timesheet");
    return { ok: true, message: `Returned ${result.affectedEntryIds.length} entr${result.affectedEntryIds.length === 1 ? "y" : "ies"} for correction.` };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Could not return timesheet week." };
  }
}

export async function finalApproveEmployeeTimesheetWeekAction(
  targetProfileId: string,
  weekStart: string,
): Promise<ApprovalActionResult> {
  try {
    const parsedWeekStart = parseApprovalWeekStart(weekStart);
    const actor = await actorFromContext();
    const result = await finalApproveEmployeeTimesheetWeek(actor, targetProfileId, parsedWeekStart);
    revalidatePath("/approvals");
    revalidatePath("/timesheet");
    return {
      ok: true,
      message: `Final approved ${result.affectedEntryIds.length} reviewed entr${result.affectedEntryIds.length === 1 ? "y" : "ies"} for ${result.employeeName}.`,
    };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Could not final approve timesheet week." };
  }
}


export type BulkApprovalActionResult = {
  ok: boolean;
  message: string;
  succeeded: number;
  skipped: number;
  failed: number;
};

const runBulk = async (
  targetProfileIds: string[],
  weekStart: string,
  run: (
    actor: Awaited<ReturnType<typeof actorFromContext>>,
    targetProfileId: string,
    parsedWeekStart: string,
  ) => Promise<{ affectedEntryIds: string[] }>,
  verb: string,
): Promise<BulkApprovalActionResult> => {
  const uniqueIds = Array.from(new Set(targetProfileIds.filter(Boolean)));
  if (uniqueIds.length === 0) {
    return { ok: false, message: "Select at least one timesheet.", succeeded: 0, skipped: 0, failed: 0 };
  }

  try {
    const parsedWeekStart = parseApprovalWeekStart(weekStart);
    const actor = await actorFromContext();

    let succeeded = 0;
    let skipped = 0;
    let failed = 0;
    for (const targetProfileId of uniqueIds) {
      try {
        const result = await run(actor, targetProfileId, parsedWeekStart);
        // No eligible entries this week is a skip, not a failure.
        if (result.affectedEntryIds.length > 0) succeeded += 1;
        else skipped += 1;
      } catch {
        // Per-employee errors (e.g. nothing eligible) don't fail the batch.
        failed += 1;
      }
    }

    revalidatePath("/approvals");
    revalidatePath("/timesheet");

    const parts = [`${succeeded} ${verb}`];
    if (skipped > 0) parts.push(`${skipped} skipped`);
    if (failed > 0) parts.push(`${failed} failed`);
    return {
      ok: succeeded > 0,
      message: parts.join(", ") + ".",
      succeeded,
      skipped,
      failed,
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Could not run bulk action.",
      succeeded: 0,
      skipped: 0,
      failed: 0,
    };
  }
};

export async function approveEmployeeTimesheetWeekBulkAction(
  targetProfileIds: string[],
  weekStart: string,
): Promise<BulkApprovalActionResult> {
  return runBulk(targetProfileIds, weekStart, approveEmployeeTimesheetWeek, "reviewed");
}

export async function finalApproveEmployeeTimesheetWeekBulkAction(
  targetProfileIds: string[],
  weekStart: string,
): Promise<BulkApprovalActionResult> {
  return runBulk(targetProfileIds, weekStart, finalApproveEmployeeTimesheetWeek, "final approved");
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
