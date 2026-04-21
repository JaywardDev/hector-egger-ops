import { ProductionImportClient } from "@/app/(protected)/production/import/production-import-client";
import { PageContainer } from "@/src/components/layout/page-container";
import { PageHeader } from "@/src/components/layout/page-header";
import { requireOperationalWriteAccess } from "@/src/lib/auth/guards";

export default async function ProductionImportPage() {
  await requireOperationalWriteAccess();

  return (
    <PageContainer>
      <PageHeader
        title="Production import"
        description="Two-stage operational import: Project Registry first, Daily Registry second."
      />
      <ProductionImportClient />
    </PageContainer>
  );
}
