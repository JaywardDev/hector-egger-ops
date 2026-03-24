import Link from "next/link";
import { notFound } from "next/navigation";
import {
  saveStockTakeEntryAction,
  transitionStockTakeSessionAction,
} from "@/app/(protected)/stock-take/actions";
import { requireProtectedAccess } from "@/src/lib/auth/guards";
import {
  listMaterialGroups,
  listStockTakeInventoryItems,
} from "@/src/lib/inventory/items";
import { listStockLocations } from "@/src/lib/inventory/locations";
import {
  listStockTakeGroupFieldSettings,
  resolveStockTakeFieldConfigForItem,
} from "@/src/lib/stock-take/field-config";
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

const formatReferenceValue = (value: string | number | null) => value ?? "—";

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
          groupSettings,
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
          listStockTakeGroupFieldSettings({ session, route }),
          listStockLocations({ session, route }),
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
        const selectedInventoryItem =
          inventoryItems.find((item) => item.id === query.inventoryItemId) ?? null;
        const selectedFieldConfig = resolveStockTakeFieldConfigForItem({
          item: selectedInventoryItem,
          materialGroups,
          groupSettings,
        });
        const shouldShowLocationField = Boolean(
          selectedFieldConfig?.editableFields.find(
            ({ definition }) => definition.key === "stock_location_id",
          ),
        );
        const isLocationRequired = Boolean(
          selectedFieldConfig?.editableFields.find(
            ({ definition }) =>
              definition.key === "stock_location_id" && definition.required,
          ),
        );
        const shouldShowNotesField = Boolean(
          selectedFieldConfig?.editableFields.find(
            ({ definition }) => definition.key === "notes",
          ),
        );
        const isNotesRequired = Boolean(
          selectedFieldConfig?.editableFields.find(
            ({ definition }) => definition.key === "notes" && definition.required,
          ),
        );

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
                  <Link
                    href="/stock-take"
                    className="inline-flex rounded-md border border-zinc-300 px-3 py-1.5 text-zinc-800 hover:bg-zinc-100"
                  >
                    Back to sessions
                  </Link>
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

            <div className="space-y-3 rounded-md border border-zinc-200 bg-white p-3">
              <div>
                <h3 className="font-medium text-zinc-900">Record count</h3>
                <p className="text-zinc-600">Select inventory item</p>
              </div>
              <form
                method="get"
                className="grid gap-2 md:grid-cols-[minmax(0,1fr)_auto] md:items-end"
              >
                <label className="space-y-1">
                  <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                    Material
                  </span>
                  <select
                    name="inventoryItemId"
                    required
                    defaultValue={selectedInventoryItem?.id ?? ""}
                    className="w-full rounded-md border border-zinc-300 px-2 py-1.5"
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
                </label>
                <button
                  type="submit"
                  className="rounded-md border border-zinc-300 px-3 py-1.5 text-zinc-800 hover:bg-zinc-100"
                >
                  Show material details
                </button>
              </form>
            </div>

            {selectedInventoryItem ? (
              selectedFieldConfig ? (
                <>
                  <div className="space-y-3 rounded-md border border-zinc-200 bg-white p-3">
                    <h3 className="font-medium text-zinc-900">Material details</h3>
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                      {selectedFieldConfig.referenceFields.map(({ definition, value }) => (
                        <div
                          key={definition.key}
                          className="rounded-md border border-zinc-200 bg-zinc-50 p-3"
                        >
                          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                            {definition.label}
                          </p>
                          <p className="mt-1 text-sm text-zinc-900">
                            {formatReferenceValue(value)}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {canEnterCounts ? (
                    <form
                      action={saveStockTakeEntryAction}
                      className="space-y-3 rounded-md border border-zinc-200 bg-white p-3"
                    >
                      <input type="hidden" name="sessionId" value={stockTakeSession.id} />
                      <input
                        type="hidden"
                        name="inventoryItemId"
                        value={selectedInventoryItem.id}
                      />
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="font-medium text-zinc-900">Count details</h3>
                        <span className="rounded-md bg-zinc-100 px-2 py-1 text-xs text-zinc-700">
                          {isEntryOpen ? "Open for counting" : "Read-only status"}
                        </span>
                      </div>
                      <div className="grid gap-2 md:grid-cols-2">
                        <label className="space-y-1">
                          <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                            Counted quantity
                          </span>
                          <input
                            name="countedQuantity"
                            type="number"
                            min="0"
                            step="any"
                            placeholder="Counted quantity"
                            required
                            disabled={!isEntryOpen}
                            className="w-full rounded-md border border-zinc-300 px-2 py-1.5"
                          />
                        </label>
                        {shouldShowLocationField ? (
                          <label className="space-y-1">
                            <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                              Counted location
                            </span>
                            <select
                              name="stockLocationId"
                              defaultValue={stockTakeSession.stock_location_id ?? ""}
                              required={isLocationRequired}
                              disabled={!isEntryOpen}
                              className="w-full rounded-md border border-zinc-300 px-2 py-1.5"
                            >
                              <option value="">No location</option>
                              {stockLocations.map((location) => (
                                <option key={location.id} value={location.id}>
                                  {formatLocationLabel(location)}
                                </option>
                              ))}
                            </select>
                          </label>
                        ) : null}
                        {shouldShowNotesField ? (
                          <label className="space-y-1 md:col-span-2">
                            <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                              Notes
                            </span>
                            <textarea
                              name="notes"
                              placeholder="Entry notes (optional)"
                              rows={3}
                              required={isNotesRequired}
                              disabled={!isEntryOpen}
                              className="w-full rounded-md border border-zinc-300 px-2 py-1.5"
                            />
                          </label>
                        ) : null}
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
                      You can view this stock take setup, but cannot record counts.
                    </p>
                  )}
                </>
              ) : (
                <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-amber-800">
                  No stock-take field configuration is defined yet for the{" "}
                  {selectedInventoryItem.material_group?.label ?? "selected"} group.
                </p>
              )
            ) : (
              <p className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-zinc-600">
                Select a material to view its details before recording a count.
              </p>
            )}

            <div className="space-y-2 rounded-md border border-zinc-200 bg-white p-3">
              <h3 className="font-medium text-zinc-900">Current counts</h3>
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
                      <p>
                        Location:{" "}
                        {entry.stock_location
                          ? formatLocationLabel(entry.stock_location)
                          : "No location"}
                      </p>
                      <p>Notes: {entry.notes ?? "—"}</p>
                      <p>Timestamp: {entry.updated_at ?? entry.entered_at}</p>
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
