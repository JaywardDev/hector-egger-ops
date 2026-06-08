import { PageContainer } from "@/src/components/layout/page-container";
import { PageHeader } from "@/src/components/layout/page-header";
import { requireProtectedAccess } from "@/src/lib/auth/guards";
import {
  listActiveStockAreas,
  listActiveTimberMaterials,
  listTimberStockRowsForArea,
} from "@/src/lib/stock-take/data";
import {
  STOCK_TAKE_PAGE_DESCRIPTION,
  STOCK_TAKE_PAGE_TITLE,
} from "@/src/lib/stock-take/ui-contract";
import { StockTakeClient } from "./components/stock-take-client";

type StockTakePageProps = {
  searchParams?: Promise<{ area?: string }>;
};

export default async function StockTakePage({ searchParams }: StockTakePageProps) {
  const route = "/stock-take";
  const { session, roles } = await requireProtectedAccess(route);
  const params = await searchParams;
  const actor = { session, accessContext: { accountStatus: "approved" as const, roles }, route };

  const [areas, materials] = await Promise.all([
    listActiveStockAreas(actor),
    listActiveTimberMaterials(actor),
  ]);
  const selectedAreaId =
    areas.find((area) => area.id === params?.area)?.id ?? areas[0]?.id ?? "";
  const workingRows = selectedAreaId
    ? await listTimberStockRowsForArea({ ...actor, areaId: selectedAreaId })
    : [];

  return (
    <PageContainer>
      <PageHeader
        title={STOCK_TAKE_PAGE_TITLE}
        description={STOCK_TAKE_PAGE_DESCRIPTION}
      />

      <StockTakeClient
        areas={areas}
        materials={materials}
        initialAreaId={selectedAreaId}
        initialRows={workingRows}
      />
    </PageContainer>
  );
}
