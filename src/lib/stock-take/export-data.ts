import "server-only";

import { createServerSupabaseClient } from "@/src/lib/supabase/server";
import { withServerTiming } from "@/src/lib/server-timing";
import { createSessionHeaders } from "@/src/lib/production/access";
import { assertTimberStockReadAccess } from "@/src/lib/stock-take/access";
import type { StockAreaRecord, StockTakeActor } from "@/src/lib/stock-take/types";

const exportAreaSelect = "id,name,is_active,created_by_profile_id,created_at,updated_at";
const exportRowSelect = "area_id,bay,level,quantity,timber_materials(name)";

export type StockTakeExportSavedRow = {
  areaName: string;
  bay: string;
  level: string;
  timberName: string;
  quantity: number;
};

export type StockTakeExportBay = {
  bay: string;
  rows: StockTakeExportSavedRow[];
};

export type StockTakeExportArea = {
  name: string;
  bays: StockTakeExportBay[];
};

export type StockTakeExportSummaryRow = {
  timberName: string;
  quantity: number;
};

export type StockTakeExportData = {
  areas: StockTakeExportArea[];
  summaryRows: StockTakeExportSummaryRow[];
};

type TimberStockExportRestRecord = {
  area_id: string;
  bay: string | null;
  level: string | null;
  quantity: number | string | null;
  timber_materials?: { name?: string | null } | null;
};

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

export const compareStockTakeExportValues = (left: string, right: string) =>
  collator.compare(left.trim(), right.trim());

const toNumericQuantity = (quantity: number | string | null) => {
  if (typeof quantity === "number" && Number.isFinite(quantity)) {
    return quantity;
  }

  const parsed = Number(quantity ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const toAreaIdFilter = (areas: readonly StockAreaRecord[]) => `in.(${areas.map((area) => area.id).join(",")})`;

export const buildStockTakeExportData = (
  areas: readonly StockAreaRecord[],
  savedRows: readonly TimberStockExportRestRecord[],
): StockTakeExportData => {
  const areaNamesById = new Map(areas.map((area) => [area.id, area.name]));
  const rowsByArea = new Map<string, StockTakeExportSavedRow[]>();
  const summaryTotals = new Map<string, number>();

  for (const area of areas) {
    rowsByArea.set(area.id, []);
  }

  for (const row of savedRows) {
    const areaName = areaNamesById.get(row.area_id);
    if (!areaName) {
      continue;
    }

    const timberName = row.timber_materials?.name?.trim() || "Timber material";
    const exportRow: StockTakeExportSavedRow = {
      areaName,
      bay: row.bay?.trim() ?? "",
      level: row.level?.trim() ?? "",
      timberName,
      quantity: toNumericQuantity(row.quantity),
    };

    rowsByArea.get(row.area_id)?.push(exportRow);
    summaryTotals.set(timberName, (summaryTotals.get(timberName) ?? 0) + exportRow.quantity);
  }

  const exportAreas = areas.map((area) => {
    const bayMap = new Map<string, StockTakeExportSavedRow[]>();
    for (const row of rowsByArea.get(area.id) ?? []) {
      bayMap.set(row.bay, [...(bayMap.get(row.bay) ?? []), row]);
    }

    const bays = [...bayMap.entries()]
      .sort(([left], [right]) => compareStockTakeExportValues(left, right))
      .map(([bay, bayRows]) => ({
        bay,
        rows: bayRows.sort(
          (left, right) =>
            compareStockTakeExportValues(left.level, right.level) ||
            compareStockTakeExportValues(left.timberName, right.timberName),
        ),
      }));

    return { name: area.name, bays };
  });

  const summaryRows = [...summaryTotals.entries()]
    .sort(([left], [right]) => compareStockTakeExportValues(left, right))
    .map(([timberName, quantity]) => ({ timberName, quantity }));

  return { areas: exportAreas, summaryRows };
};

export const getStockTakeExportData = async (actor: StockTakeActor): Promise<StockTakeExportData> =>
  withServerTiming({
    name: "getStockTakeExportData",
    route: actor.route,
    operation: async () => {
      await assertTimberStockReadAccess(actor);
      const areaSearchParams = new URLSearchParams({
        select: exportAreaSelect,
        order: "name.asc",
      });
      const areasResponse = await createServerSupabaseClient().request(
        `/rest/v1/stock_areas?${areaSearchParams.toString()}`,
        { cache: "no-store", headers: createSessionHeaders(actor.session) },
      );
      if (!areasResponse.ok) {
        throw new Error("Failed to load stock areas for export.");
      }
      const areas = (await areasResponse.json()) as StockAreaRecord[];

      if (areas.length === 0) {
        return buildStockTakeExportData([], []);
      }

      const searchParams = new URLSearchParams({
        select: exportRowSelect,
        area_id: toAreaIdFilter(areas),
        order: "area_id.asc,bay.asc,level.asc,created_at.asc",
      });
      const response = await createServerSupabaseClient().request(
        `/rest/v1/timber_stock_rows?${searchParams.toString()}`,
        { cache: "no-store", headers: createSessionHeaders(actor.session) },
      );
      if (!response.ok) {
        throw new Error("Failed to load stock-take export data.");
      }

      return buildStockTakeExportData(areas, (await response.json()) as TimberStockExportRestRecord[]);
    },
  });
