"use client";

import { useActionState, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Alert } from "@/src/components/ui/alert";
import { Button } from "@/src/components/ui/button";
import { Card } from "@/src/components/ui/card";
import { FormField } from "@/src/components/ui/form-field";
import { FullScreenDialog } from "@/src/components/ui/full-screen-dialog";
import { Input } from "@/src/components/ui/input";
import { PendingSubmitButton } from "@/src/components/ui/pending-button";
import { Select } from "@/src/components/ui/select";
import { cn } from "@/src/lib/utils";
import {
  ADD_MATERIAL_FIELDS,
  UPDATE_STOCK_LABEL,
  WORKING_LIST_HEADERS,
} from "@/src/lib/stock-take/ui-contract";
import {
  compareTimberMaterialsBySize,
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
  initialRowsByAreaId: Record<string, TimberStockWorkingRow[]>;
};

const initialActionState: StockTakeActionState = { ok: false, message: "" };

export const UNASSIGNED_BAY_TAB = "__unassigned__";

type StockTakeChangeEvent = {
  currentTarget?: EventTarget | null;
  target?: EventTarget | null;
};

type StockTakeValueElement = {
  value: string;
};

type FocusableStockTakeElement = {
  focus: () => void;
};

const hasStringValue = (element: EventTarget | null | undefined): element is EventTarget & StockTakeValueElement => {
  if (!element || typeof element !== "object" || !("value" in element)) {
    return false;
  }

  if (typeof HTMLInputElement !== "undefined" && element instanceof HTMLInputElement) {
    return true;
  }
  if (typeof HTMLSelectElement !== "undefined" && element instanceof HTMLSelectElement) {
    return true;
  }
  if (typeof HTMLTextAreaElement !== "undefined" && element instanceof HTMLTextAreaElement) {
    return true;
  }

  return typeof (element as { value?: unknown }).value === "string";
};

const isFocusableStockTakeElement = (element: Element | null): element is Element & FocusableStockTakeElement =>
  !!element && typeof (element as { focus?: unknown }).focus === "function";

export const readStockTakeChangeValue = (event: StockTakeChangeEvent): string => {
  const element = event.currentTarget ?? event.target;

  return hasStringValue(element) ? element.value : "";
};

export const focusStockTakeRowField = (
  rowKey: string,
  field: "timber" | "level" | "quantity",
  root: ParentNode = document,
): boolean => {
  const fieldElement = root.querySelector(`[data-stock-row-key="${rowKey}"][data-stock-field="${field}"]`);

  if (isFocusableStockTakeElement(fieldElement)) {
    fieldElement.focus();
    return true;
  }

  return false;
};

const getRowBayTabKey = (bay: string) => (bay.trim() ? bay : UNASSIGNED_BAY_TAB);

const isPositiveIntegerBay = (bay: string) => /^\d+$/.test(bay) && Number(bay) > 0;

export const getLowestMissingPositiveNumericBay = (bays: readonly string[]) => {
  const numericBays = new Set(bays.filter(isPositiveIntegerBay).map((bay) => Number(bay)));
  let bay = 1;

  while (numericBays.has(bay)) {
    bay += 1;
  }

  return String(bay);
};

export type BayTab = {
  key: string;
  label: string;
  count: number;
};

const formatBayTabLabel = (bay: string) => {
  if (bay === UNASSIGNED_BAY_TAB) {
    return "Unassigned";
  }

  return `Bay ${bay}`;
};

export const deriveBayTabs = (rows: readonly Pick<DraftRow, "bay">[], addedBays: readonly string[] = []): BayTab[] => {
  const bayValues = new Set<string>(["1", "2", ...addedBays]);
  let hasUnassignedRows = false;
  const counts = new Map<string, number>();

  for (const row of rows) {
    const tabKey = getRowBayTabKey(row.bay);
    counts.set(tabKey, (counts.get(tabKey) ?? 0) + 1);

    if (tabKey === UNASSIGNED_BAY_TAB) {
      hasUnassignedRows = true;
    } else {
      bayValues.add(tabKey);
    }
  }

  const tabs = [...bayValues]
    .sort((left, right) => {
      const leftIsNumeric = isPositiveIntegerBay(left);
      const rightIsNumeric = isPositiveIntegerBay(right);

      if (leftIsNumeric && rightIsNumeric) {
        return Number(left) - Number(right);
      }
      if (leftIsNumeric) {
        return -1;
      }
      if (rightIsNumeric) {
        return 1;
      }
      return left.localeCompare(right, undefined, { numeric: true, sensitivity: "base" });
    })
    .map((bay) => ({
      key: bay,
      label: formatBayTabLabel(bay),
      count: counts.get(bay) ?? 0,
    }));

  if (hasUnassignedRows) {
    tabs.push({
      key: UNASSIGNED_BAY_TAB,
      label: "Unassigned",
      count: counts.get(UNASSIGNED_BAY_TAB) ?? 0,
    });
  }

  return tabs;
};


