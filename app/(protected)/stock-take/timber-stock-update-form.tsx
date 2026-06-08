"use client";

import { useState } from "react";
import { updateTimberStockAndFinalizeAction } from "@/app/(protected)/stock-take/actions";
import { Stack } from "@/src/components/layout/stack";
import { SectionHeader } from "@/src/components/layout/section-header";
import { Alert } from "@/src/components/ui/alert";
import { Button } from "@/src/components/ui/button";
import { FormField } from "@/src/components/ui/form-field";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";
import { Select } from "@/src/components/ui/select";
import { SegmentedControl } from "@/src/components/ui/segmented-control";
import { Textarea } from "@/src/components/ui/textarea";
import {
  formatStockLocationLabel,
  formatTimberStockLabel,
} from "@/src/lib/stock-take/timber-stock-formatting";
import type { StockLocationRecord } from "@/src/lib/inventory/locations";
import type { MaterialGroupRecord, StockTakeInventoryItemRecord } from "@/src/lib/inventory/items";

type TimberStockUpdateFormProps = {
  canUpdateStock: boolean;
  timberMaterialGroup: MaterialGroupRecord | undefined;
  stockLocations: StockLocationRecord[];
  timberItems: StockTakeInventoryItemRecord[];
  selectedItemId: string;
  selectedLocationId: string;
};

export function TimberStockUpdateForm({
  canUpdateStock,
  timberMaterialGroup,
  stockLocations,
  timberItems,
  selectedItemId,
  selectedLocationId,
}: TimberStockUpdateFormProps) {
  const [mode, setMode] = useState<"existing" | "missing">("existing");

  return (
    <Stack gap="sm">
      <SectionHeader
        title="Add / update timber"
        description="Choose timber, enter the counted quantity, and update the official stock balance immediately."
      />

      {!canUpdateStock ? (
        <Alert>
          Only supervisors and admins can update finalized stock balances.
        </Alert>
      ) : null}

      {!timberMaterialGroup ? (
        <Alert variant="error">
          Timber setup is not available yet. Add a timber material group before updating stock.
        </Alert>
      ) : null}

      <form action={updateTimberStockAndFinalizeAction} className="space-y-4">
        <input
          type="hidden"
          name="timberMaterialGroupId"
          value={timberMaterialGroup?.id ?? ""}
        />
        <input type="hidden" name="timberStockMode" value={mode} />

        <div className="space-y-2">
          <Label>Action</Label>
          <SegmentedControl
            aria-label="Choose stock update action"
            options={[
              { label: "Choose existing timber", value: "existing" },
              { label: "Add missing timber", value: "missing" },
            ]}
            value={mode}
            onChange={setMode}
          />
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          {mode === "existing" ? (
            <FormField>
              <Label htmlFor="inventory-item-id">Existing timber</Label>
              <Select
                id="inventory-item-id"
                name="inventoryItemId"
                defaultValue={selectedItemId}
                required={mode === "existing"}
              >
                <option value="">Select timber</option>
                {timberItems.map((item) => (
                  <option key={item.id} value={item.id}>
                    {formatTimberStockLabel({
                      name: item.name,
                      itemCode: item.item_code,
                      timberSpec: item.timber_spec,
                    })}
                  </option>
                ))}
              </Select>
            </FormField>
          ) : null}

          <FormField>
            <Label htmlFor="stock-location-id">Location</Label>
            <Select
              id="stock-location-id"
              name="stockLocationId"
              defaultValue={selectedLocationId}
            >
              <option value="">No location recorded</option>
              {stockLocations.map((location) => (
                <option key={location.id} value={location.id}>
                  {formatStockLocationLabel(location)}
                </option>
              ))}
            </Select>
          </FormField>

          <FormField>
            <Label htmlFor="counted-quantity">Counted quantity</Label>
            <Input
              id="counted-quantity"
              name="countedQuantity"
              inputMode="decimal"
              min="0"
              step="0.001"
              type="number"
              required
            />
          </FormField>

          <FormField>
            <Label htmlFor="notes">Notes / reason</Label>
            <Input
              id="notes"
              name="notes"
              placeholder="Optional"
            />
          </FormField>
        </div>

        {mode === "missing" ? (
          <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3">
            <p className="text-sm font-medium text-zinc-900">Add missing timber</p>
            <p className="mt-1 text-sm text-zinc-600">
              This will add the timber to the stock list and record the counted quantity.
            </p>
            <div className="mt-3 grid gap-3 md:grid-cols-3">
              <FormField>
                <Label htmlFor="new-item-code">Code</Label>
                <Input id="new-item-code" name="newItemCode" placeholder="Optional" />
              </FormField>
              <FormField>
                <Label htmlFor="new-item-name">Name</Label>
                <Input id="new-item-name" name="newItemName" placeholder="Optional when spec is entered" />
              </FormField>
              <FormField>
                <Label htmlFor="new-item-unit">Unit</Label>
                <Input id="new-item-unit" name="newItemUnit" defaultValue="each" />
              </FormField>
              <FormField>
                <Label htmlFor="timber-thickness">Thickness mm</Label>
                <Input id="timber-thickness" name="timberThicknessMm" inputMode="decimal" type="number" min="0" step="0.001" />
              </FormField>
              <FormField>
                <Label htmlFor="timber-width">Width mm</Label>
                <Input id="timber-width" name="timberWidthMm" inputMode="decimal" type="number" min="0" step="0.001" />
              </FormField>
              <FormField>
                <Label htmlFor="timber-length">Length mm</Label>
                <Input id="timber-length" name="timberLengthMm" inputMode="decimal" type="number" min="0" step="0.001" />
              </FormField>
              <FormField>
                <Label htmlFor="timber-grade">Grade</Label>
                <Input id="timber-grade" name="timberGrade" placeholder="Optional" />
              </FormField>
              <FormField>
                <Label htmlFor="timber-treatment">Treatment</Label>
                <Input id="timber-treatment" name="timberTreatment" placeholder="Optional" />
              </FormField>
              <FormField>
                <Label htmlFor="new-item-description">Description</Label>
                <Textarea id="new-item-description" name="newItemDescription" rows={2} placeholder="Optional" />
              </FormField>
            </div>
          </div>
        ) : null}

        <Button
          type="submit"
          variant="primary"
          disabled={!canUpdateStock || !timberMaterialGroup}
        >
          Update stock
        </Button>
      </form>
    </Stack>
  );
}
