"use client";

import { useEffect, useMemo, useState } from "react";
import {
  saveStockTakeSessionDraftAction,
  type SaveStockTakeSessionDraftActionInput,
} from "@/app/(protected)/stock-take/actions";
import { resolveInventoryItemNameCandidate } from "@/src/lib/inventory/item-labels";

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
  material_group: { id: string; label: string | null } | null;
};

type StockLocationOption = {
  id: string;
  name: string;
  code: string | null;
};

type EntryRow = {
  id: string;
  inventory_item: {
    id: string;
    name: string;
    item_code: string | null;
    unit: string;
    material_group: { label: string | null } | null;
  } | null;
  counted_quantity: number;
  stock_location: { id?: string; name: string; code: string | null } | null;
  notes: string | null;
  updated_at: string | null;
  entered_at: string;
};

type DraftRow = {
  clientId: string;
  entryId: string | null;
  inventoryItemId: string | null;
  countedQuantity: number;
  stockLocationId: string | null;
  notes: string | null;
  newMaterial: {
    materialGroupId: string;
    description: string | null;
    unit: string | null;
    name: string | null;
    itemCode: string | null;
    timberSpec: {
      thicknessMm: number | null;
      widthMm: number | null;
      lengthMm: number | null;
      grade: string | null;
      treatment: string | null;
    } | null;
  } | null;
  enteredAt: string;
  updatedAt: string | null;
};

type RowEditBuffer = {
  inventoryItemId: string | null;
  countedQuantity: string;
  stockLocationId: string;
  notes: string;
};

type Props = {
  sessionId: string;
  canEnterCounts: boolean;
  isEntryOpen: boolean;
  canTransitionStatus: boolean;
  nextTransition:
    | {
        action: string;
        buttonLabel: string;
      }
    | null;
  transitionAction: (formData: FormData) => void;
  initialSelectedInventoryItemId: string | null;
  inventoryItems: InventoryItemOption[];
  materialGroups: MaterialGroupOption[];
  stockLocations: StockLocationOption[];
  defaultStockLocationId: string | null;
  stockTakeEntries: EntryRow[];
};

const formatLocationLabel = (location: { name: string; code: string | null }) =>
  location.code ? `${location.name} (${location.code})` : location.name;

const toDraftRows = (rows: EntryRow[]): DraftRow[] =>
  rows.map((row) => ({
    clientId: `persisted-${row.id}`,
    entryId: row.id,
    inventoryItemId: row.inventory_item?.id ?? null,
    countedQuantity: row.counted_quantity,
    stockLocationId: row.stock_location?.id ?? null,
    notes: row.notes,
    newMaterial: null,
    enteredAt: row.entered_at,
    updatedAt: row.updated_at,
  }));

const toComparableRows = (rows: DraftRow[]) =>
  rows
    .map((row) => ({
      entryId: row.entryId,
      inventoryItemId: row.inventoryItemId,
      countedQuantity: row.countedQuantity,
      stockLocationId: row.stockLocationId,
      notes: row.notes ?? null,
      newMaterial: row.newMaterial,
    }))
    .sort((a, b) => `${a.entryId ?? ""}-${a.inventoryItemId ?? ""}`.localeCompare(`${b.entryId ?? ""}-${b.inventoryItemId ?? ""}`));

