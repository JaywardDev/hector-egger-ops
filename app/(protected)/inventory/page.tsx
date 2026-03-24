import {
  createInventoryItemAction,
  updateInventoryItemAction,
} from "@/app/(protected)/inventory/actions";
import { InventoryItemForm } from "@/src/components/inventory/inventory-item-form";
import {
  hasSupervisorOrAdminRole,
  requireProtectedAccess,
} from "@/src/lib/auth/guards";
import {
  listInventoryItems,
  listMaterialGroups,
  type InventoryItemRecord,
} from "@/src/lib/inventory/items";
import {
  resolveStockTakeFieldConfigForGroup,
  stockTakeFieldLibrary,
} from "@/src/lib/stock-take/field-config";
import { withServerTiming } from "@/src/lib/server-timing";

type InventoryPageProps = {
  searchParams: Promise<{
    success?: string;
    error?: string;
  }>;
};

const getTimberSpecSummary = (
  timberSpec:
    | {
        thickness_mm: number | null;
        width_mm: number | null;
        length_mm: number | null;
        grade: string | null;
        treatment: string | null;
      }
    | null,
) => {
  if (!timberSpec) {
    return "—";
  }

  return `${timberSpec.thickness_mm ?? "—"} × ${timberSpec.width_mm ?? "—"} × ${timberSpec.length_mm ?? "—"} mm, grade ${timberSpec.grade ?? "—"}, treatment ${timberSpec.treatment ?? "—"}`;
};

const getStockTakeFieldSummary = (groupKey: string) => {
  const config = resolveStockTakeFieldConfigForGroup(groupKey);
  if (!config) {
    return "No stock-take form configured yet.";
  }

  const labels = [...config.referenceFieldKeys, ...config.editableFieldKeys].map(
    (fieldKey) => stockTakeFieldLibrary[fieldKey].label.toLowerCase(),
  );

  return `Stock-take fields: ${labels.join(", ")}`;
};

const listItemsByGroup = (items: InventoryItemRecord[]) =>
  items.reduce<Record<string, InventoryItemRecord[]>>((acc, item) => {
    const groupId = item.material_group_id;
    if (!groupId) {
      return acc;
    }

    const groupItems = acc[groupId] ?? [];
    groupItems.push(item);
    acc[groupId] = groupItems;
    return acc;
  }, {});

