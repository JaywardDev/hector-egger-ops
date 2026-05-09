"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Badge } from "@/src/components/ui/badge";
import { Button } from "@/src/components/ui/button";
import { Card } from "@/src/components/ui/card";
import { DailyTimesheetForm } from "@/app/(protected)/timesheet/components/daily-timesheet-form";
import { DailyTimesheetSheet } from "@/app/(protected)/timesheet/components/daily-timesheet-sheet";
import type { TimesheetDaySummary, TimesheetLookups, TimesheetWorkMode } from "@/src/lib/timesheets/types";

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
  const selectedDay = useMemo(() => days.find((day) => day.date === selectedDate) ?? null, [days, selectedDate]);

  const close = () => setSelectedDate(null);
  const saved = () => {
    close();
    router.refresh();
  };

  return (
    <>
      <Card className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900">Weekly Summary</h2>
          <p className="text-sm text-zinc-600">Current Pacific/Auckland week, Monday to Sunday.</p>
        </div>
        <div className="divide-y divide-zinc-200 rounded-md border border-zinc-200">
          {days.map((day) => (
            <div key={day.date} className="grid gap-3 p-3 sm:grid-cols-[1fr_auto_auto] sm:items-center">
              <div>
                <p className="font-medium text-zinc-900">{day.weekdayLabel}</p>
                <p className="text-sm text-zinc-600">{day.displayDate} · {day.date}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-sm text-zinc-700">
                {day.entry ? (
                  <>
                    <Badge variant={day.entry.status === "approved" ? "success" : "info"}>{day.entry.status}</Badge>
                    <span>{day.entry.payable_hours} paid h</span>
                  </>
                ) : <span className="text-zinc-500">No entry</span>}
              </div>
              <Button onClick={() => setSelectedDate(day.date)} disabled={Boolean(day.entry) && !day.canEdit}>
                {day.entry ? "Edit" : "Add"}
              </Button>
            </div>
          ))}
        </div>
      </Card>

      <DailyTimesheetSheet open={selectedDay !== null} title={selectedDay?.entry ? "Edit daily timesheet" : "Add daily timesheet"} onClose={close}>
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
