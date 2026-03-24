import {
  archiveMaterialGroupAction,
  createMaterialGroupAction,
  createInventoryItemAction,
  saveGroupStockTakeConfigAction,
  updateMaterialGroupAction,
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
  listStockTakeGroupFieldSettings,
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

const getStockTakeFieldSummary = ({
  referenceFieldKeys,
  editableFieldKeys,
}: {
  referenceFieldKeys: string[];
  editableFieldKeys: string[];
}) => {
  const labels = [...referenceFieldKeys, ...editableFieldKeys].map(
    (fieldKey) =>
      stockTakeFieldLibrary[fieldKey as keyof typeof stockTakeFieldLibrary].label.toLowerCase(),
  );

  if (labels.length === 0) {
    return "No stock-take form configured yet.";
  }

  return `Stock-take fields: ${labels.join(", ")}`;
};

const getStockTakeFieldConfigSummary = ({
  group,
  groupSettings,
}: {
  group: { id: string; key: string };
  groupSettings: Awaited<ReturnType<typeof listStockTakeGroupFieldSettings>>;
}) => {
  const config = resolveStockTakeFieldConfigForGroup({ group, groupSettings });
  if (!config) {
    return "No stock-take form configured yet.";
  }
  return getStockTakeFieldSummary(config);
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
      const [items, materialGroups, groupSettings, params] = await Promise.all([
        listInventoryItems({ session, route }),
        listMaterialGroups({ session, route }),
        listStockTakeGroupFieldSettings({ session, route }),
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

            {canWrite ? (
              <details className="rounded-md border border-zinc-200 bg-white p-3">
                <summary className="cursor-pointer list-none font-medium text-zinc-900">
                  Add material group
                </summary>
                <form action={createMaterialGroupAction} className="mt-3 flex flex-wrap items-end gap-2">
                  <label className="space-y-1">
                    <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                      Group name
                    </span>
                    <input
                      name="label"
                      required
                      placeholder="Material group name"
                      className="rounded-md border border-zinc-300 px-2 py-1.5"
                    />
                  </label>
                  <button
                    type="submit"
                    className="rounded-md border border-zinc-300 px-3 py-1.5 text-zinc-800 hover:bg-zinc-100"
                  >
                    Create group
                  </button>
                </form>
              </details>
            ) : null}

            {materialGroups.length === 0 ? (
              <p className="rounded-md border border-zinc-200 bg-white px-3 py-3">
                No material groups found.
              </p>
            ) : (
              <ul className="space-y-3">
                {materialGroups.map((group) => {
                  const groupItems = itemsByGroup[group.id] ?? [];
                  const groupConfig = resolveStockTakeFieldConfigForGroup({
                    group,
                    groupSettings,
                  });
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
                        <p>{getStockTakeFieldConfigSummary({ group, groupSettings })}</p>
                      </div>
                      {canWrite ? (
                        <div className="mt-3 grid gap-2 md:grid-cols-[minmax(0,1fr)_auto_auto] md:items-end">
                          <form action={updateMaterialGroupAction} className="space-y-1">
                            <input type="hidden" name="materialGroupId" value={group.id} />
                            <label className="space-y-1 text-xs font-medium uppercase tracking-wide text-zinc-500">
                              Group name
                              <input
                                name="label"
                                defaultValue={group.label}
                                required
                                className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm font-normal normal-case tracking-normal"
                              />
                            </label>
                            <button
                              type="submit"
                              className="rounded-md border border-zinc-300 px-3 py-1.5 text-zinc-800 hover:bg-zinc-100"
                            >
                              Save group
                            </button>
                          </form>
                          <form action={archiveMaterialGroupAction}>
                            <input type="hidden" name="materialGroupId" value={group.id} />
                            <button
                              type="submit"
                              className="rounded-md border border-red-300 px-3 py-1.5 text-red-700 hover:bg-red-50"
                            >
                              Archive group
                            </button>
                          </form>
                        </div>
                      ) : null}

                      <div className="mt-3 space-y-2">
                        <details className="rounded-md border border-zinc-200 bg-zinc-50 p-3">
                          <summary className="cursor-pointer list-none font-medium text-zinc-900">
                            Materials in this group
                          </summary>
                          <div className="mt-3 space-y-3">
                            <p className="text-sm text-zinc-600">
                              Reference list of material definitions used for stock takes. Quantity changes are recorded in Stock Take sessions.
                            </p>
                            {groupItems.length === 0 ? (
                              <p className="rounded-md border border-zinc-200 bg-white px-3 py-2">
                                No materials in this group yet.
                              </p>
                            ) : (
                              <div className="overflow-x-auto rounded-md border border-zinc-200 bg-white">
                                <table className="min-w-full border-collapse text-sm">
                                  <thead className="bg-zinc-100 text-left text-xs uppercase tracking-wide text-zinc-600">
                                    <tr>
                                      <th className="px-3 py-2 font-medium">Material label</th>
                                      <th className="px-3 py-2 font-medium">Item code</th>
                                      <th className="px-3 py-2 font-medium">Quantity label</th>
                                      <th className="px-3 py-2 font-medium">Specs summary</th>
                                      {canWrite ? <th className="px-3 py-2 font-medium">Actions</th> : null}
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {groupItems.map((item) => (
                                      <tr key={item.id} className="border-t border-zinc-200 align-top">
                                        <td className="px-3 py-2 text-zinc-900">
                                          <p className="font-medium">{item.name}</p>
                                          {item.description ? (
                                            <p className="mt-1 text-xs text-zinc-600">{item.description}</p>
                                          ) : null}
                                        </td>
                                        <td className="px-3 py-2 text-zinc-700">{item.item_code ?? "—"}</td>
                                        <td className="px-3 py-2 text-zinc-700">{item.unit}</td>
                                        <td className="px-3 py-2 text-zinc-700">
                                          {getTimberSpecSummary(item.timber_spec)}
                                        </td>
                                        {canWrite ? (
                                          <td className="px-3 py-2">
                                            <details>
                                              <summary className="cursor-pointer list-none rounded-md border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-800 hover:bg-zinc-50">
                                                Edit definition
                                              </summary>
                                              <div className="mt-2 min-w-[18rem] rounded-md border border-zinc-200 bg-zinc-50 p-3">
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
                                          </td>
                                        ) : null}
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
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
                                        {groupConfig.requiredEditableFieldKeys.includes(fieldKey) ? " (required)" : ""}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              </>
                            )}

                            {canWrite ? (
                              <form action={saveGroupStockTakeConfigAction} className="rounded-md border border-zinc-200 bg-white p-3">
                                <input type="hidden" name="materialGroupId" value={group.id} />
                                <p className="font-medium text-zinc-900">Stock-take fields</p>
                                <div className="mt-2 space-y-2">
                                  {Object.values(stockTakeFieldLibrary).map((field) => {
                                    const isEnabled = Boolean(
                                      groupConfig &&
                                        [...groupConfig.referenceFieldKeys, ...groupConfig.editableFieldKeys].includes(field.key),
                                    );
                                    const isRequired = Boolean(
                                      groupConfig?.requiredEditableFieldKeys.includes(field.key),
                                    );

                                    return (
                                      <div key={field.key} className="rounded-md border border-zinc-200 p-2">
                                        <label className="flex items-center gap-2">
                                          <input
                                            type="checkbox"
                                            name="enabledFieldKeys"
                                            value={field.key}
                                            defaultChecked={isEnabled}
                                            disabled={field.key === "counted_quantity"}
                                          />
                                          <span>
                                            {field.label}
                                            <span className="text-zinc-500">
                                              {" "}
                                              ({field.kind === "reference" ? "Reference" : "Editable"})
                                            </span>
                                          </span>
                                        </label>
                                        {field.kind === "editable" && field.supportsRequiredToggle ? (
                                          <label className="mt-1 flex items-center gap-2 pl-6 text-xs text-zinc-600">
                                            <input
                                              type="checkbox"
                                              name="requiredFieldKeys"
                                              value={field.key}
                                              defaultChecked={isRequired}
                                            />
                                            Required
                                          </label>
                                        ) : null}
                                      </div>
                                    );
                                  })}
                                </div>
                                <button
                                  type="submit"
                                  className="mt-3 rounded-md border border-zinc-300 px-3 py-1.5 text-zinc-800 hover:bg-zinc-100"
                                >
                                  Save stock-take form
                                </button>
                              </form>
                            ) : (
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
                            )}
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
