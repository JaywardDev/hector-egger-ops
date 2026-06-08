import { PageContainer } from "@/src/components/layout/page-container";
import { PageHeader } from "@/src/components/layout/page-header";
import { Card } from "@/src/components/ui/card";
import { requireProtectedAccess } from "@/src/lib/auth/guards";

export default async function StockTakePage() {
  await requireProtectedAccess("/stock-take");

  return (
    <PageContainer>
      <PageHeader title="Stock take" />

      <Card className="space-y-3">
        <p className="text-base text-zinc-800">
          This area is being rebuilt from a clean stock foundation.
        </p>
        <p className="text-sm text-zinc-600">
          Old stocktake sessions, locations, materials, and history have been removed so the new workflow can be rebuilt without legacy assumptions.
        </p>
      </Card>
    </PageContainer>
  );
}
