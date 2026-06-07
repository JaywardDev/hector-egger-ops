"use client";

import { useEffect, useRef, useState } from "react";
import { resolveInventoryItemNameCandidate } from "@/src/lib/inventory/item-labels";
import { BottomSheet } from "@/src/components/ui/bottom-sheet";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Select } from "@/src/components/ui/select";
import { formatStockTakeEntryMappingCode } from "@/src/lib/stock-take/entry-mapping";
import { cn } from "@/src/lib/utils";
import type {
  DraftRow,
  InventoryItemOption,
  MaterialGroupOption,
  RowEditBuffer,
  StockLocationOption,
} from "@/app/(protected)/stock-take/[sessionId]/stock-take-session-detail-types";
import { formatLocationLabel } from "@/app/(protected)/stock-take/[sessionId]/stock-take-session-detail-types";

type StockTakeEntriesTableProps = {
  draftRows: DraftRow[];
  inventoryItems: InventoryItemOption[];
  inventoryItemById: Map<string, InventoryItemOption>;
  materialGroups: MaterialGroupOption[];
  stockLocations: StockLocationOption[];
  editingRowClientId: string | null;
  rowEditBuffer: RowEditBuffer | null;
  flashRowClientId: string | null;
  onRowEditBufferChange: (updater: (current: RowEditBuffer | null) => RowEditBuffer | null) => void;
  onStartRowEdit: (row: DraftRow) => void;
  onApplyRowEdit: () => void;
  onCancelRowEdit: () => void;
  onCopyRow: (row: DraftRow) => void;
  onRemoveRow: (rowClientId: string) => void;
};

