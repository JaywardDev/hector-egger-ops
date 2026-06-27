import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireProtectedAccess } from "@/src/lib/auth/guards";
import { getNzWeekDates } from "@/src/lib/dateTime";
import { saveOwnTimesheetEntry } from "@/src/lib/timesheets/entries";
import type { SaveTimesheetEntryInput } from "@/src/lib/timesheets/types";

type SaveEntryRequestBody = {
  entry?: SaveTimesheetEntryInput;
  clientMutationId?: string;
};

// Idempotent save endpoint for the user's own timesheet entry. This is the HTTP
// path the offline outbox will replay (a stable URL with cookie auth), but it is
// usable online today and shares the same save logic as the server action.
export async function POST(request: Request) {
  const { session, profile, roles } = await requireProtectedAccess("/timesheet");
  if (!profile) {
    return NextResponse.json({ ok: false, message: "Authenticated profile is required." }, { status: 401 });
  }

  let body: SaveEntryRequestBody;
  try {
    body = (await request.json()) as SaveEntryRequestBody;
  } catch {
    return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 });
  }

  const { entry, clientMutationId } = body;
  if (!entry || typeof entry.workDate !== "string") {
    return NextResponse.json({ ok: false, message: "A timesheet entry is required." }, { status: 400 });
  }

  // Product decision: offline/device entry is restricted to the current NZ week.
  if (!getNzWeekDates().includes(entry.workDate)) {
    return NextResponse.json(
      { ok: false, message: "Only the current week can be saved from this device." },
      { status: 422 },
    );
  }

  try {
    const saved = await saveOwnTimesheetEntry(
      {
        session,
        profileId: profile.id,
        accessContext: { accountStatus: "approved", roles },
        route: "/timesheet",
      },
      entry,
      profile.staff_group,
      { clientMutationId: clientMutationId ?? null },
    );
    revalidatePath("/timesheet");
    return NextResponse.json({ ok: true, entry: saved });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "Could not save timesheet." },
      { status: 400 },
    );
  }
}
