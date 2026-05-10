"use client";

import { useMemo, useState, useTransition } from "react";
import { saveTimesheetEntryAction } from "@/app/(protected)/timesheet/actions";
import { Alert } from "@/src/components/ui/alert";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Select } from "@/src/components/ui/select";
import { cn } from "@/src/lib/utils";
import { calculateAllocationHours, calculatePayableHours } from "@/src/lib/timesheets/validation";
import type { SaveTimesheetEntryInput, TimesheetActivityInput, TimesheetEntryWithActivities, TimesheetLeaveType, TimesheetLookups, TimesheetWorkMode } from "@/src/lib/timesheets/types";

type DraftActivity = TimesheetActivityInput & { clientId: string; hoursText: string };

const leaveOptions: { value: TimesheetLeaveType; label: string }[] = [
  { value: "annual", label: "Annual leave" },
  { value: "sick", label: "Sick leave" },
  { value: "bereavement", label: "Bereavement leave" },
  { value: "unpaid", label: "Unpaid leave" },
  { value: "other", label: "Other leave" },
];

const defaultActivity = (lookups: TimesheetLookups, workMode: TimesheetWorkMode, hoursText = ""): DraftActivity => ({
  clientId: crypto.randomUUID(),
  projectId: lookups.projects[0]?.id ?? "",
  taskId: lookups.tasks[0]?.id ?? "",
  workMode: workMode === "site" ? "site" : "factory",
  hours: Number(hoursText) || 0,
  hoursText,
});

const entryToActivities = (entry: TimesheetEntryWithActivities | null, lookups: TimesheetLookups, workMode: TimesheetWorkMode) => {
  if (entry && entry.activities.length > 0) {
    return entry.activities.map((activity) => ({
      clientId: activity.id,
      projectId: activity.project_id,
      taskId: activity.task_id,
      workMode: activity.work_mode,
      hours: activity.hours,
      hoursText: String(activity.hours),
    }));
  }
  return [defaultActivity(lookups, workMode, "8"), defaultActivity(lookups, workMode)];
};

