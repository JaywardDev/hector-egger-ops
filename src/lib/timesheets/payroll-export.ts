import "server-only";

import { addNzDays, formatNzDate, getNzWeekEnd, getNzWeekStart, parseNzDate } from "@/src/lib/dateTime";
import { createServiceRoleSupabaseClient } from "@/src/lib/supabase/service-role";
import type { AuthSession } from "@/src/lib/auth/session";
import type { TimesheetLeaveType } from "@/src/lib/timesheets/types";

export const PAYROLL_EXPORT_HEADERS = [
  "WEEK_ENDING",
  "EMPLOYEE_NAME",
  "TOTAL_HOUR_WORKED",
  "COSTCODE",
  "TOTAL_WORKED_ON_LEAVE",
  "DESCRIPTION_CHARGEUP",
  "COMMENT_OTHER",
] as const;

const INCLUDED_STATUSES = ["submitted", "supervisor_approved", "approved"] as const;
const leaveMappings: Record<TimesheetLeaveType, { costCode: string; comment: string }> = {
  annual: { costCode: "LA - Leave Annual", comment: "Leave Annual" },
  sick: { costCode: "LS - Leave Sick", comment: "Leave Sick" },
  bereavement: { costCode: "LB - Leave Bereavement", comment: "Leave Bereavement" },
  unpaid: { costCode: "LW - Leave Without Pay", comment: "Leave Without Pay" },
  other: { costCode: "TIL - Time In Lieu", comment: "Time In Lieu" },
};

export type PayrollExportLeaveRow = {
  leaveType: TimesheetLeaveType | "public_holiday";
  costCode: string;
  leaveHours: number;
  commentOther: string;
};

export type PayrollExportEmployeeRow = {
  weekEnding: string;
  employeeName: string;
  totalHourWorked: number;
  descriptionChargeup: string;
  leaveRows: PayrollExportLeaveRow[];
};

type PayrollExportEntryRow = {
  profile_id: string;
  payable_hours: number | null;
  is_public_holiday: boolean | null;
  leave_type: TimesheetLeaveType | null;
  leave_hours: number | null;
  status: string | null;
  profile?: {
    full_name: string | null;
    email: string | null;
    account_status: string | null;
  } | null;
};

export const formatWeekEndingForPayroll = (weekEndingIso: string) =>
  formatNzDate(weekEndingIso, { day: "2-digit", month: "2-digit", year: "numeric" });

export const aggregatePayrollExport = (args: {
  weekEnding: string;
    entries: Array<{
    profile_id: string;
    payable_hours: number;
    is_public_holiday: boolean;
    leave_type: TimesheetLeaveType | null;
    leave_hours: number;
    profile: { full_name: string | null; email: string | null } | null;
  }>;
}) => {
  const byEmployee = new Map<string, PayrollExportEmployeeRow>();

  for (const entry of args.entries) {
    const existing = byEmployee.get(entry.profile_id);
    const employeeName = entry.profile?.full_name?.trim() || entry.profile?.email?.trim() || "Unknown";

    if (!existing) {
      byEmployee.set(entry.profile_id, {
        weekEnding: args.weekEnding,
        employeeName,
        totalHourWorked: 0,
        descriptionChargeup: "",
        leaveRows: [],
      });
    }

    const row = byEmployee.get(entry.profile_id)!;
    row.totalHourWorked = Number((row.totalHourWorked + Number(entry.payable_hours)).toFixed(2));

    if (entry.is_public_holiday && entry.payable_hours > 0) {
      const existingPuho = row.leaveRows.find((leaveRow) => leaveRow.leaveType === "public_holiday");
      if (existingPuho) {
        existingPuho.leaveHours = Number((existingPuho.leaveHours + Number(entry.payable_hours)).toFixed(2));
      } else {
        row.leaveRows.push({
          leaveType: "public_holiday",
          costCode: "PUHO - Public Holiday",
          leaveHours: Number(entry.payable_hours),
          commentOther: "Public Holiday",
        });
      }
      continue;
    }

    if (entry.leave_type && entry.leave_hours > 0) {
      const mapping = leaveMappings[entry.leave_type];

      const existingLeave = row.leaveRows.find((leaveRow) => leaveRow.leaveType === entry.leave_type);
      if (existingLeave) {
        existingLeave.leaveHours = Number((existingLeave.leaveHours + Number(entry.leave_hours)).toFixed(2));
      } else {
        row.leaveRows.push({
          leaveType: entry.leave_type,
          costCode: mapping.costCode,
          leaveHours: Number(entry.leave_hours),
          commentOther: mapping.comment,
        });
      }
    }
  }

  return Array.from(byEmployee.values())
    .map((row) => ({ ...row, leaveRows: row.leaveRows.sort((a, b) => a.leaveType.localeCompare(b.leaveType)) }))
    .sort((a, b) => a.employeeName.localeCompare(b.employeeName));
};

export async function getPayrollExportData(session: AuthSession, selectedDate: string) {
  const parsed = parseNzDate(selectedDate);
  if (!parsed) {
    throw new Error("A valid payroll week ending date is required.");
  }

  const weekEnding = getNzWeekEnd(parsed);
  const weekStart = getNzWeekStart(weekEnding);
  const weekEndExclusive = addNzDays(weekStart, 7);
  const supabase = createServiceRoleSupabaseClient();
  console.info("[payroll-export] loading entries", { weekEnding, weekStart, weekEndExclusive });

  const response = await supabase.request(
    `/rest/v1/timesheet_entries?select=profile_id,payable_hours,is_public_holiday,leave_type,leave_hours,status,profile:profiles!timesheet_entries_profile_id_fkey(full_name,email,account_status)&work_date=gte.${weekStart}&work_date=lt.${weekEndExclusive}&status=in.(${INCLUDED_STATUSES.join(",")})`,
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch payroll export entries (${response.status})`);
  }

  const entries = (await response.json()) as PayrollExportEntryRow[];
  const statusCounts = entries.reduce<Record<string, number>>((acc, entry) => {
    const status = entry.status ?? "unknown";
    acc[status] = (acc[status] ?? 0) + 1;
    return acc;
  }, {});
  console.info("[payroll-export] fetched entries", { rawCount: entries.length, statusCounts });

  const scopedEntries = entries
    .filter((entry) => entry.profile?.account_status === "approved")
    .map((entry) => ({
      profile_id: entry.profile_id,
      payable_hours: Number(entry.payable_hours),
      is_public_holiday: Boolean(entry.is_public_holiday),
      leave_type: entry.leave_type,
      leave_hours: Number(entry.leave_hours),
      profile: entry.profile ? { full_name: entry.profile.full_name, email: entry.profile.email } : null,
    }));

  const rows = aggregatePayrollExport({ weekEnding, entries: scopedEntries });
  console.info("[payroll-export] aggregated rows", { finalRowCount: rows.length });

  return {
    weekEnding,
    displayWeekEnding: formatWeekEndingForPayroll(weekEnding),
    rows,
  };
}
