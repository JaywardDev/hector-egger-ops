"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveEmployeeTimesheetCorrectionAction } from "@/app/(protected)/approvals/actions";
import { DailyTimesheetForm } from "@/app/(protected)/timesheet/components/daily-timesheet-form";
import { Alert } from "@/src/components/ui/alert";
import { StatusBadge } from "@/src/components/ui/status-badge";
import { Button } from "@/src/components/ui/button";
import { TIMESHEET_STATUS_BADGE_CONFIG, formatTimesheetHours } from "@/src/lib/timesheets/formatting";
import { getActivityProjectDisplay, getActivityTaskDisplay } from "@/src/lib/timesheets/activity-display";
import type { TimesheetEntryWithActivities, TimesheetLookups } from "@/src/lib/timesheets/types";

export function DailyTimesheetReview({
  entry,
  lookups,
  displayDate,
  employeeName,
  targetProfileId,
  onSaved,
}: {
  entry: TimesheetEntryWithActivities | null;
  lookups: TimesheetLookups;
  displayDate: string;
  employeeName: string;
  targetProfileId: string;
  onSaved: () => void;
}) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [comment, setComment] = useState("");
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const projectById = new Map(lookups.projects.map((project) => [project.id, project]));
  const taskById = new Map(lookups.tasks.map((task) => [task.id, task]));
  const canCorrect = entry?.status === "submitted" || entry?.status === "returned";

  if (entry && isEditing) {
    return (
      <DailyTimesheetForm
        workDate={entry.work_date}
        displayDate={displayDate}
        userName={employeeName}
        entry={entry}
        preferredWorkMode={entry.work_mode}
        lookups={lookups}
        canEdit={canCorrect}
        saveHandler={(input) => saveEmployeeTimesheetCorrectionAction(targetProfileId, input, comment)}
        submitLabel="Save Changes"
        pendingLabel="Saving changes…"
        headingText={`Correct ${employeeName} timesheet`}
        showReturnedNotice={false}
        correctionComment={comment}
        onCorrectionCommentChange={setComment}
        onSaved={() => {
          setSuccessMessage("Timesheet correction saved.");
          setIsEditing(false);
          setComment("");
          router.refresh();
          onSaved();
        }}
      />
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 bg-white px-4 py-5 sm:px-6">
      <section>
        <h2 className="text-2xl font-semibold tracking-tight text-zinc-950">{employeeName}</h2>
        <p className="mt-1 text-sm text-zinc-500">{displayDate}</p>
        {entry && canCorrect ? (
          <div className="mt-4">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setSuccessMessage(null);
                setIsEditing(true);
              }}
            >
              Edit
            </Button>
          </div>
        ) : null}
      </section>

      {successMessage ? <Alert variant="success">{successMessage}</Alert> : null}

      {!entry ? (
        <Alert variant="warning">No timesheet entry has been submitted for this day.</Alert>
      ) : (
        <>
          {entry.status === "returned" && entry.return_comment ? (
            <Alert variant="warning">Returned comment: {entry.return_comment}</Alert>
          ) : null}

          <section className="grid gap-3 rounded-lg bg-zinc-50 p-4 text-sm sm:grid-cols-4">
            <div>
              <p className="text-zinc-500">Status</p>
              <StatusBadge className="mt-1" config={TIMESHEET_STATUS_BADGE_CONFIG[entry.status]} />
            </div>
            <div>
              <p className="text-zinc-500">Time</p>
              <p className="font-medium text-zinc-900">{entry.is_public_holiday ? "Public holiday" : `${entry.time_in?.slice(0, 5)}–${entry.time_out?.slice(0, 5)}`}</p>
            </div>
            <div>
              <p className="text-zinc-500">Payable</p>
              <p className="font-medium text-zinc-900">{formatTimesheetHours(entry.payable_hours)}</p>
            </div>
            <div>
              <p className="text-zinc-500">Allocated</p>
              <p className="font-medium text-zinc-900">{formatTimesheetHours(entry.allocation_hours)}</p>
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-base font-semibold text-zinc-900">Activities</h3>
            {entry.activities.length === 0 ? (
              <p className="text-sm text-zinc-500">No activity rows.</p>
            ) : (
              <div className="divide-y divide-zinc-100 rounded-lg border border-zinc-200">
                {entry.activities.map((activity) => {
                  const projectLabel = getActivityProjectDisplay(activity, projectById);
                  const taskLabel = getActivityTaskDisplay(activity, taskById);
                  return (
                    <div key={activity.id} className="grid gap-2 p-3 text-sm sm:grid-cols-[1fr_1fr_120px_100px]">
                      <span>{projectLabel}</span>
                      <span>{taskLabel}</span>
                      <span className="capitalize">{activity.work_mode}</span>
                      <span className="font-medium">{formatTimesheetHours(activity.hours)}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
