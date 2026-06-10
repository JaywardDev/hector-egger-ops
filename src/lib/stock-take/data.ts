import "server-only";

import { createServiceRoleSupabaseClient } from "@/src/lib/supabase/service-role";
import { createServerSupabaseClient } from "@/src/lib/supabase/server";
import { withServerTiming } from "@/src/lib/server-timing";
import { createSessionHeaders } from "@/src/lib/production/access";
import {
  assertTimberStockReadAccess,
  assertTimberStockWriteAccess,
} from "@/src/lib/stock-take/access";
import type {
  StockAreaRecord,
  StockTakeActor,
  TimberMaterialRecord,
  TimberStockRowInput,
  TimberStockRowRecord,
  TimberStockWorkingRow,
} from "@/src/lib/stock-take/types";
import {
  buildAreaPayload,
  generateTimberMaterialName,
  normalizeAreaNameForLookup,
  normalizeBayLevelValue,
  normalizeDuplicateLookupValue,
  normalizeQuantity,
  normalizeTimberMaterialForLookup,
  normalizeTimberMaterialInput,
  type TimberMaterialInput,
} from "@/src/lib/stock-take/validation";

const areaSelect = "id,name,is_active,created_by_profile_id,created_at,updated_at";
const materialSelect = "id,height,width,length,grade,treatment,name,is_active,created_at,updated_at";
const rowSelect = "id,area_id,timber_material_id,bay,level,quantity,updated_by_profile_id,created_at,updated_at";

type TimberStockRowRestRecord = TimberStockRowRecord & {
  timber_materials?: { name: string } | null;
};

const encodeIlike = (value: string) => `ilike.${encodeURIComponent(value)}`;

export const listActiveStockAreas = async (actor: StockTakeActor): Promise<StockAreaRecord[]> =>
  withServerTiming({
    name: "listActiveStockAreas",
    route: actor.route,
    operation: async () => {
      await assertTimberStockReadAccess(actor);
      const searchParams = new URLSearchParams({
        select: areaSelect,
        is_active: "eq.true",
        order: "name.asc",
      });
      const response = await createServerSupabaseClient().request(
        `/rest/v1/stock_areas?${searchParams.toString()}`,
        { cache: "no-store", headers: createSessionHeaders(actor.session) },
      );
      if (!response.ok) {
        throw new Error("Failed to load areas.");
      }
      return (await response.json()) as StockAreaRecord[];
    },
  });

export const createStockArea = async (
  actor: StockTakeActor & { name: string; createdByProfileId?: string },
): Promise<StockAreaRecord> => {
  await assertTimberStockWriteAccess(actor);
  const payload = buildAreaPayload({ name: actor.name }, actor.createdByProfileId);
  const existing = await findStockAreaByName(actor, payload.name);
  if (existing) {
    return existing;
  }

  const response = await createServiceRoleSupabaseClient().request(
    `/rest/v1/stock_areas?select=${areaSelect}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Prefer: "return=representation,resolution=ignore-duplicates",
      },
      body: JSON.stringify(payload),
    },
  );
  if (!response.ok) {
    const duplicate = await findStockAreaByName(actor, payload.name);
    if (duplicate) {
      return duplicate;
    }
    throw new Error("Failed to add area.");
  }
  const records = (await response.json()) as StockAreaRecord[];
  if (records[0]) {
    return records[0];
  }

  const insertedExisting = await findStockAreaByName(actor, payload.name);
  if (!insertedExisting) {
    throw new Error("Area already exists, but could not be loaded.");
  }
  return insertedExisting;
};

export const findStockAreaByName = async (
  actor: StockTakeActor,
  name: string,
): Promise<StockAreaRecord | null> => {
  await assertTimberStockReadAccess(actor);
  const normalizedName = normalizeAreaNameForLookup(name);
  const response = await createServerSupabaseClient().request(
    `/rest/v1/stock_areas?select=${areaSelect}&name=${encodeIlike(normalizedName)}&limit=10`,
    { cache: "no-store", headers: createSessionHeaders(actor.session) },
  );
  if (!response.ok) {
    throw new Error("Failed to load area.");
  }
  const records = (await response.json()) as StockAreaRecord[];
  return records.find((record) => normalizeDuplicateLookupValue(record.name) === normalizedName) ?? null;
};

export const listActiveTimberMaterials = async (
  actor: StockTakeActor,
): Promise<TimberMaterialRecord[]> =>
  withServerTiming({
    name: "listActiveTimberMaterials",
    route: actor.route,
    operation: async () => {
      await assertTimberStockReadAccess(actor);
      const searchParams = new URLSearchParams({
        select: materialSelect,
        is_active: "eq.true",
        order: "name.asc",
      });
      const response = await createServerSupabaseClient().request(
        `/rest/v1/timber_materials?${searchParams.toString()}`,
        { cache: "no-store", headers: createSessionHeaders(actor.session) },
      );
      if (!response.ok) {
        throw new Error("Failed to load timber materials.");
      }
      return (await response.json()) as TimberMaterialRecord[];
    },
  });

export const createTimberMaterial = async (
  actor: StockTakeActor & { input: TimberMaterialInput },
): Promise<TimberMaterialRecord> => {
  await assertTimberStockWriteAccess(actor);
  const material = normalizeTimberMaterialInput(actor.input);
  const existing = await findTimberMaterialByInput(actor, material);
  if (existing) {
    return existing;
  }

  const response = await createServiceRoleSupabaseClient().request(
    `/rest/v1/timber_materials?select=${materialSelect}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", Prefer: "return=representation" },
      body: JSON.stringify(material),
    },
  );
  if (!response.ok) {
    const duplicate = await findTimberMaterialByInput(actor, material);
    if (duplicate) {
      return duplicate;
    }
    throw new Error("Failed to add timber material.");
  }
  const [record] = (await response.json()) as TimberMaterialRecord[];
  if (!record) {
    throw new Error("Timber material was not returned.");
  }
  return record;
};

