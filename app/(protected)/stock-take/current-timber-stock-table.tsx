"use client";

import { useMemo, useState } from "react";
import { updateTimberStockBatchAndFinalizeAction } from "@/app/(protected)/stock-take/actions";
import { Alert } from "@/src/components/ui/alert";
import { Button } from "@/src/components/ui/button";
import { FormField } from "@/src/components/ui/form-field";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";
import { Select } from "@/src/components/ui/select";
import { Textarea } from "@/src/components/ui/textarea";
import type { StockLocationRecord } from "@/src/lib/inventory/locations";
import type { MaterialGroupRecord } from "@/src/lib/inventory/items";
import {
  toTimberStockChangeKey,
  type TimberStockBatchChange,
  type TimberStockBatchExistingChange,
  type TimberStockBatchMissingChange,
} from "@/src/lib/stock-take/timber-stock-batch";
import {
  formatStockLocationLabel,
  formatTimberStockLabel,
} from "@/src/lib/stock-take/timber-stock-formatting";
import type { CurrentTimberStockBalance } from "@/src/lib/stock-take/timber-stock";

type CurrentTimberStockTableProps = {
  balances: CurrentTimberStockBalance[];
  canUpdateStock: boolean;
  timberMaterialGroup: MaterialGroupRecord | undefined;
  stockLocations: StockLocationRecord[];
};

type MissingTimberDraft = {
  itemCode: string;
  name: string;
  unit: string;
  description: string;
  thicknessMm: string;
  widthMm: string;
  lengthMm: string;
  grade: string;
  treatment: string;
  stockLocationId: string;
  countedQuantity: string;
  notes: string;
};

const emptyMissingTimberDraft = (): MissingTimberDraft => ({
  itemCode: "",
  name: "",
  unit: "each",
  description: "",
  thicknessMm: "",
  widthMm: "",
  lengthMm: "",
  grade: "",
  treatment: "",
  stockLocationId: "",
  countedQuantity: "",
  notes: "",
});

const formatQuantity = (quantity: number, unit: string) =>
  `${new Intl.NumberFormat("en-NZ", { maximumFractionDigits: 3 }).format(quantity)} ${unit}`;

const formatLastCounted = (value: string) =>
  new Intl.DateTimeFormat("en-NZ", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));

const normalizeOptional = (value: string) => {
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
};

const parseOptionalNumber = (value: string) => {
  const normalized = normalizeOptional(value);
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};


