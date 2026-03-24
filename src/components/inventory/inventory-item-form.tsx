"use client";

import { useId, useMemo, useState } from "react";
import { buildTimberItemLabel } from "@/src/lib/inventory/item-labels";
import type { InventoryItemRecord, MaterialGroupRecord } from "@/src/lib/inventory/items";

type InventoryItemFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  materialGroups: MaterialGroupRecord[];
  item?: InventoryItemRecord;
  fixedMaterialGroupId?: string;
  hideMaterialGroupSelector?: boolean;
  submitLabel?: string;
};

const inputClassName = "rounded-md border border-zinc-300 px-2 py-1.5";
const timberGridClassName = "grid gap-2 border border-amber-200 bg-amber-50/50 p-3 md:grid-cols-2";

export function InventoryItemForm({
  action,
  materialGroups,
  item,
  fixedMaterialGroupId,
  hideMaterialGroupSelector = false,
  submitLabel,
}: InventoryItemFormProps) {
  const formId = useId();
  const timberGroupId = useMemo(() => materialGroups.find((group) => group.key === "timber")?.id ?? "", [materialGroups]);
  const [materialGroupId, setMaterialGroupId] = useState(fixedMaterialGroupId ?? item?.material_group_id ?? "");
  const isTimberSelected = materialGroupId !== "" && materialGroupId === timberGroupId;
  const [timberThicknessMm, setTimberThicknessMm] = useState(item?.timber_spec?.thickness_mm?.toString() ?? "");
  const [timberWidthMm, setTimberWidthMm] = useState(item?.timber_spec?.width_mm?.toString() ?? "");
  const [timberLengthMm, setTimberLengthMm] = useState(item?.timber_spec?.length_mm?.toString() ?? "");
  const [timberGrade, setTimberGrade] = useState(item?.timber_spec?.grade ?? "");
  const [timberTreatment, setTimberTreatment] = useState(item?.timber_spec?.treatment ?? "");

  const generatedTimberLabel = useMemo(
    () =>
      buildTimberItemLabel({
        thicknessMm: timberThicknessMm.trim() ? Number(timberThicknessMm) : null,
        widthMm: timberWidthMm.trim() ? Number(timberWidthMm) : null,
        lengthMm: timberLengthMm.trim() ? Number(timberLengthMm) : null,
        grade: timberGrade.trim() || null,
        treatment: timberTreatment.trim() || null,
      }),
    [timberGrade, timberLengthMm, timberThicknessMm, timberTreatment, timberWidthMm],
  );

  const initialTimberLabelMode = useMemo<"auto" | "manual">(() => {
    if (!item || item.material_group?.key !== "timber") {
      return "auto";
    }

    const existingGeneratedLabel = buildTimberItemLabel(item.timber_spec);
    return existingGeneratedLabel.length > 0 && item.name === existingGeneratedLabel ? "auto" : "manual";
  }, [item]);

  const [timberLabelMode, setTimberLabelMode] = useState<"auto" | "manual">(initialTimberLabelMode);
  const [manualItemLabel, setManualItemLabel] = useState(item?.name ?? "");
  const displayedItemLabel = isTimberSelected && timberLabelMode === "auto" ? generatedTimberLabel : manualItemLabel;

  return (
    <form action={action} className="space-y-2">
      {item ? <input type="hidden" name="itemId" value={item.id} /> : null}
      <input type="hidden" name="timberLabelMode" value={isTimberSelected ? timberLabelMode : "manual"} />
      {fixedMaterialGroupId ? <input type="hidden" name="materialGroupId" value={fixedMaterialGroupId} /> : null}
      <div className="grid gap-2 md:grid-cols-2">
        <input
          name="itemCode"
          defaultValue={item?.item_code ?? ""}
          placeholder={item ? "Item code" : "Item code (optional)"}
          className={inputClassName}
        />
        <label className="space-y-1 text-sm">
          <span className="text-zinc-700">Item label</span>
          <input
            name="name"
            value={displayedItemLabel}
            onChange={(event) => {
              setManualItemLabel(event.target.value);
              if (isTimberSelected) {
                setTimberLabelMode("manual");
              }
            }}
            placeholder={isTimberSelected ? "Auto-generated from timber spec unless overridden" : "Item label"}
            required={!isTimberSelected}
            className={`${inputClassName} w-full`}
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-zinc-700">Quantity label</span>
          <input
            name="unit"
            defaultValue={item?.unit ?? ""}
            placeholder="Quantity label (for example: pcs, m, kg)"
            required
            className={`${inputClassName} w-full`}
          />
        </label>
        {!hideMaterialGroupSelector ? (
          <select
            name="materialGroupId"
            value={materialGroupId}
            onChange={(event) => setMaterialGroupId(event.target.value)}
            className={inputClassName}
          >
            <option value="">Material group (optional)</option>
            {materialGroups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.label}
              </option>
            ))}
          </select>
        ) : null}
        <input
          name="description"
          defaultValue={item?.description ?? ""}
          placeholder={item ? "Description" : "Description (optional)"}
          className={`${inputClassName} md:col-span-2`}
        />
      </div>

      {isTimberSelected ? (
        <div className={timberGridClassName}>
          <p className="md:col-span-2 text-xs font-medium uppercase tracking-wide text-amber-900">Timber spec</p>
          <input
            name="timberThicknessMm"
            type="number"
            min="0.01"
            step="0.01"
            value={timberThicknessMm}
            onChange={(event) => setTimberThicknessMm(event.target.value)}
            placeholder="Thickness (mm)"
            className={inputClassName}
          />
          <input
            name="timberWidthMm"
            type="number"
            min="0.01"
            step="0.01"
            value={timberWidthMm}
            onChange={(event) => setTimberWidthMm(event.target.value)}
            placeholder="Width (mm)"
            className={inputClassName}
          />
          <input
            name="timberLengthMm"
            type="number"
            min="0.01"
            step="0.01"
            value={timberLengthMm}
            onChange={(event) => setTimberLengthMm(event.target.value)}
            placeholder="Length (mm)"
            className={inputClassName}
          />
          <input
            name="timberGrade"
            value={timberGrade}
            onChange={(event) => setTimberGrade(event.target.value)}
            placeholder="Grade"
            className={inputClassName}
          />
          <input
            name="timberTreatment"
            value={timberTreatment}
            onChange={(event) => setTimberTreatment(event.target.value)}
            placeholder="Treatment"
            className={`${inputClassName} md:col-span-2`}
          />
          <p id={`${formId}-timber-help`} className="md:col-span-2 text-xs text-amber-900">
            The item label defaults to the timber spec, for example <span className="font-medium">90x63 LVL 11 H1.2 12000</span>.
            You can type your own label, or reset it to the current timber spec.
          </p>
          <div className="md:col-span-2 flex flex-wrap items-center gap-2 text-xs text-amber-950">
            <span>Current auto label: {generatedTimberLabel || "Fill in timber specs to generate a label."}</span>
            <button
              type="button"
              className="rounded-md border border-amber-300 px-2 py-1 hover:bg-amber-100"
              onClick={() => {
                setTimberLabelMode("auto");
              }}
            >
              Use auto label
            </button>
          </div>
        </div>
      ) : null}

      {item ? <p className="text-xs text-zinc-500">Material group: {item.material_group?.label ?? "Unassigned"}</p> : null}

      <button type="submit" className="rounded-md border border-zinc-300 px-3 py-1.5 text-zinc-800 hover:bg-zinc-100">
        {submitLabel ?? (item ? "Save" : "Create")}
      </button>
    </form>
  );
}
