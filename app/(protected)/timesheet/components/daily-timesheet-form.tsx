"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { StickyNote } from "lucide-react";
import { saveTimesheetEntryAction } from "@/app/(protected)/timesheet/actions";
import { Alert } from "@/src/components/ui/alert";
import { Button } from "@/src/components/ui/button";
import { PendingActionButton } from "@/src/components/ui/pending-button";
import { Input } from "@/src/components/ui/input";
import { Select } from "@/src/components/ui/select";
import { BottomSheet } from "@/src/components/ui/bottom-sheet";
import { formatNzDate } from "@/src/lib/dateTime";
import { cn } from "@/src/lib/utils";
import {
  calculateAllocationHours,
  calculatePayableHours,
  derivePaidBreakEntitlement,
  getIncompleteActivityRows,
  incompleteActivityMessage,
} from "@/src/lib/timesheets/validation";
import { filterLookupsForLocation, getLeaveTaskOptions, hasPublicHolidayTask, isWorkActivityTask } from "@/src/lib/timesheets/lookup-shared";
import { calculateShiftCompletionHelper, SHIFT_COMPLETION_CONFIG } from "@/src/lib/timesheets/shift-completion";
import { shouldDisableBreakFields, shouldDisablePaidBreakControl } from "@/src/lib/timesheets/daily-timesheet-ui-rules";
import type {
  SaveTimesheetEntryInput,
  TimesheetActivityInput,
  TimesheetEntryWithActivities,
  TimesheetActivityMode,
  TimesheetLeaveType,
  TimesheetLookups,
  TimesheetWorkMode,
} from "@/src/lib/timesheets/types";

type SaveHandlerResult = { ok: true; message: string } | { ok: false; message: string };

type DraftActivity = TimesheetActivityInput & {
  clientId: string;
  hoursText: string;
};
const hasNoteContent = (value: string | null | undefined) => Boolean(value?.trim());

const formatGreetingName = (fullName: string) => {
  const trimmed = fullName.trim();
  if (!trimmed) return "Kia ora";

  const nameParts = trimmed.split(/\s+/).filter(Boolean);
  if (nameParts.length === 0) return "Kia ora";

  const firstName = nameParts[0];
  const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : "";
  return lastName ? `Kia ora, ${firstName} ${lastName.charAt(0)}.` : `Kia ora, ${firstName}`;
};

const leaveCodeToType: Record<string, TimesheetLeaveType> = { LA: "annual", LB: "bereavement", LS: "sick", LSACC: "sick", LSACCNW: "sick", LW: "unpaid", TIL: "other" };

const defaultActivity = (
  lookups: TimesheetLookups,
  workMode: TimesheetWorkMode,
  hoursText = "",
): DraftActivity => ({
  clientId: crypto.randomUUID(),
  projectId: "",
  taskId: "",
  workMode: workMode === "mixed" ? "factory" : workMode,
  hours: Number(hoursText) || 0,
  clientDescription: null,
  internalNote: null,
  hoursText,
});

const entryToActivities = (
  entry: TimesheetEntryWithActivities | null,
  lookups: TimesheetLookups,
  workMode: TimesheetWorkMode,
) => {
  if (entry && entry.activities.length > 0) {
    return entry.activities.map((activity) => ({
      clientId: activity.id,
      projectId: activity.project_id,
      taskId: activity.task_id,
      workMode: activity.work_mode,
      hours: activity.hours,
      clientDescription: activity.client_description,
      internalNote: activity.internal_note,
      hoursText: String(activity.hours),
    }));
  }
  return [defaultActivity(lookups, workMode)];
};