export function StockTakeEntriesTable({
  draftRows,
  inventoryItems,
  inventoryItemById,
  materialGroups,
  stockLocations,
  editingRowClientId,
  rowEditBuffer,
  flashRowClientId,
  onRowEditBufferChange,
  onStartRowEdit,
  onApplyRowEdit,
  onCancelRowEdit,
  onCopyRow,
  onRemoveRow,
}: StockTakeEntriesTableProps) {
  const [isMobileViewport, setIsMobileViewport] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 767px)");
    const syncViewport = (event?: MediaQueryListEvent) => {
      setIsMobileViewport(event ? event.matches : mediaQuery.matches);
    };

    syncViewport();

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", syncViewport);
      return () => mediaQuery.removeEventListener("change", syncViewport);
    }

    mediaQuery.addListener(syncViewport);
    return () => mediaQuery.removeListener(syncViewport);
  }, []);

  const rowBeingEdited = editingRowClientId
    ? draftRows.find((row) => row.clientId === editingRowClientId) ?? null
    : null;
  const showMobileEditSheet = isMobileViewport && rowBeingEdited && rowEditBuffer;

  const resolveRowLabels = (row: DraftRow) => {
    const item = row.inventoryItemId ? inventoryItemById.get(row.inventoryItemId) : null;
    const draftNewMaterial = row.newMaterial;
    const draftMaterialGroup = draftNewMaterial
      ? materialGroups.find((group) => group.id === draftNewMaterial.materialGroupId)
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
      ? draftPreviewLabel ?? `New material (${draftMaterialGroup?.label ?? "Unknown"})`
      : item?.name ?? "—";
    const locationLabel = row.stockLocationId
      ? formatLocationLabel(
          stockLocations.find((loc) => loc.id === row.stockLocationId) ?? { name: "Unknown", code: null },
        )
      : null;
    const mappingCode = formatStockTakeEntryMappingCode({ bay: row.bay, level: row.level });
    return { item, materialLabel, locationLabel, mappingCode };
  };

  return (
    <div className="space-y-2">
      {isMobileViewport ? (
        /* Card list for mobile and tablet (< 768px) */
        <div className="space-y-2">
          {draftRows.length === 0 ? (
            <p className="py-3 text-zinc-500">No entries recorded yet.</p>
          ) : (
            draftRows.map((row) => {
              const { item, materialLabel, locationLabel, mappingCode } = resolveRowLabels(row);
              const isEditing = editingRowClientId === row.clientId;
              const isFlashing = flashRowClientId === row.clientId;
              const secondaryParts = [locationLabel, mappingCode || null].filter(Boolean);

              return (
                <div
                  key={row.clientId}
                  className={cn(
                    "rounded-md border bg-white transition-colors duration-700",
                    isEditing ? "border-blue-200 bg-blue-50" : isFlashing ? "border-green-300 bg-green-50" : "border-zinc-200",
                  )}
                >
                  {/* Tappable content area */}
                  <button
                    type="button"
                    className="w-full p-3 text-left"
                    onClick={() => onStartRowEdit(row)}
                    aria-label={`Edit ${materialLabel}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-zinc-900">{materialLabel}</p>
                        {secondaryParts.length > 0 ? (
                          <p className="mt-0.5 text-xs text-zinc-500">{secondaryParts.join(" · ")}</p>
                        ) : (
                          <p className="mt-0.5 text-xs text-zinc-400">No location</p>
                        )}
                        {row.notes ? (
                          <p className="mt-0.5 truncate text-xs text-zinc-400">{row.notes}</p>
                        ) : null}
                      </div>
                      <div className="shrink-0 text-right">
                        <span className="text-2xl font-bold leading-none text-zinc-900">
                          {row.countedQuantity}
                        </span>
                        {item?.unit ? (
                          <p className="mt-0.5 text-xs text-zinc-400">{item.unit}</p>
                        ) : null}
                      </div>
                    </div>
                  </button>

                  {/* Action row */}
                  <div className="flex items-center divide-x divide-zinc-100 border-t border-zinc-100">
                    <button
                      type="button"
                      onClick={() => onStartRowEdit(row)}
                      className="flex-1 py-2 text-center text-xs font-medium text-zinc-700 hover:bg-zinc-50 active:bg-zinc-100"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => onCopyRow(row)}
                      className="px-5 py-2 text-xs text-zinc-600 hover:bg-zinc-50 active:bg-zinc-100"
                    >
                      Copy
                    </button>
                    <button
                      type="button"
                      onClick={() => onRemoveRow(row.clientId)}
                      className="px-5 py-2 text-xs text-red-600 hover:bg-red-50 active:bg-red-100"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      ) : (
        /* Table for desktop (≥ 768px) */
        <div className="overflow-x-auto rounded-md border border-zinc-200">
          <table className="min-w-[860px] w-full text-left text-sm">
            <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-3 py-2">Material</th>
                <th className="px-3 py-2">Qty</th>
                <th className="px-3 py-2">Location</th>
                <th className="px-3 py-2">Bay / Level</th>
                <th className="px-3 py-2">Notes</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {draftRows.length === 0 ? (
                <tr>
                  <td className="px-3 py-3 text-zinc-500" colSpan={6}>
                    No entries recorded yet.
                  </td>
                </tr>
              ) : (
                draftRows.map((row) => {
                  const { item, materialLabel, locationLabel, mappingCode } = resolveRowLabels(row);
                  const isEditingRow = editingRowClientId === row.clientId;
                  const activeRowBuffer = isEditingRow ? rowEditBuffer : null;
                  const shouldInlineEdit = isEditingRow && Boolean(activeRowBuffer);
                  const isFlashing = flashRowClientId === row.clientId;

                  return (
                    <tr
                      key={row.clientId}
                      className={cn(
                        "border-t border-zinc-100 align-top transition-colors duration-700",
                        shouldInlineEdit ? "bg-blue-50/30" : isFlashing ? "bg-green-50" : "",
                      )}
                    >
                      <td className="min-w-52 px-3 py-3">
                        {shouldInlineEdit && activeRowBuffer ? (
                          row.newMaterial ? (
                            <span className="text-sm text-zinc-800">{materialLabel}</span>
                          ) : (
                            <Select
                              value={activeRowBuffer.inventoryItemId ?? ""}
                              onChange={(event) =>
                                onRowEditBufferChange((current) =>
                                  current ? { ...current, inventoryItemId: event.target.value || null } : current,
                                )
                              }
                              className="min-h-10"
                            >
                              <option value="">Select material</option>
                              {inventoryItems.map((option) => (
                                <option key={option.id} value={option.id}>
                                  {option.name} {option.item_code ? `(${option.item_code})` : ""}
                                </option>
                              ))}
                            </Select>
                          )
                        ) : (
                          <span>{materialLabel}</span>
                        )}
                      </td>
                      <td className="min-w-24 px-3 py-3">
                        {shouldInlineEdit && activeRowBuffer ? (
                          <Input
                            type="number"
                            min="0"
                            step="any"
                            value={activeRowBuffer.countedQuantity}
                            onChange={(event) =>
                              onRowEditBufferChange((current) =>
                                current ? { ...current, countedQuantity: event.target.value } : current,
                              )
                            }
                            className="w-24 min-h-10"
                          />
                        ) : (
                          <span>
                            {row.countedQuantity}
                            {item?.unit ? <span className="ml-1 text-xs text-zinc-400">{item.unit}</span> : null}
                          </span>
                        )}
                      </td>
                      <td className="min-w-40 px-3 py-3">
                        {shouldInlineEdit && activeRowBuffer ? (
                          <Select
                            value={activeRowBuffer.stockLocationId}
                            onChange={(event) =>
                              onRowEditBufferChange((current) =>
                                current ? { ...current, stockLocationId: event.target.value } : current,
                              )
                            }
                            className="min-h-10"
                          >
                            <option value="">No location</option>
                            {stockLocations.map((location) => (
                              <option key={location.id} value={location.id}>
                                {formatLocationLabel(location)}
                              </option>
                            ))}
                          </Select>
                        ) : (
                          <span>{locationLabel ?? "—"}</span>
                        )}
                      </td>
                      <td className="min-w-32 px-3 py-3">
                        {shouldInlineEdit && activeRowBuffer ? (
                          <div className="grid grid-cols-2 gap-2">
                            <Input
                              value={activeRowBuffer.bay}
                              onChange={(event) =>
                                onRowEditBufferChange((current) =>
                                  current ? { ...current, bay: event.target.value } : current,
                                )
                              }
                              className="min-h-10"
                              placeholder="Bay"
                            />
                            <Input
                              value={activeRowBuffer.level}
                              onChange={(event) =>
                                onRowEditBufferChange((current) =>
                                  current ? { ...current, level: event.target.value } : current,
                                )
                              }
                              className="min-h-10"
                              placeholder="Level"
                            />
                          </div>
                        ) : (
                          <span>{mappingCode || "—"}</span>
                        )}
                      </td>
                      <td className="min-w-48 px-3 py-3">
                        {shouldInlineEdit && activeRowBuffer ? (
                          <Input
                            value={activeRowBuffer.notes}
                            onChange={(event) =>
                              onRowEditBufferChange((current) =>
                                current ? { ...current, notes: event.target.value } : current,
                              )
                            }
                            className="min-h-10"
                          />
                        ) : (
                          <span className="text-zinc-700">{row.notes?.trim() ? row.notes : "—"}</span>
                        )}
                      </td>
                      <td className="min-w-56 px-3 py-3 align-middle">
                        <div className="flex flex-wrap items-center gap-2">
                          {shouldInlineEdit ? (
                            <>
                              <Button onClick={onApplyRowEdit} size="sm" className="min-h-9 px-3">
                                Save row
                              </Button>
                              <Button
                                onClick={onCancelRowEdit}
                                variant="secondary"
                                size="sm"
                                className="min-h-9 px-3"
                              >
                                Cancel
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button onClick={() => onStartRowEdit(row)} size="sm" className="min-h-9 px-3">
                                Edit
                              </Button>
                              <Button
                                onClick={() => onCopyRow(row)}
                                variant="secondary"
                                size="sm"
                                className="min-h-9 px-3"
                              >
                                Copy
                              </Button>
                              <Button
                                onClick={() => onRemoveRow(row.clientId)}
                                variant="danger"
                                size="sm"
                                className="min-h-9 px-3"
                              >
                                Delete
                              </Button>
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
      )}

      <BottomSheet
        open={Boolean(showMobileEditSheet)}
        title="Edit entry"
        description={rowBeingEdited ? describeRowForEdit(rowBeingEdited, inventoryItemById, materialGroups) : undefined}
        onClose={onCancelRowEdit}
      >
        {showMobileEditSheet && rowBeingEdited ? (
          <MobileRowEditForm
            row={rowBeingEdited}
            rowEditBuffer={rowEditBuffer}
            inventoryItems={inventoryItems}
            materialGroups={materialGroups}
            stockLocations={stockLocations}
            onRowEditBufferChange={onRowEditBufferChange}
            onApplyRowEdit={onApplyRowEdit}
            onCancelRowEdit={onCancelRowEdit}
          />
        ) : null}
      </BottomSheet>
    </div>
  );
}

type MobileRowEditFormProps = {
  row: DraftRow;
  rowEditBuffer: RowEditBuffer;
  inventoryItems: InventoryItemOption[];
  materialGroups: MaterialGroupOption[];
  stockLocations: StockLocationOption[];
  onRowEditBufferChange: (updater: (current: RowEditBuffer | null) => RowEditBuffer | null) => void;
  onApplyRowEdit: () => void;
  onCancelRowEdit: () => void;
};

function MobileRowEditForm({
  row,
  rowEditBuffer,
  inventoryItems,
  materialGroups,
  stockLocations,
  onRowEditBufferChange,
  onApplyRowEdit,
  onCancelRowEdit,
}: MobileRowEditFormProps) {
  const qtyInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      qtyInputRef.current?.focus();
      qtyInputRef.current?.select();
    }, 60);
    return () => clearTimeout(timer);
  }, []);

  const draftMaterialGroup = row.newMaterial
    ? materialGroups.find((group) => group.id === row.newMaterial?.materialGroupId)
    : null;
  const draftPreviewLabel = row.newMaterial
    ? resolveInventoryItemNameCandidate({
        name: row.newMaterial.name,
        timberSpec: row.newMaterial.timberSpec,
        selectedMaterialGroupKey: draftMaterialGroup?.key,
        timberLabelMode: "auto",
      })
    : null;

  return (
    <div className="space-y-4">
      {row.newMaterial ? (
        <div className="rounded-md bg-zinc-100 px-3 py-2 text-sm text-zinc-700">
          {draftPreviewLabel ?? `New material (${draftMaterialGroup?.label ?? "Unknown"})`}
        </div>
      ) : (
        <Select
          value={rowEditBuffer.inventoryItemId ?? ""}
          onChange={(event) =>
            onRowEditBufferChange((current) =>
              current ? { ...current, inventoryItemId: event.target.value || null } : current,
            )
          }
          className="min-h-11"
          aria-label="Material"
        >
          <option value="">Select material</option>
          {inventoryItems.map((option) => (
            <option key={option.id} value={option.id}>
              {option.name} {option.item_code ? `(${option.item_code})` : ""}
            </option>
          ))}
        </Select>
      )}

      <div>
        <label className="mb-1 block text-xs font-medium text-zinc-600">Counted quantity</label>
        <input
          ref={qtyInputRef}
          type="number"
          inputMode="decimal"
          min="0"
          step="any"
          value={rowEditBuffer.countedQuantity}
          onChange={(event) =>
            onRowEditBufferChange((current) =>
              current ? { ...current, countedQuantity: event.target.value } : current,
            )
          }
          className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-2xl font-bold text-zinc-900 outline-none ring-0 focus:border-zinc-400 min-h-14"
          aria-label="Counted quantity"
        />
      </div>

      <Select
        value={rowEditBuffer.stockLocationId}
        onChange={(event) =>
          onRowEditBufferChange((current) =>
            current ? { ...current, stockLocationId: event.target.value } : current,
          )
        }
        className="min-h-11"
        aria-label="Stock location"
      >
        <option value="">No location</option>
        {stockLocations.map((location) => (
          <option key={location.id} value={location.id}>
            {formatLocationLabel(location)}
          </option>
        ))}
      </Select>

      <div className="grid grid-cols-2 gap-2">
        <Input
          value={rowEditBuffer.bay}
          onChange={(event) =>
            onRowEditBufferChange((current) =>
              current ? { ...current, bay: event.target.value } : current,
            )
          }
          className="min-h-11"
          placeholder="Bay"
          aria-label="Bay"
        />
        <Input
          value={rowEditBuffer.level}
          onChange={(event) =>
            onRowEditBufferChange((current) =>
              current ? { ...current, level: event.target.value } : current,
            )
          }
          className="min-h-11"
          placeholder="Level"
          aria-label="Level"
        />
      </div>

      <Input
        value={rowEditBuffer.notes}
        onChange={(event) =>
          onRowEditBufferChange((current) =>
            current ? { ...current, notes: event.target.value } : current,
          )
        }
        className="min-h-11"
        placeholder="Notes"
        aria-label="Notes"
      />

      <div className="flex items-center justify-end gap-2 pt-2">
        <Button type="button" variant="secondary" className="min-h-11 px-4" onClick={onCancelRowEdit}>
          Cancel
        </Button>
        <Button type="button" variant="primary" className="min-h-11 flex-1" onClick={onApplyRowEdit}>
          Save row
        </Button>
      </div>
    </div>
  );
}

function describeRowForEdit(
  row: DraftRow,
  inventoryItemById: Map<string, InventoryItemOption>,
  materialGroups: MaterialGroupOption[],
) {
  if (!row.newMaterial) {
    return row.inventoryItemId
      ? inventoryItemById.get(row.inventoryItemId)?.name ?? "Material"
      : "Material";
  }

  const group = materialGroups.find((item) => item.id === row.newMaterial?.materialGroupId);
  const previewLabel = resolveInventoryItemNameCandidate({
    name: row.newMaterial.name,
    timberSpec: row.newMaterial.timberSpec,
    selectedMaterialGroupKey: group?.key,
    timberLabelMode: "auto",
  });

  return previewLabel ?? `New material (${group?.label ?? "Unknown"})`;
}