export default async function InventoryPage({
  searchParams,
}: InventoryPageProps) {
  const route = "/inventory";

  return withServerTiming({
    name: "InventoryPage",
    route,
    operation: async () => {
      const { session, roles } = await requireProtectedAccess(route);
      const [items, materialGroups, params] = await Promise.all([
        listInventoryItems({ session, route }),
        listMaterialGroups({ session, route }),
        searchParams,
      ]);
      const canWrite = hasSupervisorOrAdminRole(roles);
      const itemsByGroup = listItemsByGroup(items);

      return (
        <section className="space-y-4 text-sm text-zinc-700">
          <div>
            <h2 className="text-base font-semibold text-zinc-900">
              Materials Setup
            </h2>
            <p className="text-zinc-600">
              Configure material groups, manage the materials inside them, and
              define how each group appears in stock take.
            </p>
          </div>

          {params.success ? (
            <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-800">
              {params.success}
            </p>
          ) : null}
          {params.error ? (
            <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-red-700">
              {params.error}
            </p>
          ) : null}

          {!canWrite ? (
            <p className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2">
              You have read-only access to materials setup.
            </p>
          ) : null}

          <div className="space-y-3">
            <h3 className="font-medium text-zinc-900">Material Groups</h3>

            {materialGroups.length === 0 ? (
              <p className="rounded-md border border-zinc-200 bg-white px-3 py-3">
                No material groups found.
              </p>
            ) : (
              <ul className="space-y-3">
                {materialGroups.map((group) => {
                  const groupItems = itemsByGroup[group.id] ?? [];
                  const groupConfig = resolveStockTakeFieldConfigForGroup(group.key);
                  return (
                    <li
                      key={group.id}
                      className="rounded-md border border-zinc-200 bg-white p-3"
                    >
                      <div className="space-y-1">
                        <p className="font-medium text-zinc-900">{group.label}</p>
                        <p>
                          {groupItems.length} material
                          {groupItems.length === 1 ? "" : "s"}
                        </p>
                        <p>{getStockTakeFieldSummary(group.key)}</p>
                      </div>

                      <div className="mt-3 space-y-2">
                        <details className="rounded-md border border-zinc-200 bg-zinc-50 p-3">
                          <summary className="cursor-pointer list-none font-medium text-zinc-900">
                            Manage materials
                          </summary>
                          <div className="mt-3 space-y-3">
                            {groupItems.length === 0 ? (
                              <p className="rounded-md border border-zinc-200 bg-white px-3 py-2">
                                No materials in this group yet.
                              </p>
                            ) : (
                              <ul className="space-y-2">
                                {groupItems.map((item) => (
                                  <li
                                    key={item.id}
                                    className="rounded-md border border-zinc-200 bg-white p-3"
                                  >
                                    <div className="space-y-1">
                                      <p className="font-medium text-zinc-900">
                                        {item.name}
                                      </p>
                                      <p>Unit: {item.unit}</p>
                                      <p>Item code: {item.item_code ?? "—"}</p>
                                      <p>
                                        Timber spec: {getTimberSpecSummary(item.timber_spec)}
                                      </p>
                                      {item.description ? (
                                        <p>Description: {item.description}</p>
                                      ) : null}
                                    </div>

                                    {canWrite ? (
                                      <details className="mt-3 rounded-md border border-zinc-200 bg-zinc-50 p-3">
                                        <summary className="cursor-pointer list-none font-medium text-zinc-800">
                                          Edit material
                                        </summary>
                                        <div className="mt-3">
                                          <InventoryItemForm
                                            action={updateInventoryItemAction}
                                            materialGroups={materialGroups}
                                            item={item}
                                            fixedMaterialGroupId={group.id}
                                            hideMaterialGroupSelector
                                            submitLabel="Save material"
                                          />
                                        </div>
                                      </details>
                                    ) : null}
                                  </li>
                                ))}
                              </ul>
                            )}

                            {canWrite ? (
                              <details className="rounded-md border border-zinc-200 bg-white p-3">
                                <summary className="cursor-pointer list-none font-medium text-zinc-900">
                                  Add material
                                </summary>
                                <div className="mt-3">
                                  <InventoryItemForm
                                    action={createInventoryItemAction}
                                    materialGroups={materialGroups}
                                    fixedMaterialGroupId={group.id}
                                    hideMaterialGroupSelector
                                    submitLabel="Create material"
                                  />
                                </div>
                              </details>
                            ) : null}
                          </div>
                        </details>

                        <details className="rounded-md border border-zinc-200 bg-zinc-50 p-3">
                          <summary className="cursor-pointer list-none font-medium text-zinc-900">
                            Edit stock-take form
                          </summary>
                          <div className="mt-3 space-y-3">
                            <p className="text-xs uppercase tracking-wide text-zinc-500">
                              Group-level stock-take setup for {group.label}
                            </p>

                            {!groupConfig ? (
                              <p className="rounded-md border border-zinc-200 bg-white px-3 py-2">
                                No stock-take form configured yet.
                              </p>
                            ) : (
                              <>
                                <div className="rounded-md border border-zinc-200 bg-white p-3">
                                  <p className="font-medium text-zinc-900">
                                    Selected stock-take fields
                                  </p>
                                  <ul className="mt-2 list-disc space-y-1 pl-5">
                                    {[
                                      ...groupConfig.referenceFieldKeys,
                                      ...groupConfig.editableFieldKeys,
                                    ].map((fieldKey) => (
                                      <li key={fieldKey}>
                                        {stockTakeFieldLibrary[fieldKey].label}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              </>
                            )}

                            <div className="rounded-md border border-zinc-200 bg-white p-3">
                              <p className="font-medium text-zinc-900">
                                Available field library
                              </p>
                              <ul className="mt-2 list-disc space-y-1 pl-5">
                                {Object.values(stockTakeFieldLibrary).map((field) => (
                                  <li key={field.key}>
                                    {field.label}
                                    <span className="text-zinc-500">
                                      {" "}
                                      ({field.kind === "reference" ? "Reference" : "Editable"})
                                    </span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          </div>
                        </details>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>
      );
    },
  });
}
