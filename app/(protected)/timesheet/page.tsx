import { PageContainer } from "@/src/components/layout/page-container";
import { PageHeader } from "@/src/components/layout/page-header";
import { Card } from "@/src/components/ui/card";
import { requireProtectedAccess } from "@/src/lib/auth/guards";

export default async function TimesheetPage() {
  await requireProtectedAccess("/timesheet");

  return (
    <PageContainer>
      <PageHeader
        title="Timesheet"
        description="Timesheet entry will become the primary company-wide workflow."
      />
      <Card>
        Timesheets are not implemented yet. This page is intentionally a placeholder while permissions and navigation are prepared.
      </Card>
    </PageContainer>
  );
}
