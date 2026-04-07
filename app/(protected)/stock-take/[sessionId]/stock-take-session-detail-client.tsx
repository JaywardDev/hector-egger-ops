"use client";

import { useState } from "react";
import {
  saveStockTakeEntryAction,
  type SaveStockTakeEntryActionResult,
} from "@/app/(protected)/stock-take/actions";

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

type EditableField = {
  key: string;
  label: string;
  control: "number" | "textarea" | "select" | "text";
  required: boolean;
};

type GroupFieldConfig = {
  referenceFields: {
    key: string;
    label: string;
    control: "number" | "textarea" | "select" | "text";
  }[];
  editableFields: EditableField[];
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
  initialSelectedInventoryItemId: string | null;
  existingMaterialFieldConfigs: Record<
    string,
    {
      referenceFields: ReferenceField[];
      editableFields: EditableField[];
    }
  >;
  inventoryItems: InventoryItemOption[];
  materialGroups: MaterialGroupOption[];
  stockLocations: StockLocationOption[];
  defaultStockLocationId: string | null;
  groupFieldConfigs: Record<string, GroupFieldConfig>;
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

const fieldNameByKey = {
  item_name: "name",
  item_code: "itemCode",
  unit: "unit",
  thickness_mm: "timberThicknessMm",
  width_mm: "timberWidthMm",
  length_mm: "timberLengthMm",
  grade: "timberGrade",
  treatment: "timberTreatment",
  counted_quantity: "countedQuantity",
  stock_location_id: "stockLocationId",
  notes: "notes",
} as const;

const numberStepByFieldKey: Record<string, string> = {
  thickness_mm: "0.01",
  width_mm: "0.01",
  length_mm: "0.01",
  counted_quantity: "any",
};

const numberMinByFieldKey: Record<string, string> = {
  thickness_mm: "0.01",
  width_mm: "0.01",
  length_mm: "0.01",
  counted_quantity: "0",
};

export function StockTakeSessionDetailClient(props: Props) {
  const [entryFeedback, setEntryFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [mode, setMode] = useState<"existing" | "new">("existing");
  const [inventoryItems, setInventoryItems] = useState(props.inventoryItems);
  const [stockTakeEntries, setStockTakeEntries] = useState(props.stockTakeEntries);
  const [selectedInventoryItemId, setSelectedInventoryItemId] = useState(
    props.initialSelectedInventoryItemId,
  );
  const [materialGroupId, setMaterialGroupId] = useState(
    props.materialGroups[0]?.id ?? "",
  );
  const selectedExistingMaterialFieldConfig = selectedInventoryItemId
    ? props.existingMaterialFieldConfigs[selectedInventoryItemId] ?? {
        referenceFields: [],
        editableFields: [],
      }
    : { referenceFields: [], editableFields: [] };

  const activeGroupConfig = props.groupFieldConfigs[materialGroupId] ?? {
    referenceFields: [],
    editableFields: [],
  };

  const renderEntryField = ({
    field,
    mode,
  }: {
    field: EditableField | GroupFieldConfig["referenceFields"][number];
    mode: "existing" | "new";
  }) => {
    const name = fieldNameByKey[field.key as keyof typeof fieldNameByKey];
    if (!name) {
      return null;
    }

    if (field.key === "stock_location_id") {
      return (
        <label key={`${mode}-${field.key}`} className="space-y-1">
          <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            {field.label}
          </span>
          <select
            name={name}
            defaultValue={props.defaultStockLocationId ?? ""}
            required={"required" in field ? field.required : false}
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
      );
    }

    if (field.control === "textarea") {
      return (
        <label key={`${mode}-${field.key}`} className="space-y-1 md:col-span-2">
          <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            {field.label}
          </span>
          <textarea
            name={name}
            rows={2}
            required={"required" in field ? field.required : false}
            disabled={!props.isEntryOpen}
            className="w-full rounded-md border border-zinc-300 px-2 py-1.5"
          />
        </label>
      );
    }

    const inputType = field.control === "number" ? "number" : "text";

    return (
      <label key={`${mode}-${field.key}`} className="space-y-1">
        <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
          {field.label}
        </span>
        <input
          name={name}
          type={inputType}
          min={inputType === "number" ? numberMinByFieldKey[field.key] : undefined}
          step={inputType === "number" ? numberStepByFieldKey[field.key] : undefined}
          required={"required" in field ? field.required : false}
          disabled={!props.isEntryOpen}
          className="w-full rounded-md border border-zinc-300 px-2 py-1.5"
        />
      </label>
    );
  };

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
          <div className="grid gap-2">
            <label className="space-y-1">
              <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                Existing material
              </span>
              <select
                required
                value={selectedInventoryItemId ?? ""}
                onChange={(event) =>
                  setSelectedInventoryItemId(
                    event.target.value.length > 0 ? event.target.value : null,
                  )
                }
                className="w-full rounded-md border border-zinc-300 px-2 py-1.5"
              >
                <option value="">
                  Select a material
                </option>
                {inventoryItems.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} {item.item_code ? `(${item.item_code})` : ""}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {selectedInventoryItemId &&
          selectedExistingMaterialFieldConfig.referenceFields.length > 0 ? (
            <div className="rounded-md border border-zinc-200 bg-zinc-50 p-2">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Material details
              </p>
              <dl className="grid gap-x-4 gap-y-1 text-sm md:grid-cols-2 xl:grid-cols-3">
                {selectedExistingMaterialFieldConfig.referenceFields.map((field) => (
                  <div key={field.key} className="flex gap-2">
                    <dt className="text-zinc-500">{field.label}:</dt>
                    <dd className="font-medium text-zinc-900">
                      {formatValue(field.value)}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          ) : (
            <p className="text-zinc-600">
              Select a material to view its details and record a count.
            </p>
          )}

          {props.canEnterCounts && selectedInventoryItemId ? (
            <form
              action={async (formData) => {
                const result = await saveStockTakeEntryAction(formData);
                if (!result.ok) {
                  setEntryFeedback({ type: "error", message: result.message });
                  if (result.inventoryItemId) {
                    setSelectedInventoryItemId(result.inventoryItemId);
                  }
                  return;
                }

                setStockTakeEntries((current) => [result.entry, ...current]);
                setEntryFeedback({ type: "success", message: result.message });
              }}
              className="space-y-2"
            >
              <input type="hidden" name="sessionId" value={props.sessionId} />
              <input
                type="hidden"
                name="inventoryItemId"
                value={selectedInventoryItemId}
              />
              <div className="grid gap-2 md:grid-cols-2">
                {selectedExistingMaterialFieldConfig.editableFields.map((field) =>
                  renderEntryField({ field, mode: "existing" }),
                )}
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
            <form
              action={async (formData) => {
                const result: SaveStockTakeEntryActionResult =
                  await saveStockTakeEntryAction(formData);
                if (!result.ok) {
                  setEntryFeedback({ type: "error", message: result.message });
                  return;
                }

                setStockTakeEntries((current) => [result.entry, ...current]);
                if (result.createdInventoryItem) {
                  const createdItem = result.createdInventoryItem;
                  setInventoryItems((current) => [
                    createdItem,
                    ...current,
                  ]);
                  setSelectedInventoryItemId(createdItem.id);
                  setMode("existing");
                }
                setEntryFeedback({ type: "success", message: result.message });
              }}
              className="space-y-3"
            >
              <input type="hidden" name="sessionId" value={props.sessionId} />
              <input type="hidden" name="entryMode" value="create-material" />
              <input type="hidden" name="timberLabelMode" value="auto" />

              <div className="grid gap-2 md:grid-cols-2">
                <label className="space-y-1">
                  <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                    Material group
                  </span>
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
                <label className="space-y-1 md:col-span-2">
                  <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                    Description
                  </span>
                  <input
                    name="description"
                    disabled={!props.isEntryOpen}
                    className="w-full rounded-md border border-zinc-300 px-2 py-1.5"
                  />
                </label>
              </div>

              <div className="grid gap-2 md:grid-cols-2">
                {activeGroupConfig.referenceFields.map((field) =>
                  renderEntryField({ field, mode: "new" }),
                )}
                {activeGroupConfig.editableFields.map((field) =>
                  renderEntryField({ field, mode: "new" }),
                )}
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
            <p className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2">
              You can view this session, but cannot record counts.
            </p>
          )}
        </div>
      ) : null}

      <div className="border-t border-zinc-200 pt-3">
        {entryFeedback ? (
          <p
            className={`mb-3 rounded-md border px-3 py-2 ${
              entryFeedback.type === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-red-200 bg-red-50 text-red-700"
            }`}
          >
            {entryFeedback.message}
          </p>
        ) : null}
        <h4 className="mb-2 font-medium text-zinc-900">Session entries</h4>
        {stockTakeEntries.length === 0 ? (
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
                  <th className="px-2 py-2">Storage location</th>
                  <th className="px-2 py-2">Notes</th>
                  <th className="px-2 py-2">Updated</th>
                </tr>
              </thead>
              <tbody>
                {stockTakeEntries.map((entry) => (
                  <tr key={entry.id} className="border-t border-zinc-100 align-top">
                    <td className="px-2 py-2 font-medium text-zinc-900">
                      {entry.inventory_item?.name ?? "—"}
                    </td>
                    <td className="px-2 py-2">{entry.inventory_item?.item_code ?? "—"}</td>
                    <td className="px-2 py-2">
                      {entry.inventory_item?.material_group?.label ?? "—"}
                    </td>
                    <td className="px-2 py-2">
                      {entry.counted_quantity}
                      {entry.inventory_item?.unit ? ` ${entry.inventory_item.unit}` : ""}
                    </td>
                    <td className="px-2 py-2">
                      {entry.stock_location ? formatLocationLabel(entry.stock_location) : "—"}
                    </td>
                    <td className="px-2 py-2">{entry.notes ?? "—"}</td>
                    <td className="px-2 py-2 whitespace-nowrap">
                      {formatEntryTimestamp(entry.updated_at, entry.entered_at)}
                    </td>
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
