"use client";

import { useActionState, useMemo, useState } from "react";
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
import { generateTimberMaterialName } from "@/src/lib/stock-take/validation";
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

  const namesById = useMemo(() => materialNameById(materials), [materials]);
  const selectedArea = areas.find((area) => area.id === selectedAreaId);
  const selectedAreaName = selectedArea?.name ?? "selected area";
  const latestSelectedAreaId = areaState.selectedAreaId ?? materialState.selectedAreaId ?? updateState.selectedAreaId;
  const preview = useMemo(() => {
    try {
      return generateTimberMaterialName(materialPreviewInput);
    } catch {
      return "Fill in the timber details to preview the name.";
    }
  }, [materialPreviewInput]);

  const visibleRows = rows;
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
        timberMaterialId: materials[0]?.id ?? "",
        bay: "",
        level: "",
        quantity: "0",
        persisted: false,
      },
    ]);
  };

  const stockRowsPayload = visibleRows.map((row) => ({
    timberMaterialId: row.timberMaterialId,
    bay: row.bay,
    level: row.level,
    quantity: Number(row.quantity),
  }));

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
              setSelectedAreaId(event.currentTarget.value);
              window.location.href = `/stock-take?area=${event.currentTarget.value}`;
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
              window.location.href = `/stock-take?area=${latestSelectedAreaId}`;
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
            <Button type="button" variant="secondary" onClick={addWorkingRow} disabled={materials.length === 0}>
              Add row
            </Button>
          </div>

          <form action={updateStockAction} className="space-y-3">
            <input type="hidden" name="area_id" value={selectedAreaId} />
            <input type="hidden" name="rows" value={JSON.stringify(stockRowsPayload)} />
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
                        No timber rows yet. Add a row or add a new material to begin.
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
                            {materials.map((material) => (
                              <option key={material.id} value={material.id}>
                                {material.name}
                              </option>
                            ))}
                          </Select>
                        )}
                      </td>
                      <td className="px-2 py-2 align-top">
                        <Input value={row.bay} onChange={(event) => updateRow(row.key, "bay", event.currentTarget.value)} />
                      </td>
                      <td className="px-2 py-2 align-top">
                        <Input value={row.level} onChange={(event) => updateRow(row.key, "level", event.currentTarget.value)} />
                      </td>
                      <td className="px-2 py-2 align-top">
                        <Input
                          type="number"
                          min={0}
                          step="0.001"
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
              <PendingSubmitButton type="submit" variant="primary" disabled={!selectedAreaId || visibleRows.length === 0}>
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