export function DailyTimesheetForm({
  workDate,
  displayDate,
  userName,
  entry,
  preferredWorkMode,
  lookups,
  canEdit,
  onSaved,
  saveHandler = saveTimesheetEntryAction,
  submitLabel = "Submit",
  pendingLabel = "Submitting…",
  headingText,
  showReturnedNotice = true,
  correctionComment,
  onCorrectionCommentChange,
}: {
  workDate: string;
  displayDate: string;
  userName: string;
  entry: TimesheetEntryWithActivities | null;
  preferredWorkMode: TimesheetWorkMode;
  lookups: TimesheetLookups;
  canEdit: boolean;
  onSaved: () => void;
  saveHandler?: (input: SaveTimesheetEntryInput) => Promise<SaveHandlerResult>;
  submitLabel?: string;
  pendingLabel?: string;
  headingText?: string;
  showReturnedNotice?: boolean;
  correctionComment?: string;
  onCorrectionCommentChange?: (comment: string) => void;
}) {
  const [workMode, setWorkMode] = useState<TimesheetWorkMode>(
    entry?.work_mode ?? preferredWorkMode,
  );
  const [timeIn, setTimeIn] = useState((entry?.time_in ?? "07:00").slice(0, 5));
  const [timeOut, setTimeOut] = useState(
    (entry?.time_out ?? "16:00").slice(0, 5),
  );
  const [leaveType, setLeaveType] = useState<TimesheetLeaveType | "">(
    entry?.leave_type ?? "",
  );
  const [isFullDayLeave, setIsFullDayLeave] = useState(
    Boolean(entry?.leave_type) && (entry?.leave_hours ?? 0) === 8,
  );
  const [leaveHoursText, setLeaveHoursText] = useState(
    entry?.leave_hours ? String(entry.leave_hours) : "0",
  );
  const [isPublicHoliday, setIsPublicHoliday] = useState(
    entry?.is_public_holiday ?? false,
  );
  const [unpaidBreak, setUnpaidBreak] = useState(entry?.unpaid_break ?? true);
  const [paidBreak, setPaidBreak] = useState(() => {
    if (entry) return entry.paid_break ?? false;
    return derivePaidBreakEntitlement({
      isPublicHoliday: false,
      timeIn: "07:00",
      timeOut: "16:00",
    });
  });
  const [showShiftHelperPopover, setShowShiftHelperPopover] = useState(false);
  const shiftHelperPopoverRef = useRef<HTMLDivElement | null>(null);
  const [activities, setActivities] = useState(() =>
    entryToActivities(entry, lookups, entry?.work_mode ?? preferredWorkMode),
  );
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [isPending, startTransition] = useTransition();
  const [activeNotesRowId, setActiveNotesRowId] = useState<string | null>(null);
  const [draftNotes, setDraftNotes] = useState<{ clientDescription: string; internalNote: string }>({ clientDescription: "", internalNote: "" });

  const isPublicHolidayMode = isPublicHoliday;
  const isFullDayLeaveMode = isFullDayLeave;
  const publicHolidayMutedClasses = "opacity-60 grayscale-[65%] [&_button:disabled]:cursor-not-allowed [&_input:disabled]:cursor-not-allowed [&_select:disabled]:cursor-not-allowed";
  const disableAttendanceFields = !canEdit || isPublicHolidayMode || isFullDayLeaveMode;
  const disableActivityFields = !canEdit || isPublicHolidayMode || isFullDayLeaveMode;
  const disableBreakFields = shouldDisableBreakFields({ canEdit, isPublicHolidayMode, isFullDayLeaveMode });
  const disableLeaveFields = !canEdit || isPublicHolidayMode;
  const leaveHours = Number(leaveHoursText) || 0;
  const parsedActivities = useMemo(
    () =>
      activities.map((activity) => ({
        ...activity,
        hours: Number(activity.hoursText) || 0,
      })),
    [activities],
  );
  const payableHours = calculatePayableHours({
    isPublicHoliday,
    fullDayLeave: isFullDayLeave,
    timeIn,
    timeOut,
    unpaidBreak,
  });
  const paidBreakEligible = derivePaidBreakEntitlement({
    isPublicHoliday,
    timeIn,
    timeOut,
  });
  const applyPaidBreakRules = useCallback((next: {
    isPublicHoliday?: boolean;
    timeIn?: string;
    timeOut?: string;
    isFullDayLeave?: boolean;
  }) => {
    const nextIsPublicHoliday = next.isPublicHoliday ?? isPublicHoliday;
    const nextTimeIn = next.timeIn ?? timeIn;
    const nextTimeOut = next.timeOut ?? timeOut;
    const nextIsFullDayLeave = next.isFullDayLeave ?? isFullDayLeave;

    const eligible = derivePaidBreakEntitlement({
      isPublicHoliday: nextIsPublicHoliday,
      timeIn: nextTimeIn,
      timeOut: nextTimeOut,
    });

    if (!eligible || nextIsFullDayLeave) setPaidBreak(false);
  }, [isFullDayLeave, isPublicHoliday, timeIn, timeOut]);

  const effectivePaidBreak = !isPublicHoliday && paidBreakEligible && paidBreak;
  const allocationHours = calculateAllocationHours({
    isPublicHoliday,
    fullDayLeave: isFullDayLeave,
    activities: parsedActivities.filter((row) => row.hours > 0),
    leaveHours,
  });
  const requiredAllocationHours = isFullDayLeave ? 8 : payableHours === null ? null : Number((payableHours - (effectivePaidBreak ? 0.5 : 0)).toFixed(1));
  const allocationMatches =
    requiredAllocationHours !== null && Math.abs(allocationHours - requiredAllocationHours) < 0.01;
  const shiftCompletion = useMemo(() => calculateShiftCompletionHelper({
    timeIn: isPublicHoliday ? null : timeIn,
    timeOut: isPublicHoliday ? null : timeOut,
  }), [isPublicHoliday, timeIn, timeOut]);
  const showShiftCompletionHelper = !isPublicHoliday && !isFullDayLeave && payableHours !== null && !allocationMatches;
  const incompleteActivityRows = useMemo(
    () =>
      getIncompleteActivityRows({
        isPublicHoliday,
        workMode,
        activities: parsedActivities,
      }),
    [isPublicHoliday, parsedActivities, workMode],
  );
  const incompleteActivityRowsByIndex = useMemo(
    () => new Map(incompleteActivityRows.map((row) => [row.index, row])),
    [incompleteActivityRows],
  );
  const incompleteActivityError =
    incompleteActivityRows.length > 0
      ? incompleteActivityMessage(workMode)
      : null;
  const publicHolidayAvailable = hasPublicHolidayTask(lookups);
  const leaveOptions = useMemo(() => getLeaveTaskOptions(lookups).map((task) => ({ value: leaveCodeToType[task.code], label: `${task.code} — ${task.label}` })).filter((option): option is { value: TimesheetLeaveType; label: string } => Boolean(option.value)), [lookups]);
  const lookupOptionsByLocation = useMemo(() => ({
    factory: {
      ...filterLookupsForLocation(lookups, "factory"),
      tasks: filterLookupsForLocation(lookups, "factory").tasks.filter(isWorkActivityTask),
    },
    site: {
      ...filterLookupsForLocation(lookups, "site"),
      tasks: filterLookupsForLocation(lookups, "site").tasks.filter(isWorkActivityTask),
    },
    office: {
      ...filterLookupsForLocation(lookups, "office"),
      tasks: filterLookupsForLocation(lookups, "office").tasks.filter(isWorkActivityTask),
    },
  }), [lookups]);


  useEffect(() => {
    if (!showShiftHelperPopover) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!shiftHelperPopoverRef.current?.contains(event.target as Node)) {
        setShowShiftHelperPopover(false);
      }
    };
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setShowShiftHelperPopover(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onEscape);
    };
  }, [showShiftHelperPopover]);

  const formattedWorkDate = displayDate || formatNzDate(workDate, {
    weekday: "long",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  const updateWorkMode = (nextMode: TimesheetWorkMode) => {
    setWorkMode(nextMode);
    if (nextMode !== "mixed") {
      setActivities((current) =>
        current.map((row) => ({ ...row, workMode: nextMode })),
      );
    }
  };

  const updateActivity = useCallback((clientId: string, patch: Partial<DraftActivity>) => {
    setActivities((current) =>
      current.map((row) =>
        row.clientId === clientId ? { ...row, ...patch } : row,
      ),
    );
  }, []);
  const openNotesEditor = useCallback((activity: DraftActivity) => {
    setActiveNotesRowId(activity.clientId);
    setDraftNotes({ clientDescription: activity.clientDescription ?? "", internalNote: activity.internalNote ?? "" });
  }, []);
  const closeNotesEditor = useCallback(() => {
    setActiveNotesRowId(null);
  }, []);
  const saveNotesEditor = useCallback(() => {
    if (!activeNotesRowId) return;
    updateActivity(activeNotesRowId, {
      clientDescription: draftNotes.clientDescription,
      internalNote: draftNotes.internalNote,
    });
    setActiveNotesRowId(null);
  }, [activeNotesRowId, draftNotes.clientDescription, draftNotes.internalNote, updateActivity]);

  const submit = () => {
    setFeedback(null);
    const payload: SaveTimesheetEntryInput = {
      workDate,
      timeIn: isPublicHoliday ? null : timeIn,
      timeOut: isPublicHoliday ? null : timeOut,
      workMode,
      leaveType: isPublicHoliday || leaveType === "" ? null : leaveType,
      leaveHours: isPublicHoliday ? 0 : leaveHours,
      fullDayLeave: isFullDayLeave,
      isPublicHoliday,
      unpaidBreak: isPublicHoliday || isFullDayLeave ? false : unpaidBreak,
      paidBreak: isPublicHoliday || isFullDayLeave ? false : effectivePaidBreak,
      activities: isPublicHoliday
        ? []
        : parsedActivities.map((row) => ({
            projectId: row.projectId,
            taskId: row.taskId,
            workMode: workMode === "mixed" ? row.workMode : workMode,
            hours: row.hours,
            clientDescription: row.clientDescription,
            internalNote: row.internalNote,
          })),
    };

    startTransition(async () => {
      const result = await saveHandler(payload);
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
          <h2 className="text-2xl font-semibold tracking-tight text-zinc-950">
            {headingText ?? formatGreetingName(userName)}
          </h2>
          <p className="mt-1 text-sm font-normal text-zinc-500">
            {formattedWorkDate}
          </p>
        </div>
        {showReturnedNotice && entry?.status === "returned" ? (
          <Alert variant="warning">
            This entry was returned for correction. {entry.return_comment ? `Comment: ${entry.return_comment}` : "Please update and resubmit."}
          </Alert>
        ) : null}
        {entry?.status === "supervisor_approved" || entry?.status === "approved" ? (
          <Alert variant="warning">
            This entry is supervisor reviewed and locked. Contact a supervisor if it needs to be returned for correction.
          </Alert>
        ) : null}
        {correctionComment !== undefined && onCorrectionCommentChange ? (
          <label className="block space-y-1 text-sm font-medium text-zinc-700">
            Correction note (optional)
            <textarea
              className="min-h-20 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-200"
              value={correctionComment}
              onChange={(event) => onCorrectionCommentChange(event.target.value)}
              placeholder="Add a short note for the audit history."
            />
          </label>
        ) : null}
        {feedback ? (
          <Alert variant={feedback.type}>{feedback.message}</Alert>
        ) : null}
        {lookups.projects.length === 0 || lookups.tasks.length === 0 ? (
          <Alert variant="warning">
            No project or task options are available for this employee&rsquo;s staff group. Ask an admin to assign a staff group or make the relevant lookup rows visible before submitting.
          </Alert>
        ) : null}
      </section>

      <section className="space-y-3">
        <label className="flex items-center gap-2 text-sm font-medium text-zinc-900">
          <input
            type="checkbox"
            checked={isPublicHoliday}
            disabled={!canEdit || !publicHolidayAvailable}
            onChange={(event) => {
                const checked = event.target.checked;
                setIsPublicHoliday(checked);
                applyPaidBreakRules({ isPublicHoliday: checked });
              }}
          />
          Public holiday
        </label>
        {!publicHolidayAvailable ? (<p className="text-xs text-zinc-500">Public holiday is unavailable because the PUHO costcode is not active for this work location.</p>) : null}
      </section>

      <div
        className={cn(
          "space-y-6 transition-[filter,opacity] duration-150",
          isPublicHolidayMode && publicHolidayMutedClasses,
        )}
      >
        <section className={cn("grid gap-4 sm:grid-cols-3", isFullDayLeaveMode && publicHolidayMutedClasses)}>
          <label className="space-y-1 text-sm font-medium text-zinc-700">
            Time in
            <Input
              type="time"
              value={timeIn}
              disabled={disableAttendanceFields}
              onChange={(event) => {
                const nextTimeIn = event.target.value;
                setTimeIn(nextTimeIn);
                applyPaidBreakRules({ timeIn: nextTimeIn });
              }}
              step={1800}
            />
          </label>
          <label className="space-y-1 text-sm font-medium text-zinc-700">
            Time out
            <Input
              type="time"
              value={timeOut}
              disabled={disableAttendanceFields}
              onChange={(event) => {
                const nextTimeOut = event.target.value;
                setTimeOut(nextTimeOut);
                applyPaidBreakRules({ timeOut: nextTimeOut });
              }}
              step={1800}
            />
          </label>
          <label className="space-y-1 text-sm font-medium text-zinc-700">
            Work Location
            <Select
              value={workMode}
              disabled={disableAttendanceFields}
              onChange={(event) =>
                updateWorkMode(event.target.value as TimesheetWorkMode)
              }
            >
              <option value="factory">Factory</option>
              <option value="site">Site</option>
              <option value="office">Office</option>
              <option value="mixed">Mixed</option>
            </Select>
          </label>
        </section>

        <section className={cn("space-y-3", isFullDayLeaveMode && publicHolidayMutedClasses)}>
          <h3 className="text-base font-semibold text-zinc-900">Activity</h3>
          <div className="space-y-3">
            {activities.map((activity, index) => {
              const rowLocation = workMode === "mixed" ? activity.workMode : workMode;
              const rowLookups = lookupOptionsByLocation[rowLocation];
              const incompleteRow = incompleteActivityRowsByIndex.get(index);

              return (
                <div
                  key={activity.clientId}
                  className={
                    workMode === "mixed"
                      ? "grid gap-3 rounded-lg bg-zinc-50 p-3 sm:grid-cols-[1fr_1fr_120px_100px_40px]"
                      : "grid gap-3 rounded-lg bg-zinc-50 p-3 sm:grid-cols-[1fr_1fr_100px_40px]"
                  }
                >
                  <label className="space-y-1 text-xs font-medium text-zinc-600">
                    Project
                    <Select
                      className={cn(
                        incompleteRow?.missingProject &&
                          "border-red-300 bg-red-50/40 focus:border-red-400",
                      )}
                      value={activity.projectId}
                      disabled={disableActivityFields}
                      onChange={(event) =>
                        updateActivity(activity.clientId, {
                          projectId: event.target.value,
                        })
                      }
                    >
                      <option value="">Select project</option>
                      {rowLookups.projects.map((project) => (
                        <option key={project.id} value={project.id}>
                          {project.code} — {project.label}
                        </option>
                      ))}
                    </Select>
                  </label>
                  <label className="space-y-1 text-xs font-medium text-zinc-600">
                    Task
                    <Select
                      className={cn(
                        incompleteRow?.missingTask &&
                          "border-red-300 bg-red-50/40 focus:border-red-400",
                      )}
                      value={activity.taskId}
                      disabled={disableActivityFields}
                      onChange={(event) =>
                        updateActivity(activity.clientId, {
                          taskId: event.target.value,
                        })
                      }
                    >
                      <option value="">Select task</option>
                      {rowLookups.tasks.map((task) => (
                        <option key={task.id} value={task.id}>
                          {task.label}
                        </option>
                      ))}
                    </Select>
                  </label>
                  {workMode === "mixed" ? (
                    <label className="space-y-1 text-xs font-medium text-zinc-600">
                      Location
                      <Select
                        className={cn(
                          incompleteRow?.missingLocation &&
                            "border-red-300 bg-red-50/40 focus:border-red-400",
                        )}
                        value={activity.workMode}
                        disabled={disableActivityFields}
                        onChange={(event) =>
                          updateActivity(activity.clientId, {
                            workMode: event.target.value as TimesheetActivityMode,
                          })
                        }
                      >
                        <option value="factory">Factory</option>
                        <option value="site">Site</option>
                        <option value="office">Office</option>
                      </Select>
                    </label>
                  ) : null}
                  <label className="space-y-1 text-xs font-medium text-zinc-600">
                    Hours
                    <Input
                      inputMode="decimal"
                      value={activity.hoursText}
                      disabled={disableActivityFields}
                      onChange={(event) =>
                        updateActivity(activity.clientId, {
                          hoursText: event.target.value,
                        })
                      }
                      placeholder="Hours"
                    />
                  </label>
                  <div className="flex items-end">
                    <button
                      type="button"
                      aria-label={`Edit notes for row ${index + 1}`}
                      className="relative mb-0.5 rounded p-2 text-zinc-500 transition hover:bg-zinc-200 hover:text-zinc-700 disabled:opacity-40"
                      disabled={disableActivityFields}
                      onClick={() => openNotesEditor(activity)}
                    >
                      <StickyNote className="size-4" />
                      {hasNoteContent(activity.clientDescription) || hasNoteContent(activity.internalNote) ? <span className="absolute right-1 top-1 size-2 rounded-full bg-amber-400" /> : null}
                    </button>
                  </div>
                </div>
              );
            })}
            {incompleteActivityError ? (
              <Alert className="text-xs" variant="error">
                {incompleteActivityError}
              </Alert>
            ) : null}
            <Button
              aria-label="Add activity row"
              className="gap-2 border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
              disabled={disableActivityFields}
              onClick={() =>
                setActivities((current) => [
                  ...current,
                  defaultActivity(lookups, workMode),
                ])
              }
            >
              <span
                aria-hidden="true"
                className="flex size-5 items-center justify-center rounded-full bg-emerald-600 text-sm font-semibold leading-none text-white"
              >
                ＋
              </span>
              Add another activity
            </Button>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1 text-sm font-medium text-zinc-700">
            Leave type
            <Select
              value={leaveType}
              disabled={disableLeaveFields}
              onChange={(event) => {
                const nextLeaveType = event.target.value as TimesheetLeaveType | "";
                setLeaveType(nextLeaveType);
                if (nextLeaveType !== "") {
                  setUnpaidBreak(false);
                  setIsFullDayLeave(true);
                  setLeaveHoursText("8");
                  applyPaidBreakRules({ isFullDayLeave: true });
                  return;
                }
                setIsFullDayLeave(false);
                setLeaveHoursText("0");
                applyPaidBreakRules({ isFullDayLeave: false });
              }}
            >
              <option value="">No leave</option>
              {leaveOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </label>
          <label className="space-y-1 text-sm font-medium text-zinc-700">
            Leave hours
            <Input
              inputMode="decimal"
              value={leaveHoursText}
              disabled={disableLeaveFields}
              onChange={(event) => setLeaveHoursText(event.target.value)}
            />
            <label className="flex items-center gap-2 pt-2 text-xs font-medium text-zinc-600">
              <input
                type="checkbox"
                checked={isFullDayLeave}
                disabled={disableLeaveFields || leaveType === ""}
                onChange={(event) => {
                  const checked = event.target.checked;
                  setIsFullDayLeave(checked);
                  if (checked) {
                    setLeaveHoursText("8");
                    setUnpaidBreak(false);
                  }
                  applyPaidBreakRules({ isFullDayLeave: checked });
                }}
              />
              Full day leave
              {showShiftCompletionHelper ? (
                <span className="relative inline-flex" ref={shiftHelperPopoverRef}>
                  <button
                    type="button"
                    aria-label="Show shift completion helper"
                    aria-expanded={showShiftHelperPopover}
                    className="rounded-full p-0.5 text-zinc-500 transition hover:bg-zinc-200 hover:text-zinc-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-300"
                    onClick={() => setShowShiftHelperPopover((current) => !current)}
                  >
                    <span aria-hidden="true" className="text-[11px] font-semibold leading-none">?</span>
                  </button>
                  {showShiftHelperPopover ? (
                    <span
                      role="tooltip"
                      className="absolute left-0 top-6 z-20 w-64 rounded-md border border-zinc-200 bg-white p-2 text-[11px] font-normal text-zinc-600 shadow-sm"
                    >
                      Based on the standard {SHIFT_COMPLETION_CONFIG.shiftStart}–{SHIFT_COMPLETION_CONFIG.shiftFinish} shift, suggested leave: {shiftCompletion.suggestedLeaveHours.toFixed(1)} h
                    </span>
                  ) : null}
                </span>
              ) : null}
            </label>
          </label>
        </section>

        <section className={cn("space-y-2", isFullDayLeaveMode && publicHolidayMutedClasses)}>
          <label className="flex items-center gap-2 text-sm text-zinc-700">
            <input
              type="checkbox"
              checked={unpaidBreak}
              disabled={disableBreakFields}
              onChange={(event) => setUnpaidBreak(event.target.checked)}
            />
            Unpaid break
          </label>
          <label className="flex items-center gap-2 text-sm text-zinc-700">
            <input
              type="checkbox"
              checked={effectivePaidBreak}
              disabled={shouldDisablePaidBreakControl({ disableBreakFields, paidBreakEligible })}
              onChange={(event) => setPaidBreak(event.target.checked)}
            />
            Paid break taken/claimed (0.5h)
          </label>
          <p className="text-xs text-zinc-500">Paid break is available from 3.0h attendance and must be included inside the time in/out span.</p>
          {!paidBreakEligible && !isPublicHoliday ? <p className="text-xs text-zinc-500">Paid break cannot be claimed below 3.0h attendance.</p> : null}
        </section>
      </div>

      <section className="space-y-3 rounded-lg bg-zinc-50 p-3">
        <div className="flex justify-between text-sm">
          <span>Total payable hours</span>
          <strong>{payableHours ?? "Invalid"} h</strong>
        </div>
        <div className="flex justify-between text-sm">
          <span>Allocation</span>
          <strong>{allocationHours} h</strong>
        </div>
        <p className="text-xs text-zinc-500">Required allocation: {requiredAllocationHours ?? "Invalid"} h</p>
        {!allocationMatches ? (
          <Alert variant="error">
            Allocation must equal attendance span minus claimed paid break and unpaid break before saving.
          </Alert>
        ) : null}
        {incompleteActivityError ? (
          <Alert variant="error">{incompleteActivityError}</Alert>
        ) : null}
        <PendingActionButton
          variant="brand"
          className="w-full"
          disabled={
            !canEdit ||
            !allocationMatches ||
            incompleteActivityRows.length > 0 ||
            lookups.projects.length === 0 ||
            lookups.tasks.length === 0
          }
          isPending={isPending}
          pendingLabel={pendingLabel}
          onClick={submit}
        >
          {submitLabel}
        </PendingActionButton>
      </section>
      {activeNotesRowId !== null ? (
        <div className="fixed inset-0 z-40 hidden sm:block">
          <button type="button" className="absolute inset-0 bg-zinc-900/30" onClick={closeNotesEditor} aria-label="Close notes editor" />
          <div className="absolute right-0 top-0 h-full w-full max-w-md overflow-y-auto bg-white p-4 shadow-xl">
            <h3 className="text-base font-semibold text-zinc-900">Activity notes</h3>
            <div className="mt-3 space-y-3">
              <label className="space-y-1 text-sm font-medium text-zinc-700">
                Client description
                <textarea className="min-h-20 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm" value={draftNotes.clientDescription} onChange={(event) => setDraftNotes((current) => ({ ...current, clientDescription: event.target.value }))} />
                <p className="text-xs font-normal text-zinc-500">May appear in client summaries or future exports.</p>
              </label>
              <label className="space-y-1 text-sm font-medium text-zinc-700">
                Internal management note
                <textarea className="min-h-20 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm" value={draftNotes.internalNote} onChange={(event) => setDraftNotes((current) => ({ ...current, internalNote: event.target.value }))} />
                <p className="text-xs font-normal text-zinc-500">Internal only. Not for client-facing summaries.</p>
              </label>
              <div className="flex justify-end gap-2">
                <Button onClick={closeNotesEditor} variant="secondary">Cancel</Button>
                <Button onClick={saveNotesEditor} variant="brand">Done</Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
      <BottomSheet open={activeNotesRowId !== null} title="Activity notes" onClose={closeNotesEditor}>
        <div className="space-y-3">
          <label className="space-y-1 text-sm font-medium text-zinc-700">
            Client description
            <textarea className="min-h-20 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm" value={draftNotes.clientDescription} onChange={(event) => setDraftNotes((current) => ({ ...current, clientDescription: event.target.value }))} />
            <p className="text-xs font-normal text-zinc-500">May appear in client summaries or future exports.</p>
          </label>
          <label className="space-y-1 text-sm font-medium text-zinc-700">
            Internal management note
            <textarea className="min-h-20 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm" value={draftNotes.internalNote} onChange={(event) => setDraftNotes((current) => ({ ...current, internalNote: event.target.value }))} />
            <p className="text-xs font-normal text-zinc-500">Internal only. Not for client-facing summaries.</p>
          </label>
          <div className="flex justify-end gap-2">
            <Button onClick={closeNotesEditor} variant="secondary">Cancel</Button>
            <Button onClick={saveNotesEditor} variant="brand">Done</Button>
          </div>
        </div>
      </BottomSheet>
    </div>
  );
}
