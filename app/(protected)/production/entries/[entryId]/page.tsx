import Link from "next/link";
import {
  deleteProductionEntryAction,
  updateProductionEntryFormAction,
} from "@/app/(protected)/production/actions";
import { EntryMetricsPreview } from "@/app/(protected)/production/components/entry-metrics-preview";
import { ProductionEntryForm } from "@/app/(protected)/production/components/production-entry-form";
import { PageContainer } from "@/src/components/layout/page-container";
import { PageHeader } from "@/src/components/layout/page-header";
import { Alert } from "@/src/components/ui/alert";
import { Button } from "@/src/components/ui/button";
import { Card } from "@/src/components/ui/card";
import { requireProtectedAccess } from "@/src/lib/auth/guards";
import { getProductionEntryDetail, listAssignableProductionOperators } from "@/src/lib/production/entries";
import { listProductionProjects } from "@/src/lib/production/projects";
import { listProductionDowntimeReasons, listProductionInterruptionReasons } from "@/src/lib/production/reasons";

type EntryDetailPageProps = {
  params: Promise<{ entryId: string }>;
  searchParams: Promise<{ success?: string; error?: string }>;
};

export default async function ProductionEntryDetailPage({ params, searchParams }: EntryDetailPageProps) {
  const route = "/production/entries";
  const { entryId } = await params;
  const { session, roles, profile } = await requireProtectedAccess(route);
  const canAssignOtherOperator = roles.includes("admin") || roles.includes("supervisor");

  const [messages, entry, projects, downtimeReasons, interruptionReasons, assignableOperators] = await Promise.all([
    searchParams,
    getProductionEntryDetail({
      session,
      accessContext: { accountStatus: "approved", roles },
      route,
      entryId,
    }),
    listProductionProjects({ session, accessContext: { accountStatus: "approved", roles }, route }),
    listProductionDowntimeReasons({ session, accessContext: { accountStatus: "approved", roles }, route }),
    listProductionInterruptionReasons({ session, accessContext: { accountStatus: "approved", roles }, route }),
    canAssignOtherOperator
      ? listAssignableProductionOperators({
          session,
          accessContext: { accountStatus: "approved", roles },
          route,
        })
      : Promise.resolve([]),
  ]);

  if (!entry) {
    return (
      <PageContainer>
        <PageHeader title="Entry not found" description="This production entry is missing or unavailable." />
      </PageContainer>
    );
  }

  const operators = canAssignOtherOperator
    ? assignableOperators
    : profile
      ? [{ profile_id: profile.id, display_name: profile.full_name ?? profile.email }]
      : [];
  const selectedOperatorId = operators.some((option) => option.profile_id === entry.operator_profile_id)
    ? entry.operator_profile_id
    : operators[0]?.profile_id ?? "";

  return (
    <PageContainer>
      <PageHeader title={`Entry ${entry.work_date}`} description={`${entry.operator_name} · ${entry.project_file} #${entry.project_sequence}`} />
      {messages.success ? <Alert variant="success">{messages.success}</Alert> : null}
      {messages.error ? <Alert variant="error">{messages.error}</Alert> : null}
      <EntryMetricsPreview />
      <Card>
        <ProductionEntryForm
          formAction={updateProductionEntryFormAction}
          submitLabel="Save entry"
          operators={operators}
          canAssignOtherOperator={canAssignOtherOperator}
          projects={projects}
          downtimeReasons={downtimeReasons}
          interruptionReasons={interruptionReasons}
          initialValues={{
            entryId: entry.id,
            workDate: entry.work_date,
            operatorProfileId: selectedOperatorId,
            projectId: entry.project_id,
            shiftStartTime: entry.shift_start_time.slice(0, 5),
            shiftEndTime: entry.shift_end_time.slice(0, 5),
            fileMinutesLeftStart: entry.file_minutes_left_start,
            fileMinutesLeftEnd: entry.file_minutes_left_end,
            actualVolumeCutM3: entry.actual_volume_cut_m3,
            downtimeMinutes: entry.downtime_minutes,
            downtimeReasonId: entry.downtime_reason_id,
            interruptionMinutes: entry.interruption_minutes,
            interruptionReasonId: entry.interruption_reason_id,
            notes: entry.notes,
          }}
        />
      </Card>

      <Card>
        <p className="font-medium text-zinc-900">Metadata</p>
        <p className="mt-1">Created at: {entry.created_at}</p>
        <p>Updated at: {entry.updated_at}</p>
        <p>Created by profile: {entry.created_by_profile_id}</p>
      </Card>

      <Card>
        <form
          action={async () => {
            "use server";
            await deleteProductionEntryAction(entry.id);
          }}
        >
          <Button type="submit" variant="danger">Delete entry</Button>
        </form>
        <p className="mt-2">
          <Link className="underline" href="/production/entries">Back to entries</Link>
        </p>
      </Card>
    </PageContainer>
  );
}