export function StockTakeSessionDetailClient(props: Props) {
  const [inventoryItems, setInventoryItems] = useState(props.inventoryItems);
  const [baselineRows, setBaselineRows] = useState<DraftRow[]>(() => toDraftRows(props.stockTakeEntries));
  const [draftRows, setDraftRows] = useState<DraftRow[]>(() => toDraftRows(props.stockTakeEntries));
  const [selectedInventoryItemId, setSelectedInventoryItemId] = useState<string | null>(props.initialSelectedInventoryItemId);
  const [countedQuantity, setCountedQuantity] = useState("0");
  const [stockLocationId, setStockLocationId] = useState(props.defaultStockLocationId ?? "");
  const [notes, setNotes] = useState("");
  const [newMaterialGroupId, setNewMaterialGroupId] = useState(props.materialGroups[0]?.id ?? "");
  const [newMaterialDescription, setNewMaterialDescription] = useState("");
  const [newMaterialQty, setNewMaterialQty] = useState("0");
  const [newMaterialLocationId, setNewMaterialLocationId] = useState(props.defaultStockLocationId ?? "");
  const [newMaterialNotes, setNewMaterialNotes] = useState("");
  const [newMaterialThicknessMm, setNewMaterialThicknessMm] = useState("");
  const [newMaterialWidthMm, setNewMaterialWidthMm] = useState("");
  const [newMaterialLengthMm, setNewMaterialLengthMm] = useState("");
  const [newMaterialGrade, setNewMaterialGrade] = useState("");
  const [newMaterialTreatment, setNewMaterialTreatment] = useState("");
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [editingRowClientId, setEditingRowClientId] = useState<string | null>(null);
  const [rowEditBuffer, setRowEditBuffer] = useState<RowEditBuffer | null>(null);

  const baselineSnapshot = useMemo(() => JSON.stringify(toComparableRows(baselineRows)), [baselineRows]);
  const draftSnapshot = useMemo(() => JSON.stringify(toComparableRows(draftRows)), [draftRows]);
  const hasUnsavedChanges = baselineSnapshot !== draftSnapshot;

  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => {
      if (!hasUnsavedChanges) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [hasUnsavedChanges]);

  const inventoryItemById = useMemo(
    () => new Map(inventoryItems.map((item) => [item.id, item] as const)),
    [inventoryItems],
  );

  const addExistingRow = () => {
    const qty = Number(countedQuantity);
    if (!selectedInventoryItemId || !Number.isFinite(qty) || qty < 0) {
      setFeedback({ type: "error", message: "Select a material and provide a valid quantity." });
      return;
    }

    setDraftRows((current) => [
      {
        clientId: `local-${crypto.randomUUID()}`,
        entryId: null,
        inventoryItemId: selectedInventoryItemId,
        countedQuantity: qty,
        stockLocationId: stockLocationId || null,
        notes: notes.trim().length > 0 ? notes.trim() : null,
        newMaterial: null,
        enteredAt: new Date().toISOString(),
        updatedAt: null,
      },
      ...current,
    ]);
    setCountedQuantity("0");
    setNotes("");
    setFeedback(null);
  };

  const addNewMaterialRow = () => {
    const qty = Number(newMaterialQty);
    if (!newMaterialGroupId || !Number.isFinite(qty) || qty < 0) {
      setFeedback({ type: "error", message: "Provide a valid group and quantity for the new material row." });
      return;
    }

    const parseNum = (value: string) => {
      const trimmed = value.trim();
      if (!trimmed) return null;
      const parsed = Number(trimmed);
      return Number.isFinite(parsed) ? parsed : null;
    };

    setDraftRows((current) => [
      {
        clientId: `local-${crypto.randomUUID()}`,
        entryId: null,
        inventoryItemId: null,
        countedQuantity: qty,
        stockLocationId: newMaterialLocationId || null,
        notes: newMaterialNotes.trim().length > 0 ? newMaterialNotes.trim() : null,
        newMaterial: {
          materialGroupId: newMaterialGroupId,
          description: newMaterialDescription.trim() || null,
          unit: null,
          name: null,
          itemCode: null,
          timberSpec: {
            thicknessMm: parseNum(newMaterialThicknessMm),
            widthMm: parseNum(newMaterialWidthMm),
            lengthMm: parseNum(newMaterialLengthMm),
            grade: newMaterialGrade.trim() || null,
            treatment: newMaterialTreatment.trim() || null,
          },
        },
        enteredAt: new Date().toISOString(),
        updatedAt: null,
      },
      ...current,
    ]);
    setNewMaterialDescription("");
    setNewMaterialQty("0");
    setNewMaterialNotes("");
    setNewMaterialThicknessMm("");
    setNewMaterialWidthMm("");
    setNewMaterialLengthMm("");
    setNewMaterialGrade("");
    setNewMaterialTreatment("");
    setFeedback(null);
  };

  const saveChanges = async () => {
    if (!props.canEnterCounts || !props.isEntryOpen || isSaving || !hasUnsavedChanges) {
      return;
    }

    setIsSaving(true);
    setFeedback(null);

    const payload: SaveStockTakeSessionDraftActionInput = {
      sessionId: props.sessionId,
      rows: draftRows.map((row) => ({
        entryId: row.entryId,
        inventoryItemId: row.inventoryItemId,
        countedQuantity: row.countedQuantity,
        stockLocationId: row.stockLocationId,
        notes: row.notes,
        newMaterial: row.newMaterial,
      })),
    };

    const result = await saveStockTakeSessionDraftAction(payload);
    if (!result.ok) {
      setFeedback({ type: "error", message: result.message });
      setIsSaving(false);
      return;
    }

    if (result.createdInventoryItems.length > 0) {
      setInventoryItems((current) => {
        const existing = new Set(current.map((item) => item.id));
        return [
          ...result.createdInventoryItems.filter((item) => !existing.has(item.id)).map((item) => ({
            id: item.id,
            name: item.name,
            item_code: item.item_code,
            unit: item.unit,
            material_group: item.material_group?.label
              ? { id: "", label: item.material_group.label }
              : null,
          })),
          ...current,
        ];
      });
    }

    const savedRows = toDraftRows(result.rows);
    setBaselineRows(savedRows);
    setDraftRows(savedRows);
    setFeedback({ type: "success", message: result.message });
    setIsSaving(false);
  };

  const resetChanges = () => {
    setDraftRows(baselineRows);
    setEditingRowClientId(null);
    setRowEditBuffer(null);
    setFeedback({ type: "success", message: "Unsaved changes discarded." });
  };

  const updateRow = (clientId: string, patch: Partial<DraftRow>) => {
    setDraftRows((current) =>
      current.map((row) => (row.clientId === clientId ? { ...row, ...patch } : row)),
    );
  };

  const removeRow = (clientId: string) => {
    setDraftRows((current) => current.filter((row) => row.clientId !== clientId));
    if (editingRowClientId === clientId) {
      setEditingRowClientId(null);
      setRowEditBuffer(null);
    }
  };

  const copyRow = (sourceRow: DraftRow) => {
    const copiedRow: DraftRow = {
      clientId: `local-${crypto.randomUUID()}`,
      entryId: null,
      inventoryItemId: sourceRow.inventoryItemId,
      countedQuantity: sourceRow.countedQuantity,
      stockLocationId: sourceRow.stockLocationId,
      notes: sourceRow.notes,
      newMaterial: sourceRow.newMaterial
        ? {
            materialGroupId: sourceRow.newMaterial.materialGroupId,
            description: sourceRow.newMaterial.description,
            unit: sourceRow.newMaterial.unit,
            name: sourceRow.newMaterial.name,
            itemCode: sourceRow.newMaterial.itemCode,
            timberSpec: sourceRow.newMaterial.timberSpec
              ? {
                  thicknessMm: sourceRow.newMaterial.timberSpec.thicknessMm,
                  widthMm: sourceRow.newMaterial.timberSpec.widthMm,
                  lengthMm: sourceRow.newMaterial.timberSpec.lengthMm,
                  grade: sourceRow.newMaterial.timberSpec.grade,
                  treatment: sourceRow.newMaterial.timberSpec.treatment,
                }
              : null,
          }
        : null,
      enteredAt: new Date().toISOString(),
      updatedAt: null,
    };

    setDraftRows((current) => [copiedRow, ...current]);
    setEditingRowClientId(copiedRow.clientId);
    setRowEditBuffer({
      inventoryItemId: copiedRow.inventoryItemId,
      countedQuantity: String(copiedRow.countedQuantity),
      stockLocationId: copiedRow.stockLocationId ?? "",
      notes: copiedRow.notes ?? "",
    });
    setFeedback(null);
  };

  const startRowEdit = (row: DraftRow) => {
    setEditingRowClientId(row.clientId);
    setRowEditBuffer({
      inventoryItemId: row.inventoryItemId,
      countedQuantity: String(row.countedQuantity),
      stockLocationId: row.stockLocationId ?? "",
      notes: row.notes ?? "",
    });
  };

  const cancelRowEdit = () => {
    setEditingRowClientId(null);
    setRowEditBuffer(null);
  };

  const applyRowEditToDraft = () => {
    if (!editingRowClientId || !rowEditBuffer) return;
    const qty = Number(rowEditBuffer.countedQuantity);
    if (!Number.isFinite(qty) || qty < 0) {
      setFeedback({ type: "error", message: "Provide a valid quantity before confirming row edits." });
      return;
    }

    const rowBeingEdited = draftRows.find((row) => row.clientId === editingRowClientId);
    if (!rowBeingEdited) {
      cancelRowEdit();
      return;
    }

    if (!rowBeingEdited.newMaterial && !rowEditBuffer.inventoryItemId) {
      setFeedback({ type: "error", message: "Select a material before confirming row edits." });
      return;
    }

    updateRow(editingRowClientId, {
      inventoryItemId: rowBeingEdited.newMaterial ? rowBeingEdited.inventoryItemId : rowEditBuffer.inventoryItemId,
      countedQuantity: qty,
      stockLocationId: rowEditBuffer.stockLocationId || null,
      notes: rowEditBuffer.notes.trim() ? rowEditBuffer.notes.trim() : null,
    });
    setEditingRowClientId(null);
    setRowEditBuffer(null);
    setFeedback(null);
  };

  return (
    <div className="space-y-3 rounded-md border border-zinc-200 bg-white p-3">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={saveChanges}
          disabled={!hasUnsavedChanges || isSaving || !props.canEnterCounts || !props.isEntryOpen}
          className="rounded-md border border-zinc-300 px-3 py-1.5 text-zinc-800 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSaving ? "Saving..." : "Save changes"}
        </button>
        <button
          type="button"
          onClick={resetChanges}
          disabled={!hasUnsavedChanges}
          className="rounded-md border border-zinc-300 px-3 py-1.5 text-zinc-800 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Reset
        </button>
        {hasUnsavedChanges ? <span className="text-xs text-amber-700">Unsaved changes</span> : null}
      </div>

      <div className="grid gap-3 border-t border-zinc-200 pt-3 md:grid-cols-2">
        <div className="space-y-2">
          <h4 className="font-medium text-zinc-900">Add row (existing material)</h4>
          <select
            value={selectedInventoryItemId ?? ""}
            onChange={(event) =>
              setSelectedInventoryItemId(event.target.value.length > 0 ? event.target.value : null)
            }
            className="w-full rounded-md border border-zinc-300 px-2 py-1.5"
          >
            <option value="">Select a material</option>
            {inventoryItems.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} {item.item_code ? `(${item.item_code})` : ""}
              </option>
            ))}
          </select>
          <input
            type="number"
            min="0"
            step="any"
            value={countedQuantity}
            onChange={(event) => setCountedQuantity(event.target.value)}
            className="w-full rounded-md border border-zinc-300 px-2 py-1.5"
            placeholder="Counted quantity"
          />
          <select
            value={stockLocationId}
            onChange={(event) => setStockLocationId(event.target.value)}
            className="w-full rounded-md border border-zinc-300 px-2 py-1.5"
          >
            <option value="">No location</option>
            {props.stockLocations.map((location) => (
              <option key={location.id} value={location.id}>
                {formatLocationLabel(location)}
              </option>
            ))}
          </select>
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            className="w-full rounded-md border border-zinc-300 px-2 py-1.5"
            placeholder="Notes"
            rows={2}
          />
          <button type="button" onClick={addExistingRow} className="rounded-md border border-zinc-300 px-3 py-1.5">
            Add draft row
          </button>
        </div>

        <div className="space-y-2">
          <h4 className="font-medium text-zinc-900">Add row (new material)</h4>
          <select
            value={newMaterialGroupId}
            onChange={(event) => setNewMaterialGroupId(event.target.value)}
            className="w-full rounded-md border border-zinc-300 px-2 py-1.5"
          >
            {props.materialGroups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.label}
              </option>
            ))}
          </select>
          <input value={newMaterialDescription} onChange={(event) => setNewMaterialDescription(event.target.value)} placeholder="Description" className="w-full rounded-md border border-zinc-300 px-2 py-1.5" />
          <div className="grid grid-cols-2 gap-2">
            <input value={newMaterialThicknessMm} onChange={(event) => setNewMaterialThicknessMm(event.target.value)} placeholder="Thickness (mm)" className="rounded-md border border-zinc-300 px-2 py-1.5" />
            <input value={newMaterialWidthMm} onChange={(event) => setNewMaterialWidthMm(event.target.value)} placeholder="Width (mm)" className="rounded-md border border-zinc-300 px-2 py-1.5" />
            <input value={newMaterialLengthMm} onChange={(event) => setNewMaterialLengthMm(event.target.value)} placeholder="Length (mm)" className="rounded-md border border-zinc-300 px-2 py-1.5" />
            <input value={newMaterialGrade} onChange={(event) => setNewMaterialGrade(event.target.value)} placeholder="Grade" className="rounded-md border border-zinc-300 px-2 py-1.5" />
          </div>
          <input value={newMaterialTreatment} onChange={(event) => setNewMaterialTreatment(event.target.value)} placeholder="Treatment" className="w-full rounded-md border border-zinc-300 px-2 py-1.5" />
          <input type="number" min="0" step="any" value={newMaterialQty} onChange={(event) => setNewMaterialQty(event.target.value)} className="w-full rounded-md border border-zinc-300 px-2 py-1.5" placeholder="Counted quantity" />
          <select value={newMaterialLocationId} onChange={(event) => setNewMaterialLocationId(event.target.value)} className="w-full rounded-md border border-zinc-300 px-2 py-1.5">
            <option value="">No location</option>
            {props.stockLocations.map((location) => (
              <option key={location.id} value={location.id}>
                {formatLocationLabel(location)}
              </option>
            ))}
          </select>
          <textarea value={newMaterialNotes} onChange={(event) => setNewMaterialNotes(event.target.value)} className="w-full rounded-md border border-zinc-300 px-2 py-1.5" rows={2} placeholder="Notes" />
          <button type="button" onClick={addNewMaterialRow} className="rounded-md border border-zinc-300 px-3 py-1.5">
            Add new-material draft row
          </button>
        </div>
      </div>

      {feedback ? (
        <p className={`rounded-md border px-3 py-2 ${feedback.type === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-700"}`}>
          {feedback.message}
        </p>
      ) : null}

      <div className="overflow-x-auto rounded-md border border-zinc-200">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="px-2 py-2">Material Label</th>
              <th className="px-2 py-2">Qty</th>
              <th className="px-2 py-2">Location</th>
              <th className="px-2 py-2">Notes</th>
              <th className="px-2 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {draftRows.length === 0 ? (
              <tr>
                <td className="px-2 py-2 text-zinc-500" colSpan={5}>No entries recorded yet.</td>
              </tr>
            ) : (
              draftRows.map((row) => {
                const item = row.inventoryItemId ? inventoryItemById.get(row.inventoryItemId) : null;
                const isEditingRow = editingRowClientId === row.clientId;
                const activeRowBuffer = isEditingRow ? rowEditBuffer : null;
                const draftNewMaterial = row.newMaterial;
                const draftMaterialGroup = draftNewMaterial
                  ? props.materialGroups.find((group) => group.id === draftNewMaterial.materialGroupId)
                  : null;
                const draftPreviewLabel = draftNewMaterial
                  ? resolveInventoryItemNameCandidate({
                      name: draftNewMaterial.name,
                      timberSpec: draftNewMaterial.timberSpec,
                      selectedMaterialGroupKey: draftMaterialGroup?.key,
                      timberLabelMode: "auto",
                    })
                  : null;
                const materialLabel = draftNewMaterial
                  ? (draftPreviewLabel ?? `New material (${draftMaterialGroup?.label ?? "Unknown"})`)
                  : (item?.name ?? "—");
                const locationLabel = row.stockLocationId
                  ? formatLocationLabel(props.stockLocations.find((location) => location.id === row.stockLocationId) ?? { name: "Unknown location", code: null })
                  : "—";

                return (
                  <tr key={row.clientId} className="border-t border-zinc-100 align-top">
                    <td className="px-2 py-2">
                      {isEditingRow && activeRowBuffer ? (
                        row.newMaterial ? (
                          <span className="text-sm text-zinc-800">{materialLabel}</span>
                        ) : (
                          <select
                            value={activeRowBuffer.inventoryItemId ?? ""}
                            onChange={(event) =>
                              setRowEditBuffer((current) => (current ? { ...current, inventoryItemId: event.target.value || null } : current))
                            }
                            className="w-full rounded-md border border-zinc-300 px-2 py-1.5"
                          >
                            <option value="">Select material</option>
                            {inventoryItems.map((option) => (
                              <option key={option.id} value={option.id}>
                                {option.name} {option.item_code ? `(${option.item_code})` : ""}
                              </option>
                            ))}
                          </select>
                        )
                      ) : (
                        <span>{materialLabel}</span>
                      )}
                    </td>
                    <td className="px-2 py-2">
                      {isEditingRow && activeRowBuffer ? (
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={activeRowBuffer.countedQuantity}
                          onChange={(event) =>
                            setRowEditBuffer((current) => (current ? { ...current, countedQuantity: event.target.value } : current))
                          }
                          className="w-28 rounded-md border border-zinc-300 px-2 py-1.5"
                        />
                      ) : (
                        <span>{row.countedQuantity}</span>
                      )}
                    </td>
                    <td className="px-2 py-2">
                      {isEditingRow && activeRowBuffer ? (
                        <select
                          value={activeRowBuffer.stockLocationId}
                          onChange={(event) =>
                            setRowEditBuffer((current) => (current ? { ...current, stockLocationId: event.target.value } : current))
                          }
                          className="w-full rounded-md border border-zinc-300 px-2 py-1.5"
                        >
                          <option value="">No location</option>
                          {props.stockLocations.map((location) => (
                            <option key={location.id} value={location.id}>
                              {formatLocationLabel(location)}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span>{locationLabel}</span>
                      )}
                    </td>
                    <td className="px-2 py-2">
                      {isEditingRow && activeRowBuffer ? (
                        <input
                          value={activeRowBuffer.notes}
                          onChange={(event) =>
                            setRowEditBuffer((current) => (current ? { ...current, notes: event.target.value } : current))
                          }
                          className="w-full rounded-md border border-zinc-300 px-2 py-1.5"
                        />
                      ) : (
                        <span>{row.notes?.trim() ? row.notes : "—"}</span>
                      )}
                    </td>
                    <td className="px-2 py-2 align-middle">
                      <div className="flex items-center gap-1">
                        {isEditingRow ? (
                          <>
                            <button
                              type="button"
                              onClick={applyRowEditToDraft}
                              className="rounded-md border border-zinc-300 px-2 py-1 text-xs"
                              aria-label="Confirm row edits"
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              onClick={cancelRowEdit}
                              className="rounded-md border border-zinc-300 px-2 py-1 text-xs"
                              aria-label="Cancel row edits"
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => startRowEdit(row)}
                              className="rounded-md border border-zinc-300 px-2 py-1 text-xs"
                              aria-label="Edit row"
                            >
                              ✏️
                            </button>
                            <button
                              type="button"
                              onClick={() => copyRow(row)}
                              className="rounded-md border border-zinc-300 px-2 py-1 text-xs"
                              aria-label="Copy row"
                            >
                              📄
                            </button>
                            <button
                              type="button"
                              onClick={() => removeRow(row.clientId)}
                              className="rounded-md border border-zinc-300 px-2 py-1 text-xs"
                              aria-label="Delete row"
                            >
                              🗑️
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {props.canTransitionStatus && props.nextTransition ? (
        <form
          action={props.transitionAction}
          onSubmit={(event) => {
            if (!hasUnsavedChanges) return;
            event.preventDefault();
            setFeedback({
              type: "error",
              message: "Save or reset your draft changes before changing session status.",
            });
          }}
        >
          <input type="hidden" name="sessionId" value={props.sessionId} />
          <input type="hidden" name="transitionAction" value={props.nextTransition.action} />
          <button type="submit" className="rounded-md border border-zinc-300 px-3 py-1.5 text-zinc-800 hover:bg-zinc-100">
            {props.nextTransition.buttonLabel}
          </button>
        </form>
      ) : null}
    </div>
  );
}
