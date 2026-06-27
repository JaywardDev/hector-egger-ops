"use client";

import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { DailyTimesheetForm } from "@/app/(protected)/timesheet/components/daily-timesheet-form";
import { DailyTimesheetSheet } from "@/app/(protected)/timesheet/components/daily-timesheet-sheet";
import { WeeklyTimesheetView } from "@/app/(protected)/timesheet/components/weekly-timesheet-view";
import { Alert } from "@/src/components/ui/alert";
import { Button } from "@/src/components/ui/button";
import { StatusBadge } from "@/src/components/ui/status-badge";
import { TIMESHEET_STATUS_BADGE_CONFIG } from "@/src/lib/timesheets/formatting";
import { timesheetDraftKey } from "@/src/lib/offline/timesheet-drafts";
import { saveTimesheetEntryWithSync } from "@/src/lib/offline/timesheet-sync";
import { useTimesheetOutbox } from "@/src/lib/offline/use-timesheet-outbox";
import type { SaveTimesheetEntryInput, TimesheetDaySummary, TimesheetLookups, TimesheetWorkMode } from "@/src/lib/timesheets/types";

type WeeklyTimesheetMode = "summary" | "details";

export function WeeklyTimesheetClient({
  days,
  userName,
  profileId,
  preferredWorkMode,
  lookups,
}: {
  days: TimesheetDaySummary[];
  userName: string;
  profileId: string;
  preferredWorkMode: TimesheetWorkMode;
  lookups: TimesheetLookups;
}) {
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [mode, setMode] = useState<WeeklyTimesheetMode>("summary");
  const selectedDay = useMemo(() => days.find((day) => day.date === selectedDate) ?? null, [days, selectedDate]);
  const copyFromDay = useMemo(() => {
    if (!selectedDay || selectedDay.entry !== null) return null;
    return [...days].reverse().find((d) => d.date < selectedDay.date && d.entry !== null) ?? null;
  }, [days, selectedDay]);

  const outbox = useTimesheetOutbox();

  const close = () => setSelectedDate(null);
  const saved = () => {
    close();
    router.refresh();
  };

  // Saves go through the offline-aware sync layer: synced when online, queued
  // (and replayed later) when offline or the server is unreachable.
  const saveHandler = useCallback(
    (input: SaveTimesheetEntryInput) => saveTimesheetEntryWithSync(profileId, input),
    [profileId],
  );

  const pendingCount = outbox.pending.length;
  const failedCount = outbox.failed.length;

  return (
    <>
      {!outbox.online ? (
        <Alert variant="warning">
          You&rsquo;re offline. Days you save are stored on this device and will sync automatically when you reconnect.
        </Alert>
      ) : null}
      {pendingCount > 0 ? (
        <Alert variant="info">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span>
              {pendingCount} day{pendingCount === 1 ? "" : "s"} waiting to sync
              {outbox.isSyncing ? " — syncing…" : ""}.
            </span>
            {outbox.online && !outbox.isSyncing ? (
              <Button type="button" variant="secondary" size="sm" onClick={outbox.retry}>
                Sync now
              </Button>
            ) : null}
          </span>
        </Alert>
      ) : null}
      {failedCount > 0 ? (
        <Alert variant="error">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span>
              {failedCount} day{failedCount === 1 ? "" : "s"} couldn&rsquo;t sync
              {outbox.failed[0]?.lastError ? `: ${outbox.failed[0].lastError}` : "."} Open the day to fix it, then retry.
            </span>
            <Button type="button" variant="secondary" size="sm" onClick={outbox.retry} disabled={outbox.isSyncing}>
              Retry
            </Button>
          </span>
        </Alert>
      ) : null}

      <WeeklyTimesheetView days={days} lookups={lookups} mode={mode} onModeChange={setMode} onSelectDay={setSelectedDate} />

      <DailyTimesheetSheet
        open={selectedDay !== null}
        title={selectedDay?.entry ? "Edit daily timesheet" : "Add daily timesheet"}
        eyebrow="Timesheet editor"
        subtitle={selectedDay ? `${selectedDay.weekdayLabel}, ${selectedDay.displayDate}` : undefined}
        metadata={userName}
        statusSlot={selectedDay?.entry ? <StatusBadge config={TIMESHEET_STATUS_BADGE_CONFIG[selectedDay.entry.status]} /> : null}
        onClose={close}
      >
        {selectedDay ? (
          <DailyTimesheetForm
            key={selectedDay.date}
            workDate={selectedDay.date}
            displayDate={`${selectedDay.weekdayLabel}, ${selectedDay.displayDate}`}
            userName={userName}
            entry={selectedDay.entry}
            preferredWorkMode={preferredWorkMode}
            lookups={lookups}
            canEdit={selectedDay.canEdit}
            onSaved={saved}
            saveHandler={saveHandler}
            copyFrom={copyFromDay?.entry}
            copyFromLabel={copyFromDay?.weekdayLabel}
            draftKey={timesheetDraftKey(profileId, selectedDay.date)}
          />
        ) : null}
      </DailyTimesheetSheet>
    </>
  );
}
