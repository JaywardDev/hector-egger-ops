"use client";

import { useEffect, useMemo, useState } from "react";
import {
  saveStockTakeSessionDraftAction,
  type SaveStockTakeSessionDraftActionInput,
} from "@/app/(protected)/stock-take/actions";
import { resolveInventoryItemNameCandidate } from "@/src/lib/inventory/item-labels";
import { Alert } from "@/src/components/ui/alert";
import { Card } from "@/src/components/ui/card";
import { Stack } from "@/src/components/layout/stack";
import { StockTakeAddExistingForm } from "@/app/(protected)/stock-take/[sessionId]/components/stock-take-add-existing-form";
import { StockTakeAddNewMaterialForm } from "@/app/(protected)/stock-take/[sessionId]/components/stock-take-add-new-material-form";
import { StockTakeDraftActions } from "@/app/(protected)/stock-take/[sessionId]/components/stock-take-draft-actions";
import { StockTakeEntriesTable } from "@/app/(protected)/stock-take/[sessionId]/components/stock-take-entries-table";
import { StockTakeFeedbackAlert } from "@/app/(protected)/stock-take/[sessionId]/components/stock-take-feedback-alert";
import { StockTakeSessionTransitionForm } from "@/app/(protected)/stock-take/[sessionId]/components/stock-take-session-transition-form";
import {
  type DraftRow,
  type EntryRow,
  type InventoryItemOption,
  type MaterialGroupOption,
  type RowEditBuffer,
  type StockLocationOption,
  toComparableRows,
  toDraftRows,
} from "@/app/(protected)/stock-take/[sessionId]/stock-take-session-detail-types";

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

