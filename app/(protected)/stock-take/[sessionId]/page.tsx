import Link from "next/link";
import { notFound } from "next/navigation";
import { transitionStockTakeSessionAction } from "@/app/(protected)/stock-take/actions";
import { StockTakeSessionDetailClient } from "@/app/(protected)/stock-take/[sessionId]/stock-take-session-detail-client";
import { requireProtectedAccess } from "@/src/lib/auth/guards";
import {
  listMaterialGroups,
  listStockTakeInventoryItems,
} from "@/src/lib/inventory/items";
import { listStockLocations } from "@/src/lib/inventory/locations";
import {
  listStockTakeGroupFieldSettings,
  resolveStockTakeFieldConfigForGroup,
  stockTakeFieldLibrary,
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

type ExistingMaterialFieldConfig = {
  referenceFields: {
    key: string;
    label: string;
    value: string | number | null;
  }[];
  editableFields: {
    key: string;
    label: string;
    control: "number" | "textarea" | "select" | "text";
    required: boolean;
  }[];
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
        const initialSelectedInventoryItemId =
          inventoryItems.some((item) => item.id === query.inventoryItemId)
            ? (query.inventoryItemId ?? null)
            : null;
        const inventoryItemById = new Map(
          inventoryItems.map((item) => [item.id, item] as const),
        );
        const groupSettingsById = new Map<string, typeof groupSettings>();
        for (const setting of groupSettings) {
          const existing = groupSettingsById.get(setting.material_group_id);
          if (existing) {
            existing.push(setting);
            continue;
          }
          groupSettingsById.set(setting.material_group_id, [setting]);
        }
        const groupConfigById = new Map(
          materialGroups.map((group) => {
            const config = resolveStockTakeFieldConfigForGroup({
              group,
              groupSettings: groupSettingsById.get(group.id) ?? [],
            });
            return [group.id, config] as const;
          }),
        );

        const existingMaterialFieldConfigs: Record<
          string,
          ExistingMaterialFieldConfig
        > = Object.fromEntries(
          inventoryItems.map((item) => {
            const fieldConfig = item.material_group?.id
              ? (groupConfigById.get(item.material_group.id) ?? null)
              : null;

            return [
              item.id,
              {
                referenceFields:
                  fieldConfig?.referenceFieldKeys
                    .map((fieldKey) => {
                      const definition = stockTakeFieldLibrary[fieldKey];
                      const value = (() => {
                        switch (fieldKey) {
                          case "item_name":
                            return item.name;
                          case "item_code":
                            return item.item_code;
                          case "unit":
                            return item.unit;
                          case "thickness_mm":
                            return item.timber_spec?.thickness_mm ?? null;
                          case "width_mm":
                            return item.timber_spec?.width_mm ?? null;
                          case "length_mm":
                            return item.timber_spec?.length_mm ?? null;
                          case "grade":
                            return item.timber_spec?.grade ?? null;
                          case "treatment":
                            return item.timber_spec?.treatment ?? null;
                          default:
                            return null;
                        }
                      })();
                      return {
                        key: definition.key,
                        label: definition.label,
                        value,
                      };
                    })
                    .filter(({ value }) => {
                      if (value === null) {
                        return false;
                      }
                      const normalized = String(value).trim();
                      return normalized.length > 0;
                    }) ?? [],
                editableFields:
                  fieldConfig?.editableFieldKeys.map((fieldKey) => ({
                    key: fieldKey,
                    label: stockTakeFieldLibrary[fieldKey].label,
                    control: stockTakeFieldLibrary[fieldKey].control,
                    required: fieldConfig.requiredEditableFieldKeys.includes(fieldKey),
                  })) ?? [],
              },
            ];
          }),
        );

        const groupFieldConfigs = Object.fromEntries(
          materialGroups.map((group) => {
            const config = groupConfigById.get(group.id) ?? null;
            return [
              group.id,
              {
                referenceFields:
                  config?.referenceFieldKeys.map((fieldKey) => ({
                    key: fieldKey,
                    label: stockTakeFieldLibrary[fieldKey].label,
                    control: stockTakeFieldLibrary[fieldKey].control,
                  })) ?? [],
                editableFields:
                  config?.editableFieldKeys.map((fieldKey) => ({
                    key: fieldKey,
                    label: stockTakeFieldLibrary[fieldKey].label,
                    control: stockTakeFieldLibrary[fieldKey].control,
                    required: config.requiredEditableFieldKeys.includes(fieldKey),
                  })) ?? [],
              },
            ];
          }),
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

            <StockTakeSessionDetailClient
              sessionId={stockTakeSession.id}
              canEnterCounts={canEnterCounts}
              isEntryOpen={isEntryOpen}
              initialSelectedInventoryItemId={initialSelectedInventoryItemId}
              existingMaterialFieldConfigs={existingMaterialFieldConfigs}
              inventoryItems={inventoryItems}
              materialGroups={materialGroups}
              stockLocations={stockLocations}
              defaultStockLocationId={stockTakeSession.stock_location_id}
              groupFieldConfigs={groupFieldConfigs}
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
