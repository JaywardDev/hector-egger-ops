import { CBaseTimesheetImportClient } from "@/app/(protected)/admin/timesheet-lookups/import/c-base-import-client";
import { PageContainer } from "@/src/components/layout/page-container";
import { PageHeader } from "@/src/components/layout/page-header";
import { Alert } from "@/src/components/ui/alert";
import { requireAdminAccess } from "@/src/lib/auth/guards";

export default async function CBaseTimesheetLookupImportPage() {
  await requireAdminAccess();

  return (
    <PageContainer>
      <PageHeader
        title="C Base timesheet lookup import"
        description="Admin-only validation and sync for C Base BuildingsExport and CostcodesExport snapshots."
      />
      <Alert variant="warning">
        C Base remains the source of truth. This sync never deletes lookup rows; hidden or missing C Base rows are soft-deactivated, and manual rows are left untouched.
      </Alert>
      <CBaseTimesheetImportClient />
    </PageContainer>
  );
}
