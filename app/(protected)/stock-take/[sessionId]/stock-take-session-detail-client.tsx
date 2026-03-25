"use client";

import { useState } from "react";
import { saveStockTakeEntryAction } from "@/app/(protected)/stock-take/actions";

type MaterialGroupOption = {
  id: string;
  key: string;
  label: string;
};

type InventoryItemOption = {
  id: string;
  name: string;
  item_code: string | null;
  unit: string;
  material_group: { label: string | null } | null;
};

type StockLocationOption = {
  id: string;
  name: string;
  code: string | null;
};

type ReferenceField = {
  key: string;
  label: string;
  value: string | number | null;
};

type GroupFieldBehavior = {
  showLocation: boolean;
  locationRequired: boolean;
  showNotes: boolean;
  notesRequired: boolean;
};

type EntryRow = {
  id: string;
  inventory_item: {
    name: string;
    item_code: string | null;
    unit: string;
    material_group: { label: string | null } | null;
  } | null;
  counted_quantity: number;
  stock_location: { name: string; code: string | null } | null;
  notes: string | null;
  updated_at: string | null;
  entered_at: string;
};

type Props = {
  sessionId: string;
  canEnterCounts: boolean;
  isEntryOpen: boolean;
  selectedInventoryItemId: string | null;
  selectedReferenceFields: ReferenceField[];
  inventoryItems: InventoryItemOption[];
  materialGroups: MaterialGroupOption[];
  stockLocations: StockLocationOption[];
  defaultStockLocationId: string | null;
  existingFieldBehavior: GroupFieldBehavior;
  groupFieldBehaviors: Record<string, GroupFieldBehavior>;
  stockTakeEntries: EntryRow[];
};

const formatLocationLabel = (location: { name: string; code: string | null }) =>
  location.code ? `${location.name} (${location.code})` : location.name;

const formatValue = (value: string | number | null) => {
  if (value === null) {
    return "—";
  }
  const normalized = String(value).trim();
  return normalized.length > 0 ? normalized : "—";
};

const formatEntryTimestamp = (updatedAt: string | null, enteredAt: string) =>
  updatedAt ?? enteredAt;

