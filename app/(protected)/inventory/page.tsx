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
} from "@/src/lib/inventory/items";
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

      return (
        <section className="space-y-4 text-sm text-zinc-700">
          <div>
            <h2 className="text-base font-semibold text-zinc-900">Materials</h2>
            <p className="text-zinc-600">
              Master list of materials used for stock take and operations.
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

          {canWrite ? (
            <details className="rounded-md border border-zinc-200 bg-white p-3">
              <summary className="cursor-pointer list-none font-medium text-zinc-900">
                Add material
              </summary>
              <div className="mt-3">
                <InventoryItemForm
                  action={createInventoryItemAction}
                  materialGroups={materialGroups}
                />
              </div>
            </details>
          ) : (
            <p className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2">
              You have read-only access to materials.
            </p>
          )}

          <div className="space-y-2">
            <h3 className="font-medium text-zinc-900">Materials</h3>
            {items.length === 0 ? (
              <p className="rounded-md border border-zinc-200 bg-white px-3 py-3">
                No materials yet.
              </p>
            ) : (
              <ul className="space-y-3">
                {items.map((item) => (
                  <li
                    key={item.id}
                    className="rounded-md border border-zinc-200 bg-white p-3"
                  >
                    <div className="space-y-1">
                      <p className="font-medium text-zinc-900">{item.name}</p>
                      <p>Material group: {item.material_group?.label ?? "—"}</p>
                      <p>Unit: {item.unit}</p>
                      <p>Item code: {item.item_code ?? "—"}</p>
                      <p>Timber spec: {getTimberSpecSummary(item.timber_spec)}</p>
                      {item.description ? <p>Description: {item.description}</p> : null}
                    </div>

                    {canWrite ? (
                      <details className="mt-3 rounded-md border border-zinc-200 bg-zinc-50 p-3">
                        <summary className="cursor-pointer list-none font-medium text-zinc-800">
                          Edit
                        </summary>
                        <div className="mt-3">
                          <InventoryItemForm
                            action={updateInventoryItemAction}
                            materialGroups={materialGroups}
                            item={item}
                          />
                        </div>
                      </details>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      );
    },
  });
}
