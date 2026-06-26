import { PageContainer } from "@/src/components/layout/page-container";
import { PageHeader } from "@/src/components/layout/page-header";
import { Alert } from "@/src/components/ui/alert";
import { requireProtectedAccess } from "@/src/lib/auth/guards";
import { canEditApprovedTimesheets } from "@/src/lib/timesheets/access";
import { getNzWeekDates, formatTimesheetDisplayDate, formatTimesheetWeekday } from "@/src/lib/timesheets/date";
import { getTimesheetPreference, listOwnTimesheetEntriesForDates } from "@/src/lib/timesheets/entries";
import { getTimesheetLookups } from "@/src/lib/timesheets/lookups";
import { WeeklyTimesheetClient } from "@/app/(protected)/timesheet/components/weekly-timesheet-client";
import { getTodayNzDate } from "@/src/lib/dateTime";

export default async function TimesheetPage() {
  const { session, profile, roles } = await requireProtectedAccess("/timesheet");

  if (!profile) {
    return (
      <PageContainer>
        <PageHeader title="Weekly Timesheet" />
        <Alert variant="error">Authenticated profile is required.</Alert>
      </PageContainer>
    );
  }

  const actor = {
    session,
    profileId: profile.id,
    accessContext: { accountStatus: "approved" as const, roles },
    route: "/timesheet",
  };
  const todayDate = getTodayNzDate();
  const weekDates = getNzWeekDates(todayDate);
  const [entries, preferredWorkMode, lookups] = await Promise.all([
    listOwnTimesheetEntriesForDates(actor, weekDates),
    getTimesheetPreference(actor),
    getTimesheetLookups(actor, profile.staff_group),
  ]);
  const entryByDate = new Map(entries.map((entry) => [entry.work_date, entry] as const));
  const weekRangeLabel = `${formatTimesheetDisplayDate(weekDates[0])} – ${formatTimesheetDisplayDate(weekDates[weekDates.length - 1])}`;
  const canEditApproved = canEditApprovedTimesheets(roles);
  const days = weekDates.map((date) => {
    const entry = entryByDate.get(date) ?? null;
    return {
      date,
      weekdayLabel: formatTimesheetWeekday(date),
      displayDate: formatTimesheetDisplayDate(date),
      entry,
      canEdit: !entry || (entry.status !== "supervisor_approved" && (entry.status !== "approved" || canEditApproved)),
    };
  });

  // Past Mon–Fri workdays with no entry
  const pastWorkdays = weekDates.slice(0, 5).filter((d) => d <= todayDate);
  const missedDays = pastWorkdays.filter((d) => !entryByDate.has(d));
  const dayOfWeek = new Date(`${todayDate}T12:00:00Z`).getUTCDay();
  const isUrgent = dayOfWeek === 4 || dayOfWeek === 5; // Thu or Fri

  return (
    <PageContainer>
      <PageHeader
        accent
        title="Weekly Timesheet"
        eyebrow="Personal timesheet"
        description={
          <span className="hidden text-sm text-zinc-500 sm:block">
            Track and manage your weekly work records here. Submit your timesheet for approval at the end of each week to keep your records up to date.
          </span>
        }
        metadata={
          <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
            <span>{weekRangeLabel}</span>
          </span>
        }
      />
      {missedDays.length > 0 && (
        <Alert variant={isUrgent ? "error" : "warning"}>
          {isUrgent
            ? `You have ${missedDays.length} unsubmitted day${missedDays.length === 1 ? "" : "s"} this week. Please submit before end of day Friday.`
            : `${missedDays.length} day${missedDays.length === 1 ? "" : "s"} this week still need${missedDays.length === 1 ? "s" : ""} a timesheet entry.`}
        </Alert>
      )}
      <WeeklyTimesheetClient
        days={days}
        userName={profile.full_name ?? profile.email}
        preferredWorkMode={preferredWorkMode}
        lookups={lookups}
      />
    </PageContainer>
  );
}
