"use client";

import { useEffect, useState } from "react";
import { resolveInventoryItemNameCandidate } from "@/src/lib/inventory/item-labels";
import { BottomSheet } from "@/src/components/ui/bottom-sheet";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Select } from "@/src/components/ui/select";
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
  onRowEditBufferChange,
  onStartRowEdit,
  onApplyRowEdit,
  onCancelRowEdit,
  onCopyRow,
  onRemoveRow,
}: StockTakeEntriesTableProps) {
  const [isMobileViewport, setIsMobileViewport] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 639px)");
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

  return (
    <div className="space-y-2">
      <p className="text-xs text-zinc-500 sm:hidden">
        Browse rows in the table. Tap Edit to open a focused editor.
      </p>
      <div className="overflow-x-auto rounded-md border border-zinc-200">
        <table className="min-w-[860px] w-full text-left text-sm">
          <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="px-3 py-2">Material Label</th>
              <th className="px-3 py-2">Qty</th>
              <th className="px-3 py-2">Location</th>
              <th className="px-3 py-2">Notes</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {draftRows.length === 0 ? (
              <tr>
                <td className="px-3 py-3 text-zinc-500" colSpan={5}>
                  No entries recorded yet.
                </td>
              </tr>
            ) : (
              draftRows.map((row) => {
                const item = row.inventoryItemId
                  ? inventoryItemById.get(row.inventoryItemId)
                  : null;
                const isEditingRow = editingRowClientId === row.clientId;
                const activeRowBuffer = isEditingRow ? rowEditBuffer : null;
                const shouldInlineEdit = isEditingRow && Boolean(activeRowBuffer) && !isMobileViewport;
                const draftNewMaterial = row.newMaterial;
                const draftMaterialGroup = draftNewMaterial
                  ? materialGroups.find(
                      (group) => group.id === draftNewMaterial.materialGroupId,
                    )
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
                  ? draftPreviewLabel ??
                    `New material (${draftMaterialGroup?.label ?? "Unknown"})`
                  : item?.name ?? "—";
                const locationLabel = row.stockLocationId
                  ? formatLocationLabel(
                      stockLocations.find(
                        (location) => location.id === row.stockLocationId,
                      ) ?? { name: "Unknown location", code: null },
                    )
                  : "—";

                return (
                  <tr
                    key={row.clientId}
                    className="border-t border-zinc-100 align-top data-[editing=true]:bg-blue-50/30"
                    data-editing={shouldInlineEdit}
                  >
                    <td className="min-w-56 px-3 py-3">
                      {shouldInlineEdit && activeRowBuffer ? (
                        row.newMaterial ? (
                          <span className="text-sm text-zinc-800">{materialLabel}</span>
                        ) : (
                          <Select
                            value={activeRowBuffer.inventoryItemId ?? ""}
                            onChange={(event) =>
                              onRowEditBufferChange((current) =>
                                current
                                  ? {
                                      ...current,
                                      inventoryItemId: event.target.value || null,
                                    }
                                  : current,
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
                    <td className="min-w-28 px-3 py-3">
                      {shouldInlineEdit && activeRowBuffer ? (
                        <Input
                          type="number"
                          min="0"
                          step="any"
                          value={activeRowBuffer.countedQuantity}
                          onChange={(event) =>
                            onRowEditBufferChange((current) =>
                              current
                                ? {
                                    ...current,
                                    countedQuantity: event.target.value,
                                  }
                                : current,
                            )
                          }
                          className="w-28 min-h-10"
                        />
                      ) : (
                        <span>{row.countedQuantity}</span>
                      )}
                    </td>
                    <td className="min-w-44 px-3 py-3">
                      {shouldInlineEdit && activeRowBuffer ? (
                        <Select
                          value={activeRowBuffer.stockLocationId}
                          onChange={(event) =>
                            onRowEditBufferChange((current) =>
                              current
                                ? {
                                    ...current,
                                    stockLocationId: event.target.value,
                                  }
                                : current,
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
                        <span>{locationLabel}</span>
                      )}
                    </td>
                    <td className="min-w-56 px-3 py-3">
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
                    <td className="min-w-72 px-3 py-3 align-middle">
                      <StockTakeEntryRowActions
                        isEditingRow={isEditingRow}
                        isMobileViewport={isMobileViewport}
                        onApplyRowEdit={onApplyRowEdit}
                        onCancelRowEdit={onCancelRowEdit}
                        onStartRowEdit={() => onStartRowEdit(row)}
                        onCopyRow={() => onCopyRow(row)}
                        onRemoveRow={() => onRemoveRow(row.clientId)}
                      />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <BottomSheet
        open={Boolean(showMobileEditSheet)}
        title="Edit row"
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

type StockTakeEntryRowActionsProps = {
  isEditingRow: boolean;
  isMobileViewport: boolean;
  onApplyRowEdit: () => void;
  onCancelRowEdit: () => void;
  onStartRowEdit: () => void;
  onCopyRow: () => void;
  onRemoveRow: () => void;
};

function StockTakeEntryRowActions({
  isEditingRow,
  isMobileViewport,
  onApplyRowEdit,
  onCancelRowEdit,
  onStartRowEdit,
  onCopyRow,
  onRemoveRow,
}: StockTakeEntryRowActionsProps) {
  const showInlineEditActions = isEditingRow && !isMobileViewport;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {showInlineEditActions ? (
        <>
          <Button
            onClick={onApplyRowEdit}
            size="sm"
            className="min-h-9 px-3"
            aria-label="Confirm row edits"
          >
            Save row
          </Button>
          <Button
            onClick={onCancelRowEdit}
            variant="secondary"
            size="sm"
            className="min-h-9 px-3"
            aria-label="Cancel row edits"
          >
            Cancel edit
          </Button>
        </>
      ) : (
        <>
          <Button
            onClick={onStartRowEdit}
            size="sm"
            className="min-h-9 px-3"
            aria-label="Edit row"
          >
            Edit
          </Button>
          <Button
            onClick={onCopyRow}
            variant="secondary"
            size="sm"
            className="min-h-9 px-3"
            aria-label="Copy row"
          >
            Copy
          </Button>
          <Button
            onClick={onRemoveRow}
            variant="danger"
            size="sm"
            className="min-h-9 px-3"
            aria-label="Delete row"
          >
            Delete
          </Button>
        </>
      )}
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
              current
                ? {
                    ...current,
                    inventoryItemId: event.target.value || null,
                  }
                : current,
            )
          }
          className="min-h-11"
        >
          <option value="">Select material</option>
          {inventoryItems.map((option) => (
            <option key={option.id} value={option.id}>
              {option.name} {option.item_code ? `(${option.item_code})` : ""}
            </option>
          ))}
        </Select>
      )}

      <Input
        type="number"
        min="0"
        step="any"
        value={rowEditBuffer.countedQuantity}
        onChange={(event) =>
          onRowEditBufferChange((current) =>
            current
              ? {
                  ...current,
                  countedQuantity: event.target.value,
                }
              : current,
          )
        }
        className="min-h-11"
        aria-label="Counted quantity"
      />

      <Select
        value={rowEditBuffer.stockLocationId}
        onChange={(event) =>
          onRowEditBufferChange((current) =>
            current
              ? {
                  ...current,
                  stockLocationId: event.target.value,
                }
              : current,
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
        <Button type="button" className="min-h-11 px-4" onClick={onApplyRowEdit}>
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
    return row.inventoryItemId ? inventoryItemById.get(row.inventoryItemId)?.name ?? "Material" : "Material";
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
