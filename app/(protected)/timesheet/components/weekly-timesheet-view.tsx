"use client";

import { Button } from "@/src/components/ui/button";
import { SegmentedControl } from "@/src/components/ui/segmented-control";
import { StatusBadge } from "@/src/components/ui/status-badge";
import { formatNzDate } from "@/src/lib/dateTime";
import { TIMESHEET_STATUS_BADGE_CONFIG, formatTimesheetHours } from "@/src/lib/timesheets/formatting";
import type { TimesheetDaySummary, TimesheetLeaveType, TimesheetLookups, TimesheetWorkMode } from "@/src/lib/timesheets/types";

type WeeklyTimesheetMode = "summary" | "details";

type WeeklyTimesheetViewProps = {
  days: TimesheetDaySummary[];
  lookups: TimesheetLookups;
  mode: WeeklyTimesheetMode;
  onModeChange: (mode: WeeklyTimesheetMode) => void;
  onSelectDay: (date: string) => void;
  entryActionLabel?: string;
  missingActionLabel?: string;
};

const leaveLabels: Record<TimesheetLeaveType, string> = {
  annual: "Annual leave",
  sick: "Sick leave",
  bereavement: "Bereavement leave",
  unpaid: "Unpaid leave",
  other: "Other leave",
};


const workModeLabels: Record<Exclude<TimesheetWorkMode, "mixed">, string> = {
  factory: "Factory",
  site: "Site",
};

function getFullDateLabel(date: string) {
  return formatNzDate(date, {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function ActivitySummary({ day, lookups }: { day: TimesheetDaySummary; lookups: TimesheetLookups }) {
  const entry = day.entry;

  if (!entry) {
    return <p className="text-sm text-zinc-500">No activity listed</p>;
  }

  if (entry.is_public_holiday) {
    return <p className="text-sm text-zinc-700">Public holiday · {formatTimesheetHours(entry.payable_hours)}</p>;
  }

  const projectById = new Map(lookups.projects.map((project) => [project.id, project]));
  const taskById = new Map(lookups.tasks.map((task) => [task.id, task]));
  const visibleActivities = entry.activities.filter((activity) => activity.hours > 0);
  const hasLeave = entry.leave_hours > 0 && entry.leave_type;

  if (visibleActivities.length === 0 && !hasLeave && !entry.paid_break) {
    return <p className="text-sm text-zinc-500">No activity listed</p>;
  }

  return (
    <ul className="mt-3 space-y-1.5 text-sm text-zinc-700" aria-label={`${day.weekdayLabel} activity summary`}>
      {visibleActivities.map((activity) => {
        const project = projectById.get(activity.project_id);
        const task = taskById.get(activity.task_id);
        const projectLabel = project ? `${project.code || "General"} / ${project.label || "unassigned"}` : "General / unassigned";
        const taskLabel = task?.label ?? "Unassigned task";
        return (
          <li key={activity.id} className="leading-6">
            {projectLabel} · {taskLabel} · {workModeLabels[activity.work_mode]} · {formatTimesheetHours(activity.hours)}
          </li>
        );
      })}
      {hasLeave ? <li className="leading-6">{leaveLabels[entry.leave_type as TimesheetLeaveType]} · {formatTimesheetHours(entry.leave_hours)}</li> : null}
      {entry.paid_break ? <li className="leading-6">Paid break · 0.5 h</li> : null}
    </ul>
  );
}

function TimesheetDayRow({
  day,
  lookups,
  mode,
  onSelectDay,
  entryActionLabel = "Edit",
  missingActionLabel = "Add",
}: {
  day: TimesheetDaySummary;
  lookups: TimesheetLookups;
  mode: WeeklyTimesheetMode;
  onSelectDay: (date: string) => void;
  entryActionLabel?: string;
  missingActionLabel?: string;
}) {
  const fullDateLabel = getFullDateLabel(day.date);
  const actionLabel = day.entry ? entryActionLabel : missingActionLabel;
  const disabled = Boolean(day.entry) && !day.canEdit;

  return (
    <div className="py-3 sm:py-4" title={fullDateLabel}>
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center">
        <div className="min-w-0">
          <p className="text-base font-semibold text-zinc-950">{day.weekdayLabel}</p>
          <p className="text-sm text-zinc-500">{day.displayDate}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm text-zinc-700 sm:justify-end">
          {day.entry ? (
            <>
              <StatusBadge config={TIMESHEET_STATUS_BADGE_CONFIG[day.entry.status]} />
              <span className="font-medium text-zinc-800">{formatTimesheetHours(day.entry.payable_hours)}</span>
            </>
          ) : (
            <span className="text-zinc-500">No entry</span>
          )}
        </div>
        <Button
          aria-label={`${actionLabel} timesheet for ${fullDateLabel}`}
          className="min-h-10 w-full sm:w-24"
          disabled={disabled}
          onClick={() => onSelectDay(day.date)}
          variant={day.entry ? "secondary" : "default"}
        >
          {actionLabel}
        </Button>
      </div>
      {mode === "details" ? <ActivitySummary day={day} lookups={lookups} /> : null}
    </div>
  );
}

export function WeeklyTimesheetView({ days, lookups, mode, onModeChange, onSelectDay, entryActionLabel, missingActionLabel }: WeeklyTimesheetViewProps) {
  return (
    <section className="rounded-2xl bg-white px-4 py-4 shadow-sm ring-1 ring-zinc-950/5 sm:px-6 sm:py-5" aria-labelledby="weekly-timesheet-heading">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-end">
        <h2 id="weekly-timesheet-heading" className="sr-only">Weekly Timesheet days</h2>
        <SegmentedControl
          aria-label="Weekly timesheet view"
          className="self-start sm:self-auto"
          onChange={onModeChange}
          options={[
            { label: "Summary", value: "summary" },
            { label: "Details", value: "details" },
          ]}
          value={mode}
        />
      </div>
      <div className="mt-4 divide-y divide-zinc-100">
        {days.map((day) => (
          <TimesheetDayRow key={day.date} day={day} lookups={lookups} mode={mode} onSelectDay={onSelectDay} entryActionLabel={entryActionLabel} missingActionLabel={missingActionLabel} />
        ))}
      </div>
    </section>
  );
}
