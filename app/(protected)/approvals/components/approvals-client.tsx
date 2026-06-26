"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { approveEmployeeTimesheetWeekAction, approveEmployeeTimesheetWeekBulkAction, finalApproveEmployeeTimesheetWeekAction, finalApproveEmployeeTimesheetWeekBulkAction, returnEmployeeTimesheetWeekAction } from "@/app/(protected)/approvals/actions";
import { DailyTimesheetReview } from "@/app/(protected)/approvals/components/daily-timesheet-review";
import { DailyTimesheetSheet } from "@/app/(protected)/timesheet/components/daily-timesheet-sheet";
import { WeeklyTimesheetView } from "@/app/(protected)/timesheet/components/weekly-timesheet-view";
import { Alert } from "@/src/components/ui/alert";
import { Badge } from "@/src/components/ui/badge";
import { ConfirmDialog } from "@/src/components/ui/confirm-dialog";
import { FullScreenDialog } from "@/src/components/ui/full-screen-dialog";
import { PendingActionButton } from "@/src/components/ui/pending-button";
import { StatusBadge } from "@/src/components/ui/status-badge";
import { formatRoleLabel } from "@/src/lib/auth/role-labels";
import { TIMESHEET_STATUS_BADGE_CONFIG } from "@/src/lib/timesheets/formatting";
import { Card } from "@/src/components/ui/card";
import { Textarea } from "@/src/components/ui/textarea";
import { cn } from "@/src/lib/utils";
import type { ApprovalStaffProfile } from "@/src/lib/timesheets/approvals";
import type { StaffGroup, TimesheetDaySummary, TimesheetEntryWithActivities, TimesheetLookups, TimesheetLookupsByStaffGroup } from "@/src/lib/timesheets/types";

type WeeklyTimesheetMode = "summary" | "details";

type StaffWithWeek = ApprovalStaffProfile & {
  days: TimesheetDaySummary[];
  totalHours: number;
  submittedCount: number;
  returnedCount: number;
  supervisorApprovedCount: number;
  finalApprovedCount: number;
  missingCount: number;
};

type GroupData = Partial<Record<StaffGroup, StaffWithWeek[]>>;

const groupLabels: Record<StaffGroup, string> = { factory: "Factory", site: "Site", office: "Office" };

