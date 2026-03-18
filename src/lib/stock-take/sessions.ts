import "server-only";

import type { AuthSession } from "@/src/lib/auth/session";
import { getCurrentAccountStatus, getCurrentUserRoles, type AppRole } from "@/src/lib/auth/profile-access";
import { createServerSupabaseClient } from "@/src/lib/supabase/server";
import { createServiceRoleSupabaseClient } from "@/src/lib/supabase/service-role";

type SessionActor = {
  session: AuthSession;
};

export type StockTakeSessionStatus = "draft" | "in_progress" | "submitted" | "reviewed" | "closed";

export type StockTakeSessionRecord = {
  id: string;
  title: string;
  stock_location_id: string;
  stock_location: {
    id: string;
    code: string;
    name: string;
  } | null;
  status: StockTakeSessionStatus;
  notes: string | null;
  created_by: string | null;
  started_at: string | null;
  submitted_at: string | null;
  reviewed_at: string | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type StockTakeEntryRecord = {
  id: string;
  stock_take_session_id: string;
  inventory_item_id: string;
  inventory_item: {
    id: string;
    item_code: string | null;
    name: string;
    unit: string;
  } | null;
  counted_quantity: number;
  notes: string | null;
  entered_by: string | null;
  entered_at: string;
  updated_at: string;
};

type StockTakeSessionInput = {
  title: string;
  stockLocationId: string;
  notes: string | null;
};

type StockTakeEntryInput = {
  inventoryItemId: string;
  countedQuantity: number;
  notes: string | null;
};

const stockTakeSessionSelect =
  "id,title,stock_location_id,stock_location:stock_locations(id,code,name),status,notes,created_by,started_at,submitted_at,reviewed_at,closed_at,created_at,updated_at";

const stockTakeEntrySelect =
  "id,stock_take_session_id,inventory_item_id,inventory_item:inventory_items(id,item_code,name,unit),counted_quantity,notes,entered_by,entered_at,updated_at";

const createSessionHeaders = (session: AuthSession) => ({
  Authorization: `Bearer ${session.accessToken}`,
});

const assertApprovedAccount = async ({ session }: SessionActor) => {
  const accountStatus = await getCurrentAccountStatus(session);
  if (accountStatus !== "approved") {
    throw new Error("Approved account access is required for stock take");
  }
};

const getActorRoles = async ({ session }: SessionActor) => {
  const [accountStatus, roles] = await Promise.all([getCurrentAccountStatus(session), getCurrentUserRoles(session)]);

  if (accountStatus !== "approved") {
    throw new Error("Approved account access is required for stock take");
  }

  return roles;
};

const assertSessionCreateAccess = async ({ session }: SessionActor) => {
  const roles = await getActorRoles({ session });
  if (!roles.includes("admin") && !roles.includes("supervisor")) {
    throw new Error("Supervisor or admin access is required to create stock take sessions");
  }
};

const assertEntryWriteAccess = async ({ session }: SessionActor) => {
  const roles = await getActorRoles({ session });
  if (!["admin", "supervisor", "operator"].some((role) => roles.includes(role as AppRole))) {
    throw new Error("Approved stock take operator access is required to record counts");
  }
};

const fetchSessionById = async (sessionId: string) => {
  const supabase = createServiceRoleSupabaseClient();
  const response = await supabase.request(
    `/rest/v1/stock_take_sessions?id=eq.${sessionId}&select=${stockTakeSessionSelect}&limit=1`,
    {
      cache: "no-store",
      headers: {
        Prefer: "return=representation",
      },
    },
  );

  if (!response.ok) {
    throw new Error("Failed to load stock take session");
  }

  const [record] = (await response.json()) as StockTakeSessionRecord[];
  if (!record) {
    throw new Error("Stock take session not found");
  }

  return record;
};

const logStockAdminEvent = async ({
  eventType,
  entityType,
  entityId,
  actorAuthUserId,
  payload,
}: {
  eventType: string;
  entityType: "stock_take_session" | "stock_take_entry";
  entityId: string;
  actorAuthUserId: string;
  payload: Record<string, unknown>;
}) => {
  const supabase = createServiceRoleSupabaseClient();
  const response = await supabase.request("/rest/v1/stock_admin_events", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({
      event_type: eventType,
      entity_type: entityType,
      entity_id: entityId,
      actor_auth_user_id: actorAuthUserId,
      payload,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to log ${eventType} event`);
  }
};

export const listStockTakeSessions = async ({ session }: SessionActor): Promise<StockTakeSessionRecord[]> => {
  await assertApprovedAccount({ session });

  const supabase = createServerSupabaseClient();
  const response = await supabase.request(
    `/rest/v1/stock_take_sessions?select=${stockTakeSessionSelect}&order=created_at.desc`,
    {
      cache: "no-store",
      headers: createSessionHeaders(session),
    },
  );

  if (!response.ok) {
    throw new Error("Failed to load stock take sessions");
  }

  return (await response.json()) as StockTakeSessionRecord[];
};

export const createStockTakeSession = async ({
  session,
  input,
}: SessionActor & { input: StockTakeSessionInput }): Promise<StockTakeSessionRecord> => {
  await assertSessionCreateAccess({ session });

  const supabase = createServiceRoleSupabaseClient();
  const response = await supabase.request(`/rest/v1/stock_take_sessions?select=${stockTakeSessionSelect}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify({
      title: input.title,
      stock_location_id: input.stockLocationId,
      notes: input.notes,
      created_by: session.user.id,
    }),
  });

  if (!response.ok) {
    throw new Error("Failed to create stock take session");
  }

  const [createdRecord] = (await response.json()) as StockTakeSessionRecord[];

  await logStockAdminEvent({
    eventType: "stock_take_session_created",
    entityType: "stock_take_session",
    entityId: createdRecord.id,
    actorAuthUserId: session.user.id,
    payload: {
      title: createdRecord.title,
      stock_location_id: createdRecord.stock_location_id,
      stock_location_code: createdRecord.stock_location?.code ?? null,
      stock_location_name: createdRecord.stock_location?.name ?? null,
      status: createdRecord.status,
      notes: createdRecord.notes,
    },
  });

  return createdRecord;
};

export const getStockTakeSessionDetail = async ({
  session,
  sessionId,
}: SessionActor & { sessionId: string }): Promise<StockTakeSessionRecord> => {
  await assertApprovedAccount({ session });
  return fetchSessionById(sessionId);
};

export const listStockTakeEntries = async ({
  session,
  sessionId,
}: SessionActor & { sessionId: string }): Promise<StockTakeEntryRecord[]> => {
  await assertApprovedAccount({ session });

  const supabase = createServerSupabaseClient();
  const response = await supabase.request(
    `/rest/v1/stock_take_entries?stock_take_session_id=eq.${sessionId}&select=${stockTakeEntrySelect}&order=updated_at.desc`,
    {
      cache: "no-store",
      headers: createSessionHeaders(session),
    },
  );

  if (!response.ok) {
    throw new Error("Failed to load stock take entries");
  }

  return (await response.json()) as StockTakeEntryRecord[];
};

export const upsertStockTakeEntry = async ({
  session,
  sessionId,
  input,
}: SessionActor & { sessionId: string; input: StockTakeEntryInput }): Promise<StockTakeEntryRecord> => {
  await assertEntryWriteAccess({ session });

  if (input.countedQuantity < 0) {
    throw new Error("Counted quantity must be zero or greater");
  }

  const stockTakeSession = await fetchSessionById(sessionId);
  if (!["draft", "in_progress"].includes(stockTakeSession.status)) {
    throw new Error("Counts can only be recorded while a stock take session is draft or in progress");
  }

  const supabase = createServiceRoleSupabaseClient();
  const existingEntryResponse = await supabase.request(
    `/rest/v1/stock_take_entries?stock_take_session_id=eq.${sessionId}&inventory_item_id=eq.${input.inventoryItemId}&select=${stockTakeEntrySelect}&limit=1`,
    {
      cache: "no-store",
      headers: {
        Prefer: "return=representation",
      },
    },
  );

  if (!existingEntryResponse.ok) {
    throw new Error("Failed to load stock take entry");
  }

  const [existingEntry] = (await existingEntryResponse.json()) as StockTakeEntryRecord[];
  const response = await supabase.request(existingEntry ? `/rest/v1/stock_take_entries?id=eq.${existingEntry.id}&select=${stockTakeEntrySelect}` : `/rest/v1/stock_take_entries?select=${stockTakeEntrySelect}`, {
    method: existingEntry ? "PATCH" : "POST",
    headers: {
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify(
      existingEntry
        ? {
            counted_quantity: input.countedQuantity,
            notes: input.notes,
            entered_by: session.user.id,
          }
        : {
            stock_take_session_id: sessionId,
            inventory_item_id: input.inventoryItemId,
            counted_quantity: input.countedQuantity,
            notes: input.notes,
            entered_by: session.user.id,
          },
    ),
  });

  if (!response.ok) {
    throw new Error(existingEntry ? "Failed to update stock take entry" : "Failed to create stock take entry");
  }

  const [savedEntry] = (await response.json()) as StockTakeEntryRecord[];

  await logStockAdminEvent({
    eventType: existingEntry ? "stock_take_entry_updated" : "stock_take_entry_created",
    entityType: "stock_take_entry",
    entityId: savedEntry.id,
    actorAuthUserId: session.user.id,
    payload: {
      stock_take_session_id: savedEntry.stock_take_session_id,
      stock_take_session_status: stockTakeSession.status,
      inventory_item_id: savedEntry.inventory_item_id,
      inventory_item_name: savedEntry.inventory_item?.name ?? null,
      inventory_item_unit: savedEntry.inventory_item?.unit ?? null,
      counted_quantity: savedEntry.counted_quantity,
      notes: savedEntry.notes,
      stock_location_id: stockTakeSession.stock_location_id,
      stock_location_code: stockTakeSession.stock_location?.code ?? null,
      stock_location_name: stockTakeSession.stock_location?.name ?? null,
    },
  });

  return savedEntry;
};
