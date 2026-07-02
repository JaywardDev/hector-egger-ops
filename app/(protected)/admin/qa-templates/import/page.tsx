import { QaTemplateImportClient } from "@/app/(protected)/admin/qa-templates/import/qa-template-import-client";
import { PageContainer } from "@/src/components/layout/page-container";
import { PageHeader } from "@/src/components/layout/page-header";
import { Alert } from "@/src/components/ui/alert";
import { requireAdminAccess } from "@/src/lib/auth/guards";

export default async function QaTemplateImportPage() {
  await requireAdminAccess();

  return (
    <PageContainer>
      <PageHeader
        title="QA checklist template import"
        description="Admin-only validation and versioned import of checklist templates from C-base."
      />
      <Alert variant="warning">
        C-base remains the source of truth. Import is append-only: a changed template creates a new version and never
        rewrites an existing one, so in-progress and signed-off checklists keep the version they were built against.
      </Alert>
      <QaTemplateImportClient />
    </PageContainer>
  );
}
