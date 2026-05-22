import { ProductionImportClient } from "@/app/(protected)/production/import/production-import-client";
import { PageContainer } from "@/src/components/layout/page-container";
import { PageHeader } from "@/src/components/layout/page-header";
import { requireOperationalWriteAccess } from "@/src/lib/auth/guards";

export default async function ProductionImportPage() {
  const { profile } = await requireOperationalWriteAccess();

  return (
    <PageContainer>
      <PageHeader
        title="Legacy Production Import"
        description="One-time historical CSV import for legacy production records."
      />
      <ProductionImportClient actorProfileId={profile.id} />
    </PageContainer>
  );
}