export function StockTakeSessionDetailClient(props: Props) {
  const [mode, setMode] = useState<"existing" | "new">("existing");
  const [materialGroupId, setMaterialGroupId] = useState(
    props.materialGroups[0]?.id ?? "",
  );

  const activeGroupBehavior =
    props.groupFieldBehaviors[materialGroupId] ?? {
      showLocation: true,
      locationRequired: false,
      showNotes: true,
      notesRequired: false,
    };

  const isTimberGroup =
    props.materialGroups.find((group) => group.id === materialGroupId)?.key ===
    "timber";

  return (
    <div className="space-y-3 rounded-md border border-zinc-200 bg-white p-3">
      <div className="space-y-3">
        <h3 className="font-medium text-zinc-900">Stock take entry</h3>
        <div className="inline-flex rounded-md border border-zinc-300 bg-zinc-50 p-0.5">
          <button
            type="button"
            onClick={() => setMode("existing")}
            className={`rounded px-3 py-1.5 text-sm ${
              mode === "existing"
                ? "bg-white font-medium text-zinc-900 shadow-sm"
                : "text-zinc-600 hover:text-zinc-900"
            }`}
          >
            Existing material
          </button>
          <button
            type="button"
            onClick={() => setMode("new")}
            className={`rounded px-3 py-1.5 text-sm ${
              mode === "new"
                ? "bg-white font-medium text-zinc-900 shadow-sm"
                : "text-zinc-600 hover:text-zinc-900"
            }`}
          >
            Capture new material
          </button>
        </div>
      </div>

      {mode === "existing" ? (
        <div className="space-y-3 border-t border-zinc-200 pt-3">
          <form method="get" className="grid gap-2 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
            <label className="space-y-1">
              <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                Existing material
              </span>
              <select
                name="inventoryItemId"
                required
                defaultValue={props.selectedInventoryItemId ?? ""}
                className="w-full rounded-md border border-zinc-300 px-2 py-1.5"
              >
                <option value="" disabled>
                  Select a material
                </option>
                {props.inventoryItems.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} {item.item_code ? `(${item.item_code})` : ""}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="submit"
              className="rounded-md border border-zinc-300 px-3 py-1.5 text-zinc-800 hover:bg-zinc-100"
            >
              Load material
            </button>
          </form>

          {props.selectedInventoryItemId && props.selectedReferenceFields.length > 0 ? (
            <div className="rounded-md border border-zinc-200 bg-zinc-50 p-2">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Material details
              </p>
              <dl className="grid gap-x-4 gap-y-1 text-sm md:grid-cols-2 xl:grid-cols-3">
                {props.selectedReferenceFields.map((field) => (
                  <div key={field.key} className="flex gap-2">
                    <dt className="text-zinc-500">{field.label}:</dt>
                    <dd className="font-medium text-zinc-900">{formatValue(field.value)}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ) : (
            <p className="text-zinc-600">Select a material to view its details and record a count.</p>
          )}

          {props.canEnterCounts && props.selectedInventoryItemId ? (
            <form action={saveStockTakeEntryAction} className="space-y-2">
              <input type="hidden" name="sessionId" value={props.sessionId} />
              <input type="hidden" name="inventoryItemId" value={props.selectedInventoryItemId} />
              <div className="grid gap-2 md:grid-cols-2">
                <label className="space-y-1">
                  <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">Quantity counted</span>
                  <input
                    name="countedQuantity"
                    type="number"
                    min="0"
                    step="any"
                    required
                    disabled={!props.isEntryOpen}
                    className="w-full rounded-md border border-zinc-300 px-2 py-1.5"
                  />
                </label>
                {props.existingFieldBehavior.showLocation ? (
                  <label className="space-y-1">
                    <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">Storage location</span>
                    <select
                      name="stockLocationId"
                      defaultValue={props.defaultStockLocationId ?? ""}
                      required={props.existingFieldBehavior.locationRequired}
                      disabled={!props.isEntryOpen}
                      className="w-full rounded-md border border-zinc-300 px-2 py-1.5"
                    >
                      <option value="">No location</option>
                      {props.stockLocations.map((location) => (
                        <option key={location.id} value={location.id}>
                          {formatLocationLabel(location)}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
                {props.existingFieldBehavior.showNotes ? (
                  <label className="space-y-1 md:col-span-2">
                    <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">Notes</span>
                    <textarea
                      name="notes"
                      rows={2}
                      required={props.existingFieldBehavior.notesRequired}
                      disabled={!props.isEntryOpen}
                      className="w-full rounded-md border border-zinc-300 px-2 py-1.5"
                    />
                  </label>
                ) : null}
              </div>
              <button
                type="submit"
                disabled={!props.isEntryOpen}
                className="rounded-md border border-zinc-300 px-3 py-1.5 text-zinc-800 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Save entry
              </button>
            </form>
          ) : null}
        </div>
      ) : null}

      {mode === "new" ? (
        <div className="space-y-3 border-t border-zinc-200 pt-3">
          {props.canEnterCounts ? (
            <form action={saveStockTakeEntryAction} className="space-y-3">
              <input type="hidden" name="sessionId" value={props.sessionId} />
              <input type="hidden" name="entryMode" value="create-material" />
              <input type="hidden" name="timberLabelMode" value="auto" />

              <div className="grid gap-2 md:grid-cols-2">
                <label className="space-y-1">
                  <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">Material group</span>
                  <select
                    name="materialGroupId"
                    required
                    value={materialGroupId}
                    onChange={(event) => setMaterialGroupId(event.target.value)}
                    disabled={!props.isEntryOpen}
                    className="w-full rounded-md border border-zinc-300 px-2 py-1.5"
                  >
                    {props.materialGroups.map((group) => (
                      <option key={group.id} value={group.id}>
                        {group.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1">
                  <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">Material label</span>
                  <input name="name" disabled={!props.isEntryOpen} className="w-full rounded-md border border-zinc-300 px-2 py-1.5" />
                </label>
                <label className="space-y-1">
                  <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">Code</span>
                  <input name="itemCode" disabled={!props.isEntryOpen} className="w-full rounded-md border border-zinc-300 px-2 py-1.5" />
                </label>
                <label className="space-y-1">
                  <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">Unit</span>
                  <input name="unit" required disabled={!props.isEntryOpen} className="w-full rounded-md border border-zinc-300 px-2 py-1.5" />
                </label>
                <label className="space-y-1 md:col-span-2">
                  <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">Description</span>
                  <input name="description" disabled={!props.isEntryOpen} className="w-full rounded-md border border-zinc-300 px-2 py-1.5" />
                </label>
              </div>

              {isTimberGroup ? (
                <div className="grid gap-2 rounded-md border border-zinc-200 bg-zinc-50 p-2 md:grid-cols-2">
                  <p className="md:col-span-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">Timber details</p>
                  <input name="timberThicknessMm" type="number" min="0.01" step="0.01" placeholder="Thickness (mm)" disabled={!props.isEntryOpen} className="rounded-md border border-zinc-300 px-2 py-1.5" />
                  <input name="timberWidthMm" type="number" min="0.01" step="0.01" placeholder="Width (mm)" disabled={!props.isEntryOpen} className="rounded-md border border-zinc-300 px-2 py-1.5" />
                  <input name="timberLengthMm" type="number" min="0.01" step="0.01" placeholder="Length (mm)" disabled={!props.isEntryOpen} className="rounded-md border border-zinc-300 px-2 py-1.5" />
                  <input name="timberGrade" placeholder="Grade" disabled={!props.isEntryOpen} className="rounded-md border border-zinc-300 px-2 py-1.5" />
                  <input name="timberTreatment" placeholder="Treatment" disabled={!props.isEntryOpen} className="rounded-md border border-zinc-300 px-2 py-1.5 md:col-span-2" />
                </div>
              ) : null}

              <div className="grid gap-2 md:grid-cols-2">
                <label className="space-y-1">
                  <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">Quantity counted</span>
                  <input name="countedQuantity" type="number" min="0" step="any" required disabled={!props.isEntryOpen} className="w-full rounded-md border border-zinc-300 px-2 py-1.5" />
                </label>
                {activeGroupBehavior.showLocation ? (
                  <label className="space-y-1">
                    <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">Storage location</span>
                    <select
                      name="stockLocationId"
                      defaultValue={props.defaultStockLocationId ?? ""}
                      required={activeGroupBehavior.locationRequired}
                      disabled={!props.isEntryOpen}
                      className="w-full rounded-md border border-zinc-300 px-2 py-1.5"
                    >
                      <option value="">No location</option>
                      {props.stockLocations.map((location) => (
                        <option key={location.id} value={location.id}>
                          {formatLocationLabel(location)}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
                {activeGroupBehavior.showNotes ? (
                  <label className="space-y-1 md:col-span-2">
                    <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">Notes</span>
                    <textarea name="notes" rows={2} required={activeGroupBehavior.notesRequired} disabled={!props.isEntryOpen} className="w-full rounded-md border border-zinc-300 px-2 py-1.5" />
                  </label>
                ) : null}
              </div>

              <button
                type="submit"
                disabled={!props.isEntryOpen}
                className="rounded-md border border-zinc-300 px-3 py-1.5 text-zinc-800 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Save new material and entry
              </button>
            </form>
          ) : (
            <p className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2">You can view this session, but cannot record counts.</p>
          )}
        </div>
      ) : null}

      <div className="border-t border-zinc-200 pt-3">
        <h4 className="mb-2 font-medium text-zinc-900">Session entries</h4>
        {props.stockTakeEntries.length === 0 ? (
          <p className="text-zinc-600">No entries recorded yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-md border border-zinc-200">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500">
                <tr>
                  <th className="px-2 py-2">Material label</th>
                  <th className="px-2 py-2">Code</th>
                  <th className="px-2 py-2">Group</th>
                  <th className="px-2 py-2">Qty</th>
                  <th className="px-2 py-2">Location</th>
                  <th className="px-2 py-2">Notes</th>
                  <th className="px-2 py-2">Updated</th>
                </tr>
              </thead>
              <tbody>
                {props.stockTakeEntries.map((entry) => (
                  <tr key={entry.id} className="border-t border-zinc-100 align-top">
                    <td className="px-2 py-2 font-medium text-zinc-900">{entry.inventory_item?.name ?? "—"}</td>
                    <td className="px-2 py-2">{entry.inventory_item?.item_code ?? "—"}</td>
                    <td className="px-2 py-2">{entry.inventory_item?.material_group?.label ?? "—"}</td>
                    <td className="px-2 py-2">
                      {entry.counted_quantity}
                      {entry.inventory_item?.unit ? ` ${entry.inventory_item.unit}` : ""}
                    </td>
                    <td className="px-2 py-2">{entry.stock_location ? formatLocationLabel(entry.stock_location) : "—"}</td>
                    <td className="px-2 py-2">{entry.notes ?? "—"}</td>
                    <td className="px-2 py-2 whitespace-nowrap">{formatEntryTimestamp(entry.updated_at, entry.entered_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
