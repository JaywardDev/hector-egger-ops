import { createProductionEntryFormAction } from "@/app/(protected)/production/actions";
import { EntryMetricsPreview } from "@/app/(protected)/production/components/entry-metrics-preview";
import { ProductionEntryForm } from "@/app/(protected)/production/components/production-entry-form";
import { PageContainer } from "@/src/components/layout/page-container";
import { PageHeader } from "@/src/components/layout/page-header";
import { Alert } from "@/src/components/ui/alert";
import { Card } from "@/src/components/ui/card";
import { requireProtectedAccess } from "@/src/lib/auth/guards";
import { listAssignableProductionOperators } from "@/src/lib/production/entries";
import { listProductionDowntimeReasons, listProductionInterruptionReasons } from "@/src/lib/production/reasons";
import { listProductionProjects } from "@/src/lib/production/projects";

type NewEntryPageProps = {
  searchParams: Promise<{ error?: string; warn?: string }>;
};

export default async function NewProductionEntryPage({ searchParams }: NewEntryPageProps) {
  const route = "/production/entries/new";
  const { session, roles, profile } = await requireProtectedAccess(route);
  const canAssignOtherOperator = roles.includes("admin") || roles.includes("supervisor");

  const [params, projects, downtimeReasons, interruptionReasons, assignableOperators] = await Promise.all([
    searchParams,
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
  const operators = canAssignOtherOperator
    ? assignableOperators
    : profile
      ? [{ profile_id: profile.id, display_name: profile.full_name ?? profile.email }]
      : [];

  return (
    <PageContainer>
      <PageHeader title="New production entry" description="Create a daily production entry." />
      {params.error ? <Alert variant="error">{params.error}</Alert> : null}
      {params.warn ? <Alert>{params.warn}</Alert> : null}
      <EntryMetricsPreview />
      <Card>
        <ProductionEntryForm
          formAction={createProductionEntryFormAction}
          submitLabel="Create entry"
          operators={operators}
          canAssignOtherOperator={canAssignOtherOperator}
          projects={projects}
          downtimeReasons={downtimeReasons}
          interruptionReasons={interruptionReasons}
          initialValues={{
            operatorProfileId: operators[0]?.profile_id ?? "",
          }}
        />
      </Card>
    </PageContainer>
  );
}
