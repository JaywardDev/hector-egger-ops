"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  OUTBOX_CHANGED_EVENT,
  listOutboxItems,
  type TimesheetOutboxItem,
} from "@/src/lib/offline/timesheet-outbox";
import { flushTimesheetOutbox } from "@/src/lib/offline/timesheet-sync";

export type TimesheetOutboxState = {
  online: boolean;
  isSyncing: boolean;
  pending: TimesheetOutboxItem[];
  failed: TimesheetOutboxItem[];
  total: number;
  retry: () => void;
};

// Tracks the offline outbox and online/offline status, auto-flushing queued
// saves when connectivity returns. Browser-only.
export function useTimesheetOutbox(): TimesheetOutboxState {
  const [items, setItems] = useState<TimesheetOutboxItem[]>([]);
  const [online, setOnline] = useState(() =>
    typeof navigator === "undefined" ? true : navigator.onLine,
  );
  const [isSyncing, setIsSyncing] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setItems(await listOutboxItems());
    } catch {
      setItems([]);
    }
  }, []);

  const flush = useCallback(
    async (includeFailed: boolean) => {
      setIsSyncing(true);
      try {
        await flushTimesheetOutbox({ includeFailed });
      } catch {
        // ignore — items stay queued
      } finally {
        setIsSyncing(false);
        await refresh();
      }
    },
    [refresh],
  );

  useEffect(() => {
    const onChange = () => void refresh();
    const onOnline = () => {
      setOnline(true);
      void flush(false);
    };
    const onOffline = () => setOnline(false);

    window.addEventListener(OUTBOX_CHANGED_EVENT, onChange);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);

    // Initial load + an attempt to drain anything left from a previous session.
    void refresh();
    void flush(false);

    return () => {
      window.removeEventListener(OUTBOX_CHANGED_EVENT, onChange);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [refresh, flush]);

  const pending = useMemo(() => items.filter((item) => item.status === "queued"), [items]);
  const failed = useMemo(() => items.filter((item) => item.status === "failed"), [items]);

  return {
    online,
    isSyncing,
    pending,
    failed,
    total: items.length,
    retry: () => void flush(true),
  };
}
