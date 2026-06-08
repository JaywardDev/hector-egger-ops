export const NO_LOCATION_SCOPE_KEY = "__none__";

export type TimberStockBatchExistingChange = {
  kind: "existing";
  inventoryItemId: string;
  stockLocationId: string | null;
  countedQuantity: number;
  bay?: string | null;
  level?: string | null;
  notes?: string | null;
};

export type TimberStockBatchMissingChange = {
  kind: "missing";
  clientId: string;
  stockLocationId: string | null;
  countedQuantity: number;
  bay?: string | null;
  level?: string | null;
  notes?: string | null;
  newMaterial: {
    itemCode: string | null;
    name: string | null;
    unit: string | null;
    description: string | null;
    timberSpec: {
      thicknessMm: number | null;
      widthMm: number | null;
      lengthMm: number | null;
      grade: string | null;
      treatment: string | null;
    } | null;
  };
};

export type TimberStockBatchChange =
  | TimberStockBatchExistingChange
  | TimberStockBatchMissingChange;

export type ResolvedTimberStockBatchChange = Omit<
  TimberStockBatchExistingChange,
  "kind"
> & {
  kind: "existing";
};

export type CurrentScopeBalanceForBatch = {
  inventoryItemId: string;
  stockLocationId: string | null;
  quantity: number;
};

export type StockTakeFinalizeEntryRow = {
  entryId: null;
  inventoryItemId: string;
  stockLocationId: string | null;
  countedQuantity: number;
  bay: string | null;
  level: string | null;
  notes: string | null;
};

export const toStockLocationScopeKey = (stockLocationId: string | null) =>
  stockLocationId ?? NO_LOCATION_SCOPE_KEY;

export const toTimberStockChangeKey = ({
  inventoryItemId,
  stockLocationId,
}: {
  inventoryItemId: string;
  stockLocationId: string | null;
}) => `${inventoryItemId}:${toStockLocationScopeKey(stockLocationId)}`;

export const countAffectedLocationScopes = (
  changes: Pick<TimberStockBatchChange, "stockLocationId">[],
) => new Set(changes.map((change) => toStockLocationScopeKey(change.stockLocationId))).size;

export const buildFinalizedEntryRowsForScope = ({
  currentBalances,
  changes,
  stockLocationId,
}: {
  currentBalances: CurrentScopeBalanceForBatch[];
  changes: ResolvedTimberStockBatchChange[];
  stockLocationId: string | null;
}): StockTakeFinalizeEntryRow[] => {
  const rowsByItemId = new Map<string, StockTakeFinalizeEntryRow>();

  for (const balance of currentBalances) {
    rowsByItemId.set(balance.inventoryItemId, {
      entryId: null,
      inventoryItemId: balance.inventoryItemId,
      stockLocationId,
      countedQuantity: balance.quantity,
      bay: null,
      level: null,
      notes: null,
    });
  }

  for (const change of changes) {
    rowsByItemId.set(change.inventoryItemId, {
      entryId: null,
      inventoryItemId: change.inventoryItemId,
      stockLocationId,
      countedQuantity: change.countedQuantity,
      bay: change.bay ?? null,
      level: change.level ?? null,
      notes: change.notes ?? null,
    });
  }

  return [...rowsByItemId.values()].sort((a, b) =>
    a.inventoryItemId.localeCompare(b.inventoryItemId),
  );
};
