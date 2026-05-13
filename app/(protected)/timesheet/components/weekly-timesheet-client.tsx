"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { DailyTimesheetForm } from "@/app/(protected)/timesheet/components/daily-timesheet-form";
import { DailyTimesheetSheet } from "@/app/(protected)/timesheet/components/daily-timesheet-sheet";
import { WeeklyTimesheetView } from "@/app/(protected)/timesheet/components/weekly-timesheet-view";
import { StatusBadge } from "@/src/components/ui/status-badge";
import { TIMESHEET_STATUS_BADGE_CONFIG } from "@/src/lib/timesheets/formatting";
import type { TimesheetDaySummary, TimesheetLookups, TimesheetWorkMode } from "@/src/lib/timesheets/types";

type WeeklyTimesheetMode = "summary" | "details";

export function WeeklyTimesheetClient({
  days,
  userName,
  preferredWorkMode,
  lookups,
}: {
  days: TimesheetDaySummary[];
  userName: string;
  preferredWorkMode: TimesheetWorkMode;
  lookups: TimesheetLookups;
}) {
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [mode, setMode] = useState<WeeklyTimesheetMode>("summary");
  const selectedDay = useMemo(() => days.find((day) => day.date === selectedDate) ?? null, [days, selectedDate]);

  const close = () => setSelectedDate(null);
  const saved = () => {
    close();
    router.refresh();
  };

  return (
    <>
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
            workDate={selectedDay.date}
            displayDate={`${selectedDay.weekdayLabel}, ${selectedDay.displayDate}`}
            userName={userName}
            entry={selectedDay.entry}
            preferredWorkMode={preferredWorkMode}
            lookups={lookups}
            canEdit={selectedDay.canEdit}
            onSaved={saved}
          />
        ) : null}
      </DailyTimesheetSheet>
    </>
  );
}