export function CurrentTimberStockTable({
  balances,
  canUpdateStock,
  timberMaterialGroup,
  stockLocations,
}: CurrentTimberStockTableProps) {
  const [query, setQuery] = useState("");
  const [locationFilter, setLocationFilter] = useState("all");
  const [quantityEdits, setQuantityEdits] = useState<Record<string, string>>({});
  const [noteEdits, setNoteEdits] = useState<Record<string, string>>({});
  const [missingRows, setMissingRows] = useState<TimberStockBatchMissingChange[]>([]);
  const [missingDraft, setMissingDraft] = useState(emptyMissingTimberDraft);
  const [missingError, setMissingError] = useState<string | null>(null);

  const balanceRows = useMemo(() => balances.map((balance) => {
    const key = toTimberStockChangeKey({
      inventoryItemId: balance.inventoryItemId,
      stockLocationId: balance.stockLocationId,
    });
    return { balance, key };
  }), [balances]);

  const locations = useMemo(() => {
    const byKey = new Map<string, string>();
    for (const balance of balances) {
      const key = balance.stockLocationId ?? "__none__";
      byKey.set(key, formatStockLocationLabel(balance.stockLocation));
    }
    for (const location of stockLocations) {
      byKey.set(location.id, formatStockLocationLabel(location));
    }
    return [...byKey.entries()].sort(([, a], [, b]) => a.localeCompare(b));
  }, [balances, stockLocations]);

  const existingChanges = useMemo<TimberStockBatchExistingChange[]>(() => {
    const changes: TimberStockBatchExistingChange[] = [];
    for (const { balance, key } of balanceRows) {
      const editedQuantity = quantityEdits[key];
      const editedNotes = noteEdits[key];
      const hasQuantityEdit = editedQuantity !== undefined;
      const hasNoteEdit = Boolean(editedNotes?.trim());
      if (!hasQuantityEdit && !hasNoteEdit) continue;

      const countedQuantity = hasQuantityEdit ? Number(editedQuantity) : balance.quantity;
      if (!Number.isFinite(countedQuantity) || countedQuantity < 0) continue;
      if (countedQuantity === balance.quantity && !hasNoteEdit) continue;

      changes.push({
        kind: "existing",
        inventoryItemId: balance.inventoryItemId,
        stockLocationId: balance.stockLocationId,
        countedQuantity,
        notes: normalizeOptional(editedNotes ?? ""),
      });
    }
    return changes;
  }, [balanceRows, noteEdits, quantityEdits]);

  const stockChanges = useMemo<TimberStockBatchChange[]>(
    () => [...existingChanges, ...missingRows],
    [existingChanges, missingRows],
  );
  const unsavedChangeCount = stockChanges.length;
  const stockChangesPayload = JSON.stringify(stockChanges);

  const filteredBalances = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return balanceRows.filter(({ balance }) => {
      const locationKey = balance.stockLocationId ?? "__none__";
      if (locationFilter !== "all" && locationFilter !== locationKey) {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      const searchableText = [
        balance.itemName,
        balance.itemCode,
        balance.timberSpec?.thickness_mm,
        balance.timberSpec?.width_mm,
        balance.timberSpec?.length_mm,
        balance.timberSpec?.grade,
        balance.timberSpec?.treatment,
        formatStockLocationLabel(balance.stockLocation),
      ]
        .filter((part) => part !== null && part !== undefined)
        .join(" ")
        .toLowerCase();

      return searchableText.includes(normalizedQuery);
    });
  }, [balanceRows, locationFilter, query]);

  const changedKeys = useMemo(
    () => new Set(existingChanges.map((change) => toTimberStockChangeKey(change))),
    [existingChanges],
  );

  const resetChanges = () => {
    setQuantityEdits({});
    setNoteEdits({});
    setMissingRows([]);
    setMissingDraft(emptyMissingTimberDraft());
    setMissingError(null);
  };

  const addMissingTimber = () => {
    const countedQuantity = Number(missingDraft.countedQuantity);
    if (!Number.isFinite(countedQuantity) || countedQuantity < 0) {
      setMissingError("Enter a counted quantity of zero or more.");
      return;
    }

    const hasIdentity = Boolean(
      missingDraft.name.trim() ||
        missingDraft.thicknessMm.trim() ||
        missingDraft.widthMm.trim() ||
        missingDraft.lengthMm.trim() ||
        missingDraft.grade.trim() ||
        missingDraft.treatment.trim(),
    );
    if (!hasIdentity) {
      setMissingError("Enter a timber name or timber spec.");
      return;
    }

    setMissingRows((rows) => [
      ...rows,
      {
        kind: "missing",
        clientId: crypto.randomUUID(),
        stockLocationId: normalizeOptional(missingDraft.stockLocationId),
        countedQuantity,
        notes: normalizeOptional(missingDraft.notes),
        newMaterial: {
          itemCode: normalizeOptional(missingDraft.itemCode),
          name: normalizeOptional(missingDraft.name),
          unit: normalizeOptional(missingDraft.unit) ?? "each",
          description: normalizeOptional(missingDraft.description),
          timberSpec: {
            thicknessMm: parseOptionalNumber(missingDraft.thicknessMm),
            widthMm: parseOptionalNumber(missingDraft.widthMm),
            lengthMm: parseOptionalNumber(missingDraft.lengthMm),
            grade: normalizeOptional(missingDraft.grade),
            treatment: normalizeOptional(missingDraft.treatment),
          },
        },
      },
    ]);
    setMissingDraft(emptyMissingTimberDraft());
    setMissingError(null);
  };

  return (
    <form action={updateTimberStockBatchAndFinalizeAction} className="space-y-4">
      <input type="hidden" name="timberMaterialGroupId" value={timberMaterialGroup?.id ?? ""} />
      <input type="hidden" name="stockChanges" value={stockChangesPayload} />

      {!canUpdateStock ? (
        <Alert>Only supervisors and admins can update finalized stock balances.</Alert>
      ) : null}
      {!timberMaterialGroup ? (
        <Alert variant="error">Timber setup is not available yet. Add a timber material group before updating stock.</Alert>
      ) : null}

      <div className="sticky top-0 z-10 rounded-md border border-zinc-200 bg-white/95 p-3 shadow-sm backdrop-blur">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold text-zinc-900">
              {unsavedChangeCount === 1 ? "1 unsaved change" : `${unsavedChangeCount} unsaved changes`}
            </p>
            <p className="text-xs text-zinc-600">
              Editing stock is local and smooth. Updating stock is the official save action.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" disabled={unsavedChangeCount === 0} onClick={resetChanges}>
              Reset changes
            </Button>
            <Button type="submit" variant="primary" disabled={!canUpdateStock || !timberMaterialGroup || unsavedChangeCount === 0}>
              Update stock
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_16rem]">
        <Input
          aria-label="Search current timber stock"
          placeholder="Search by timber, code, spec, or location"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <Select
          aria-label="Filter by location"
          value={locationFilter}
          onChange={(event) => setLocationFilter(event.target.value)}
        >
          <option value="all">All locations</option>
          {locations.map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </Select>
      </div>

      {balances.length === 0 ? (
        <div className="rounded-md border border-dashed border-zinc-300 bg-zinc-50 p-4 text-sm text-zinc-600">
          No current timber stock has been finalized yet. Add missing timber below, then update stock once.
        </div>
      ) : filteredBalances.length === 0 ? (
        <div className="rounded-md border border-dashed border-zinc-300 bg-zinc-50 p-4 text-sm text-zinc-600">
          No timber stock matches the current filters.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border border-zinc-200 bg-white">
          <table className="min-w-full divide-y divide-zinc-200 text-sm">
            <thead className="bg-zinc-50 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-3 py-2">Timber/spec</th>
                <th className="px-3 py-2">Location</th>
                <th className="px-3 py-2">Counted quantity</th>
                <th className="px-3 py-2">Notes</th>
                <th className="px-3 py-2">Last counted</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {filteredBalances.map(({ balance, key }) => {
                const changed = changedKeys.has(key);
                return (
                  <tr key={key} className={changed ? "bg-amber-50/50" : undefined}>
                    <td className="px-3 py-2">
                      <div className="font-medium text-zinc-900">
                        {formatTimberStockLabel({
                          name: balance.itemName,
                          itemCode: balance.itemCode,
                          timberSpec: balance.timberSpec,
                        })}
                      </div>
                      <div className="text-xs text-zinc-500">Current: {formatQuantity(balance.quantity, balance.unit)}</div>
                      {changed ? <div className="mt-1 text-xs font-medium text-amber-700">Unsaved change</div> : null}
                    </td>
                    <td className="px-3 py-2 text-zinc-700">
                      {formatStockLocationLabel(balance.stockLocation)}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-end gap-2">
                        <Input
                          aria-label={`Counted quantity for ${balance.itemName}`}
                          className="w-32 text-right"
                          inputMode="decimal"
                          min="0"
                          step="0.001"
                          type="number"
                          value={quantityEdits[key] ?? String(balance.quantity)}
                          onChange={(event) => setQuantityEdits((edits) => ({ ...edits, [key]: event.target.value }))}
                        />
                        <span className="min-w-10 text-xs text-zinc-500">{balance.unit}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        aria-label={`Notes for ${balance.itemName}`}
                        placeholder="Optional"
                        value={noteEdits[key] ?? ""}
                        onChange={(event) => setNoteEdits((edits) => ({ ...edits, [key]: event.target.value }))}
                      />
                    </td>
                    <td className="px-3 py-2 text-zinc-600">
                      {formatLastCounted(balance.lastFinalizedAt)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {missingRows.length > 0 ? (
        <div className="rounded-md border border-amber-200 bg-amber-50/50 p-3">
          <p className="text-sm font-semibold text-zinc-900">Missing timber waiting to be added</p>
          <div className="mt-2 space-y-2">
            {missingRows.map((row) => (
              <div key={row.clientId} className="flex flex-col gap-2 rounded-md border border-amber-100 bg-white p-2 text-sm md:flex-row md:items-center md:justify-between">
                <div>
                  <span className="font-medium text-zinc-900">
                    {formatTimberStockLabel({
                      name: row.newMaterial.name ?? "Missing timber",
                      itemCode: row.newMaterial.itemCode,
                      timberSpec: {
                        thickness_mm: row.newMaterial.timberSpec?.thicknessMm ?? null,
                        width_mm: row.newMaterial.timberSpec?.widthMm ?? null,
                        length_mm: row.newMaterial.timberSpec?.lengthMm ?? null,
                        grade: row.newMaterial.timberSpec?.grade ?? null,
                        treatment: row.newMaterial.timberSpec?.treatment ?? null,
                      },
                    })}
                  </span>
                  <span className="text-zinc-600"> · {formatQuantity(row.countedQuantity, row.newMaterial.unit ?? "each")} · {formatStockLocationLabel(stockLocations.find((location) => location.id === row.stockLocationId) ?? null)}</span>
                </div>
                <button
                  type="button"
                  className="text-left text-sm font-medium text-red-700 hover:text-red-800 md:text-right"
                  onClick={() => setMissingRows((rows) => rows.filter((candidate) => candidate.clientId !== row.clientId))}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div id="add-missing-timber" className="scroll-mt-4 rounded-md border border-zinc-200 bg-zinc-50 p-4">
        <div className="flex flex-col gap-1">
          <h3 className="text-base font-semibold text-zinc-900">Add missing timber</h3>
          <p className="text-sm text-zinc-600">This will add the timber to the stock list when you update stock.</p>
        </div>
        {missingError ? <div className="mt-3"><Alert variant="error">{missingError}</Alert></div> : null}
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <FormField>
            <Label htmlFor="missing-code">Code</Label>
            <Input id="missing-code" value={missingDraft.itemCode} placeholder="Optional" onChange={(event) => setMissingDraft((draft) => ({ ...draft, itemCode: event.target.value }))} />
          </FormField>
          <FormField>
            <Label htmlFor="missing-name">Name</Label>
            <Input id="missing-name" value={missingDraft.name} placeholder="Optional when spec is entered" onChange={(event) => setMissingDraft((draft) => ({ ...draft, name: event.target.value }))} />
          </FormField>
          <FormField>
            <Label htmlFor="missing-unit">Unit</Label>
            <Input id="missing-unit" value={missingDraft.unit} onChange={(event) => setMissingDraft((draft) => ({ ...draft, unit: event.target.value }))} />
          </FormField>
          <FormField>
            <Label htmlFor="missing-location">Location</Label>
            <Select id="missing-location" value={missingDraft.stockLocationId} onChange={(event) => setMissingDraft((draft) => ({ ...draft, stockLocationId: event.target.value }))}>
              <option value="">No location recorded</option>
              {stockLocations.map((location) => (
                <option key={location.id} value={location.id}>{formatStockLocationLabel(location)}</option>
              ))}
            </Select>
          </FormField>
          <FormField>
            <Label htmlFor="missing-quantity">Counted quantity</Label>
            <Input id="missing-quantity" inputMode="decimal" min="0" step="0.001" type="number" value={missingDraft.countedQuantity} onChange={(event) => setMissingDraft((draft) => ({ ...draft, countedQuantity: event.target.value }))} />
          </FormField>
          <FormField>
            <Label htmlFor="missing-notes">Notes / reason</Label>
            <Input id="missing-notes" value={missingDraft.notes} placeholder="Optional" onChange={(event) => setMissingDraft((draft) => ({ ...draft, notes: event.target.value }))} />
          </FormField>
          <FormField>
            <Label htmlFor="missing-thickness">Thickness mm</Label>
            <Input id="missing-thickness" inputMode="decimal" min="0" step="0.001" type="number" value={missingDraft.thicknessMm} onChange={(event) => setMissingDraft((draft) => ({ ...draft, thicknessMm: event.target.value }))} />
          </FormField>
          <FormField>
            <Label htmlFor="missing-width">Width mm</Label>
            <Input id="missing-width" inputMode="decimal" min="0" step="0.001" type="number" value={missingDraft.widthMm} onChange={(event) => setMissingDraft((draft) => ({ ...draft, widthMm: event.target.value }))} />
          </FormField>
          <FormField>
            <Label htmlFor="missing-length">Length mm</Label>
            <Input id="missing-length" inputMode="decimal" min="0" step="0.001" type="number" value={missingDraft.lengthMm} onChange={(event) => setMissingDraft((draft) => ({ ...draft, lengthMm: event.target.value }))} />
          </FormField>
          <FormField>
            <Label htmlFor="missing-grade">Grade</Label>
            <Input id="missing-grade" value={missingDraft.grade} placeholder="Optional" onChange={(event) => setMissingDraft((draft) => ({ ...draft, grade: event.target.value }))} />
          </FormField>
          <FormField>
            <Label htmlFor="missing-treatment">Treatment</Label>
            <Input id="missing-treatment" value={missingDraft.treatment} placeholder="Optional" onChange={(event) => setMissingDraft((draft) => ({ ...draft, treatment: event.target.value }))} />
          </FormField>
          <FormField>
            <Label htmlFor="missing-description">Description</Label>
            <Textarea id="missing-description" rows={2} value={missingDraft.description} placeholder="Optional" onChange={(event) => setMissingDraft((draft) => ({ ...draft, description: event.target.value }))} />
          </FormField>
        </div>
        <div className="mt-3">
          <Button type="button" variant="secondary" onClick={addMissingTimber}>
            Add missing timber
          </Button>
        </div>
      </div>
    </form>
  );
}