export function ApprovalsClient({
  groups,
  visibleGroups,
  lookupsByGroup,
  weekStart,
  weekRangeLabel,
  canFinalApprove,
  prevWeekStart,
  nextWeekStart,
  isCurrentWeek,
}: {
  groups: GroupData;
  visibleGroups: StaffGroup[];
  lookupsByGroup: TimesheetLookupsByStaffGroup;
  weekStart: string;
  weekRangeLabel: string;
  canFinalApprove: boolean;
  prevWeekStart: string;
  nextWeekStart: string | null;
  isCurrentWeek: boolean;
}) {
  const router = useRouter();
  const goToWeek = (target: string | null) => {
    if (!target) return;
    closeWeekly();
    router.push(`/approvals?week=${target}`);
  };
  const [selectedGroup, setSelectedGroup] = useState<StaffGroup | null>(visibleGroups[0] ?? null);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [mode, setMode] = useState<WeeklyTimesheetMode>("summary");
  const [returnComment, setReturnComment] = useState("");
  const [showFinalApproveConfirm, setShowFinalApproveConfirm] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulkFinalConfirm, setShowBulkFinalConfirm] = useState(false);
  const [bulkFeedback, setBulkFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  const staff = useMemo(() => (selectedGroup ? (groups[selectedGroup] ?? []) : []), [groups, selectedGroup]);
  const selectedStaff = useMemo(() => staff.find((person) => person.id === selectedProfileId) ?? null, [staff, selectedProfileId]);
  const selectedDay = useMemo(() => selectedStaff?.days.find((day) => day.date === selectedDate) ?? null, [selectedDate, selectedStaff]);
  const selectedLookups: TimesheetLookups = selectedGroup
    ? (lookupsByGroup[selectedGroup] ?? { projects: [], tasks: [] })
    : { projects: [], tasks: [] };

  const closeWeekly = () => {
    setSelectedProfileId(null);
    setSelectedDate(null);
    setReturnComment("");
    setFeedback(null);
  };

  const runApproval = () => {
    if (!selectedStaff) return;
    setFeedback(null);
    startTransition(async () => {
      const result = await approveEmployeeTimesheetWeekAction(selectedStaff.id, weekStart);
      setFeedback({ type: result.ok ? "success" : "error", message: result.message });
      if (result.ok) router.refresh();
    });
  };

  const runReturn = () => {
    if (!selectedStaff) return;
    setFeedback(null);
    startTransition(async () => {
      const result = await returnEmployeeTimesheetWeekAction(selectedStaff.id, weekStart, returnComment);
      setFeedback({ type: result.ok ? "success" : "error", message: result.message });
      if (result.ok) {
        setReturnComment("");
        router.refresh();
      }
    });
  };

  const runFinalApproval = () => {
    if (!selectedStaff || !canFinalApprove) return;
    setFeedback(null);
    startTransition(async () => {
      const result = await finalApproveEmployeeTimesheetWeekAction(selectedStaff.id, weekStart);
      setFeedback({ type: result.ok ? "success" : "error", message: result.message });
      if (result.ok) router.refresh();
    });
  };

  const selectableStaff = useMemo(
    () => staff.filter((person) => person.submittedCount > 0 || person.supervisorApprovedCount > 0),
    [staff],
  );
  const selectedInGroup = useMemo(
    () => staff.filter((person) => selectedIds.has(person.id)),
    [staff, selectedIds],
  );
  const reviewableSelectedCount = selectedInGroup.filter((person) => person.submittedCount > 0).length;
  const finalApprovableSelectedCount = selectedInGroup.filter((person) => person.supervisorApprovedCount > 0).length;

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allSelectableSelected = selectableStaff.length > 0 && selectableStaff.every((person) => selectedIds.has(person.id));
  const toggleSelectAll = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allSelectableSelected) {
        for (const person of selectableStaff) next.delete(person.id);
      } else {
        for (const person of selectableStaff) next.add(person.id);
      }
      return next;
    });
  };

  const clearSelection = () => setSelectedIds(new Set());

  const runBulkReview = () => {
    const ids = selectedInGroup.map((person) => person.id);
    if (ids.length === 0) return;
    setBulkFeedback(null);
    startTransition(async () => {
      const result = await approveEmployeeTimesheetWeekBulkAction(ids, weekStart);
      setBulkFeedback({ type: result.ok ? "success" : "error", message: result.message });
      if (result.ok) {
        clearSelection();
        router.refresh();
      }
    });
  };

  const runBulkFinalApprove = () => {
    if (!canFinalApprove) return;
    const ids = selectedInGroup.map((person) => person.id);
    if (ids.length === 0) return;
    setBulkFeedback(null);
    startTransition(async () => {
      const result = await finalApproveEmployeeTimesheetWeekBulkAction(ids, weekStart);
      setBulkFeedback({ type: result.ok ? "success" : "error", message: result.message });
      if (result.ok) {
        clearSelection();
        router.refresh();
      }
    });
  };

  if (visibleGroups.length === 0 || !selectedGroup) {
    return (
      <Card className="mt-4">
        <h2 className="text-lg font-semibold text-zinc-950">No approval group assigned</h2>
        <p className="mt-2 text-sm text-zinc-600">
          Your supervisor account is not assigned to Factory, Site, or Office. Ask an admin to assign your staff group before reviewing approvals.
        </p>
      </Card>
    );
  }

  return (
    <>
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Staff groups">
        {visibleGroups.map((group) => (
          <button
            key={group}
            type="button"
            className={cn(
              "rounded-full px-4 py-2 text-sm font-medium transition-colors",
              selectedGroup === group ? "bg-zinc-950 text-white" : "bg-white text-zinc-700 ring-1 ring-zinc-200 hover:text-zinc-950",
            )}
            onClick={() => {
              setSelectedGroup(group);
              clearSelection();
              setBulkFeedback(null);
            }}
          >
            {groupLabels[group]}
          </button>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="rounded-full bg-white px-3 py-2 text-sm font-medium text-zinc-700 ring-1 ring-zinc-200 transition-colors hover:text-zinc-950"
          onClick={() => goToWeek(prevWeekStart)}
        >
          ← Previous week
        </button>
        <button
          type="button"
          className="rounded-full bg-white px-3 py-2 text-sm font-medium text-zinc-700 ring-1 ring-zinc-200 transition-colors enabled:hover:text-zinc-950 disabled:cursor-not-allowed disabled:opacity-40"
          onClick={() => goToWeek(nextWeekStart)}
          disabled={nextWeekStart === null}
        >
          Next week →
        </button>
        {!isCurrentWeek ? (
          <button
            type="button"
            className="rounded-full bg-zinc-950 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800"
            onClick={() => {
              closeWeekly();
              router.push("/approvals");
            }}
          >
            Jump to current week
          </button>
        ) : null}
      </div>

      <Card className="mt-4 overflow-hidden p-0">
        <div className="border-b border-zinc-200 p-4">
          <h2 className="text-lg font-semibold text-zinc-950">{groupLabels[selectedGroup]} staff</h2>
          <p className="text-sm text-zinc-500">
            {isCurrentWeek ? "Current NZ week" : "NZ week"}: {weekRangeLabel}
          </p>
        </div>

        {selectableStaff.length > 0 ? (
          <div className="flex flex-wrap items-center gap-3 border-b border-zinc-200 bg-zinc-50 px-4 py-3">
            <label className="flex items-center gap-2 text-sm font-medium text-zinc-700">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-zinc-300"
                checked={allSelectableSelected}
                onChange={toggleSelectAll}
              />
              Select all with pending work
            </label>
            {selectedInGroup.length > 0 ? (
              <>
                <span className="text-sm text-zinc-500">{selectedInGroup.length} selected</span>
                <div className="ml-auto flex flex-wrap gap-2">
                  <PendingActionButton
                    type="button"
                    onClick={runBulkReview}
                    isPending={isPending}
                    disabled={reviewableSelectedCount === 0}
                    pendingLabel="Reviewing…"
                  >
                    Review {reviewableSelectedCount} week{reviewableSelectedCount === 1 ? "" : "s"}
                  </PendingActionButton>
                  {canFinalApprove ? (
                    <PendingActionButton
                      type="button"
                      variant="secondary"
                      onClick={() => setShowBulkFinalConfirm(true)}
                      isPending={isPending}
                      disabled={finalApprovableSelectedCount === 0}
                      pendingLabel="Final approving…"
                    >
                      Final approve {finalApprovableSelectedCount} week{finalApprovableSelectedCount === 1 ? "" : "s"}
                    </PendingActionButton>
                  ) : null}
                  <button
                    type="button"
                    className="rounded-md px-3 py-2 text-sm font-medium text-zinc-600 hover:text-zinc-900"
                    onClick={clearSelection}
                  >
                    Clear
                  </button>
                </div>
              </>
            ) : null}
          </div>
        ) : null}

        {bulkFeedback ? (
          <div className="px-4 pt-3">
            <Alert variant={bulkFeedback.type}>{bulkFeedback.message}</Alert>
          </div>
        ) : null}

        {staff.length === 0 ? (
          <p className="p-4 text-sm text-zinc-500">No approved staff assigned to this group.</p>
        ) : (
          <div className="divide-y divide-zinc-100">
            {staff.map((person) => {
              const selectable = person.submittedCount > 0 || person.supervisorApprovedCount > 0;
              return (
                <div
                  key={person.id}
                  className="flex items-center gap-3 p-4 transition-colors hover:bg-zinc-50"
                >
                  <input
                    type="checkbox"
                    aria-label={`Select ${person.full_name ?? person.email}`}
                    className="h-4 w-4 shrink-0 rounded border-zinc-300 disabled:opacity-30"
                    checked={selectedIds.has(person.id)}
                    disabled={!selectable}
                    onChange={() => toggleSelected(person.id)}
                  />
                  <button
                    type="button"
                    className="grid min-w-0 flex-1 gap-3 text-left sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
                    onClick={() => setSelectedProfileId(person.id)}
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-zinc-950">{person.full_name ?? person.email}</p>
                      <p className="text-sm text-zinc-500">{person.email} · {formatRoleLabel(person.role)}</p>
                    </div>
                    <div className="flex flex-wrap gap-2 sm:justify-end">
                      <Badge variant="neutral">{person.totalHours} h</Badge>
                      <Badge variant="info">{person.submittedCount} saved</Badge>
                      <Badge variant="warning">{person.returnedCount} returned</Badge>
                      <Badge variant="success">{person.supervisorApprovedCount} reviewed</Badge>
                      <Badge variant="neutral">{person.finalApprovedCount} approved</Badge>
                      <Badge variant={person.missingCount > 0 ? "warning" : "neutral"}>{person.missingCount} missing</Badge>
                    </div>
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <ConfirmDialog
        open={showBulkFinalConfirm}
        title={`Final approve ${finalApprovableSelectedCount} week${finalApprovableSelectedCount === 1 ? "" : "s"}?`}
        description="Final approval marks each selected employee's supervisor-reviewed entries as payroll-ready. Only final-approved timesheets are included in payroll exports."
        confirmLabel="Final Approve Selected"
        cancelLabel="Cancel"
        onCancel={() => setShowBulkFinalConfirm(false)}
        onConfirm={() => {
          setShowBulkFinalConfirm(false);
          runBulkFinalApprove();
        }}
      />

      {selectedStaff ? (
        <>
          <FullScreenDialog
            open
            eyebrow="Timesheet review"
            title={selectedStaff.full_name ?? selectedStaff.email}
            subtitle={weekRangeLabel}
            onClose={closeWeekly}
            actionSlot={
              <>
                <PendingActionButton type="button" onClick={runApproval} isPending={isPending} disabled={selectedStaff.submittedCount === 0} pendingLabel="Reviewing…">Review Week</PendingActionButton>
                {canFinalApprove ? (
                  <PendingActionButton
                    type="button"
                    variant="secondary"
                    onClick={() => setShowFinalApproveConfirm(true)}
                    isPending={isPending}
                    disabled={selectedStaff.supervisorApprovedCount === 0}
                    pendingLabel="Final approving…"
                  >
                    Final Approve Week
                  </PendingActionButton>
                ) : null}
              </>
            }
          >
            <div className="space-y-4 px-4 py-5 sm:p-0">
              {feedback ? <Alert variant={feedback.type}>{feedback.message}</Alert> : null}
              <WeeklyTimesheetView
                days={selectedStaff.days}
                lookups={selectedLookups}
                mode={mode}
                onModeChange={setMode}
                onSelectDay={setSelectedDate}
                entryActionLabel="Review"
                missingActionLabel="View"
                context="approval"
              />
              <Card className="space-y-3">
                <h3 className="font-semibold text-zinc-950">Return for correction</h3>
                <Textarea
                  value={returnComment}
                  onChange={(event) => setReturnComment(event.target.value)}
                  placeholder="Explain what the employee needs to fix before saving again."
                  rows={3}
                />
                <PendingActionButton type="button" variant="danger" onClick={runReturn} isPending={isPending} disabled={returnComment.trim().length === 0} pendingLabel="Returning…">
                  Return for Correction
                </PendingActionButton>
              </Card>
            </div>
          </FullScreenDialog>

          <ConfirmDialog
            open={showFinalApproveConfirm}
            title="Final approve this week?"
            description={`Final approval marks ${selectedStaff.full_name ?? selectedStaff.email}'s supervisor-reviewed entries as payroll-ready. Only final-approved timesheets are included in payroll exports.`}
            confirmLabel="Final Approve Week"
            cancelLabel="Cancel"
            onCancel={() => setShowFinalApproveConfirm(false)}
            onConfirm={() => {
              setShowFinalApproveConfirm(false);
              runFinalApproval();
            }}
          />

          <DailyTimesheetSheet
            open={selectedDay !== null}
            title="Daily timesheet review"
            eyebrow="Supervisor review"
            subtitle={selectedDay ? `${selectedDay.weekdayLabel}, ${selectedDay.displayDate}` : undefined}
            metadata={selectedStaff.full_name ?? selectedStaff.email}
            statusSlot={selectedDay?.entry ? <StatusBadge config={TIMESHEET_STATUS_BADGE_CONFIG[selectedDay.entry.status]} /> : null}
            onClose={() => setSelectedDate(null)}
          >
            {selectedDay ? (
              <DailyTimesheetReview
                entry={selectedDay.entry as TimesheetEntryWithActivities | null}
                lookups={selectedLookups}
                displayDate={`${selectedDay.weekdayLabel}, ${selectedDay.displayDate}`}
                employeeName={selectedStaff.full_name ?? selectedStaff.email}
                targetProfileId={selectedStaff.id}
                onSaved={() => router.refresh()}
              />
            ) : null}
          </DailyTimesheetSheet>
        </>
      ) : null}
    </>
  );
}
