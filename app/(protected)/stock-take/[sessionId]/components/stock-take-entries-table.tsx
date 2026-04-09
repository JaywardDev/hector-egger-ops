import { resolveInventoryItemNameCandidate } from "@/src/lib/inventory/item-labels";
import { Badge } from "@/src/components/ui/badge";
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
  return (
    <div className="space-y-2">
      <p className="text-xs text-zinc-500 sm:hidden">
        Scroll horizontally to view all entry columns and row actions.
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
                    data-editing={isEditingRow}
                  >
                    <td className="min-w-56 px-3 py-3">
                      <div className="space-y-2">
                        {isEditingRow ? (
                          <Badge variant="info" className="w-fit">
                            Editing row
                          </Badge>
                        ) : null}
                        {isEditingRow && activeRowBuffer ? (
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
                      </div>
                    </td>
                    <td className="min-w-28 px-3 py-3">
                      {isEditingRow && activeRowBuffer ? (
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
                      {isEditingRow && activeRowBuffer ? (
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
                      {isEditingRow && activeRowBuffer ? (
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
    </div>
  );
}

type StockTakeEntryRowActionsProps = {
  isEditingRow: boolean;
  onApplyRowEdit: () => void;
  onCancelRowEdit: () => void;
  onStartRowEdit: () => void;
  onCopyRow: () => void;
  onRemoveRow: () => void;
};

function StockTakeEntryRowActions({
  isEditingRow,
  onApplyRowEdit,
  onCancelRowEdit,
  onStartRowEdit,
  onCopyRow,
  onRemoveRow,
}: StockTakeEntryRowActionsProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {isEditingRow ? (
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