export const deriveSearchMatchCountByBay = (
  rows: readonly DraftRow[],
  namesById: ReadonlyMap<string, string>,
  search: string,
) => {
  const term = search.trim();
  const counts = new Map<string, number>();

  if (!term) {
    return counts;
  }

  for (const row of rows) {
    if (
      rowMatchesStockTakeSearch(
        {
          timberName: namesById.get(row.timberMaterialId) ?? "Timber material",
          bay: row.bay,
          level: row.level,
        },
        term,
      )
    ) {
      const bayKey = getRowBayTabKey(row.bay);
      counts.set(bayKey, (counts.get(bayKey) ?? 0) + 1);
    }
  }

  return counts;
};

export const deriveSearchMatchCountByArea = (
  rowsByAreaId: Readonly<Record<string, readonly DraftRow[]>>,
  namesById: ReadonlyMap<string, string>,
  search: string,
) => {
  const term = search.trim();
  const counts = new Map<string, number>();

  if (!term) {
    return counts;
  }

  for (const [areaId, rows] of Object.entries(rowsByAreaId)) {
    let matches = 0;
    for (const row of rows) {
      if (
        rowMatchesStockTakeSearch(
          {
            timberName: namesById.get(row.timberMaterialId) ?? "Timber material",
            bay: row.bay,
            level: row.level,
          },
          term,
        )
      ) {
        matches += 1;
      }
    }
    if (matches > 0) {
      counts.set(areaId, matches);
    }
  }

  return counts;
};

const getLevelSortValue = (level: string) => {
  const match = level.trim().match(/^(?:level\s*)?(\d+(?:\.\d+)?)$/i);
  return match ? Number(match[1]) : null;
};

export const compareStockTakeLevels = (left: Pick<DraftRow, "level">, right: Pick<DraftRow, "level">) => {
  const leftLevel = getLevelSortValue(left.level);
  const rightLevel = getLevelSortValue(right.level);

  if (leftLevel !== null && rightLevel !== null) {
    return leftLevel - rightLevel;
  }
  if (leftLevel !== null) {
    return -1;
  }
  if (rightLevel !== null) {
    return 1;
  }
  return 0;
};

const toDraftRows = (rows: readonly TimberStockWorkingRow[]): DraftRow[] =>
  rows.map((row) => ({
    key: row.id,
    timberMaterialId: row.timber_material_id,
    bay: row.bay,
    level: row.level,
    quantity: String(row.quantity),
    persisted: true,
  }));

const buildDraftRowsByAreaId = (
  rowsByAreaId: Record<string, TimberStockWorkingRow[]>,
): Record<string, DraftRow[]> => {
  const result: Record<string, DraftRow[]> = {};
  for (const [areaId, rows] of Object.entries(rowsByAreaId)) {
    result[areaId] = toDraftRows(rows);
  }
  return result;
};

const sortMaterialsBySize = (materials: readonly TimberMaterialRecord[]) =>
  [...materials].sort(compareTimberMaterialsBySize);

const materialNameById = (materials: TimberMaterialRecord[]) =>
  new Map(materials.map((material) => [material.id, material.name]));

const firstBayWithMatches = (
  rows: readonly DraftRow[],
  addedBays: readonly string[],
  namesById: ReadonlyMap<string, string>,
  search: string,
) => {
  const term = search.trim();
  if (!term) {
    return "1";
  }
  const counts = deriveSearchMatchCountByBay(rows, namesById, term);
  const tabs = deriveBayTabs(rows, addedBays);
  for (const tab of tabs) {
    if ((counts.get(tab.key) ?? 0) > 0) {
      return tab.key;
    }
  }
  return "1";
};

type ExcelTabProps = {
  active: boolean;
  onClick: () => void;
  badgeCount?: number;
  badgeLabel?: string;
  ariaLabel?: string;
  size?: "md" | "sm";
  children: ReactNode;
};

