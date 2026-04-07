import Link from "next/link";
import { notFound } from "next/navigation";
import {
  deleteEmptyDraftStockTakeSessionAction,
  transitionStockTakeSessionAction,
} from "@/app/(protected)/stock-take/actions";
import { StockTakeSessionDetailClient } from "@/app/(protected)/stock-take/[sessionId]/stock-take-session-detail-client";
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

const formatTimestamp = (value: string | null) => value ?? "—";

const statusBadgeClassName = {
  draft: "bg-zinc-100 text-zinc-700",
  in_progress: "bg-blue-100 text-blue-800",
  submitted: "bg-amber-100 text-amber-800",
  reviewed: "bg-violet-100 text-violet-800",
  closed: "bg-emerald-100 text-emerald-800",
};

const formatLocationLabel = (location: { name: string; code: string | null }) =>
  location.code ? `${location.name} (${location.code})` : location.name;

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
          <section className="space-y-4 text-sm text-zinc-700">
            <div className="rounded-md border border-zinc-200 bg-white p-3">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="space-y-2">
                  <h2 className="text-base font-semibold text-zinc-900">
                    {stockTakeSession.title}
                  </h2>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-zinc-600">Status:</span>
                    <span
                      className={`inline-flex rounded-md px-2 py-1 text-xs font-medium ${statusBadgeClassName[stockTakeSession.status]}`}
                    >
                      {stockTakeSession.status}
                    </span>
                  </div>
                  <p className="text-zinc-600">
                    Default location:{" "}
                    {stockTakeSession.stock_location
                      ? formatLocationLabel(stockTakeSession.stock_location)
                      : "None"}
                  </p>
                  <p>Notes: {stockTakeSession.notes ?? "—"}</p>
                  <p>Started at: {formatTimestamp(stockTakeSession.started_at)}</p>
                  <p>Submitted at: {formatTimestamp(stockTakeSession.submitted_at)}</p>
                  <p>Reviewed at: {formatTimestamp(stockTakeSession.reviewed_at)}</p>
                  <p>Closed at: {formatTimestamp(stockTakeSession.closed_at)}</p>
                </div>
                <div className="space-y-2 md:min-w-52">
                  <h3 className="font-medium text-zinc-900">Session actions</h3>
                  {!canTransitionStatus ? (
                    <p className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-zinc-600">
                      Only supervisors and admins can change session status.
                    </p>
                  ) : !nextTransition ? (
                    <p className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-zinc-600">
                      No further status actions available.
                    </p>
                  ) : null}
                  <Link
                    href="/stock-take"
                    className="inline-flex rounded-md border border-zinc-300 px-3 py-1.5 text-zinc-800 hover:bg-zinc-100"
                  >
                    Back to sessions
                  </Link>
                  {canDeleteEmptyDraft ? (
                    <form
                      action={deleteEmptyDraftStockTakeSessionAction}
                      onSubmit={(event) => {
                        if (
                          !window.confirm(
                            "Delete this empty draft session? This action cannot be undone.",
                          )
                        ) {
                          event.preventDefault();
                        }
                      }}
                    >
                      <input type="hidden" name="sessionId" value={stockTakeSession.id} />
                      <button
                        type="submit"
                        className="inline-flex rounded-md border border-red-200 px-3 py-1.5 text-red-700 hover:bg-red-50"
                      >
                        Delete empty draft
                      </button>
                    </form>
                  ) : null}
                </div>
              </div>
            </div>

            {query.success ? (
              <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-800">
                {query.success}
              </p>
            ) : null}
            {query.error ? (
              <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-red-700">
                {query.error}
              </p>
            ) : null}

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
          </section>
        );
      } catch {
        notFound();
      }
    },
  });
}
