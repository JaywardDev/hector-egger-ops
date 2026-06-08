import Link from "next/link";
import { CurrentTimberStockTable } from "@/app/(protected)/stock-take/current-timber-stock-table";
import { PageContainer } from "@/src/components/layout/page-container";
import { PageHeader } from "@/src/components/layout/page-header";
import { SectionHeader } from "@/src/components/layout/section-header";
import { Stack } from "@/src/components/layout/stack";
import { Alert } from "@/src/components/ui/alert";
import {
  hasSupervisorOrAdminRole,
  requireProtectedAccess,
} from "@/src/lib/auth/guards";
import { listStockLocations } from "@/src/lib/inventory/locations";
import { listMaterialGroups } from "@/src/lib/inventory/items";
import { TIMBER_MATERIAL_GROUP_KEY } from "@/src/lib/inventory/item-labels";
import { withServerTiming } from "@/src/lib/server-timing";
import {
  getLatestClosedStockTakeSessionForExport,
} from "@/src/lib/stock-take/sessions";
import {
  listCurrentTimberStockBalances,
} from "@/src/lib/stock-take/timber-stock";
import {
  buildStockTakeExportHref,
} from "@/src/lib/stock-take/timber-stock-formatting";

type StockTakePageProps = {
  searchParams: Promise<{
    success?: string;
    error?: string;
    itemId?: string;
    locationId?: string;
    location?: string;
  }>;
};

export default async function StockTakePage({
  searchParams,
}: StockTakePageProps) {
  const route = "/stock-take";

  return withServerTiming({
    name: "StockTakePage",
    route,
    operation: async () => {
      const { session, roles } = await requireProtectedAccess(route);
      const accessContext = { accountStatus: "approved" as const, roles };
      const [
        currentTimberStock,
        stockLocations,
        materialGroups,
        latestExportSession,
        params,
      ] = await Promise.all([
        listCurrentTimberStockBalances({ session, route }),
        listStockLocations({ session, route }),
        listMaterialGroups({ session, route }),
        getLatestClosedStockTakeSessionForExport({ session, accessContext, route }),
        searchParams,
      ]);

      const canUpdateStock = hasSupervisorOrAdminRole(roles);
      const timberMaterialGroup = materialGroups.find(
        (group) => group.key === TIMBER_MATERIAL_GROUP_KEY,
      );
      const exportHref = buildStockTakeExportHref(latestExportSession);

      return (
        <PageContainer>
          <PageHeader
            title="Timber Stock Take"
            description="View current timber stock, update counts, and export a snapshot for company records."
            actions={(
              <>
                {exportHref ? (
                  <Link
                    className="inline-flex items-center justify-center rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-900 shadow-sm transition-colors hover:bg-zinc-50"
                    href={exportHref}
                  >
                    Export snapshot
                  </Link>
                ) : null}
                <Link
                  className="inline-flex items-center justify-center rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-900 shadow-sm transition-colors hover:bg-zinc-50"
                  href="/locations"
                >
                  Manage locations
                </Link>
              </>
            )}
          />

          {params.success ? <Alert variant="success">{params.success}</Alert> : null}
          {params.error ? <Alert variant="error">{params.error}</Alert> : null}

          {!exportHref ? (
            <Alert>No finalized stock snapshot is available to export yet.</Alert>
          ) : null}

          <Stack gap="sm">
            <SectionHeader
              title="Current timber stock"
              description="Search current balances by timber, spec, code, or location."
            />
            <CurrentTimberStockTable
              balances={currentTimberStock}
              canUpdateStock={canUpdateStock}
              timberMaterialGroup={timberMaterialGroup}
              stockLocations={stockLocations}
            />
          </Stack>

        </PageContainer>
      );
    },
  });
}
