"use client";

import { OperationalListRow } from "@/src/components/ui/operational-list-row";
import { Button } from "@/src/components/ui/button";
import { SegmentedControl } from "@/src/components/ui/segmented-control";
import { StatusBadge } from "@/src/components/ui/status-badge";
import { formatNzDate, getTodayNzDate } from "@/src/lib/dateTime";
import { getActivityProjectDisplay, getActivityTaskDisplay } from "@/src/lib/timesheets/activity-display";
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
  office: "Office",
};

function getFullDateLabel(date: string) {
  return formatNzDate(date, {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function truncateProjectLabel(label: string, maxLength = 24) {
  const normalizedLabel = label.trim();
  if (normalizedLabel.length <= maxLength) {
    return normalizedLabel;
  }
  return `${normalizedLabel.slice(0, maxLength - 1).trimEnd()}…`;
}

function getMobileActivityProjectDisplay(
  activity: NonNullable<TimesheetDaySummary["entry"]>["activities"][number],
  projectById: Map<string, TimesheetLookups["projects"][number]>,
) {
  const snapshotCode = activity.project_code_snapshot?.trim() ?? "";
  const snapshotLabel = activity.project_label_snapshot?.trim() ?? "";
  const lookupProject = activity.project_id ? projectById.get(activity.project_id) : undefined;
  const lookupCode = lookupProject?.code?.trim() ?? "";
  const lookupLabel = lookupProject?.label?.trim() ?? "";
  const code = snapshotCode || lookupCode;
  const label = snapshotLabel || lookupLabel;

  if (code && label) {
    return `${code} — ${truncateProjectLabel(label)}`;
  }
  if (code) {
    return code;
  }
  if (label) {
    return truncateProjectLabel(label);
  }
  return "Unknown project";
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
        const projectLabel = getActivityProjectDisplay(activity, projectById);
        const mobileProjectLabel = getMobileActivityProjectDisplay(activity, projectById);
        const taskLabel = getActivityTaskDisplay(activity, taskById);
        return (
          <li key={activity.id} className="leading-6">
            <span className="text-zinc-800 sm:hidden" title={projectLabel}>
              {mobileProjectLabel}
            </span>
            <span className="hidden text-zinc-800 sm:inline">{projectLabel}</span> · {taskLabel} · {workModeLabels[activity.work_mode]} · {formatTimesheetHours(activity.hours)}
          </li>
        );
      })}
      {hasLeave ? <li className="leading-6">{leaveLabels[entry.leave_type as TimesheetLeaveType]} · {formatTimesheetHours(entry.leave_hours)}</li> : null}
      {entry.paid_break ? <li className="leading-6">Paid break claimed · 0.5 h</li> : null}
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
          className="min-h-9 w-auto px-2.5 text-xs sm:min-h-10 sm:px-3 sm:text-sm sm:w-24"
          disabled={disabled}
          onClick={() => onSelectDay(day.date)}
          variant={day.entry ? "quiet" : "secondary"}
        >
          {actionLabel}
        </Button>
      }
      aria-label={fullDateLabel}
      className="grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3 gap-y-1 rounded-xl border border-transparent py-2 sm:py-3 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center sm:gap-3"
      density="dense"
      titleBlockClassName="row-span-2 sm:row-span-1"
      metadataClassName="col-start-2 row-start-1 justify-end whitespace-nowrap"
      actionsClassName="col-start-2 row-start-2 justify-end"
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
        <span className="flex items-center gap-2">
          <span>{day.weekdayLabel}</span>
          {isToday ? (
            <span className="shrink-0 rounded-full bg-[var(--he-yellow)]/25 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-zinc-900">
              Today
            </span>
          ) : null}
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
  const heading = context === "approval" ? "Review week" : "Week overview";

  return (
    <section className="rounded-[1.35rem] border border-zinc-200/80 bg-white px-3 py-3 shadow-[0_18px_45px_rgba(15,23,42,0.04)] sm:px-4 sm:py-4" aria-labelledby="weekly-timesheet-heading">
      <div className="flex items-start justify-between gap-2 border-b border-zinc-100 px-1 pb-3 sm:items-end sm:gap-3 sm:pb-4">
        <div className="min-w-0 shrink">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--he-muted)]">Timesheet</p>
          <h2 id="weekly-timesheet-heading" className="mt-1 whitespace-nowrap text-[15px] font-semibold text-zinc-950 sm:text-lg">{heading}</h2>
        </div>
        <SegmentedControl
          aria-label="Weekly timesheet view"
          className="shrink-0 origin-right scale-[0.88] self-center text-xs sm:scale-100 sm:self-auto sm:text-sm"
          onChange={onModeChange}
          options={WEEKDAY_MODE_OPTIONS}
          value={mode}
        />
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
