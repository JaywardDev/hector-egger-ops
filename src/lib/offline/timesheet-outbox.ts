import { idbDelete, idbGetAll, idbSet } from "@/src/lib/offline/idb-store";
import type { SaveTimesheetEntryInput } from "@/src/lib/timesheets/types";

const STORE = "timesheet-outbox" as const;

// A timesheet save that was made while offline (or failed to reach the server),
// queued to be replayed to POST /api/timesheet/entries when connectivity returns.
export type TimesheetOutboxItem = {
  clientMutationId: string;
  profileId: string;
  workDate: string;
  payload: SaveTimesheetEntryInput;
  createdAt: string;
  attempts: number;
  status: "queued" | "failed";
  lastError?: string;
};

// Fired (in the browser) whenever the outbox changes so any mounted UI can refresh.
export const OUTBOX_CHANGED_EVENT = "timesheet-outbox-changed";

const notifyChanged = () => {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(OUTBOX_CHANGED_EVENT));
};

export const listOutboxItems = () => idbGetAll<TimesheetOutboxItem>(STORE);

export const putOutboxItem = async (item: TimesheetOutboxItem) => {
  await idbSet(STORE, item.clientMutationId, item);
  notifyChanged();
};

export const deleteOutboxItem = async (clientMutationId: string) => {
  await idbDelete(STORE, clientMutationId);
  notifyChanged();
};
