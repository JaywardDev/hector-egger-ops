import { notFound } from "next/navigation";
import {
  transitionStockTakeSessionAction,
} from "@/app/(protected)/stock-take/actions";
import { DeleteEmptyDraftForm } from "@/app/(protected)/stock-take/delete-empty-draft-form";
import { StockTakeSessionSummaryCard } from "@/app/(protected)/stock-take/[sessionId]/components/stock-take-session-summary-card";
import { StockTakeSessionDetailClient } from "@/app/(protected)/stock-take/[sessionId]/stock-take-session-detail-client";
import { Alert } from "@/src/components/ui/alert";
import { PageContainer } from "@/src/components/layout/page-container";
import { requireProtectedAccess } from "@/src/lib/auth/guards";
import {
  listMaterialGroups,
  listStockTakeInventoryItems,
} from "@/src/lib/inventory/items";
import { listStockLocations } from "@/src/lib/inventory/locations";
import {
  getNextStockTakeTransitionAction,
  getStockTakeSessionDetail,
  listStockTakeEntries,
  StockTakeSessionNotFoundError,
} from "@/src/lib/stock-take/sessions";
import { withServerTiming } from "@/src/lib/server-timing";

type StockTakeSessionDetailPageProps = {
  params: Promise<{
    sessionId: string;
  }>;
  searchParams: Promise<{
    success?: string;
    error?: string;
    inventoryItemId?: string;
  }>;
};

export default async function StockTakeSessionDetailPage({
  params,
  searchParams,
}: StockTakeSessionDetailPageProps) {
  const { sessionId } = await params;
  const route = `/stock-take/${sessionId}`;
  return withServerTiming({
    name: "StockTakeSessionDetailPage",
    route,
    operation: async () => {
      const { session, roles } = await requireProtectedAccess(route);
      const accessContext = { accountStatus: "approved" as const, roles };

      try {
        const [
          stockTakeSession,
          stockTakeEntries,
          inventoryItems,
          materialGroups,
          stockLocations,
          query,
        ] = await Promise.all([
          getStockTakeSessionDetail({
            session,
            accessContext,
            route,
            sessionId,
          }),
          listStockTakeEntries({
            session,
            accessContext,
            route,
            sessionId,
          }),
          listStockTakeInventoryItems({ session, route }),
          listMaterialGroups({ session, route }),
          listStockLocations({ session, route }),
          searchParams,
        ]);
        const canEnterCounts =
          roles.includes("admin") ||
          roles.includes("supervisor") ||
          roles.includes("operator");
        const canTransitionStatus =
          roles.includes("admin") || roles.includes("supervisor");
        const canDeleteEmptyDraft =
          canTransitionStatus &&
          stockTakeSession.status === "draft" &&
          stockTakeEntries.length === 0;
        const isEntryOpen = ["draft", "in_progress"].includes(
          stockTakeSession.status,
        );
        const nextTransition = getNextStockTakeTransitionAction(stockTakeSession);
        const initialSelectedInventoryItemId =
          inventoryItems.some((item) => item.id === query.inventoryItemId)
            ? (query.inventoryItemId ?? null)
            : null;
        const inventoryItemById = new Map(
          inventoryItems.map((item) => [item.id, item] as const),
        );
        const stockTakeEntryRows = stockTakeEntries.map((entry) => {
          const inventoryItem = entry.inventory_item;
          const inventoryItemWithGroup =
            inventoryItem === null
              ? null
              : {
                  ...inventoryItem,
                  material_group:
                    inventoryItemById.get(inventoryItem.id)?.material_group ?? null,
                };

          return {
            ...entry,
            stock_location: entry.stock_location
              ? {
                  id: entry.stock_location.id,
                  name: entry.stock_location.name,
                  code: entry.stock_location.code,
                }
              : null,
            inventory_item: inventoryItemWithGroup,
          };
        });

        return (
          <PageContainer>
            <StockTakeSessionSummaryCard
              sessionId={stockTakeSession.id}
              title={stockTakeSession.title}
              status={stockTakeSession.status}
              stockLocation={stockTakeSession.stock_location}
              notes={stockTakeSession.notes}
              startedAt={stockTakeSession.started_at}
              submittedAt={stockTakeSession.submitted_at}
              reviewedAt={stockTakeSession.reviewed_at}
              closedAt={stockTakeSession.closed_at}
              canTransitionStatus={canTransitionStatus}
              hasNextTransition={Boolean(nextTransition)}
              deleteAction={
                canDeleteEmptyDraft ? (
                  <DeleteEmptyDraftForm sessionId={stockTakeSession.id} />
                ) : null
              }
            />

            {query.success ? <Alert variant="success">{query.success}</Alert> : null}
            {query.error ? <Alert variant="error">{query.error}</Alert> : null}

            <StockTakeSessionDetailClient
              sessionId={stockTakeSession.id}
              canEnterCounts={canEnterCounts}
              isEntryOpen={isEntryOpen}
              canTransitionStatus={canTransitionStatus}
              nextTransition={
                nextTransition
                  ? {
                      action: nextTransition.action,
                      buttonLabel: nextTransition.buttonLabel,
                    }
                  : null
              }
              transitionAction={transitionStockTakeSessionAction}
              initialSelectedInventoryItemId={initialSelectedInventoryItemId}
              inventoryItems={inventoryItems}
              materialGroups={materialGroups}
              stockLocations={stockLocations}
              defaultStockLocationId={stockTakeSession.stock_location_id}
              stockTakeEntries={stockTakeEntryRows}
            />
          </PageContainer>
        );
      } catch (error) {
        if (error instanceof StockTakeSessionNotFoundError) {
          notFound();
        }
        throw error;
      }
    },
  });
}
