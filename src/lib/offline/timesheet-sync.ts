import { deleteTimesheetDraft, timesheetDraftKey } from "@/src/lib/offline/timesheet-drafts";
import {
  deleteOutboxItem,
  listOutboxItems,
  putOutboxItem,
  type TimesheetOutboxItem,
} from "@/src/lib/offline/timesheet-outbox";
import type { SaveTimesheetEntryInput } from "@/src/lib/timesheets/types";

const ENDPOINT = "/api/timesheet/entries";

export type SaveSyncResult =
  | { ok: true; synced: boolean; message: string }
  | { ok: false; message: string };

type PostResult =
  | { kind: "ok" }
  | { kind: "rejected"; message: string } // server reachable but refused (validation) — do not retry blindly
  | { kind: "unreachable" }; // network/offline/5xx — safe to keep queued

const postEntry = async (
  payload: SaveTimesheetEntryInput,
  clientMutationId: string,
): Promise<PostResult> => {
  let response: Response;
  try {
    response = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entry: payload, clientMutationId }),
    });
  } catch {
    return { kind: "unreachable" };
  }

  if (response.ok) return { kind: "ok" };
  // 5xx: transient server problem — keep queued and try later.
  if (response.status >= 500) return { kind: "unreachable" };
  // 4xx: the server rejected this entry (e.g. validation). Surface it.
  let message = "The server rejected this timesheet entry.";
  try {
    const body = (await response.json()) as { message?: string };
    if (body.message) message = body.message;
  } catch {
    // keep default
  }
  return { kind: "rejected", message };
};

const isOffline = () => typeof navigator !== "undefined" && navigator.onLine === false;

const OUTBOX_SYNC_TAG = "timesheet-outbox";

type SyncCapableRegistration = ServiceWorkerRegistration & {
  sync?: { register: (tag: string) => Promise<void> };
};

// Ask the service worker to replay the outbox via Background Sync when the
// connection returns — even if the app/tab is closed. Best-effort: browsers
// without Background Sync (e.g. iOS Safari) fall back to the in-app "online"
// event flush in useTimesheetOutbox.
const registerBackgroundSync = async () => {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  try {
    const registration = (await navigator.serviceWorker.ready) as SyncCapableRegistration;
    if (registration.sync) await registration.sync.register(OUTBOX_SYNC_TAG);
  } catch {
    // Background Sync unsupported or registration failed — fallback handles it.
  }
};

const enqueue = async (profileId: string, payload: SaveTimesheetEntryInput, clientMutationId: string) => {
  await putOutboxItem({
    clientMutationId,
    profileId,
    workDate: payload.workDate,
    payload,
    createdAt: new Date().toISOString(),
    attempts: 0,
    status: "queued",
  });
  await registerBackgroundSync();
};

// Save the user's own entry, queuing it for later if the device is offline or the
// request can't reach the server. Returns synced:false when the save was queued.
export const saveTimesheetEntryWithSync = async (
  profileId: string,
  payload: SaveTimesheetEntryInput,
): Promise<SaveSyncResult> => {
  const clientMutationId =
    typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;

  const queuedMessage = "Saved on this device — it will sync automatically when you're back online.";

  if (isOffline()) {
    await enqueue(profileId, payload, clientMutationId);
    return { ok: true, synced: false, message: queuedMessage };
  }

  const result = await postEntry(payload, clientMutationId);
  if (result.kind === "ok") {
    await deleteTimesheetDraft(timesheetDraftKey(profileId, payload.workDate)).catch(() => {});
    return { ok: true, synced: true, message: "Timesheet saved." };
  }
  if (result.kind === "rejected") {
    return { ok: false, message: result.message };
  }
  // Unreachable: queue it.
  await enqueue(profileId, payload, clientMutationId);
  return { ok: true, synced: false, message: queuedMessage };
};

export type FlushResult = { synced: number; failed: number; remaining: number };

// Replay queued saves. By default only "queued" items are retried; pass
// includeFailed when the user explicitly asks to retry previously-failed items.
export const flushTimesheetOutbox = async (options?: { includeFailed?: boolean }): Promise<FlushResult> => {
  if (isOffline()) {
    const remainingItems = await listOutboxItems();
    return { synced: 0, failed: 0, remaining: remainingItems.length };
  }

  const items = await listOutboxItems();
  let synced = 0;
  let failed = 0;

  for (const item of items) {
    if (item.status === "failed" && !options?.includeFailed) continue;

    const result = await postEntry(item.payload, item.clientMutationId);
    if (result.kind === "ok") {
      await deleteOutboxItem(item.clientMutationId);
      await deleteTimesheetDraft(timesheetDraftKey(item.profileId, item.workDate)).catch(() => {});
      synced += 1;
    } else if (result.kind === "rejected") {
      const updated: TimesheetOutboxItem = {
        ...item,
        status: "failed",
        attempts: item.attempts + 1,
        lastError: result.message,
      };
      await putOutboxItem(updated);
      failed += 1;
    }
    // unreachable: leave the item queued, stop trying for now.
    else {
      break;
    }
  }

  const remaining = (await listOutboxItems()).length;
  return { synced, failed, remaining };
};
