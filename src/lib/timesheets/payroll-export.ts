import "server-only";

import { addNzDays, formatNzDate, getNzWeekEnd, getNzWeekStart, parseNzDate } from "@/src/lib/dateTime";
import { createServerSupabaseClient } from "@/src/lib/supabase/server";
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

const INCLUDED_STATUSES = ["supervisor_approved", "approved"] as const;
const leaveMappings: Partial<Record<TimesheetLeaveType, { costCode: string; comment: string }>> = {
  sick: { costCode: "LS - Leave Sick", comment: "Leave Sick" },
  unpaid: { costCode: "LW - Leave Without Pay", comment: "Leave Without Pay" },
};

export type PayrollExportLeaveRow = {
  leaveType: TimesheetLeaveType;
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

export const formatWeekEndingForPayroll = (weekEndingIso: string) =>
  formatNzDate(weekEndingIso, { day: "2-digit", month: "2-digit", year: "numeric" });

export const aggregatePayrollExport = (args: {
  weekEnding: string;
  entries: Array<{
    profile_id: string;
    payable_hours: number;
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

    if (entry.leave_type && entry.leave_hours > 0) {
      const mapping = leaveMappings[entry.leave_type];
      if (!mapping) continue;

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
  const supabase = createServerSupabaseClient();
  const response = await supabase.request(
    `/rest/v1/timesheet_entries?select=profile_id,payable_hours,leave_type,leave_hours,profile:profiles!timesheet_entries_profile_id_fkey(full_name,email,account_status)&work_date=gte.${weekStart}&work_date=lt.${weekEndExclusive}&status=in.(${INCLUDED_STATUSES.join(",")})`,
  );

  const scopedEntries = (response as any[])
    .filter((entry) => entry.profile?.account_status === "approved")
    .map((entry) => ({
      profile_id: entry.profile_id as string,
      payable_hours: Number(entry.payable_hours),
      leave_type: entry.leave_type as TimesheetLeaveType | null,
      leave_hours: Number(entry.leave_hours),
      profile: entry.profile ? { full_name: entry.profile.full_name, email: entry.profile.email } : null,
    }));

  return {
    weekEnding,
    displayWeekEnding: formatWeekEndingForPayroll(weekEnding),
    rows: aggregatePayrollExport({ weekEnding, entries: scopedEntries }),
  };
}