export function DailyTimesheetForm({
  workDate,
  userName,
  entry,
  preferredWorkMode,
  lookups,
  canEdit,
  onSaved,
}: {
  workDate: string;
  displayDate: string;
  userName: string;
  entry: TimesheetEntryWithActivities | null;
  preferredWorkMode: TimesheetWorkMode;
  lookups: TimesheetLookups;
  canEdit: boolean;
  onSaved: () => void;
}) {
  const [workMode, setWorkMode] = useState<TimesheetWorkMode>(entry?.work_mode ?? preferredWorkMode);
  const [timeIn, setTimeIn] = useState((entry?.time_in ?? "07:00").slice(0, 5));
  const [timeOut, setTimeOut] = useState((entry?.time_out ?? "16:00").slice(0, 5));
  const [leaveType, setLeaveType] = useState<TimesheetLeaveType | "">(entry?.leave_type ?? "");
  const [leaveHoursText, setLeaveHoursText] = useState(entry?.leave_hours ? String(entry.leave_hours) : "0");
  const [isPublicHoliday, setIsPublicHoliday] = useState(entry?.is_public_holiday ?? false);
  const [unpaidBreak, setUnpaidBreak] = useState(entry?.unpaid_break ?? true);
  const [paidBreak, setPaidBreak] = useState(entry?.paid_break ?? true);
  const [activities, setActivities] = useState(() => entryToActivities(entry, lookups, entry?.work_mode ?? preferredWorkMode));
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  const disabled = !canEdit || isPublicHoliday;
  const leaveHours = Number(leaveHoursText) || 0;
  const parsedActivities = useMemo(
    () => activities.map((activity) => ({ ...activity, hours: Number(activity.hoursText) || 0 })),
    [activities],
  );
  const payableHours = calculatePayableHours({ isPublicHoliday, timeIn, timeOut, unpaidBreak });
  const allocationHours = calculateAllocationHours({ isPublicHoliday, activities: parsedActivities.filter((row) => row.hours > 0), leaveHours, paidBreak });
  const allocationMatches = payableHours !== null && Math.abs(allocationHours - payableHours) < 0.01;
  const formattedWorkDate = new Intl.DateTimeFormat("en-NZ", {
    timeZone: "UTC",
    weekday: "long",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(`${workDate}T12:00:00.000Z`));

  const updateWorkMode = (nextMode: TimesheetWorkMode) => {
    setWorkMode(nextMode);
    if (nextMode !== "mixed") {
      setActivities((current) => current.map((row) => ({ ...row, workMode: nextMode })));
    }
  };

  const updateActivity = (clientId: string, patch: Partial<DraftActivity>) => {
    setActivities((current) => current.map((row) => (row.clientId === clientId ? { ...row, ...patch } : row)));
  };

  const submit = () => {
    setFeedback(null);
    const payload: SaveTimesheetEntryInput = {
      workDate,
      timeIn: isPublicHoliday ? null : timeIn,
      timeOut: isPublicHoliday ? null : timeOut,
      workMode,
      leaveType: isPublicHoliday || leaveType === "" ? null : leaveType,
      leaveHours: isPublicHoliday ? 0 : leaveHours,
      isPublicHoliday,
      unpaidBreak: isPublicHoliday ? false : unpaidBreak,
      paidBreak: isPublicHoliday ? false : paidBreak,
      activities: isPublicHoliday ? [] : parsedActivities.map((row) => ({
        projectId: row.projectId,
        taskId: row.taskId,
        workMode: workMode === "mixed" ? row.workMode : workMode,
        hours: row.hours,
      })),
    };

    startTransition(async () => {
      const result = await saveTimesheetEntryAction(payload);
      if (!result.ok) {
        setFeedback({ type: "error", message: result.message });
        return;
      }
      setFeedback({ type: "success", message: result.message });
      onSaved();
    });
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6 bg-white px-4 py-5 sm:px-6">
      <section className="space-y-3">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-zinc-950">Kia ora, {userName}</h2>
          <p className="mt-1 text-sm font-normal text-zinc-500">{formattedWorkDate}</p>
        </div>
        {entry?.status === "approved" ? <Alert variant="warning">This entry is approved and locked for normal users.</Alert> : null}
        {feedback ? <Alert variant={feedback.type}>{feedback.message}</Alert> : null}
      </section>

      <section className="space-y-3">
        <label className="flex items-center gap-2 text-sm font-medium text-zinc-900">
          <input type="checkbox" checked={isPublicHoliday} disabled={!canEdit} onChange={(event) => setIsPublicHoliday(event.target.checked)} />
          Public holiday (fixed 8.0 paid hours)
        </label>
      </section>

      <div
        className={cn(
          "space-y-6 transition-[filter,opacity] duration-150",
          isPublicHoliday &&
            "opacity-60 grayscale-[65%] [&_button:disabled]:cursor-not-allowed [&_input:disabled]:cursor-not-allowed [&_select:disabled]:cursor-not-allowed",
        )}
      >
        <section className="grid gap-4 sm:grid-cols-3">
          <label className="space-y-1 text-sm font-medium text-zinc-700">Time in<Input type="time" value={timeIn} disabled={disabled} onChange={(event) => setTimeIn(event.target.value)} /></label>
          <label className="space-y-1 text-sm font-medium text-zinc-700">Time out<Input type="time" value={timeOut} disabled={disabled} onChange={(event) => setTimeOut(event.target.value)} /></label>
          <label className="space-y-1 text-sm font-medium text-zinc-700">Work Location
            <Select value={workMode} disabled={disabled} onChange={(event) => updateWorkMode(event.target.value as TimesheetWorkMode)}>
              <option value="factory">Factory</option><option value="site">Site</option><option value="mixed">Mixed</option>
            </Select>
          </label>
        </section>

        <section className="space-y-3">
          <h3 className="text-base font-semibold text-zinc-900">Activity</h3>
          <div className="space-y-3">
            {activities.map((activity, index) => (
              <div key={activity.clientId} className={workMode === "mixed" ? "grid gap-3 rounded-lg bg-zinc-50 p-3 sm:grid-cols-[1fr_1fr_120px_100px]" : "grid gap-3 rounded-lg bg-zinc-50 p-3 sm:grid-cols-[1fr_1fr_100px]"}>
                <label className="space-y-1 text-xs font-medium text-zinc-600">Project<Select value={activity.projectId} disabled={disabled} onChange={(event) => updateActivity(activity.clientId, { projectId: event.target.value })}>{lookups.projects.map((project) => <option key={project.id} value={project.id}>{project.code} — {project.label}</option>)}</Select></label>
                <label className="space-y-1 text-xs font-medium text-zinc-600">Task<Select value={activity.taskId} disabled={disabled} onChange={(event) => updateActivity(activity.clientId, { taskId: event.target.value })}>{lookups.tasks.map((task) => <option key={task.id} value={task.id}>{task.label}</option>)}</Select></label>
                {workMode === "mixed" ? (
                  <label className="space-y-1 text-xs font-medium text-zinc-600">Location<Select value={activity.workMode} disabled={disabled} onChange={(event) => updateActivity(activity.clientId, { workMode: event.target.value as "factory" | "site" })}><option value="factory">Factory</option><option value="site">Site</option></Select></label>
                ) : null}
                <label className="space-y-1 text-xs font-medium text-zinc-600">Hours<Input inputMode="decimal" value={activity.hoursText} disabled={disabled} onChange={(event) => updateActivity(activity.clientId, { hoursText: event.target.value })} placeholder={index === 0 ? "8" : "0"} /></label>
              </div>
            ))}
            <Button
              aria-label="Add activity row"
              className="gap-2 border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
              disabled={disabled}
              onClick={() => setActivities((current) => [...current, defaultActivity(lookups, workMode)])}
            >
              <span aria-hidden="true" className="flex size-5 items-center justify-center rounded-full bg-emerald-600 text-sm font-semibold leading-none text-white">＋</span>
              Add row
            </Button>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1 text-sm font-medium text-zinc-700">Leave type<Select value={leaveType} disabled={disabled} onChange={(event) => setLeaveType(event.target.value as TimesheetLeaveType | "")}><option value="">No leave</option>{leaveOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</Select></label>
          <label className="space-y-1 text-sm font-medium text-zinc-700">Leave hours<Input inputMode="decimal" value={leaveHoursText} disabled={disabled} onChange={(event) => setLeaveHoursText(event.target.value)} /></label>
        </section>

        <section className="space-y-2">
          <label className="flex items-center gap-2 text-sm text-zinc-700"><input type="checkbox" checked={unpaidBreak} disabled={disabled} onChange={(event) => setUnpaidBreak(event.target.checked)} />Unpaid break (0.5 deducted)</label>
          <label className="flex items-center gap-2 text-sm text-zinc-700"><input type="checkbox" checked={paidBreak} disabled={disabled} onChange={(event) => setPaidBreak(event.target.checked)} />Paid break (0.5 included in allocation)</label>
        </section>
      </div>

      <section className="space-y-3 rounded-lg bg-zinc-50 p-3">
        <div className="flex justify-between text-sm"><span>Payable total</span><strong>{payableHours ?? "Invalid"} h</strong></div>
        <div className="flex justify-between text-sm"><span>Allocation</span><strong>{allocationHours} h</strong></div>
        {!allocationMatches ? <Alert variant="error">Allocation must equal payable total before Submit.</Alert> : null}
<Button
  className="w-full border-blue-700 bg-blue-600 !text-white shadow-sm hover:bg-blue-700 disabled:border-blue-300 disabled:bg-blue-300 disabled:!text-white disabled:opacity-80"
  disabled={
    !canEdit ||
    isPending ||
    !allocationMatches ||
    lookups.projects.length === 0 ||
    lookups.tasks.length === 0
  }
  onClick={submit}
>
  {isPending ? "Submitting…" : "Submit"}
</Button>
      </section>
    </div>
  );
}
