import type { TimesheetStatus } from "@/src/lib/timesheets/types";
import type { StatusBadgeConfig } from "@/src/components/ui/status-badge";

export const TIMESHEET_STATUS_LABELS: Record<TimesheetStatus, string> = {
  submitted: "Submitted",
  returned: "Returned",
  supervisor_approved: "Supervisor approved",
  approved: "Approved",
};

export const TIMESHEET_STATUS_BADGE_CONFIG: Record<TimesheetStatus, StatusBadgeConfig> = {
  submitted: { label: TIMESHEET_STATUS_LABELS.submitted, tone: "info" },
  returned: { label: TIMESHEET_STATUS_LABELS.returned, tone: "warning" },
  supervisor_approved: { label: TIMESHEET_STATUS_LABELS.supervisor_approved, tone: "success" },
  approved: { label: TIMESHEET_STATUS_LABELS.approved, tone: "success" },
};

export function formatTimesheetHours(hours: number) {
  return `${Number.isInteger(hours) ? hours : hours.toFixed(2).replace(/0+$/, "").replace(/\.$/, "")} h`;
}
