import "server-only";

import type { AuthSession } from "@/src/lib/auth/session";
import { createServerSupabaseClient } from "@/src/lib/supabase/server";
import { withServerTiming } from "@/src/lib/server-timing";
import { TIMBER_MATERIAL_GROUP_KEY } from "@/src/lib/inventory/item-labels";

const createSessionHeaders = (session: AuthSession) => ({
  Authorization: `Bearer ${session.accessToken}`,
});

const stockBalanceSelect =
  "inventory_item_id,stock_location_id,quantity,source_stock_take_session_id,last_finalized_at,updated_at,stock_location:stock_locations(id,code,name),inventory_item:inventory_items(id,item_code,name,unit,material_group_id,material_group:material_groups(id,key,label),timber_spec:inventory_item_timber_specs(thickness_mm,width_mm,length_mm,grade,treatment))";

type StockBalanceInventoryItem = {
  id: string;
  item_code: string | null;
  name: string;
  unit: string;
  material_group_id: string | null;
  material_group: {
    id: string;
    key: string;
    label: string | null;
  } | null;
  timber_spec: {
    thickness_mm: number | null;
    width_mm: number | null;
    length_mm: number | null;
    grade: string | null;
    treatment: string | null;
  } | null;
};

type StockBalanceLocation = {
  id: string;
  code: string | null;
  name: string;
};

type StockBalanceRow = {
  inventory_item_id: string;
  stock_location_id: string | null;
  quantity: number;
  source_stock_take_session_id: string;
  last_finalized_at: string;
  updated_at: string;
  stock_location: StockBalanceLocation | null;
  inventory_item: StockBalanceInventoryItem | null;
};

export type CurrentTimberStockBalance = {
  inventoryItemId: string;
  itemCode: string | null;
  itemName: string;
  unit: string;
  timberSpec: StockBalanceInventoryItem["timber_spec"];
  materialGroup: StockBalanceInventoryItem["material_group"];
  stockLocationId: string | null;
  stockLocation: StockBalanceLocation | null;
  quantity: number;
  sourceStockTakeSessionId: string;
  lastFinalizedAt: string;
  updatedAt: string;
};

export type CurrentStockBalanceForScope = CurrentTimberStockBalance;

const mapStockBalanceRow = (row: StockBalanceRow): CurrentStockBalanceForScope | null => {
  if (!row.inventory_item) {
    return null;
  }

  return {
    inventoryItemId: row.inventory_item_id,
    itemCode: row.inventory_item.item_code,
    itemName: row.inventory_item.name,
    unit: row.inventory_item.unit,
    timberSpec: row.inventory_item.timber_spec,
    materialGroup: row.inventory_item.material_group,
    stockLocationId: row.stock_location_id,
    stockLocation: row.stock_location,
    quantity: Number(row.quantity),
    sourceStockTakeSessionId: row.source_stock_take_session_id,
    lastFinalizedAt: row.last_finalized_at,
    updatedAt: row.updated_at,
  };
};

export const listCurrentTimberStockBalances = async ({
  session,
  route,
}: {
  session: AuthSession;
  route?: string;
}): Promise<CurrentTimberStockBalance[]> =>
  withServerTiming({
    name: "listCurrentTimberStockBalances",
    route,
    operation: async () => {
      const supabase = createServerSupabaseClient();
      const response = await supabase.request(
        `/rest/v1/inventory_stock_balances?select=${stockBalanceSelect}&order=last_finalized_at.desc`,
        {
          cache: "no-store",
          headers: createSessionHeaders(session),
        },
      );

      if (!response.ok) {
        throw new Error("Failed to load current timber stock");
      }

      const rows = (await response.json()) as StockBalanceRow[];
      return rows
        .map(mapStockBalanceRow)
        .filter((row): row is CurrentTimberStockBalance =>
          Boolean(row?.materialGroup?.key === TIMBER_MATERIAL_GROUP_KEY),
        );
    },
  });

export const listCurrentStockBalancesForLocationScope = async ({
  session,
  route,
  stockLocationId,
}: {
  session: AuthSession;
  route?: string;
  stockLocationId: string | null;
}): Promise<CurrentStockBalanceForScope[]> =>
  withServerTiming({
    name: "listCurrentStockBalancesForLocationScope",
    route,
    meta: { stockLocationId },
    operation: async () => {
      const locationFilter = stockLocationId
        ? `stock_location_id=eq.${stockLocationId}`
        : "stock_location_id=is.null";
      const supabase = createServerSupabaseClient();
      const response = await supabase.request(
        `/rest/v1/inventory_stock_balances?${locationFilter}&select=${stockBalanceSelect}&order=inventory_item_id.asc`,
        {
          cache: "no-store",
          headers: createSessionHeaders(session),
        },
      );

      if (!response.ok) {
        throw new Error("Failed to load current stock for the selected location");
      }

      const rows = (await response.json()) as StockBalanceRow[];
      return rows
        .map(mapStockBalanceRow)
        .filter((row): row is CurrentStockBalanceForScope => Boolean(row));
    },
  });
