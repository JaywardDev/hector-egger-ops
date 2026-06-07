"use client";

import { useState } from "react";
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
  newMaterialBay: string;
  newMaterialLevel: string;
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
  onBayChange: (value: string) => void;
  onLevelChange: (value: string) => void;
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
  newMaterialBay,
  newMaterialLevel,
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
  onBayChange,
  onLevelChange,
  onNotesChange,
  onSubmit,
}: StockTakeAddNewMaterialFormProps) {
  const [showTimberSpec, setShowTimberSpec] = useState(false);

  return (
    <div className="space-y-2">
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

      <div className="grid grid-cols-2 gap-2">
        <FormField label="Bay">
          <Input value={newMaterialBay} onChange={(event) => onBayChange(event.target.value)} placeholder="Bay" />
        </FormField>
        <FormField label="Level">
          <Input value={newMaterialLevel} onChange={(event) => onLevelChange(event.target.value)} placeholder="Level" />
        </FormField>
      </div>

      <FormField label="Notes">
        <Textarea
          value={newMaterialNotes}
          onChange={(event) => onNotesChange(event.target.value)}
          rows={2}
          placeholder="Notes"
        />
      </FormField>

      {/* Timber spec accordion */}
      <button
        type="button"
        onClick={() => setShowTimberSpec((v) => !v)}
        className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-700"
      >
        <span className="select-none">{showTimberSpec ? "▼" : "▶"}</span>
        {showTimberSpec ? "Hide timber spec" : "Add timber spec (thickness, width, grade…)"}
      </button>

      {showTimberSpec ? (
        <div className="space-y-2 rounded-md border border-zinc-100 bg-zinc-50 p-2">
          <div className="grid grid-cols-2 gap-2">
            <FormField label="Thickness (mm)">
              <Input
                value={newMaterialThicknessMm}
                onChange={(event) => onThicknessMmChange(event.target.value)}
                placeholder="e.g. 45"
              />
            </FormField>
            <FormField label="Width (mm)">
              <Input
                value={newMaterialWidthMm}
                onChange={(event) => onWidthMmChange(event.target.value)}
                placeholder="e.g. 90"
              />
            </FormField>
            <FormField label="Length (mm)">
              <Input
                value={newMaterialLengthMm}
                onChange={(event) => onLengthMmChange(event.target.value)}
                placeholder="e.g. 4200"
              />
            </FormField>
            <FormField label="Grade">
              <Input
                value={newMaterialGrade}
                onChange={(event) => onGradeChange(event.target.value)}
                placeholder="e.g. MSG8"
              />
            </FormField>
          </div>
          <FormField label="Treatment">
            <Input
              value={newMaterialTreatment}
              onChange={(event) => onTreatmentChange(event.target.value)}
              placeholder="e.g. H3.2"
            />
          </FormField>
        </div>
      ) : null}

      <Button onClick={onSubmit}>Add new-material draft row</Button>
    </div>
  );
}
