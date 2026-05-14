"use client";

import { OperationalListRow } from "@/src/components/ui/operational-list-row";
import { Button } from "@/src/components/ui/button";
import { SegmentedControl } from "@/src/components/ui/segmented-control";
import { StatusBadge } from "@/src/components/ui/status-badge";
import { formatNzDate, getTodayNzDate } from "@/src/lib/dateTime";
import { formatTimesheetDisplayDate, getNzWeekDates } from "@/src/lib/timesheets/date";
import { TIMESHEET_STATUS_BADGE_CONFIG, formatTimesheetHours } from "@/src/lib/timesheets/formatting";
import type { TimesheetDaySummary, TimesheetLeaveType, TimesheetLookups, TimesheetWorkMode } from "@/src/lib/timesheets/types";

const WEEKDAY_MODE_OPTIONS = [
  { label: "Summary", value: "summary" },
  { label: "Details", value: "details" },
] as const;

type WeeklyTimesheetMode = "summary" | "details";
type WeeklyTimesheetContext = "self" | "approval";

type WeeklyTimesheetViewProps = {
  days: TimesheetDaySummary[];
  lookups: TimesheetLookups;
  mode: WeeklyTimesheetMode;
  onModeChange: (mode: WeeklyTimesheetMode) => void;
  onSelectDay: (date: string) => void;
  entryActionLabel?: string;
  missingActionLabel?: string;
  context?: WeeklyTimesheetContext;
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
    return <p className="mt-2 text-sm text-zinc-500">No activity recorded for this day.</p>;
  }

  if (entry.is_public_holiday) {
    return <p className="mt-2 text-sm text-zinc-600">Public holiday · {formatTimesheetHours(entry.payable_hours)}</p>;
  }

  const projectById = new Map(lookups.projects.map((project) => [project.id, project]));
  const taskById = new Map(lookups.tasks.map((task) => [task.id, task]));
  const visibleActivities = entry.activities.filter((activity) => activity.hours > 0);
  const hasLeave = entry.leave_hours > 0 && entry.leave_type;

  if (visibleActivities.length === 0 && !hasLeave && !entry.paid_break) {
    return <p className="mt-2 text-sm text-zinc-500">No activity recorded for this day.</p>;
  }

  return (
    <ul className="mt-3 space-y-1.5 text-sm text-zinc-600" aria-label={`${day.weekdayLabel} activity summary`}>
      {visibleActivities.map((activity) => {
        const project = projectById.get(activity.project_id);
        const task = taskById.get(activity.task_id);
        const projectLabel = project ? `${project.code || "General"} / ${project.label || "unassigned"}` : "General / unassigned";
        const taskLabel = task?.label ?? "Unassigned task";
        return (
          <li key={activity.id} className="leading-6">
            <span className="text-zinc-800">{projectLabel}</span> · {taskLabel} · {workModeLabels[activity.work_mode]} · {formatTimesheetHours(activity.hours)}
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
  todayDate,
  entryActionLabel = "Edit",
  missingActionLabel = "Add",
}: {
  day: TimesheetDaySummary;
  lookups: TimesheetLookups;
  mode: WeeklyTimesheetMode;
  onSelectDay: (date: string) => void;
  todayDate: string;
  entryActionLabel?: string;
  missingActionLabel?: string;
}) {
  const fullDateLabel = getFullDateLabel(day.date);
  const actionLabel = day.entry ? entryActionLabel : missingActionLabel;
  const disabled = Boolean(day.entry) && !day.canEdit;
  const isToday = day.date === todayDate;
  const isReturned = day.entry?.status === "returned";
  const accent = isToday || isReturned;

  return (
    <OperationalListRow
      accent={accent}
      actions={
        <Button
          aria-label={`${actionLabel} timesheet for ${fullDateLabel}`}
          className="min-h-10 w-full sm:w-24"
          disabled={disabled}
          onClick={() => onSelectDay(day.date)}
          variant={day.entry ? "quiet" : "secondary"}
        >
          {actionLabel}
        </Button>
      }
      aria-label={fullDateLabel}
      className="rounded-xl border border-transparent py-4 sm:py-4"
      density="dense"
      metadata={
        day.entry ? (
          <>
            <StatusBadge config={TIMESHEET_STATUS_BADGE_CONFIG[day.entry.status]} />
            <span className="font-semibold text-zinc-900">{formatTimesheetHours(day.entry.payable_hours)}</span>
          </>
        ) : (
          <span className="rounded-md bg-zinc-50 px-2 py-1 text-xs font-medium text-zinc-500 ring-1 ring-zinc-200/70">No entry</span>
        )
      }
      title={
        <span className="flex flex-wrap items-center gap-2">
          <span>{day.weekdayLabel}</span>
          {isToday ? <span className="rounded-full bg-[var(--he-yellow)]/25 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-zinc-900">Today</span> : null}
        </span>
      }
      subtitle={
        <>
          <span>{day.displayDate}</span>
          {mode === "details" ? <ActivitySummary day={day} lookups={lookups} /> : null}
        </>
      }
    />
  );
}

export function WeeklyTimesheetView({
  days,
  lookups,
  mode,
  onModeChange,
  onSelectDay,
  entryActionLabel,
  missingActionLabel,
  context = "self",
}: WeeklyTimesheetViewProps) {
  const todayDate = getTodayNzDate();
  const weekDates = getNzWeekDates();
  const totalHours = days.reduce((sum, day) => sum + (day.entry?.payable_hours ?? 0), 0);
  const weekRangeLabel = `${formatTimesheetDisplayDate(weekDates[0])} – ${formatTimesheetDisplayDate(weekDates[weekDates.length - 1])}`;
  const heading = context === "approval" ? "Review week" : "Week overview";
  const description = context === "approval" ? "Daily submissions for supervisor review." : `${weekRangeLabel} · Total Hours${formatTimesheetHours(totalHours)}`;

  return (
    <section className="rounded-[1.35rem] border border-zinc-200/80 bg-white px-3 py-3 shadow-[0_18px_45px_rgba(15,23,42,0.04)] sm:px-4 sm:py-4" aria-labelledby="weekly-timesheet-heading">
      <div className="flex flex-col gap-3 border-b border-zinc-100 px-1 pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--he-muted)]">Timesheet</p>
          <h2 id="weekly-timesheet-heading" className="mt-1 text-lg font-semibold text-zinc-950">{heading}</h2>
        </div>
        <SegmentedControl aria-label="Weekly timesheet view" className="self-start sm:self-auto" onChange={onModeChange} options={WEEKDAY_MODE_OPTIONS} value={mode} />
      </div>
      <div className="mt-2 divide-y divide-zinc-100/80">
        {days.map((day) => (
          <TimesheetDayRow
            key={day.date}
            day={day}
            lookups={lookups}
            mode={mode}
            onSelectDay={onSelectDay}
            todayDate={todayDate}
            entryActionLabel={entryActionLabel}
            missingActionLabel={missingActionLabel}
          />
        ))}
      </div>
    </section>
  );
}
