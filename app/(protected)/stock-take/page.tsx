import { PageContainer } from "@/src/components/layout/page-container";
import { PageHeader } from "@/src/components/layout/page-header";
import { requireProtectedAccess } from "@/src/lib/auth/guards";
import {
  listActiveStockAreas,
  listActiveTimberMaterials,
  listAllTimberStockRows,
} from "@/src/lib/stock-take/data";
import type { TimberStockWorkingRow } from "@/src/lib/stock-take/types";
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

  const [areas, materials, allRows] = await Promise.all([
    listActiveStockAreas(actor),
    listActiveTimberMaterials(actor),
    listAllTimberStockRows(actor),
  ]);
  const selectedAreaId =
    areas.find((area) => area.id === params?.area)?.id ?? areas[0]?.id ?? "";

  const initialRowsByAreaId: Record<string, TimberStockWorkingRow[]> = {};
  for (const area of areas) {
    initialRowsByAreaId[area.id] = [];
  }
  for (const row of allRows) {
    (initialRowsByAreaId[row.area_id] ??= []).push(row);
  }

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
        initialRowsByAreaId={initialRowsByAreaId}
      />
    </PageContainer>
  );
}
