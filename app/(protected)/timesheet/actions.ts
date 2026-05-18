"use server";

import { revalidatePath } from "next/cache";
import { requireProtectedAccess } from "@/src/lib/auth/guards";
import { saveOwnTimesheetEntry } from "@/src/lib/timesheets/entries";
import type { SaveTimesheetEntryInput } from "@/src/lib/timesheets/types";

export type SaveTimesheetEntryActionResult =
  | { ok: true; message: string }
  | { ok: false; message: string };

export async function saveTimesheetEntryAction(input: SaveTimesheetEntryInput): Promise<SaveTimesheetEntryActionResult> {
  const { session, profile, roles } = await requireProtectedAccess("/timesheet");
  if (!profile) return { ok: false, message: "Authenticated profile is required." };

  try {
    await saveOwnTimesheetEntry(
      {
        session,
        profileId: profile.id,
        accessContext: { accountStatus: "approved", roles },
        route: "/timesheet",
      },
      input,
      profile.staff_group,
    );
    revalidatePath("/timesheet");
    return { ok: true, message: "Timesheet saved." };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Could not save timesheet.",
    };
  }
}
