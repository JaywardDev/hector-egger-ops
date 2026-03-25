import "server-only";

import type { AuthSession } from "@/src/lib/auth/session";
import {
  getCurrentAccountStatus,
  getCurrentUserRoles,
  type AppRole,
} from "@/src/lib/auth/profile-access";
import { createServerSupabaseClient } from "@/src/lib/supabase/server";
import { createServiceRoleSupabaseClient } from "@/src/lib/supabase/service-role";
import { withServerTiming } from "@/src/lib/server-timing";

type ApprovedAccessContext = {
  accountStatus: "approved";
  roles: AppRole[];
};

type SessionActor = {
  session: AuthSession;
  accessContext?: ApprovedAccessContext;
  route?: string;
};

export type StockTakeSessionStatus =
  | "draft"
  | "in_progress"
  | "submitted"
  | "reviewed"
  | "closed";

export type StockTakeSessionRecord = {
  id: string;
  title: string;
  stock_location_id: string | null;
  stock_location: {
    id: string;
    code: string | null;
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
  stock_location_id: string | null;
  stock_location: {
    id: string;
    code: string | null;
    name: string;
  } | null;
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
  stockLocationId: string | null;
  notes: string | null;
};

type StockTakeEntryInput = {
  inventoryItemId: string;
  stockLocationId?: string | null;
  countedQuantity: number;
  notes: string | null;
};

export type StockTakeTransitionAction =
  | "start"
  | "submit"
  | "review"
  | "close";

type StockTakeTransitionDefinition = {
  action: StockTakeTransitionAction;
  from: StockTakeSessionStatus;
  to: StockTakeSessionStatus;
  timestampField: "started_at" | "submitted_at" | "reviewed_at" | "closed_at";
  buttonLabel: string;
  successMessage: string;
};

type StockLocationSummary = {
  id: string;
  code: string | null;
  name: string;
};

const stockTakeSessionSelect =
  "id,title,stock_location_id,stock_location:stock_locations(id,code,name),status,notes,created_by,started_at,submitted_at,reviewed_at,closed_at,created_at,updated_at";

const stockTakeEntrySelect =
  "id,stock_take_session_id,inventory_item_id,stock_location_id,stock_location:stock_locations(id,code,name),inventory_item:inventory_items(id,item_code,name,unit),counted_quantity,notes,entered_by,entered_at,updated_at";

const stockTakeTransitionDefinitions: Record<
  StockTakeTransitionAction,
  StockTakeTransitionDefinition
> = {
  start: {
    action: "start",
    from: "draft",
    to: "in_progress",
    timestampField: "started_at",
    buttonLabel: "Start session",
    successMessage: "Session started.",
  },
  submit: {
    action: "submit",
    from: "in_progress",
    to: "submitted",
    timestampField: "submitted_at",
    buttonLabel: "Submit session",
    successMessage: "Session submitted.",
  },
  review: {
    action: "review",
    from: "submitted",
    to: "reviewed",
    timestampField: "reviewed_at",
    buttonLabel: "Mark reviewed",
    successMessage: "Session reviewed.",
  },
  close: {
    action: "close",
    from: "reviewed",
    to: "closed",
    timestampField: "closed_at",
    buttonLabel: "Close session",
    successMessage: "Session closed.",
  },
};

const createSessionHeaders = (session: AuthSession) => ({
  Authorization: `Bearer ${session.accessToken}`,
});

const formatStockTakeSessionTitle = ({
  date,
  locationName,
}: {
  date: Date;
  locationName?: string | null;
}) => {
  const formattedDate = date.toISOString().slice(0, 10);
  return locationName
    ? `Stock take - ${formattedDate} - ${locationName}`
    : `Stock take - ${formattedDate}`;
};

const assertApprovedAccount = async ({
  session,
  accessContext,
  route,
}: SessionActor) => {
  const accountStatus =
    accessContext?.accountStatus ??
    (await getCurrentAccountStatus(session, undefined, route));
  if (accountStatus !== "approved") {
    throw new Error("Approved account access is required for stock take");
  }
};

const getActorRoles = async ({
  session,
  accessContext,
  route,
}: SessionActor) => {
  const accountStatus =
    accessContext?.accountStatus ??
    (await getCurrentAccountStatus(session, undefined, route));
  const roles =
    accessContext?.roles ??
    (await getCurrentUserRoles(session, undefined, route));

  if (accountStatus !== "approved") {
    throw new Error("Approved account access is required for stock take");
  }

  return roles;
};

const assertSessionCreateAccess = async ({
  session,
  accessContext,
  route,
}: SessionActor) => {
  const roles = await getActorRoles({ session, accessContext, route });
  if (!roles.includes("admin") && !roles.includes("supervisor")) {
    throw new Error(
      "Supervisor or admin access is required to create stock take sessions",
    );
  }
};

const assertSessionTransitionAccess = async ({
  session,
  accessContext,
  route,
}: SessionActor) => {
  const roles = await getActorRoles({ session, accessContext, route });
  if (!roles.includes("admin") && !roles.includes("supervisor")) {
    throw new Error(
      "Supervisor or admin access is required to change stock take session status",
    );
  }
};

const assertEntryWriteAccess = async ({
  session,
  accessContext,
  route,
}: SessionActor) => {
  const roles = await getActorRoles({ session, accessContext, route });
  if (
    !["admin", "supervisor", "operator"].some((role) =>
      roles.includes(role as AppRole),
    )
  ) {
    throw new Error(
      "Approved stock take operator access is required to record counts",
    );
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

const fetchStockLocationById = async (
  stockLocationId: string,
): Promise<StockLocationSummary> => {
  const supabase = createServiceRoleSupabaseClient();
  const response = await supabase.request(
    `/rest/v1/stock_locations?id=eq.${stockLocationId}&select=id,code,name&limit=1`,
    {
      cache: "no-store",
      headers: {
        Prefer: "return=representation",
      },
    },
  );

  if (!response.ok) {
    throw new Error("Failed to load stock location");
  }

  const [record] = (await response.json()) as StockLocationSummary[];
  if (!record) {
    throw new Error("Stock location not found");
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

const getNextStockTakeTransition = (
  status: StockTakeSessionStatus,
): StockTakeTransitionDefinition | null => {
  const transition = Object.values(stockTakeTransitionDefinitions).find(
    (definition) => definition.from === status,
  );

  return transition ?? null;
};

export const getStockTakeTransitionActionMetadata = (
  action: StockTakeTransitionAction,
) => stockTakeTransitionDefinitions[action];

export const listStockTakeSessions = async ({
  session,
  accessContext,
  route,
}: SessionActor): Promise<StockTakeSessionRecord[]> =>
  withServerTiming({
    name: "listStockTakeSessions",
    route,
    operation: async () => {
      await assertApprovedAccount({ session, accessContext, route });

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
    },
  });

export const createStockTakeSession = async ({
  session,
  accessContext,
  input,
}: SessionActor & {
  input: StockTakeSessionInput;
}): Promise<StockTakeSessionRecord> => {
  await assertSessionCreateAccess({ session, accessContext });

  const stockLocation = input.stockLocationId
    ? await fetchStockLocationById(input.stockLocationId)
    : null;
  const title = formatStockTakeSessionTitle({
    date: new Date(),
    locationName: stockLocation?.name ?? null,
  });

  const supabase = createServiceRoleSupabaseClient();
  const response = await supabase.request(
    `/rest/v1/stock_take_sessions?select=${stockTakeSessionSelect}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        title,
        stock_location_id: input.stockLocationId,
        notes: input.notes,
        created_by: session.user.id,
      }),
    },
  );

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
  accessContext,
  route,
  sessionId,
}: SessionActor & { sessionId: string }): Promise<StockTakeSessionRecord> =>
  withServerTiming({
    name: "getStockTakeSessionDetail",
    route,
    meta: { sessionId },
    operation: async () => {
      await assertApprovedAccount({ session, accessContext, route });
      return fetchSessionById(sessionId);
    },
  });

export const listStockTakeEntries = async ({
  session,
  accessContext,
  route,
  sessionId,
}: SessionActor & { sessionId: string }): Promise<StockTakeEntryRecord[]> =>
  withServerTiming({
    name: "listStockTakeEntries",
    route,
    meta: { sessionId },
    operation: async () => {
      await assertApprovedAccount({ session, accessContext, route });

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
    },
  });

export const transitionStockTakeSession = async ({
  session,
  accessContext,
  route,
  sessionId,
  action,
}: SessionActor & {
  sessionId: string;
  action: StockTakeTransitionAction;
}): Promise<StockTakeSessionRecord> =>
  withServerTiming({
    name: "transitionStockTakeSession",
    route,
    meta: { sessionId, action },
    operation: async () => {
      await assertSessionTransitionAccess({ session, accessContext, route });

      const existingSession = await fetchSessionById(sessionId);
      const transition = stockTakeTransitionDefinitions[action];

      if (existingSession.status !== transition.from) {
        throw new Error(
          `Invalid stock take session transition from ${existingSession.status} to ${transition.to}`,
        );
      }

      const transitionedAt = new Date().toISOString();
      const supabase = createServiceRoleSupabaseClient();
      const response = await supabase.request(
        `/rest/v1/stock_take_sessions?id=eq.${sessionId}&select=${stockTakeSessionSelect}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Prefer: "return=representation",
          },
          body: JSON.stringify({
            status: transition.to,
            [transition.timestampField]: transitionedAt,
          }),
        },
      );

      if (!response.ok) {
        throw new Error("Failed to update stock take session status");
      }

      const [updatedSession] = (await response.json()) as StockTakeSessionRecord[];

      await logStockAdminEvent({
        eventType: "stock_take_session_updated",
        entityType: "stock_take_session",
        entityId: updatedSession.id,
        actorAuthUserId: session.user.id,
        payload: {
          session_id: updatedSession.id,
          title: updatedSession.title,
          stock_location_id: updatedSession.stock_location_id,
          stock_location_code: updatedSession.stock_location?.code ?? null,
          stock_location_name: updatedSession.stock_location?.name ?? null,
          previous_status: existingSession.status,
          new_status: updatedSession.status,
          transition_action: action,
          transitioned_at: transitionedAt,
          started_at: updatedSession.started_at,
          submitted_at: updatedSession.submitted_at,
          reviewed_at: updatedSession.reviewed_at,
          closed_at: updatedSession.closed_at,
        },
      });

      return updatedSession;
    },
  });

export const getNextStockTakeTransitionAction = (
  stockTakeSession: Pick<StockTakeSessionRecord, "status">,
) => getNextStockTakeTransition(stockTakeSession.status);

export const createStockTakeEntry = async ({
  session,
  accessContext,
  sessionId,
  input,
}: SessionActor & {
  sessionId: string;
  input: StockTakeEntryInput;
}): Promise<StockTakeEntryRecord> => {
  await assertEntryWriteAccess({ session, accessContext });

  if (input.countedQuantity < 0) {
    throw new Error("Counted quantity must be zero or greater");
  }

  const stockTakeSession = await fetchSessionById(sessionId);
  if (!["draft", "in_progress"].includes(stockTakeSession.status)) {
    throw new Error(
      "Counts can only be recorded while a stock take session is draft or in progress",
    );
  }

  const entryStockLocationId = input.stockLocationId ?? null;
  const supabase = createServiceRoleSupabaseClient();
  const response = await supabase.request(
    `/rest/v1/stock_take_entries?select=${stockTakeEntrySelect}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify(
        {
          stock_take_session_id: sessionId,
          inventory_item_id: input.inventoryItemId,
          stock_location_id: entryStockLocationId,
          counted_quantity: input.countedQuantity,
          notes: input.notes,
          entered_by: session.user.id,
        },
      ),
    },
  );

  if (!response.ok) {
    throw new Error("Failed to create stock take entry");
  }

  const [savedEntry] = (await response.json()) as StockTakeEntryRecord[];

  await logStockAdminEvent({
    eventType: "stock_take_entry_created",
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
      session_stock_location_id: stockTakeSession.stock_location_id,
      session_stock_location_code: stockTakeSession.stock_location?.code ?? null,
      session_stock_location_name: stockTakeSession.stock_location?.name ?? null,
      entry_stock_location_id: savedEntry.stock_location_id,
      entry_stock_location_code: savedEntry.stock_location?.code ?? null,
      entry_stock_location_name: savedEntry.stock_location?.name ?? null,
    },
  });

  return savedEntry;
};
