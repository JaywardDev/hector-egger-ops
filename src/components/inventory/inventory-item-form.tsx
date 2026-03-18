"use client";

import { useId, useMemo, useState } from "react";
import type { InventoryItemRecord, MaterialGroupRecord } from "@/src/lib/inventory/items";

type InventoryItemFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  materialGroups: MaterialGroupRecord[];
  item?: InventoryItemRecord;
};

const inputClassName = "rounded-md border border-zinc-300 px-2 py-1.5";
const timberGridClassName = "grid gap-2 border border-amber-200 bg-amber-50/50 p-3 md:grid-cols-2";

export function InventoryItemForm({ action, materialGroups, item }: InventoryItemFormProps) {
  const formId = useId();
  const timberGroupId = useMemo(() => materialGroups.find((group) => group.key === "timber")?.id ?? "", [materialGroups]);
  const [materialGroupId, setMaterialGroupId] = useState(item?.material_group_id ?? "");
  const isTimberSelected = materialGroupId !== "" && materialGroupId === timberGroupId;

  return (
    <form action={action} className="space-y-2">
      {item ? <input type="hidden" name="itemId" value={item.id} /> : null}
      <div className="grid gap-2 md:grid-cols-2">
        <input
          name="itemCode"
          defaultValue={item?.item_code ?? ""}
          placeholder={item ? "Item code" : "Item code (optional)"}
          className={inputClassName}
        />
        <input name="name" defaultValue={item?.name ?? ""} placeholder="Name" required className={inputClassName} />
        <input name="unit" defaultValue={item?.unit ?? ""} placeholder="Unit" required className={inputClassName} />
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
            defaultValue={item?.timber_spec?.thickness_mm ?? ""}
            placeholder="Thickness (mm)"
            className={inputClassName}
          />
          <input
            name="timberWidthMm"
            type="number"
            min="0.01"
            step="0.01"
            defaultValue={item?.timber_spec?.width_mm ?? ""}
            placeholder="Width (mm)"
            className={inputClassName}
          />
          <input
            name="timberLengthMm"
            type="number"
            min="0.01"
            step="0.01"
            defaultValue={item?.timber_spec?.length_mm ?? ""}
            placeholder="Length (mm)"
            className={inputClassName}
          />
          <input
            name="timberGrade"
            defaultValue={item?.timber_spec?.grade ?? ""}
            placeholder="Grade"
            className={inputClassName}
          />
          <input
            name="timberTreatment"
            defaultValue={item?.timber_spec?.treatment ?? ""}
            placeholder="Treatment"
            className={`${inputClassName} md:col-span-2`}
          />
          <p id={`${formId}-timber-help`} className="md:col-span-2 text-xs text-amber-900">
            Leave all timber spec fields blank to keep the item generic within the timber group.
          </p>
        </div>
      ) : null}

      {item ? <p className="text-xs text-zinc-500">Material group: {item.material_group?.label ?? "Unassigned"}</p> : null}

      <button type="submit" className="rounded-md border border-zinc-300 px-3 py-1.5 text-zinc-800 hover:bg-zinc-100">
        {item ? "Save" : "Create"}
      </button>
    </form>
  );
}
