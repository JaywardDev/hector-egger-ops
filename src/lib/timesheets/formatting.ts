import type { TimesheetStatus } from "@/src/lib/timesheets/types";
import type { StatusBadgeConfig } from "@/src/components/ui/status-badge";

export const TIMESHEET_STATUS_LABELS: Record<TimesheetStatus, string> = {
  submitted: "Saved",
  returned: "Returned",
  supervisor_approved: "Supervisor reviewed",
  approved: "Approved",
};

export const TIMESHEET_STATUS_BADGE_CONFIG: Record<TimesheetStatus, StatusBadgeConfig> = {
  submitted: { label: TIMESHEET_STATUS_LABELS.submitted, tone: "neutral" },
  returned: { label: TIMESHEET_STATUS_LABELS.returned, tone: "attention" },
  supervisor_approved: { label: TIMESHEET_STATUS_LABELS.supervisor_approved, tone: "brand" },
  approved: { label: TIMESHEET_STATUS_LABELS.approved, tone: "outline" },
};

export function formatTimesheetHours(hours: number) {
  return `${Number.isInteger(hours) ? hours : hours.toFixed(2).replace(/0+$/, "").replace(/\.$/, "")} h`;
}