export function StockTakeSessionDetailClient(props: Props) {
  const [inventoryItems, setInventoryItems] = useState(props.inventoryItems);
  const [baselineRows, setBaselineRows] = useState<DraftRow[]>(() =>
    toDraftRows(props.stockTakeEntries),
  );
  const [draftRows, setDraftRows] = useState<DraftRow[]>(() =>
    toDraftRows(props.stockTakeEntries),
  );
  const [selectedInventoryItemId, setSelectedInventoryItemId] = useState<
    string | null
  >(props.initialSelectedInventoryItemId);
  const [countedQuantity, setCountedQuantity] = useState("0");
  const [stockLocationId, setStockLocationId] = useState(
    props.defaultStockLocationId ?? "",
  );
  const [notes, setNotes] = useState("");
  const [newMaterialGroupId, setNewMaterialGroupId] = useState(
    props.materialGroups[0]?.id ?? "",
  );
  const [newMaterialDescription, setNewMaterialDescription] = useState("");
  const [newMaterialQty, setNewMaterialQty] = useState("0");
  const [newMaterialLocationId, setNewMaterialLocationId] = useState(
    props.defaultStockLocationId ?? "",
  );
  const [newMaterialNotes, setNewMaterialNotes] = useState("");
  const [newMaterialThicknessMm, setNewMaterialThicknessMm] = useState("");
  const [newMaterialWidthMm, setNewMaterialWidthMm] = useState("");
  const [newMaterialLengthMm, setNewMaterialLengthMm] = useState("");
  const [newMaterialGrade, setNewMaterialGrade] = useState("");
  const [newMaterialTreatment, setNewMaterialTreatment] = useState("");
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [editingRowClientId, setEditingRowClientId] = useState<string | null>(
    null,
  );
  const [rowEditBuffer, setRowEditBuffer] = useState<RowEditBuffer | null>(null);

  const baselineSnapshot = useMemo(
    () => JSON.stringify(toComparableRows(baselineRows)),
    [baselineRows],
  );
  const draftSnapshot = useMemo(
    () => JSON.stringify(toComparableRows(draftRows)),
    [draftRows],
  );
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
  const rowBeingEdited = useMemo(
    () =>
      editingRowClientId
        ? draftRows.find((row) => row.clientId === editingRowClientId) ?? null
        : null,
    [draftRows, editingRowClientId],
  );
  const editingRowLabel = useMemo(
    () =>
      rowBeingEdited
        ? describeEditingRowLabel(rowBeingEdited, inventoryItemById, props.materialGroups)
        : null,
    [inventoryItemById, props.materialGroups, rowBeingEdited],
  );

  const addExistingRow = () => {
    const qty = Number(countedQuantity);
    if (!selectedInventoryItemId || !Number.isFinite(qty) || qty < 0) {
      setFeedback({
        type: "error",
        message: "Select a material and provide a valid quantity.",
      });
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
      setFeedback({
        type: "error",
        message: "Provide a valid group and quantity for the new material row.",
      });
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
          ...result.createdInventoryItems
            .filter((item) => !existing.has(item.id))
            .map((item) => ({
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
      setFeedback({
        type: "error",
        message: "Provide a valid quantity before confirming row edits.",
      });
      return;
    }

    const rowBeingEdited = draftRows.find((row) => row.clientId === editingRowClientId);
    if (!rowBeingEdited) {
      cancelRowEdit();
      return;
    }

    if (!rowBeingEdited.newMaterial && !rowEditBuffer.inventoryItemId) {
      setFeedback({
        type: "error",
        message: "Select a material before confirming row edits.",
      });
      return;
    }

    updateRow(editingRowClientId, {
      inventoryItemId: rowBeingEdited.newMaterial
        ? rowBeingEdited.inventoryItemId
        : rowEditBuffer.inventoryItemId,
      countedQuantity: qty,
      stockLocationId: rowEditBuffer.stockLocationId || null,
      notes: rowEditBuffer.notes.trim() ? rowEditBuffer.notes.trim() : null,
    });
    setEditingRowClientId(null);
    setRowEditBuffer(null);
    setFeedback(null);
  };

  return (
    <Card>
      <Stack gap="md">
        <StockTakeDraftActions
          onSave={saveChanges}
          onReset={resetChanges}
          hasUnsavedChanges={hasUnsavedChanges}
          isSaving={isSaving}
          canEnterCounts={props.canEnterCounts}
          isEntryOpen={props.isEntryOpen}
        />

        <div className="grid gap-3 border-t border-zinc-200 pt-3 md:grid-cols-2">
          <StockTakeAddExistingForm
            inventoryItems={inventoryItems}
            stockLocations={props.stockLocations}
            selectedInventoryItemId={selectedInventoryItemId}
            countedQuantity={countedQuantity}
            stockLocationId={stockLocationId}
            notes={notes}
            onSelectedInventoryItemIdChange={setSelectedInventoryItemId}
            onCountedQuantityChange={setCountedQuantity}
            onStockLocationIdChange={setStockLocationId}
            onNotesChange={setNotes}
            onSubmit={addExistingRow}
          />

          <StockTakeAddNewMaterialForm
            materialGroups={props.materialGroups}
            stockLocations={props.stockLocations}
            newMaterialGroupId={newMaterialGroupId}
            newMaterialDescription={newMaterialDescription}
            newMaterialThicknessMm={newMaterialThicknessMm}
            newMaterialWidthMm={newMaterialWidthMm}
            newMaterialLengthMm={newMaterialLengthMm}
            newMaterialGrade={newMaterialGrade}
            newMaterialTreatment={newMaterialTreatment}
            newMaterialQty={newMaterialQty}
            newMaterialLocationId={newMaterialLocationId}
            newMaterialNotes={newMaterialNotes}
            onMaterialGroupIdChange={setNewMaterialGroupId}
            onDescriptionChange={setNewMaterialDescription}
            onThicknessMmChange={setNewMaterialThicknessMm}
            onWidthMmChange={setNewMaterialWidthMm}
            onLengthMmChange={setNewMaterialLengthMm}
            onGradeChange={setNewMaterialGrade}
            onTreatmentChange={setNewMaterialTreatment}
            onQuantityChange={setNewMaterialQty}
            onLocationChange={setNewMaterialLocationId}
            onNotesChange={setNewMaterialNotes}
            onSubmit={addNewMaterialRow}
          />
        </div>

        <StockTakeFeedbackAlert feedback={feedback} />

        <StockTakeEntriesTable
          draftRows={draftRows}
          inventoryItems={inventoryItems}
          inventoryItemById={inventoryItemById}
          materialGroups={props.materialGroups}
          stockLocations={props.stockLocations}
          editingRowClientId={editingRowClientId}
          rowEditBuffer={rowEditBuffer}
          onRowEditBufferChange={setRowEditBuffer}
          onStartRowEdit={startRowEdit}
          onApplyRowEdit={applyRowEditToDraft}
          onCancelRowEdit={cancelRowEdit}
          onCopyRow={copyRow}
          onRemoveRow={removeRow}
        />
        {editingRowClientId && editingRowLabel ? (
          <Alert variant="info">
            Editing row in progress: <span className="font-medium">{editingRowLabel}</span>
          </Alert>
        ) : null}

        {props.canTransitionStatus && props.nextTransition ? (
          <StockTakeSessionTransitionForm
            sessionId={props.sessionId}
            hasUnsavedChanges={hasUnsavedChanges}
            nextTransition={props.nextTransition}
            transitionAction={props.transitionAction}
            onUnsavedBlocked={() =>
              setFeedback({
                type: "error",
                message:
                  "Save or reset your draft changes before changing session status.",
              })
            }
          />
        ) : null}
      </Stack>
    </Card>
  );
}

function describeEditingRowLabel(
  row: DraftRow,
  inventoryItemById: Map<string, InventoryItemOption>,
  materialGroups: MaterialGroupOption[],
) {
  if (!row.newMaterial) {
    return row.inventoryItemId ? inventoryItemById.get(row.inventoryItemId)?.name ?? "Material" : "Material";
  }

  const materialGroup = materialGroups.find((group) => group.id === row.newMaterial?.materialGroupId);
  const previewLabel = resolveInventoryItemNameCandidate({
    name: row.newMaterial.name,
    timberSpec: row.newMaterial.timberSpec,
    selectedMaterialGroupKey: materialGroup?.key,
    timberLabelMode: "auto",
  });
  return previewLabel ?? `New material (${materialGroup?.label ?? "Unknown"})`;
}
