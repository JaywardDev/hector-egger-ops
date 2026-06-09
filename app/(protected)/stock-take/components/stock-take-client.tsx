"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { Alert } from "@/src/components/ui/alert";
import { Button } from "@/src/components/ui/button";
import { Card } from "@/src/components/ui/card";
import { FormField } from "@/src/components/ui/form-field";
import { Input } from "@/src/components/ui/input";
import { PendingSubmitButton } from "@/src/components/ui/pending-button";
import { Select } from "@/src/components/ui/select";
import {
  ADD_MATERIAL_FIELDS,
  UPDATE_STOCK_LABEL,
  WORKING_LIST_HEADERS,
} from "@/src/lib/stock-take/ui-contract";
import {
  countChangedStockTakeRows,
  generateTimberMaterialName,
  rowMatchesStockTakeSearch,
} from "@/src/lib/stock-take/validation";
import type {
  StockAreaRecord,
  TimberMaterialRecord,
  TimberStockWorkingRow,
} from "@/src/lib/stock-take/types";
import {
  createStockAreaAction,
  createTimberMaterialAction,
  updateTimberStockAction,
  type StockTakeActionState,
} from "../actions";

type DraftRow = {
  key: string;
  timberMaterialId: string;
  bay: string;
  level: string;
  quantity: string;
  persisted: boolean;
};

type StockTakeClientProps = {
  areas: StockAreaRecord[];
  materials: TimberMaterialRecord[];
  initialAreaId: string;
  initialRows: TimberStockWorkingRow[];
};

const initialActionState: StockTakeActionState = { ok: false, message: "" };

const toDraftRows = (rows: TimberStockWorkingRow[]): DraftRow[] =>
  rows.map((row) => ({
    key: row.id,
    timberMaterialId: row.timber_material_id,
    bay: row.bay,
    level: row.level,
    quantity: String(row.quantity),
    persisted: true,
  }));

const materialNameById = (materials: TimberMaterialRecord[]) =>
  new Map(materials.map((material) => [material.id, material.name]));

function ActionMessage({ state }: { state: StockTakeActionState }) {
  if (!state.message) {
    return null;
  }
  return <Alert variant={state.ok ? "success" : "error"}>{state.message}</Alert>;
}