export const findTimberMaterialByInput = async (
  actor: StockTakeActor,
  input: TimberMaterialInput,
): Promise<TimberMaterialRecord | null> => {
  await assertTimberStockReadAccess(actor);
  const material = normalizeTimberMaterialInput(input);
  const normalized = normalizeTimberMaterialForLookup(material);
  const normalizedName = normalizeDuplicateLookupValue(generateTimberMaterialName(material));
  const response = await createServerSupabaseClient().request(
    `/rest/v1/timber_materials?select=${materialSelect}&name=${encodeIlike(normalizedName)}&limit=10`,
    { cache: "no-store", headers: createSessionHeaders(actor.session) },
  );
  if (!response.ok) {
    throw new Error("Failed to load timber material.");
  }
  const records = (await response.json()) as TimberMaterialRecord[];
  return records.find((record) => {
    const recordFields = normalizeTimberMaterialForLookup(record);
    return (
      recordFields.height === normalized.height &&
      recordFields.width === normalized.width &&
      recordFields.length === normalized.length &&
      recordFields.grade === normalized.grade &&
      recordFields.treatment === normalized.treatment
    );
  }) ?? null;
};

export const findTimberMaterialByName = async (
  actor: StockTakeActor,
  name: string,
): Promise<TimberMaterialRecord | null> => {
  await assertTimberStockReadAccess(actor);
  const normalizedName = normalizeDuplicateLookupValue(name);
  const response = await createServerSupabaseClient().request(
    `/rest/v1/timber_materials?select=${materialSelect}&name=${encodeIlike(normalizedName)}&limit=10`,
    { cache: "no-store", headers: createSessionHeaders(actor.session) },
  );
  if (!response.ok) {
    throw new Error("Failed to load timber material.");
  }
  const records = (await response.json()) as TimberMaterialRecord[];
  return records.find((record) => normalizeDuplicateLookupValue(record.name) === normalizedName) ?? null;
};

export const listTimberStockRowsForArea = async (
  actor: StockTakeActor & { areaId: string },
): Promise<TimberStockWorkingRow[]> =>
  withServerTiming({
    name: "listTimberStockRowsForArea",
    route: actor.route,
    meta: { areaId: actor.areaId },
    operation: async () => {
      await assertTimberStockReadAccess(actor);
      const searchParams = new URLSearchParams({
        select: `${rowSelect},timber_materials(name)`,
        area_id: `eq.${actor.areaId}`,
        order: "bay.asc,level.asc,created_at.asc",
      });
      const response = await createServerSupabaseClient().request(
        `/rest/v1/timber_stock_rows?${searchParams.toString()}`,
        { cache: "no-store", headers: createSessionHeaders(actor.session) },
      );
      if (!response.ok) {
        throw new Error("Failed to load working list.");
      }
      const rows = (await response.json()) as TimberStockRowRestRecord[];
      return rows.map((row) => ({
        ...row,
        timber_name: row.timber_materials?.name ?? "Timber material",
      }));
    },
  });

export const updateTimberStockRowsForArea = async (
  actor: StockTakeActor & {
    areaId: string;
    rows: TimberStockRowInput[];
    updatedByProfileId?: string;
  },
): Promise<TimberStockRowRecord[]> => {
  await assertTimberStockWriteAccess(actor);

  const payload = actor.rows.map((row) => {
    const timberMaterialId = row.timberMaterialId.trim();
    if (!timberMaterialId) {
      throw new Error("Timber material is required.");
    }

    return {
      timberMaterialId,
      bay: normalizeBayLevelValue(row.bay),
      level: normalizeBayLevelValue(row.level),
      quantity: normalizeQuantity(row.quantity),
    };
  });

  const response = await createServerSupabaseClient().request(
    `/rest/v1/rpc/replace_timber_stock_rows_for_area?select=${rowSelect}`,
    {
      method: "POST",
      headers: {
        ...createSessionHeaders(actor.session),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        p_area_id: actor.areaId,
        p_rows: payload,
      }),
    },
  );

  if (!response.ok) {
    throw new Error("Failed to update stock.");
  }

  return (await response.json()) as TimberStockRowRecord[];
};
