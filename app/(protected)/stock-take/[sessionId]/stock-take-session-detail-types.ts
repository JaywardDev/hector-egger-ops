export type MaterialGroupOption = {
  id: string;
  key: string;
  label: string;
};

export type InventoryItemOption = {
  id: string;
  name: string;
  item_code: string | null;
  unit: string;
  material_group: { id: string; label: string | null } | null;
};

export type StockLocationOption = {
  id: string;
  name: string;
  code: string | null;
};

export type EntryRow = {
  id: string;
  inventory_item: {
    id: string;
    name: string;
    item_code: string | null;
    unit: string;
    material_group: { label: string | null } | null;
  } | null;
  counted_quantity: number;
  stock_location: { id?: string; name: string; code: string | null } | null;
  notes: string | null;
  updated_at: string | null;
  entered_at: string;
};

export type DraftRow = {
  clientId: string;
  entryId: string | null;
  inventoryItemId: string | null;
  countedQuantity: number;
  stockLocationId: string | null;
  notes: string | null;
  newMaterial: {
    materialGroupId: string;
    description: string | null;
    unit: string | null;
    name: string | null;
    itemCode: string | null;
    timberSpec: {
      thicknessMm: number | null;
      widthMm: number | null;
      lengthMm: number | null;
      grade: string | null;
      treatment: string | null;
    } | null;
  } | null;
  enteredAt: string;
  updatedAt: string | null;
};

export type RowEditBuffer = {
  inventoryItemId: string | null;
  countedQuantity: string;
  stockLocationId: string;
  notes: string;
};

export const formatLocationLabel = (location: {
  name: string;
  code: string | null;
}) => (location.code ? `${location.name} (${location.code})` : location.name);

export const toDraftRows = (rows: EntryRow[]): DraftRow[] =>
  rows.map((row) => ({
    clientId: `persisted-${row.id}`,
    entryId: row.id,
    inventoryItemId: row.inventory_item?.id ?? null,
    countedQuantity: row.counted_quantity,
    stockLocationId: row.stock_location?.id ?? null,
    notes: row.notes,
    newMaterial: null,
    enteredAt: row.entered_at,
    updatedAt: row.updated_at,
  }));

export const toComparableRows = (rows: DraftRow[]) =>
  rows
    .map((row) => ({
      entryId: row.entryId,
      inventoryItemId: row.inventoryItemId,
      countedQuantity: row.countedQuantity,
      stockLocationId: row.stockLocationId,
      notes: row.notes ?? null,
      newMaterial: row.newMaterial,
    }))
    .sort((a, b) =>
      `${a.entryId ?? ""}-${a.inventoryItemId ?? ""}`.localeCompare(
        `${b.entryId ?? ""}-${b.inventoryItemId ?? ""}`,
      ),
    );