export function StockTakeClient({
  areas,
  materials,
  initialAreaId,
  initialRows,
}: StockTakeClientProps) {
  const [selectedAreaId, setSelectedAreaId] = useState(initialAreaId);
  const [rows, setRows] = useState<DraftRow[]>(toDraftRows(initialRows));
  const [loadedRows, setLoadedRows] = useState<DraftRow[]>(toDraftRows(initialRows));
  const [localMaterials, setLocalMaterials] = useState<TimberMaterialRecord[]>(materials);
  const [search, setSearch] = useState("");
  const [focusRowKey, setFocusRowKey] = useState<string | null>(null);
  const focusedRowKeys = useRef(new Set<string>());
  const rowsRef = useRef(rows);
  const [areaState, addAreaAction] = useActionState(createStockAreaAction, initialActionState);
  const [materialState, addMaterialAction] = useActionState(createTimberMaterialAction, initialActionState);
  const [updateState, updateStockAction] = useActionState(updateTimberStockAction, initialActionState);
  const [materialPreviewInput, setMaterialPreviewInput] = useState({
    height: "",
    width: "",
    length: "",
    grade: "",
    treatment: "",
  });

  const namesById = useMemo(() => materialNameById(localMaterials), [localMaterials]);
  const selectedArea = areas.find((area) => area.id === selectedAreaId);
  const selectedAreaName = selectedArea?.name ?? "selected area";
  const latestSelectedAreaId = areaState.selectedAreaId ?? materialState.selectedAreaId ?? updateState.selectedAreaId;
  const changedRowCount = useMemo(() => countChangedStockTakeRows(loadedRows, rows), [loadedRows, rows]);
  const hasUnsavedChanges = useMemo(() => changedRowCount > 0, [changedRowCount]);
  const preview = useMemo(() => {
    try {
      return generateTimberMaterialName(materialPreviewInput);
    } catch {
      return "Fill in the timber details to preview the name.";
    }
  }, [materialPreviewInput]);

  useEffect(() => {
    rowsRef.current = rows;
  }, [rows]);

  useEffect(() => {
    setLocalMaterials(materials);
  }, [materials]);

  useEffect(() => {
    if (!materialState.ok || !materialState.material) {
      return;
    }

    const material = materialState.material;
    const newKey = `new-${material.id}-${crypto.randomUUID()}`;
    setLocalMaterials((currentMaterials) => {
      if (currentMaterials.some((currentMaterial) => currentMaterial.id === material.id)) {
        return currentMaterials;
      }
      return [...currentMaterials, material].sort((left, right) => left.name.localeCompare(right.name));
    });
    setRows((currentRows) => [
      ...currentRows,
      {
        key: newKey,
        timberMaterialId: material.id,
        bay: "",
        level: "",
        quantity: "0",
        persisted: false,
      },
    ]);
    setSearch("");
    setFocusRowKey(newKey);
  }, [materialState]);

  useEffect(() => {
    if (!updateState.ok) {
      return;
    }
    const savedRows = rowsRef.current.map((row) => ({ ...row, persisted: true }));
    setLoadedRows(savedRows);
    setRows(savedRows);
  }, [updateState]);

  useEffect(() => {
    if (!focusRowKey || focusedRowKeys.current.has(focusRowKey)) {
      return;
    }

    const input = document.querySelector<HTMLInputElement>(`[data-stock-row-key="${focusRowKey}"][data-stock-field="bay"]`);
    input?.focus();
    if (input) {
      focusedRowKeys.current.add(focusRowKey);
    }
  }, [focusRowKey, rows]);

  const visibleRows = useMemo(
    () =>
      rows.filter((row) =>
        rowMatchesStockTakeSearch(
          {
            timberName: namesById.get(row.timberMaterialId) ?? "Timber material",
            bay: row.bay,
            level: row.level,
          },
          search,
        ),
      ),
    [namesById, rows, search],
  );
  const updateRow = (key: string, field: keyof DraftRow, value: string) => {
    setRows((currentRows) =>
      currentRows.map((row) => (row.key === key ? { ...row, [field]: value } : row)),
    );
  };

  const addWorkingRow = () => {
    setRows((currentRows) => [
      ...currentRows,
      {
        key: `new-${crypto.randomUUID()}`,
        timberMaterialId: localMaterials[0]?.id ?? "",
        bay: "",
        level: "",
        quantity: "0",
        persisted: false,
      },
    ]);
  };

  const stockRowsPayload = useMemo(
    () =>
      rows.map((row) => ({
        timberMaterialId: row.timberMaterialId,
        bay: row.bay,
        level: row.level,
        quantity: row.quantity,
      })),
    [rows],
  );
  const stockRowsPayloadJson = useMemo(() => JSON.stringify(stockRowsPayload), [stockRowsPayload]);

  const navigateToArea = (areaId: string) => {
    if (hasUnsavedChanges && !window.confirm("You have unsaved stock changes. Leave this area without updating stock?")) {
      return;
    }
    setSelectedAreaId(areaId);
    window.location.href = `/stock-take?area=${areaId}`;
  };

  return (
    <div className="space-y-4">
      <Card className="space-y-3">
        <div>
          <h2 className="text-base font-semibold text-zinc-950">Choose area</h2>
          <p className="text-sm text-zinc-600">Select the physical area you are counting.</p>
        </div>

        {areas.length === 0 ? (
          <Alert variant="warning">Add an area before entering timber quantities.</Alert>
        ) : null}

        <FormField label="Area" htmlFor="area_selector">
          <Select
            id="area_selector"
            value={selectedAreaId}
            onChange={(event) => {
              navigateToArea(event.currentTarget.value);
            }}
          >
            {areas.length === 0 ? <option value="">No areas yet</option> : null}
            {areas.map((area) => (
              <option key={area.id} value={area.id}>
                {area.name}
              </option>
            ))}
          </Select>
        </FormField>

        {latestSelectedAreaId && latestSelectedAreaId !== selectedAreaId ? (
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              navigateToArea(latestSelectedAreaId);
            }}
          >
            Open updated area
          </Button>
        ) : null}

        <form action={addAreaAction} className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <FormField label="Area name" htmlFor="area_name" className="flex-1">
            <Input id="area_name" name="area_name" required />
          </FormField>
          <PendingSubmitButton type="submit" variant="secondary">
            Add area
          </PendingSubmitButton>
        </form>
        <ActionMessage state={areaState} />
      </Card>

      {selectedArea ? (
        <Card className="space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-semibold text-zinc-950">
                Working list for {selectedAreaName}
              </h2>
              <p className="text-sm text-zinc-600">Enter the timber quantities in this area.</p>
            </div>
            <Button type="button" variant="secondary" onClick={addWorkingRow} disabled={localMaterials.length === 0}>
              Add row
            </Button>
          </div>

          <div className="space-y-2">
            <FormField label="Search working list" htmlFor="stock_take_search">
              <Input
                id="stock_take_search"
                value={search}
                onChange={(event) => setSearch(event.currentTarget.value)}
                placeholder="Search timber, bay, or level..."
              />
            </FormField>
            {hasUnsavedChanges ? (
              <Alert variant="warning">
                Unsaved changes · {changedRowCount} {changedRowCount === 1 ? "row has" : "rows have"} changed.
              </Alert>
            ) : null}
          </div>

          <form action={updateStockAction} className="space-y-3">
            <input type="hidden" name="area_id" value={selectedAreaId} />
            <input type="hidden" name="rows" value={stockRowsPayloadJson} />
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 text-left text-xs uppercase tracking-wide text-zinc-500">
                    {WORKING_LIST_HEADERS.map((header) => (
                      <th key={header} className="px-2 py-2 font-medium">
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visibleRows.length === 0 ? (
                    <tr>
                      <td className="px-2 py-4 text-zinc-600" colSpan={WORKING_LIST_HEADERS.length}>
                        {search.trim() ? "No matching timber rows in this area." : "No timber rows yet. Add a row or add a new material to begin."}
                      </td>
                    </tr>
                  ) : null}
                  {visibleRows.map((row) => (
                    <tr key={row.key} className="border-b border-zinc-100">
                      <td className="px-2 py-2 align-top">
                        {row.persisted ? (
                          <p className="pt-1.5 text-zinc-900">{namesById.get(row.timberMaterialId) ?? "Timber material"}</p>
                        ) : (
                          <Select
                            value={row.timberMaterialId}
                            onChange={(event) => updateRow(row.key, "timberMaterialId", event.currentTarget.value)}
                            required
                          >
                            {localMaterials.map((material) => (
                              <option key={material.id} value={material.id}>
                                {material.name}
                              </option>
                            ))}
                          </Select>
                        )}
                      </td>
                      <td className="px-2 py-2 align-top">
                        <Input
                          data-stock-row-key={row.key}
                          data-stock-field="bay"
                          value={row.bay}
                          onChange={(event) => updateRow(row.key, "bay", event.currentTarget.value)}
                        />
                      </td>
                      <td className="px-2 py-2 align-top">
                        <Input
                          data-stock-row-key={row.key}
                          data-stock-field="level"
                          value={row.level}
                          onChange={(event) => updateRow(row.key, "level", event.currentTarget.value)}
                        />
                      </td>
                      <td className="px-2 py-2 align-top">
                        <Input
                          type="number"
                          min={0}
                          step="0.001"
                          data-stock-row-key={row.key}
                          data-stock-field="quantity"
                          value={row.quantity}
                          onChange={(event) => updateRow(row.key, "quantity", event.currentTarget.value)}
                          required
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-end">
              <PendingSubmitButton type="submit" variant="primary" disabled={!selectedAreaId || rows.length === 0}>
                {UPDATE_STOCK_LABEL}
              </PendingSubmitButton>
            </div>
          </form>
          <ActionMessage state={updateState} />
        </Card>
      ) : null}

      <Card className="space-y-3">
        <div>
          <h2 className="text-base font-semibold text-zinc-950">Add new material</h2>
          <p className="text-sm text-zinc-600">Create a timber material from its dimensions and specification.</p>
        </div>
        <form action={addMaterialAction} className="grid gap-3 sm:grid-cols-2">
          <input type="hidden" name="selected_area_id" value={selectedAreaId} />
          {ADD_MATERIAL_FIELDS.map((field) => {
            const key = field.toLowerCase() as keyof typeof materialPreviewInput;
            return (
              <FormField key={field} label={field} htmlFor={key}>
                <Input
                  id={key}
                  name={key}
                  value={materialPreviewInput[key]}
                  onChange={(event) =>
                    setMaterialPreviewInput((current) => ({
                      ...current,
                      [key]: event.currentTarget.value,
                    }))
                  }
                  required
                />
              </FormField>
            );
          })}
          <FormField label="Generated timber name" className="sm:col-span-2">
            <Input value={preview} readOnly aria-readonly="true" />
          </FormField>
          <div className="sm:col-span-2">
            <PendingSubmitButton type="submit" variant="secondary">
              Add new material
            </PendingSubmitButton>
          </div>
        </form>
        <ActionMessage state={materialState} />
      </Card>
    </div>
  );
}
