import { createInventoryItemAction, updateInventoryItemAction } from "@/app/(protected)/inventory/actions";
import { hasSupervisorOrAdminRole, requireProtectedAccess } from "@/src/lib/auth/guards";
import { listInventoryItems, listMaterialGroups } from "@/src/lib/inventory/items";

type InventoryPageProps = {
  searchParams: Promise<{
    success?: string;
    error?: string;
  }>;
};

export default async function InventoryPage({ searchParams }: InventoryPageProps) {
  const { session, roles } = await requireProtectedAccess();
  const [items, materialGroups, params] = await Promise.all([
    listInventoryItems({ session }),
    listMaterialGroups({ session }),
    searchParams,
  ]);
  const canWrite = hasSupervisorOrAdminRole(roles);

  return (
    <section className="space-y-4 text-sm text-zinc-700">
      <div>
        <h2 className="text-base font-semibold text-zinc-900">Inventory items</h2>
        <p className="text-zinc-600">Track core stock item metadata for operations.</p>
      </div>

      {params.success ? (
        <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-800">{params.success}</p>
      ) : null}
      {params.error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-red-700">{params.error}</p>
      ) : null}

      {canWrite ? (
        <form action={createInventoryItemAction} className="space-y-2 rounded-md border border-zinc-200 bg-white p-3">
          <h3 className="font-medium text-zinc-900">Create item</h3>
          <div className="grid gap-2 md:grid-cols-2">
            <input name="itemCode" placeholder="Item code (optional)" className="rounded-md border border-zinc-300 px-2 py-1.5" />
            <input name="name" placeholder="Name" required className="rounded-md border border-zinc-300 px-2 py-1.5" />
            <input name="unit" placeholder="Unit" required className="rounded-md border border-zinc-300 px-2 py-1.5" />
            <select name="materialGroupId" defaultValue="" className="rounded-md border border-zinc-300 px-2 py-1.5">
              <option value="">Material group (optional)</option>
              {materialGroups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.label}
                </option>
              ))}
            </select>
            <input name="description" placeholder="Description (optional)" className="rounded-md border border-zinc-300 px-2 py-1.5 md:col-span-2" />
          </div>
          <button type="submit" className="rounded-md border border-zinc-300 px-3 py-1.5 text-zinc-800 hover:bg-zinc-100">
            Create
          </button>
        </form>
      ) : (
        <p className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2">You have read-only access to inventory items.</p>
      )}

      {items.length === 0 ? (
        <p className="rounded-md border border-zinc-200 bg-white px-3 py-3">No inventory items yet.</p>
      ) : (
        <ul className="space-y-3">
          {items.map((item) => (
            <li key={item.id} className="rounded-md border border-zinc-200 bg-white p-3">
              {canWrite ? (
                <form action={updateInventoryItemAction} className="space-y-2">
                  <input type="hidden" name="itemId" value={item.id} />
                  <div className="grid gap-2 md:grid-cols-2">
                    <input
                      name="itemCode"
                      defaultValue={item.item_code ?? ""}
                      placeholder="Item code"
                      className="rounded-md border border-zinc-300 px-2 py-1.5"
                    />
                    <input name="name" defaultValue={item.name} required className="rounded-md border border-zinc-300 px-2 py-1.5" />
                    <input name="unit" defaultValue={item.unit} required className="rounded-md border border-zinc-300 px-2 py-1.5" />
                    <select
                      name="materialGroupId"
                      defaultValue={item.material_group_id ?? ""}
                      className="rounded-md border border-zinc-300 px-2 py-1.5"
                    >
                      <option value="">Material group (optional)</option>
                      {materialGroups.map((group) => (
                        <option key={group.id} value={group.id}>
                          {group.label}
                        </option>
                      ))}
                    </select>
                    <input
                      name="description"
                      defaultValue={item.description ?? ""}
                      placeholder="Description"
                      className="rounded-md border border-zinc-300 px-2 py-1.5 md:col-span-2"
                    />
                  </div>
                  <p className="text-xs text-zinc-500">Material group: {item.material_group?.label ?? "Unassigned"}</p>
                  <button
                    type="submit"
                    className="rounded-md border border-zinc-300 px-3 py-1.5 text-zinc-800 hover:bg-zinc-100"
                  >
                    Save
                  </button>
                </form>
              ) : (
                <div className="space-y-1">
                  <p className="font-medium text-zinc-900">{item.name}</p>
                  <p>Unit: {item.unit}</p>
                  <p>Material group: {item.material_group?.label ?? "—"}</p>
                  <p>Item code: {item.item_code ?? "—"}</p>
                  <p>Description: {item.description ?? "—"}</p>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
