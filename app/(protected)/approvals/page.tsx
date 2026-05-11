import { ApprovalsClient } from "@/app/(protected)/approvals/components/approvals-client";
import { PageContainer } from "@/src/components/layout/page-container";
import { PageHeader } from "@/src/components/layout/page-header";
import { Alert } from "@/src/components/ui/alert";
import { requireTimesheetApprovalAccess } from "@/src/lib/auth/guards";
import {
  getApprovalWeekDates,
  listApprovedStaffByGroup,
  listTimesheetEntriesForProfileForDates,
  type ApprovalStaffProfile,
} from "@/src/lib/timesheets/approvals";
import { formatTimesheetDisplayDate, formatTimesheetWeekday } from "@/src/lib/timesheets/date";
import { getTimesheetLookups } from "@/src/lib/timesheets/lookups";
import type { StaffGroup, TimesheetDaySummary, TimesheetEntryWithActivities } from "@/src/lib/timesheets/types";

type StaffWithWeek = ApprovalStaffProfile & {
  days: TimesheetDaySummary[];
  totalHours: number;
  submittedCount: number;
  returnedCount: number;
  supervisorApprovedCount: number;
  missingCount: number;
};

const buildDays = (weekDates: string[], entries: TimesheetEntryWithActivities[]): TimesheetDaySummary[] => {
  const entryByDate = new Map(entries.map((entry) => [entry.work_date, entry] as const));
  return weekDates.map((date) => ({
    date,
    weekdayLabel: formatTimesheetWeekday(date),
    displayDate: formatTimesheetDisplayDate(date),
    entry: entryByDate.get(date) ?? null,
    canEdit: true,
  }));
};

const withWeekSummaries = async (
  actor: Parameters<typeof listApprovedStaffByGroup>[0],
  staff: ApprovalStaffProfile[],
  weekDates: string[],
): Promise<StaffWithWeek[]> => {
  const entriesByStaff = await Promise.all(
    staff.map((person) => listTimesheetEntriesForProfileForDates(actor, person.id, weekDates)),
  );

  return staff.map((person, index) => {
    const entries = entriesByStaff[index] ?? [];
    const days = buildDays(weekDates, entries);
    return {
      ...person,
      days,
      totalHours: Number(entries.reduce((sum, entry) => sum + entry.payable_hours, 0).toFixed(2)),
      submittedCount: entries.filter((entry) => entry.status === "submitted").length,
      returnedCount: entries.filter((entry) => entry.status === "returned").length,
      supervisorApprovedCount: entries.filter((entry) => entry.status === "supervisor_approved" || entry.status === "approved").length,
      missingCount: days.filter((day) => !day.entry).length,
    };
  });
};

export default async function ApprovalsPage() {
  const { session, profile, roles } = await requireTimesheetApprovalAccess();

  if (!profile) {
    return (
      <PageContainer>
        <PageHeader title="Timesheet Approvals" />
        <Alert variant="error">Authenticated profile is required.</Alert>
      </PageContainer>
    );
  }

  const actor = {
    session,
    profileId: profile.id,
    accessContext: { accountStatus: "approved" as const, roles },
    route: "/approvals",
  };
  const weekDates = getApprovalWeekDates();
  const [lookups, factoryStaff, siteStaff] = await Promise.all([
    getTimesheetLookups(actor),
    listApprovedStaffByGroup(actor, "factory"),
    listApprovedStaffByGroup(actor, "site"),
  ]);
  const [factory, site] = await Promise.all([
    withWeekSummaries(actor, factoryStaff, weekDates),
    withWeekSummaries(actor, siteStaff, weekDates),
  ]);
  const groups: Record<StaffGroup, StaffWithWeek[]> = { factory, site };
  const weekRangeLabel = `${formatTimesheetDisplayDate(weekDates[0])} – ${formatTimesheetDisplayDate(weekDates[6])}`;

  return (
    <PageContainer>
      <PageHeader
        title="Timesheet Approvals"
        description="Review submitted weekly timesheets by staff group. Supervisor review is read-only; employees correct returned entries from their own timesheet page."
      />
      <ApprovalsClient groups={groups} lookups={lookups} weekStart={weekDates[0]} weekRangeLabel={weekRangeLabel} />
    </PageContainer>
  );
}
