import { PageContainer } from "@/src/components/layout/page-container";
import { PageHeader } from "@/src/components/layout/page-header";
import { Card } from "@/src/components/ui/card";
import { requireTimesheetApprovalAccess } from "@/src/lib/auth/guards";

export default async function ApprovalsPage() {
  await requireTimesheetApprovalAccess();

  return (
    <PageContainer>
      <PageHeader
        title="Timesheet approvals"
        description="Supervisors and admins will review future timesheet records here."
      />
      <Card>
        Timesheet approvals are not implemented yet. Access is already limited to supervisors and admins.
      </Card>
    </PageContainer>
  );
}
