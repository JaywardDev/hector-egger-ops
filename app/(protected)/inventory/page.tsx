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
            <h2 className="text-base font-semibold text-zinc-900">
              Inventory items
            </h2>
            <p className="text-zinc-600">
              Track core stock item metadata for operations.
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
            <div className="space-y-2 rounded-md border border-zinc-200 bg-white p-3">
              <h3 className="font-medium text-zinc-900">Create item</h3>
              <InventoryItemForm
                action={createInventoryItemAction}
                materialGroups={materialGroups}
              />
            </div>
          ) : (
            <p className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2">
              You have read-only access to inventory items.
            </p>
          )}

          {items.length === 0 ? (
            <p className="rounded-md border border-zinc-200 bg-white px-3 py-3">
              No inventory items yet.
            </p>
          ) : (
            <ul className="space-y-3">
              {items.map((item) => (
                <li
                  key={item.id}
                  className="rounded-md border border-zinc-200 bg-white p-3"
                >
                  {canWrite ? (
                    <InventoryItemForm
                      action={updateInventoryItemAction}
                      materialGroups={materialGroups}
                      item={item}
                    />
                  ) : (
                    <div className="space-y-1">
                      <p className="font-medium text-zinc-900">{item.name}</p>
                      <p>Unit: {item.unit}</p>
                      <p>Material group: {item.material_group?.label ?? "—"}</p>
                      <p>Item code: {item.item_code ?? "—"}</p>
                      <p>Description: {item.description ?? "—"}</p>
                      <p>
                        Timber spec:{" "}
                        {item.timber_spec
                          ? `${item.timber_spec.thickness_mm ?? "—"} × ${item.timber_spec.width_mm ?? "—"} × ${item.timber_spec.length_mm ?? "—"} mm, grade ${item.timber_spec.grade ?? "—"}, treatment ${item.timber_spec.treatment ?? "—"}`
                          : "—"}
                      </p>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      );
    },
  });
}
