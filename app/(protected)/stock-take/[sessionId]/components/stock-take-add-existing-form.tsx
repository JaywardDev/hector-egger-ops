import { SectionHeader } from "@/src/components/layout/section-header";
import { Button } from "@/src/components/ui/button";
import { FormField } from "@/src/components/ui/form-field";
import { Input } from "@/src/components/ui/input";
import { Select } from "@/src/components/ui/select";
import { Textarea } from "@/src/components/ui/textarea";
import type {
  InventoryItemOption,
  StockLocationOption,
} from "@/app/(protected)/stock-take/[sessionId]/stock-take-session-detail-types";
import { formatLocationLabel } from "@/app/(protected)/stock-take/[sessionId]/stock-take-session-detail-types";

type StockTakeAddExistingFormProps = {
  inventoryItems: InventoryItemOption[];
  stockLocations: StockLocationOption[];
  selectedInventoryItemId: string | null;
  countedQuantity: string;
  stockLocationId: string;
  bay: string;
  level: string;
  notes: string;
  onSelectedInventoryItemIdChange: (value: string | null) => void;
  onCountedQuantityChange: (value: string) => void;
  onStockLocationIdChange: (value: string) => void;
  onBayChange: (value: string) => void;
  onLevelChange: (value: string) => void;
  onNotesChange: (value: string) => void;
  onSubmit: () => void;
  showHeader?: boolean;
  headerClassName?: string;
};

export function StockTakeAddExistingForm({
  inventoryItems,
  stockLocations,
  selectedInventoryItemId,
  countedQuantity,
  stockLocationId,
  bay,
  level,
  notes,
  onSelectedInventoryItemIdChange,
  onCountedQuantityChange,
  onStockLocationIdChange,
  onBayChange,
  onLevelChange,
  onNotesChange,
  onSubmit,
  showHeader = true,
  headerClassName,
}: StockTakeAddExistingFormProps) {
  return (
    <div className="space-y-2">
      {showHeader ? (
        <SectionHeader title="Add row (existing material)" className={headerClassName} />
      ) : null}

      <FormField label="Material">
        <Select
          value={selectedInventoryItemId ?? ""}
          onChange={(event) =>
            onSelectedInventoryItemIdChange(
              event.target.value.length > 0 ? event.target.value : null,
            )
          }
        >
          <option value="">Select a material</option>
          {inventoryItems.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name} {item.item_code ? `(${item.item_code})` : ""}
            </option>
          ))}
        </Select>
      </FormField>

      <FormField label="Counted quantity">
        <Input
          type="number"
          min="0"
          step="any"
          value={countedQuantity}
          onChange={(event) => onCountedQuantityChange(event.target.value)}
          placeholder="Counted quantity"
        />
      </FormField>

      <FormField label="Location">
        <Select
          value={stockLocationId}
          onChange={(event) => onStockLocationIdChange(event.target.value)}
        >
          <option value="">No location</option>
          {stockLocations.map((location) => (
            <option key={location.id} value={location.id}>
              {formatLocationLabel(location)}
            </option>
          ))}
        </Select>
      </FormField>

      <div className="grid grid-cols-2 gap-2">
        <FormField label="Bay">
          <Input value={bay} onChange={(event) => onBayChange(event.target.value)} placeholder="Bay" />
        </FormField>
        <FormField label="Level">
          <Input value={level} onChange={(event) => onLevelChange(event.target.value)} placeholder="Level" />
        </FormField>
      </div>

      <FormField label="Notes">
        <Textarea
          value={notes}
          onChange={(event) => onNotesChange(event.target.value)}
          placeholder="Notes"
          rows={2}
        />
      </FormField>

      <Button onClick={onSubmit}>Add draft row</Button>
    </div>
  );
}
