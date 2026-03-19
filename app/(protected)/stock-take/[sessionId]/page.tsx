import Link from "next/link";
import { notFound } from "next/navigation";
import {
  saveStockTakeEntryAction,
  transitionStockTakeSessionAction,
} from "@/app/(protected)/stock-take/actions";
import { requireProtectedAccess } from "@/src/lib/auth/guards";
import { listInventoryItemOptions } from "@/src/lib/inventory/items";
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
        const [stockTakeSession, stockTakeEntries, inventoryItems, query] =
          await Promise.all([
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
            listInventoryItemOptions({ session, route }),
            searchParams,
          ]);
        const canEnterCounts =
          roles.includes("admin") ||
          roles.includes("supervisor") ||
          roles.includes("operator");
        const canTransitionStatus =
          roles.includes("admin") || roles.includes("supervisor");
        const isEntryOpen = ["draft", "in_progress"].includes(
          stockTakeSession.status,
        );
        const nextTransition = getNextStockTakeTransitionAction(stockTakeSession);

        return (
          <section className="space-y-4 text-sm text-zinc-700">
            <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
              <div className="space-y-2">
                <h2 className="text-base font-semibold text-zinc-900">
                  {stockTakeSession.title}
                </h2>
                <p className="text-zinc-600">
                  Location: {stockTakeSession.stock_location?.code ?? "—"} —{" "}
                  {stockTakeSession.stock_location?.name ?? "Unknown location"}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-zinc-600">Status:</span>
                  <span
                    className={`inline-flex rounded-md px-2 py-1 text-xs font-medium ${statusBadgeClassName[stockTakeSession.status]}`}
                  >
                    {stockTakeSession.status}
                  </span>
                </div>
              </div>
              <Link
                href="/stock-take"
                className="inline-flex rounded-md border border-zinc-300 px-3 py-1.5 text-zinc-800 hover:bg-zinc-100"
              >
                Back to sessions
              </Link>
            </div>

            <div className="rounded-md border border-zinc-200 bg-white p-3">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <h3 className="font-medium text-zinc-900">Session details</h3>
                  <div className="mt-2 space-y-1">
                    <p>Notes: {stockTakeSession.notes ?? "—"}</p>
                    <p>Started at: {formatTimestamp(stockTakeSession.started_at)}</p>
                    <p>Submitted at: {formatTimestamp(stockTakeSession.submitted_at)}</p>
                    <p>Reviewed at: {formatTimestamp(stockTakeSession.reviewed_at)}</p>
                    <p>Closed at: {formatTimestamp(stockTakeSession.closed_at)}</p>
                  </div>
                </div>
                <div className="space-y-2 md:min-w-52">
                  <h3 className="font-medium text-zinc-900">Session actions</h3>
                  {canTransitionStatus && nextTransition ? (
                    <form action={transitionStockTakeSessionAction}>
                      <input type="hidden" name="sessionId" value={stockTakeSession.id} />
                      <input
                        type="hidden"
                        name="transitionAction"
                        value={nextTransition.action}
                      />
                      <button
                        type="submit"
                        className="rounded-md border border-zinc-300 px-3 py-1.5 text-zinc-800 hover:bg-zinc-100"
                      >
                        {nextTransition.buttonLabel}
                      </button>
                    </form>
                  ) : canTransitionStatus ? (
                    <p className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-zinc-600">
                      No further status actions available.
                    </p>
                  ) : (
                    <p className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-zinc-600">
                      Only supervisors and admins can change session status.
                    </p>
                  )}
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

            {canEnterCounts ? (
              <form
                action={saveStockTakeEntryAction}
                className="space-y-2 rounded-md border border-zinc-200 bg-white p-3"
              >
                <input
                  type="hidden"
                  name="sessionId"
                  value={stockTakeSession.id}
                />
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-medium text-zinc-900">
                    Record counted quantity
                  </h3>
                  <span className="rounded-md bg-zinc-100 px-2 py-1 text-xs text-zinc-700">
                    {isEntryOpen ? "Open for counting" : "Read-only status"}
                  </span>
                </div>
                <div className="grid gap-2 md:grid-cols-2">
                  <select
                    name="inventoryItemId"
                    required
                    defaultValue=""
                    disabled={!isEntryOpen}
                    className="rounded-md border border-zinc-300 px-2 py-1.5"
                  >
                    <option value="" disabled>
                      Select inventory item
                    </option>
                    {inventoryItems.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name} {item.item_code ? `(${item.item_code})` : ""} —{" "}
                        {item.unit}
                      </option>
                    ))}
                  </select>
                  <input
                    name="countedQuantity"
                    type="number"
                    min="0"
                    step="any"
                    placeholder="Counted quantity"
                    required
                    disabled={!isEntryOpen}
                    className="rounded-md border border-zinc-300 px-2 py-1.5"
                  />
                  <textarea
                    name="notes"
                    placeholder="Entry notes (optional)"
                    rows={3}
                    disabled={!isEntryOpen}
                    className="rounded-md border border-zinc-300 px-2 py-1.5 md:col-span-2"
                  />
                </div>
                <button
                  type="submit"
                  disabled={!isEntryOpen}
                  className="rounded-md border border-zinc-300 px-3 py-1.5 text-zinc-800 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Save count
                </button>
              </form>
            ) : (
              <p className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2">
                You can view this stock take session, but cannot record counts.
              </p>
            )}

            <div className="space-y-2 rounded-md border border-zinc-200 bg-white p-3">
              <h3 className="font-medium text-zinc-900">Current entries</h3>
              {stockTakeEntries.length === 0 ? (
                <p>No counts recorded yet.</p>
              ) : (
                <ul className="space-y-2">
                  {stockTakeEntries.map((entry) => (
                    <li
                      key={entry.id}
                      className="rounded-md border border-zinc-200 p-3"
                    >
                      <p className="font-medium text-zinc-900">
                        {entry.inventory_item?.name ?? "Unknown item"}
                      </p>
                      <p>Item code: {entry.inventory_item?.item_code ?? "—"}</p>
                      <p>
                        Counted quantity: {entry.counted_quantity}{" "}
                        {entry.inventory_item?.unit ?? ""}
                      </p>
                      <p>Notes: {entry.notes ?? "—"}</p>
                      <p>Entered at: {entry.entered_at}</p>
                      <p>Updated at: {entry.updated_at}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        );
      } catch {
        notFound();
      }
    },
  });
}
