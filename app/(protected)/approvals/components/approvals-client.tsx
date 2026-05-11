"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { approveEmployeeTimesheetWeekAction, returnEmployeeTimesheetWeekAction } from "@/app/(protected)/approvals/actions";
import { DailyTimesheetReview } from "@/app/(protected)/approvals/components/daily-timesheet-review";
import { DailyTimesheetSheet } from "@/app/(protected)/timesheet/components/daily-timesheet-sheet";
import { WeeklyTimesheetView } from "@/app/(protected)/timesheet/components/weekly-timesheet-view";
import { Alert } from "@/src/components/ui/alert";
import { Badge } from "@/src/components/ui/badge";
import { Button } from "@/src/components/ui/button";
import { Card } from "@/src/components/ui/card";
import { Textarea } from "@/src/components/ui/textarea";
import { cn } from "@/src/lib/utils";
import type { ApprovalStaffProfile } from "@/src/lib/timesheets/approvals";
import type { StaffGroup, TimesheetDaySummary, TimesheetEntryWithActivities, TimesheetLookups } from "@/src/lib/timesheets/types";

type WeeklyTimesheetMode = "summary" | "details";

type StaffWithWeek = ApprovalStaffProfile & {
  days: TimesheetDaySummary[];
  totalHours: number;
  submittedCount: number;
  returnedCount: number;
  supervisorApprovedCount: number;
  missingCount: number;
};

type GroupData = Record<StaffGroup, StaffWithWeek[]>;

const groupLabels: Record<StaffGroup, string> = { factory: "Factory", site: "Site" };

export function ApprovalsClient({
  groups,
  lookups,
  weekStart,
  weekRangeLabel,
}: {
  groups: GroupData;
  lookups: TimesheetLookups;
  weekStart: string;
  weekRangeLabel: string;
}) {
  const router = useRouter();
  const [selectedGroup, setSelectedGroup] = useState<StaffGroup>("factory");
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [mode, setMode] = useState<WeeklyTimesheetMode>("summary");
  const [returnComment, setReturnComment] = useState("");
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  const staff = groups[selectedGroup];
  const selectedStaff = useMemo(() => staff.find((person) => person.id === selectedProfileId) ?? null, [staff, selectedProfileId]);
  const selectedDay = useMemo(() => selectedStaff?.days.find((day) => day.date === selectedDate) ?? null, [selectedDate, selectedStaff]);

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

  return (
    <>
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Staff groups">
        {(["factory", "site"] as const).map((group) => (
          <button
            key={group}
            type="button"
            className={cn(
              "rounded-full px-4 py-2 text-sm font-medium transition-colors",
              selectedGroup === group ? "bg-zinc-950 text-white" : "bg-white text-zinc-700 ring-1 ring-zinc-200 hover:text-zinc-950",
            )}
            onClick={() => setSelectedGroup(group)}
          >
            {groupLabels[group]}
          </button>
        ))}
      </div>

      <Card className="mt-4 overflow-hidden p-0">
        <div className="border-b border-zinc-200 p-4">
          <h2 className="text-lg font-semibold text-zinc-950">{groupLabels[selectedGroup]} staff</h2>
          <p className="text-sm text-zinc-500">Current NZ week: {weekRangeLabel}</p>
        </div>
        {staff.length === 0 ? (
          <p className="p-4 text-sm text-zinc-500">No approved staff assigned to this group.</p>
        ) : (
          <div className="divide-y divide-zinc-100">
            {staff.map((person) => (
              <button
                key={person.id}
                type="button"
                className="grid w-full gap-3 p-4 text-left transition-colors hover:bg-zinc-50 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
                onClick={() => setSelectedProfileId(person.id)}
              >
                <div className="min-w-0">
                  <p className="font-medium text-zinc-950">{person.full_name ?? person.email}</p>
                  <p className="text-sm text-zinc-500">{person.email} · {person.role}</p>
                </div>
                <div className="flex flex-wrap gap-2 sm:justify-end">
                  <Badge variant="neutral">{person.totalHours} h</Badge>
                  <Badge variant="info">{person.submittedCount} submitted</Badge>
                  <Badge variant="warning">{person.returnedCount} returned</Badge>
                  <Badge variant="success">{person.supervisorApprovedCount} approved</Badge>
                  <Badge variant={person.missingCount > 0 ? "warning" : "neutral"}>{person.missingCount} missing</Badge>
                </div>
              </button>
            ))}
          </div>
        )}
      </Card>

      {selectedStaff ? (
        <div className="fixed inset-0 z-40 overflow-y-auto bg-zinc-50" role="dialog" aria-modal="true">
          <div className="sticky top-0 z-10 border-b border-zinc-200 bg-white/95 px-4 py-3 backdrop-blur sm:px-6">
            <div className="mx-auto flex max-w-6xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-xl font-semibold text-zinc-950">{selectedStaff.full_name ?? selectedStaff.email}</h2>
                <p className="text-sm text-zinc-500">Timesheet review · {weekRangeLabel}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" onClick={runApproval} disabled={isPending || selectedStaff.submittedCount === 0}>Approve Week</Button>
                <Button type="button" variant="secondary" onClick={closeWeekly}>Close</Button>
              </div>
            </div>
          </div>
          <main className="mx-auto max-w-6xl space-y-4 px-4 py-5 sm:px-6">
            {feedback ? <Alert variant={feedback.type}>{feedback.message}</Alert> : null}
            <WeeklyTimesheetView
              days={selectedStaff.days}
              lookups={lookups}
              mode={mode}
              onModeChange={setMode}
              onSelectDay={setSelectedDate}
              entryActionLabel="Review"
              missingActionLabel="View"
            />
            <Card className="space-y-3">
              <h3 className="font-semibold text-zinc-950">Return for correction</h3>
              <Textarea
                value={returnComment}
                onChange={(event) => setReturnComment(event.target.value)}
                placeholder="Explain what the employee needs to fix before resubmitting."
                rows={3}
              />
              <Button type="button" variant="danger" onClick={runReturn} disabled={isPending || returnComment.trim().length === 0}>
                Return for Correction
              </Button>
            </Card>
          </main>

          <DailyTimesheetSheet open={selectedDay !== null} title="Daily timesheet review" onClose={() => setSelectedDate(null)}>
            {selectedDay ? (
              <DailyTimesheetReview
                entry={selectedDay.entry as TimesheetEntryWithActivities | null}
                lookups={lookups}
                displayDate={`${selectedDay.weekdayLabel}, ${selectedDay.displayDate}`}
                employeeName={selectedStaff.full_name ?? selectedStaff.email}
              />
            ) : null}
          </DailyTimesheetSheet>
        </div>
      ) : null}
    </>
  );
}
