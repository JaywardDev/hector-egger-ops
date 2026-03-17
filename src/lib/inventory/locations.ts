import "server-only";

import type { AuthSession } from "@/src/lib/auth/session";
import { getCurrentAccountStatus, getCurrentUserRoles } from "@/src/lib/auth/profile-access";
import { createServerSupabaseClient } from "@/src/lib/supabase/server";
import { createServiceRoleSupabaseClient } from "@/src/lib/supabase/service-role";

type MutationActor = {
  session: AuthSession;
};

export type StockLocationRecord = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
};

const createSessionHeaders = (session: AuthSession) => ({
  Authorization: `Bearer ${session.accessToken}`,
});

const assertLocationMutationAccess = async ({ session }: MutationActor) => {
  const [accountStatus, roles] = await Promise.all([
    getCurrentAccountStatus(session),
    getCurrentUserRoles(session),
  ]);

  if (accountStatus !== "approved" || (!roles.includes("admin") && !roles.includes("supervisor"))) {
    throw new Error("Supervisor or admin access is required for location writes");
  }
};

export const listStockLocations = async ({ session }: MutationActor): Promise<StockLocationRecord[]> => {
  const supabase = createServerSupabaseClient();
  const response = await supabase.request(
    "/rest/v1/stock_locations?select=id,code,name,description,created_at,updated_at&order=name.asc",
    {
      cache: "no-store",
      headers: createSessionHeaders(session),
    },
  );

  if (!response.ok) {
    throw new Error("Failed to load stock locations");
  }

  return (await response.json()) as StockLocationRecord[];
};

type StockLocationInput = {
  code: string;
  name: string;
  description: string | null;
};

export const createStockLocation = async ({
  session,
  input,
}: MutationActor & { input: StockLocationInput }): Promise<StockLocationRecord> => {
  await assertLocationMutationAccess({ session });

  const supabase = createServiceRoleSupabaseClient();
  const response = await supabase.request("/rest/v1/stock_locations?select=id,code,name,description,created_at,updated_at", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify({
      code: input.code,
      name: input.name,
      description: input.description,
    }),
  });

  if (!response.ok) {
    throw new Error("Failed to create stock location");
  }

  const [createdRecord] = (await response.json()) as StockLocationRecord[];

  const eventResponse = await supabase.request("/rest/v1/stock_admin_events", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({
      event_type: "stock_location_created",
      entity_type: "stock_location",
      entity_id: createdRecord.id,
      actor_auth_user_id: session.user.id,
      payload: {
        code: createdRecord.code,
        name: createdRecord.name,
      },
    }),
  });

  if (!eventResponse.ok) {
    throw new Error("Failed to log stock location create event");
  }

  return createdRecord;
};

export const updateStockLocation = async ({
  session,
  locationId,
  input,
}: MutationActor & { locationId: string; input: StockLocationInput }): Promise<void> => {
  await assertLocationMutationAccess({ session });

  const supabase = createServiceRoleSupabaseClient();
  const response = await supabase.request(`/rest/v1/stock_locations?id=eq.${locationId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({
      code: input.code,
      name: input.name,
      description: input.description,
    }),
  });

  if (!response.ok) {
    throw new Error("Failed to update stock location");
  }

  const eventResponse = await supabase.request("/rest/v1/stock_admin_events", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({
      event_type: "stock_location_updated",
      entity_type: "stock_location",
      entity_id: locationId,
      actor_auth_user_id: session.user.id,
      payload: {
        code: input.code,
        name: input.name,
      },
    }),
  });

  if (!eventResponse.ok) {
    throw new Error("Failed to log stock location update event");
  }
};
