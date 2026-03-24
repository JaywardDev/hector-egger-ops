"use client";

import { useMemo, useState } from "react";

type MaterialRow = {
  id: string;
  name: string;
  itemCode: string | null;
  unit: string;
  description: string | null;
  timberSpec: {
    thicknessMm: number | null;
    widthMm: number | null;
    lengthMm: number | null;
    grade: string | null;
    treatment: string | null;
  } | null;
};

type MaterialsGroupTableProps = {
  groupKey: string;
  materials: MaterialRow[];
};

type ColumnKey =
  | "name"
  | "code"
  | "quantityLabel"
  | "thickness"
  | "width"
  | "length"
  | "grade"
  | "treatment"
  | "description";

type ColumnDefinition = {
  key: ColumnKey;
  label: string;
  render: (material: MaterialRow) => string;
};

const defaultColumnKeys: ColumnKey[] = ["name", "code", "quantityLabel"];

const allColumnDefinitions: Record<ColumnKey, ColumnDefinition> = {
  name: {
    key: "name",
    label: "Material label",
    render: (material) => material.name,
  },
  code: {
    key: "code",
    label: "Code",
    render: (material) => material.itemCode ?? "—",
  },
  quantityLabel: {
    key: "quantityLabel",
    label: "Quantity label",
    render: (material) => material.unit,
  },
  thickness: {
    key: "thickness",
    label: "Thickness",
    render: (material) =>
      material.timberSpec?.thicknessMm === null ||
      material.timberSpec?.thicknessMm === undefined
        ? "—"
        : `${material.timberSpec.thicknessMm} mm`,
  },
  width: {
    key: "width",
    label: "Width",
    render: (material) =>
      material.timberSpec?.widthMm === null ||
      material.timberSpec?.widthMm === undefined
        ? "—"
        : `${material.timberSpec.widthMm} mm`,
  },
  length: {
    key: "length",
    label: "Length",
    render: (material) =>
      material.timberSpec?.lengthMm === null ||
      material.timberSpec?.lengthMm === undefined
        ? "—"
        : `${material.timberSpec.lengthMm} mm`,
  },
  grade: {
    key: "grade",
    label: "Grade",
    render: (material) => material.timberSpec?.grade ?? "—",
  },
  treatment: {
    key: "treatment",
    label: "Treatment",
    render: (material) => material.timberSpec?.treatment ?? "—",
  },
  description: {
    key: "description",
    label: "Description",
    render: (material) => material.description ?? "—",
  },
};

const getAvailableColumnKeys = ({
  groupKey,
  materials,
}: {
  groupKey: string;
  materials: MaterialRow[];
}): ColumnKey[] => {
  const keys = new Set<ColumnKey>(defaultColumnKeys);
  const isTimberGroup = groupKey === "timber";

  if (isTimberGroup) {
    keys.add("thickness");
    keys.add("width");
    keys.add("length");
    keys.add("grade");
    keys.add("treatment");
  }

  if (materials.some((material) => Boolean(material.description))) {
    keys.add("description");
  }

  return Array.from(keys);
};

export function MaterialsGroupTable({
  groupKey,
  materials,
}: MaterialsGroupTableProps) {
  const availableColumnKeys = useMemo(
    () => getAvailableColumnKeys({ groupKey, materials }),
    [groupKey, materials],
  );
  const [visibleColumnKeys, setVisibleColumnKeys] =
    useState<ColumnKey[]>(defaultColumnKeys);

  const selectedColumnKeys = useMemo(
    () =>
      availableColumnKeys.filter((columnKey) =>
        visibleColumnKeys.includes(columnKey),
      ),
    [availableColumnKeys, visibleColumnKeys],
  );

  const onToggleColumn = (columnKey: ColumnKey, checked: boolean) => {
    if (defaultColumnKeys.includes(columnKey)) {
      return;
    }

    setVisibleColumnKeys((current) => {
      if (checked) {
        return current.includes(columnKey) ? current : [...current, columnKey];
      }
      return current.filter((key) => key !== columnKey);
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-zinc-600">
          Reference list of material definitions used for stock takes.
        </p>
        <details className="relative">
          <summary className="cursor-pointer list-none rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-xs font-medium text-zinc-800 hover:bg-zinc-50">
            Add column
          </summary>
          <div className="absolute right-0 z-10 mt-2 w-52 rounded-md border border-zinc-200 bg-white p-3 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              Available columns
            </p>
            <div className="mt-2 space-y-2">
              {availableColumnKeys.map((columnKey) => {
                const definition = allColumnDefinitions[columnKey];
                const isDefaultColumn = defaultColumnKeys.includes(columnKey);
                const isChecked = selectedColumnKeys.includes(columnKey);

                return (
                  <label
                    key={columnKey}
                    className="flex items-center gap-2 text-sm text-zinc-700"
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      disabled={isDefaultColumn}
                      onChange={(event) =>
                        onToggleColumn(columnKey, event.target.checked)
                      }
                    />
                    <span>{definition.label}</span>
                  </label>
                );
              })}
            </div>
          </div>
        </details>
      </div>

      {materials.length === 0 ? (
        <p className="rounded-md border border-zinc-200 bg-white px-3 py-2">
          No materials in this group yet.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-md border border-zinc-200 bg-white">
          <table className="min-w-full border-collapse text-sm">
            <thead className="bg-zinc-100 text-left text-xs uppercase tracking-wide text-zinc-600">
              <tr>
                {selectedColumnKeys.map((columnKey) => (
                  <th key={columnKey} className="px-3 py-2 font-medium">
                    {allColumnDefinitions[columnKey].label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {materials.map((material) => (
                <tr key={material.id} className="border-t border-zinc-200">
                  {selectedColumnKeys.map((columnKey) => (
                    <td key={columnKey} className="px-3 py-2 text-zinc-700">
                      {allColumnDefinitions[columnKey].render(material)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