// Spreadsheet-style tab (flat, baseline-attached) shared by the area and bay rows.
function ExcelTab({ active, onClick, badgeCount = 0, badgeLabel, ariaLabel, size = "md", children }: ExcelTabProps) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      aria-label={ariaLabel}
      onClick={onClick}
      className={cn(
        "relative -mb-px shrink-0 rounded-t-md border font-medium transition",
        size === "md" ? "px-4 py-2 text-sm" : "px-3 py-1.5 text-sm",
        active
          ? "z-10 border-zinc-300 border-b-white bg-white text-zinc-950 shadow-[0_-1px_2px_rgba(24,24,27,0.04)]"
          : "border-transparent bg-zinc-100 text-zinc-600 hover:bg-zinc-200 hover:text-zinc-900",
      )}
    >
      {badgeCount > 0 ? (
        <span
          className="absolute -right-1 -top-2 min-w-5 rounded-full bg-amber-500 px-1.5 py-0.5 text-center text-[0.65rem] font-bold leading-none text-white shadow-sm ring-2 ring-white"
          aria-label={badgeLabel}
        >
          {badgeCount}
        </span>
      ) : null}
      {children}
    </button>
  );
}

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
  initialRowsByAreaId,
}: StockTakeClientProps) {
  const [selectedAreaId, setSelectedAreaId] = useState(initialAreaId);
  const [rows, setRows] = useState<DraftRow[]>(() => toDraftRows(initialRowsByAreaId[initialAreaId] ?? []));
  const [loadedRows, setLoadedRows] = useState<DraftRow[]>(() => toDraftRows(initialRowsByAreaId[initialAreaId] ?? []));
  // Every area's rows are preloaded into client caches so switching tabs is instant and
  // search badges can be derived across areas without refetching.
  const [draftCacheByAreaId, setDraftCacheByAreaId] = useState<Record<string, DraftRow[]>>(() =>
    buildDraftRowsByAreaId(initialRowsByAreaId),
  );
  const [loadedCacheByAreaId, setLoadedCacheByAreaId] = useState<Record<string, DraftRow[]>>(() =>
    buildDraftRowsByAreaId(initialRowsByAreaId),
  );
  const [addedBaysCacheByAreaId, setAddedBaysCacheByAreaId] = useState<Record<string, string[]>>({});
  const [localMaterials, setLocalMaterials] = useState<TimberMaterialRecord[]>(() => sortMaterialsBySize(materials));
  const [lastUsedMaterialId, setLastUsedMaterialId] = useState("");
  const [search, setSearch] = useState("");
  const [activeBay, setActiveBay] = useState("1");
  const [addedBays, setAddedBays] = useState<string[]>([]);
  const [focusTarget, setFocusTarget] = useState<{ rowKey: string; field: "timber" | "level" | "quantity" } | null>(null);
  const [openRowActionsKey, setOpenRowActionsKey] = useState<string | null>(null);
  const [editingRowKey, setEditingRowKey] = useState<string | null>(null);
  const [editSessionStartRow, setEditSessionStartRow] = useState<DraftRow | null>(null);
  const focusedTargets = useRef(new Set<string>());
  const rowActionsRef = useRef<HTMLUListElement | null>(null);
  const activeBayRef = useRef(activeBay);
  const rowsRef = useRef(rows);
  const selectedAreaIdRef = useRef(selectedAreaId);
  const [areaState, addAreaAction] = useActionState(createStockAreaAction, initialActionState);
  const [materialState, addMaterialAction] = useActionState(createTimberMaterialAction, initialActionState);
  const [updateState, updateStockAction] = useActionState(updateTimberStockAction, initialActionState);
  const [isAreaModalOpen, setIsAreaModalOpen] = useState(false);
  const [isMaterialModalOpen, setIsMaterialModalOpen] = useState(false);
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
  const bayTabs = useMemo(() => deriveBayTabs(rows, addedBays), [addedBays, rows]);
  const searchMatchCountByBay = useMemo(
    () => deriveSearchMatchCountByBay(rows, namesById, search),
    [namesById, rows, search],
  );
  // Merge the live active-area draft over the cached snapshots so the active area's
  // unsaved edits are reflected in the cross-area search badges.
  const rowsByAreaIdForSearch = useMemo(
    () => ({ ...draftCacheByAreaId, [selectedAreaId]: rows }),
    [draftCacheByAreaId, rows, selectedAreaId],
  );
  const searchMatchCountByArea = useMemo(
    () => deriveSearchMatchCountByArea(rowsByAreaIdForSearch, namesById, search),
    [namesById, rowsByAreaIdForSearch, search],
  );
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
    activeBayRef.current = activeBay;
  }, [activeBay]);

  useEffect(() => {
    selectedAreaIdRef.current = selectedAreaId;
  }, [selectedAreaId]);

  useEffect(() => {
    setLocalMaterials(sortMaterialsBySize(materials));
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
      return sortMaterialsBySize([...currentMaterials, material]);
    });
    setLastUsedMaterialId(material.id);
    setRows((currentRows) => [
      ...currentRows,
      {
        key: newKey,
        timberMaterialId: material.id,
        bay: activeBayRef.current === UNASSIGNED_BAY_TAB ? "" : activeBayRef.current,
        level: "",
        quantity: "0",
        persisted: false,
      },
    ]);
    setSearch("");
    setIsMaterialModalOpen(false);
    setEditingRowKey(newKey);
    setEditSessionStartRow({
      key: newKey,
      timberMaterialId: material.id,
      bay: activeBayRef.current === UNASSIGNED_BAY_TAB ? "" : activeBayRef.current,
      level: "",
      quantity: "0",
      persisted: false,
    });
    setFocusTarget({ rowKey: newKey, field: "level" });
  }, [materialState]);

  useEffect(() => {
    if (!updateState.ok) {
      return;
    }
    const savedAreaId = updateState.selectedAreaId ?? selectedAreaIdRef.current;
    if (savedAreaId === selectedAreaIdRef.current) {
      const savedRows = rowsRef.current.map((row) => ({ ...row, persisted: true }));
      setLoadedRows(savedRows);
      setRows(savedRows);
    } else {
      setDraftCacheByAreaId((cache) => ({
        ...cache,
        [savedAreaId]: (cache[savedAreaId] ?? []).map((row) => ({ ...row, persisted: true })),
      }));
      setLoadedCacheByAreaId((cache) => ({
        ...cache,
        [savedAreaId]: (cache[savedAreaId] ?? []).map((row) => ({ ...row, persisted: true })),
      }));
    }
    setOpenRowActionsKey(null);
    setEditingRowKey(null);
    setEditSessionStartRow(null);
  }, [updateState]);

  useEffect(() => {
    if (!bayTabs.some((tab) => tab.key === activeBay)) {
      setActiveBay("1");
    }
  }, [activeBay, bayTabs]);

  useEffect(() => {
    if (!focusTarget) {
      return;
    }

    const focusKey = `${focusTarget.rowKey}:${focusTarget.field}`;
    if (focusedTargets.current.has(focusKey)) {
      return;
    }

    if (focusStockTakeRowField(focusTarget.rowKey, focusTarget.field)) {
      focusedTargets.current.add(focusKey);
    }
  }, [focusTarget, rows]);

  useEffect(() => {
    if (!openRowActionsKey) {
      return;
    }

    const onPointerDown = (event: MouseEvent) => {
      if (!rowActionsRef.current?.contains(event.target as Node)) {
        setOpenRowActionsKey(null);
      }
    };
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpenRowActionsKey(null);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onEscape);
    };
  }, [openRowActionsKey]);

  const visibleRows = useMemo(
    () =>
      rows
        .filter((row) => getRowBayTabKey(row.bay) === activeBay)
        .filter((row) =>
          rowMatchesStockTakeSearch(
            {
              timberName: namesById.get(row.timberMaterialId) ?? "Timber material",
              bay: row.bay,
              level: row.level,
            },
            search,
          ),
        )
        .map((row, index) => ({ row, index }))
        .sort((left, right) => compareStockTakeLevels(left.row, right.row) || left.index - right.index)
        .map(({ row }) => row),
    [activeBay, namesById, rows, search],
  );

  const editingRow = useMemo(
    () => (editingRowKey ? rows.find((row) => row.key === editingRowKey) ?? null : null),
    [editingRowKey, rows],
  );

  const updateRow = (key: string, field: keyof DraftRow, value: string) => {
    setRows((currentRows) =>
      currentRows.map((row) => (row.key === key ? { ...row, [field]: value } : row)),
    );
    if (field === "timberMaterialId") {
      setLastUsedMaterialId(value);
    }
  };

  const startEditingRow = (row: DraftRow, focusField: "timber" | "level" | "quantity" = "timber") => {
    setOpenRowActionsKey(null);
    setEditingRowKey(row.key);
    setEditSessionStartRow({ ...row });
    setFocusTarget({ rowKey: row.key, field: focusField });
  };

  const finishEditingRow = () => {
    const finishedRow = editingRowKey ? rows.find((row) => row.key === editingRowKey) : null;
    if (finishedRow?.timberMaterialId) {
      setLastUsedMaterialId(finishedRow.timberMaterialId);
    }
    setEditingRowKey(null);
    setEditSessionStartRow(null);
  };

  const cancelEditingRow = () => {
    if (editSessionStartRow) {
      setRows((currentRows) =>
        currentRows.map((row) => (row.key === editSessionStartRow.key ? editSessionStartRow : row)),
      );
    }
    finishEditingRow();
  };

  const deleteRow = (key: string) => {
    setOpenRowActionsKey(null);
    setRows((currentRows) => currentRows.filter((row) => row.key !== key));
    if (editingRowKey === key) {
      finishEditingRow();
    }
  };

  const addWorkingRow = () => {
    const newKey = `new-${crypto.randomUUID()}`;
    const defaultMaterialId =
      (lastUsedMaterialId && localMaterials.some((material) => material.id === lastUsedMaterialId)
        ? lastUsedMaterialId
        : localMaterials[0]?.id) ?? "";
    const newRow = {
      key: newKey,
      timberMaterialId: defaultMaterialId,
      bay: activeBay === UNASSIGNED_BAY_TAB ? "" : activeBay,
      level: "",
      quantity: "0",
      persisted: false,
    };
    setRows((currentRows) => [
      ...currentRows,
      newRow,
    ]);
    setSearch("");
    setOpenRowActionsKey(null);
    setEditingRowKey(newKey);
    setEditSessionStartRow(newRow);
    setFocusTarget({ rowKey: newKey, field: "timber" });
  };

  const addBayTab = () => {
    const nextBay = getLowestMissingPositiveNumericBay(bayTabs.map((tab) => tab.key));
    setAddedBays((currentBays) => (currentBays.includes(nextBay) ? currentBays : [...currentBays, nextBay]));
    setActiveBay(nextBay);
    setSearch("");
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

  // In-memory tab switch: drafts for every area stay in client state, so moving
  // between areas keeps unsaved edits and never reloads the page.
  const switchArea = (areaId: string) => {
    if (areaId === selectedAreaId) {
      return;
    }

    setDraftCacheByAreaId((cache) => ({ ...cache, [selectedAreaId]: rows }));
    setLoadedCacheByAreaId((cache) => ({ ...cache, [selectedAreaId]: loadedRows }));
    setAddedBaysCacheByAreaId((cache) => ({ ...cache, [selectedAreaId]: addedBays }));

    const targetDraft = draftCacheByAreaId[areaId] ?? toDraftRows(initialRowsByAreaId[areaId] ?? []);
    const targetLoaded = loadedCacheByAreaId[areaId] ?? toDraftRows(initialRowsByAreaId[areaId] ?? []);
    const targetAddedBays = addedBaysCacheByAreaId[areaId] ?? [];

    setRows(targetDraft);
    setLoadedRows(targetLoaded);
    setAddedBays(targetAddedBays);
    setActiveBay(firstBayWithMatches(targetDraft, targetAddedBays, namesById, search));
    setSelectedAreaId(areaId);
    setOpenRowActionsKey(null);
    setEditingRowKey(null);
    setEditSessionStartRow(null);

    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", `/stock-take?area=${areaId}`);
    }
  };

  // Full reload used only after creating a brand-new area whose (empty) rows are
  // not yet in the client cache. Guards unsaved edits in the active area first.
  const navigateToArea = (areaId: string) => {
    if (hasUnsavedChanges && !window.confirm("You have unsaved stock changes. Leave this area without updating stock?")) {
      return;
    }
    setSelectedAreaId(areaId);
    window.location.href = `/stock-take?area=${areaId}`;
  };

  const [timberHeader, levelHeader, quantityHeader] = WORKING_LIST_HEADERS;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-3 shadow-sm sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 flex-1 sm:max-w-md">
          <FormField label="Search working list" htmlFor="stock_take_search">
            <Input
              id="stock_take_search"
              value={search}
              onChange={(event) => setSearch(readStockTakeChangeValue(event))}
              placeholder="Search timber, bay, or level in this area..."
            />
          </FormField>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:flex sm:shrink-0 sm:items-center">
          <div className="space-y-1">
            <a
              href="/stock-take/export"
              className="inline-flex min-h-12 w-full items-center justify-center rounded-md border border-zinc-300 bg-white px-4 py-3 text-sm font-medium text-zinc-900 shadow-sm transition-colors hover:bg-zinc-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--he-yellow)] sm:w-auto"
            >
              Export Excel
            </a>
            {hasUnsavedChanges ? (
              <p className="max-w-56 text-xs text-amber-700">
                Export uses saved stock only. Update stock first to include your latest edits.
              </p>
            ) : null}
          </div>
          <Button type="button" variant="secondary" size="lg" onClick={() => setIsAreaModalOpen(true)}>
            Add area
          </Button>
          <Button type="button" variant="secondary" size="lg" onClick={() => setIsMaterialModalOpen(true)} disabled={!selectedAreaId}>
            Add new material
          </Button>
        </div>
      </div>

      {areas.length === 0 ? (
        <Card>
          <Alert variant="warning">Add an area before entering timber quantities.</Alert>
        </Card>
      ) : null}

      {selectedArea ? (
        <div>
          <div className="relative">
            <div className="-mx-1 overflow-x-auto px-1">
              <div
                className="flex w-max min-w-full items-end gap-0.5 border-b border-zinc-300 pt-2"
                role="tablist"
                aria-label="Area tabs"
              >
                {areas.map((area) => {
                  const isActive = area.id === selectedAreaId;
                  const areaMatchCount = searchMatchCountByArea.get(area.id) ?? 0;

                  return (
                    <ExcelTab
                      key={area.id}
                      active={isActive}
                      onClick={() => switchArea(area.id)}
                      badgeCount={areaMatchCount}
                      badgeLabel={`${areaMatchCount} search ${areaMatchCount === 1 ? "match" : "matches"} in ${area.name}`}
                      ariaLabel={`Show ${area.name}`}
                    >
                      {area.name}
                    </ExcelTab>
                  );
                })}
              </div>
            </div>
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-zinc-50 via-zinc-50/70 to-transparent"
            />
          </div>

          <Card className="space-y-3 rounded-t-none border-t-0">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-base font-semibold text-zinc-950">
                  Working list for {selectedAreaName}
                </h2>
                <p className="text-sm text-zinc-600">Enter the timber quantities in this area.</p>
              </div>
            </div>

            {hasUnsavedChanges ? (
              <Alert variant="warning">
                Unsaved changes · {changedRowCount} {changedRowCount === 1 ? "row has" : "rows have"} changed.
              </Alert>
            ) : null}

            <div className="flex items-end gap-2 pt-1">
              <div className="relative min-w-0 flex-1">
                <div className="-mx-1 overflow-x-auto px-1">
                  <div className="flex w-max min-w-full flex-nowrap items-end gap-0.5 border-b border-zinc-300 pt-2" role="tablist" aria-label="Bay tabs">
                    {bayTabs.map((tab) => {
                      const isActive = tab.key === activeBay;
                      const searchMatchCount = searchMatchCountByBay.get(tab.key) ?? 0;

                      return (
                        <ExcelTab
                          key={tab.key}
                          active={isActive}
                          onClick={() => {
                            setActiveBay(tab.key);
                          }}
                          size="sm"
                          badgeCount={searchMatchCount}
                          badgeLabel={`${searchMatchCount} search ${searchMatchCount === 1 ? "match" : "matches"} in ${tab.label}`}
                        >
                          {tab.label} <span className={isActive ? "text-zinc-500" : "text-zinc-400"}>({tab.count})</span>
                        </ExcelTab>
                      );
                    })}
                  </div>
                </div>
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-white via-white/80 to-transparent"
                />
              </div>
              <button
                type="button"
                aria-label="Add next bay"
                className="flex min-h-9 min-w-9 shrink-0 items-center justify-center rounded-md border border-dashed border-zinc-400 bg-white text-lg font-semibold leading-none text-zinc-700 hover:border-zinc-600"
                onClick={addBayTab}
              >
                +
              </button>
            </div>

            <form action={updateStockAction} className="space-y-3">
              <input type="hidden" name="area_id" value={selectedAreaId} />
              <input type="hidden" name="rows" value={stockRowsPayloadJson} />
              <div className="hidden pb-1 text-xs font-semibold uppercase tracking-wide text-zinc-500 sm:flex sm:items-center">
                <div className="flex flex-1 items-center gap-4 pr-3">
                  <span className="flex-1">{timberHeader}</span>
                  <span className="w-28 text-right">{levelHeader}</span>
                  <span className="w-28 text-right">{quantityHeader}</span>
                </div>
                <span className="w-10 shrink-0" aria-hidden="true" />
              </div>
              <ul ref={rowActionsRef} className="divide-y divide-zinc-100 border-y border-zinc-100">
                {visibleRows.length === 0 ? (
                  <li className="py-6 text-center text-sm text-zinc-600">
                    {search.trim() ? "No matching timber rows in this bay." : "No timber rows in this bay yet."}
                  </li>
                ) : null}
                {visibleRows.map((row) => {
                  const timberName = namesById.get(row.timberMaterialId) ?? "Timber material";

                  return (
                    <li key={row.key} className="relative sm:flex sm:items-center">
                      <button
                        type="button"
                        className="flex w-full items-start gap-3 py-3 pr-12 text-left transition-colors hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 sm:flex-1 sm:items-center sm:pr-3"
                        onClick={() => startEditingRow(row)}
                      >
                        <div className="min-w-0 flex-1 sm:flex sm:items-center sm:gap-4">
                          <p className="font-medium text-zinc-950 sm:flex-1 sm:truncate">{timberName}</p>
                          <dl className="mt-1 flex flex-wrap gap-x-6 gap-y-1 text-sm sm:mt-0 sm:flex-none sm:gap-4">
                            <div className="flex items-baseline gap-1.5 sm:w-28 sm:justify-end">
                              <dt className="text-zinc-500 sm:hidden">{levelHeader}</dt>
                              <dd className="font-medium text-zinc-900">{row.level || "—"}</dd>
                            </div>
                            <div className="flex items-baseline gap-1.5 sm:w-28 sm:justify-end">
                              <dt className="text-zinc-500 sm:hidden">{quantityHeader}</dt>
                              <dd className="font-medium text-zinc-900">{row.quantity}</dd>
                            </div>
                          </dl>
                        </div>
                      </button>
                      <div className="absolute right-0 top-1.5 sm:relative sm:right-auto sm:top-auto sm:ml-1 sm:flex sm:w-10 sm:shrink-0 sm:justify-center">
                        <button
                          type="button"
                          aria-label={`Actions for ${timberName}`}
                          aria-haspopup="menu"
                          aria-expanded={openRowActionsKey === row.key}
                          className="flex min-h-10 min-w-10 items-center justify-center rounded-full text-xl leading-none text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                          onClick={() => setOpenRowActionsKey((currentKey) => (currentKey === row.key ? null : row.key))}
                        >
                          <span aria-hidden="true">⋯</span>
                        </button>
                        {openRowActionsKey === row.key ? (
                          <div
                            role="menu"
                            className="absolute right-0 top-9 z-20 min-w-28 rounded-md border border-zinc-200 bg-white py-1 text-left shadow-lg"
                          >
                            <button
                              type="button"
                              role="menuitem"
                              className="block w-full px-3 py-2.5 text-left text-sm text-zinc-700 hover:bg-zinc-50"
                              onClick={() => startEditingRow(row)}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              role="menuitem"
                              className="block w-full px-3 py-2.5 text-left text-sm text-red-700 hover:bg-red-50"
                              onClick={() => deleteRow(row.key)}
                            >
                              Delete
                            </button>
                          </div>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
              <button
                type="button"
                aria-label={`Add row to ${formatBayTabLabel(activeBay)}`}
                className="flex min-h-12 w-full items-center justify-center gap-2 rounded-md border border-dashed border-zinc-300 text-sm font-semibold text-zinc-600 transition hover:border-zinc-400 hover:bg-zinc-50 hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                onClick={addWorkingRow}
                disabled={localMaterials.length === 0}
              >
                <span aria-hidden="true">+</span> Add timber row
              </button>
              <div className="sticky bottom-0 -mx-3 flex items-center justify-between gap-3 border-t border-zinc-200 bg-white/95 px-3 py-3 backdrop-blur sm:static sm:mx-0 sm:justify-end sm:border-t-0 sm:bg-transparent sm:px-0 sm:py-0 sm:backdrop-blur-none">
                {hasUnsavedChanges ? (
                  <p className="text-sm font-medium text-amber-700">
                    {changedRowCount} {changedRowCount === 1 ? "change" : "changes"}
                  </p>
                ) : <span />}
                <PendingSubmitButton type="submit" variant="primary" disabled={!selectedAreaId}>
                  {UPDATE_STOCK_LABEL}
                </PendingSubmitButton>
              </div>
            </form>
            <ActionMessage state={updateState} />
          </Card>
        </div>
      ) : null}

      <FullScreenDialog
        open={editingRow !== null}
        eyebrow="Working list"
        title={editSessionStartRow?.persisted ? "Edit timber row" : "Add timber row"}
        subtitle={selectedAreaName}
        description={`Bay ${activeBay === UNASSIGNED_BAY_TAB ? "Unassigned" : activeBay}`}
        closeLabel="Close"
        onClose={cancelEditingRow}
        contentClassName="p-3 sm:max-w-xl sm:p-6"
      >
        {editingRow ? (
          <Card className="mx-auto max-w-xl space-y-4">
            <FormField label={timberHeader} htmlFor="edit_timber">
              <Select
                id="edit_timber"
                data-stock-row-key={editingRow.key}
                data-stock-field="timber"
                className="min-h-12"
                value={editingRow.timberMaterialId}
                onChange={(event) => updateRow(editingRow.key, "timberMaterialId", readStockTakeChangeValue(event))}
                required
              >
                {localMaterials.map((material) => (
                  <option key={material.id} value={material.id}>
                    {material.name}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label={levelHeader} htmlFor="edit_level">
              <Input
                id="edit_level"
                data-stock-row-key={editingRow.key}
                data-stock-field="level"
                className="min-h-12"
                value={editingRow.level}
                onChange={(event) => updateRow(editingRow.key, "level", readStockTakeChangeValue(event))}
              />
            </FormField>
            <FormField label={quantityHeader} htmlFor="edit_quantity">
              <Input
                id="edit_quantity"
                type="number"
                min={0}
                step="0.001"
                data-stock-row-key={editingRow.key}
                data-stock-field="quantity"
                className="min-h-12"
                value={editingRow.quantity}
                onChange={(event) => updateRow(editingRow.key, "quantity", readStockTakeChangeValue(event))}
                required
              />
            </FormField>
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="secondary" size="lg" onClick={cancelEditingRow}>
                Cancel
              </Button>
              <Button type="button" variant="primary" size="lg" onClick={finishEditingRow}>
                Done
              </Button>
            </div>
          </Card>
        ) : null}
      </FullScreenDialog>

      <FullScreenDialog
        open={isAreaModalOpen}
        title="Add area"
        description="Add another active area. Switch between areas using the tabs."
        closeLabel="Close area chooser"
        onClose={() => setIsAreaModalOpen(false)}
        contentClassName="p-3 sm:p-6"
      >
        <Card className="mx-auto max-w-2xl space-y-3">
          {areas.length === 0 ? (
            <Alert variant="warning">Add an area before entering timber quantities.</Alert>
          ) : null}

          <form action={addAreaAction} className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <FormField label="Area name" htmlFor="area_name" className="flex-1">
              <Input id="area_name" name="area_name" required />
            </FormField>
            <PendingSubmitButton type="submit" variant="secondary">
              Add area
            </PendingSubmitButton>
          </form>

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

          <ActionMessage state={areaState} />
        </Card>
      </FullScreenDialog>

      <FullScreenDialog
        open={isMaterialModalOpen}
        title="Add new material"
        description="Create a timber material from its dimensions and specification. The new row will be added to the active bay."
        closeLabel="Close material form"
        onClose={() => setIsMaterialModalOpen(false)}
        contentClassName="p-3 sm:p-6"
      >
        <Card className="mx-auto max-w-2xl space-y-3">
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
                    onChange={(event) => {
                      const nextValue = readStockTakeChangeValue(event);

                      setMaterialPreviewInput((current) => ({
                        ...current,
                        [key]: nextValue,
                      }));
                    }}
                    required
                  />
                </FormField>
              );
            })}
            <FormField label="Generated timber name" className="sm:col-span-2">
              <Input value={preview} readOnly aria-readonly="true" />
            </FormField>
            <div className="flex flex-col gap-2 sm:col-span-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="secondary" onClick={() => setIsMaterialModalOpen(false)}>
                Cancel
              </Button>
              <PendingSubmitButton type="submit" variant="secondary">
                Add new material
              </PendingSubmitButton>
            </div>
          </form>
          <ActionMessage state={materialState} />
        </Card>
      </FullScreenDialog>
    </div>
  );
}
