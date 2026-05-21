import type { TimesheetActivityRecord } from "@/src/lib/timesheets/types";

export type ClientSafeTimesheetActivity = Omit<TimesheetActivityRecord, "internal_note">;

export const toClientSafeTimesheetActivity = (activity: TimesheetActivityRecord): ClientSafeTimesheetActivity => {
  const clientSafe = { ...activity };
  delete clientSafe.internal_note;
  return clientSafe;
};

export const hasActivityNotes = (activity: Pick<TimesheetActivityRecord, "client_description" | "internal_note">) =>
  Boolean(activity.client_description?.trim() || activity.internal_note?.trim());
