import { SectionHeader } from "@/src/components/layout/section-header";
import { Button } from "@/src/components/ui/button";
import { FormField } from "@/src/components/ui/form-field";
import { Input } from "@/src/components/ui/input";
import { Select } from "@/src/components/ui/select";
import { Textarea } from "@/src/components/ui/textarea";
import type {
  MaterialGroupOption,
  StockLocationOption,
} from "@/app/(protected)/stock-take/[sessionId]/stock-take-session-detail-types";
import { formatLocationLabel } from "@/app/(protected)/stock-take/[sessionId]/stock-take-session-detail-types";

type StockTakeAddNewMaterialFormProps = {
  materialGroups: MaterialGroupOption[];
  stockLocations: StockLocationOption[];
  newMaterialGroupId: string;
  newMaterialDescription: string;
  newMaterialThicknessMm: string;
  newMaterialWidthMm: string;
  newMaterialLengthMm: string;
  newMaterialGrade: string;
  newMaterialTreatment: string;
  newMaterialQty: string;
  newMaterialLocationId: string;
  newMaterialNotes: string;
  onMaterialGroupIdChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onThicknessMmChange: (value: string) => void;
  onWidthMmChange: (value: string) => void;
  onLengthMmChange: (value: string) => void;
  onGradeChange: (value: string) => void;
  onTreatmentChange: (value: string) => void;
  onQuantityChange: (value: string) => void;
  onLocationChange: (value: string) => void;
  onNotesChange: (value: string) => void;
  onSubmit: () => void;
};

export function StockTakeAddNewMaterialForm({
  materialGroups,
  stockLocations,
  newMaterialGroupId,
  newMaterialDescription,
  newMaterialThicknessMm,
  newMaterialWidthMm,
  newMaterialLengthMm,
  newMaterialGrade,
  newMaterialTreatment,
  newMaterialQty,
  newMaterialLocationId,
  newMaterialNotes,
  onMaterialGroupIdChange,
  onDescriptionChange,
  onThicknessMmChange,
  onWidthMmChange,
  onLengthMmChange,
  onGradeChange,
  onTreatmentChange,
  onQuantityChange,
  onLocationChange,
  onNotesChange,
  onSubmit,
}: StockTakeAddNewMaterialFormProps) {
  return (
    <div className="space-y-2">
      <SectionHeader title="Add row (new material)" />

      <FormField label="Material group">
        <Select
          value={newMaterialGroupId}
          onChange={(event) => onMaterialGroupIdChange(event.target.value)}
        >
          {materialGroups.map((group) => (
            <option key={group.id} value={group.id}>
              {group.label}
            </option>
          ))}
        </Select>
      </FormField>

      <FormField label="Description">
        <Input
          value={newMaterialDescription}
          onChange={(event) => onDescriptionChange(event.target.value)}
          placeholder="Description"
        />
      </FormField>

      <div className="grid grid-cols-2 gap-2">
        <FormField label="Thickness (mm)">
          <Input
            value={newMaterialThicknessMm}
            onChange={(event) => onThicknessMmChange(event.target.value)}
            placeholder="Thickness (mm)"
          />
        </FormField>
        <FormField label="Width (mm)">
          <Input
            value={newMaterialWidthMm}
            onChange={(event) => onWidthMmChange(event.target.value)}
            placeholder="Width (mm)"
          />
        </FormField>
        <FormField label="Length (mm)">
          <Input
            value={newMaterialLengthMm}
            onChange={(event) => onLengthMmChange(event.target.value)}
            placeholder="Length (mm)"
          />
        </FormField>
        <FormField label="Grade">
          <Input
            value={newMaterialGrade}
            onChange={(event) => onGradeChange(event.target.value)}
            placeholder="Grade"
          />
        </FormField>
      </div>

      <FormField label="Treatment">
        <Input
          value={newMaterialTreatment}
          onChange={(event) => onTreatmentChange(event.target.value)}
          placeholder="Treatment"
        />
      </FormField>

      <FormField label="Counted quantity">
        <Input
          type="number"
          min="0"
          step="any"
          value={newMaterialQty}
          onChange={(event) => onQuantityChange(event.target.value)}
          placeholder="Counted quantity"
        />
      </FormField>

      <FormField label="Location">
        <Select
          value={newMaterialLocationId}
          onChange={(event) => onLocationChange(event.target.value)}
        >
          <option value="">No location</option>
          {stockLocations.map((location) => (
            <option key={location.id} value={location.id}>
              {formatLocationLabel(location)}
            </option>
          ))}
        </Select>
      </FormField>

      <FormField label="Notes">
        <Textarea
          value={newMaterialNotes}
          onChange={(event) => onNotesChange(event.target.value)}
          rows={2}
          placeholder="Notes"
        />
      </FormField>

      <Button onClick={onSubmit}>Add new-material draft row</Button>
    </div>
  );
}
