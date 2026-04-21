import "server-only";

import { createServerSupabaseClient } from "@/src/lib/supabase/server";
import { createServiceRoleSupabaseClient } from "@/src/lib/supabase/service-role";
import { withServerTiming } from "@/src/lib/server-timing";
import {
  assertProductionReadAccess,
  assertProductionReasonWriteAccess,
  createSessionHeaders,
  type ProductionActor,
} from "@/src/lib/production/access";
import type {
  ProductionDowntimeReasonRecord,
  ProductionInterruptionReasonRecord,
} from "@/src/lib/production/types";

type ReasonInput = {
  code: string;
  label: string;
  sortOrder: number;
  isActive?: boolean;
};

type ReasonPatchInput = {
  code?: string;
  label?: string;
  sortOrder?: number;
  isActive?: boolean;
};

export const listProductionDowntimeReasons = async ({
  session,
  accessContext,
  route,
}: ProductionActor): Promise<ProductionDowntimeReasonRecord[]> =>
  withServerTiming({
    name: "listProductionDowntimeReasons",
    route,
    operation: async () => {
      await assertProductionReadAccess({ session, accessContext, route });

      const supabase = createServerSupabaseClient();
      const response = await supabase.request(
        "/rest/v1/production_downtime_reasons?select=id,code,label,is_active,sort_order,created_at&order=is_active.desc,sort_order.asc,label.asc",
        {
          cache: "no-store",
          headers: createSessionHeaders(session),
        },
      );

      if (!response.ok) {
        throw new Error("Failed to load downtime reasons");
      }

      return (await response.json()) as ProductionDowntimeReasonRecord[];
    },
  });

export const listProductionInterruptionReasons = async ({
  session,
  accessContext,
  route,
}: ProductionActor): Promise<ProductionInterruptionReasonRecord[]> =>
  withServerTiming({
    name: "listProductionInterruptionReasons",
    route,
    operation: async () => {
      await assertProductionReadAccess({ session, accessContext, route });

      const supabase = createServerSupabaseClient();
      const response = await supabase.request(
        "/rest/v1/production_interruption_reasons?select=id,code,label,is_active,sort_order,created_at&order=is_active.desc,sort_order.asc,label.asc",
        {
          cache: "no-store",
          headers: createSessionHeaders(session),
        },
      );

      if (!response.ok) {
        throw new Error("Failed to load interruption reasons");
      }

      return (await response.json()) as ProductionInterruptionReasonRecord[];
    },
  });

export const createProductionDowntimeReason = async ({
  session,
  accessContext,
  input,
}: ProductionActor & {
  input: ReasonInput;
}): Promise<ProductionDowntimeReasonRecord> => {
  await assertProductionReasonWriteAccess({ session, accessContext });

  const supabase = createServiceRoleSupabaseClient();
  const response = await supabase.request(
    "/rest/v1/production_downtime_reasons?select=id,code,label,is_active,sort_order,created_at",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        code: input.code,
        label: input.label,
        sort_order: input.sortOrder,
        is_active: input.isActive ?? true,
      }),
    },
  );

  if (!response.ok) {
    throw new Error("Failed to create downtime reason");
  }

  const [record] = (await response.json()) as ProductionDowntimeReasonRecord[];
  return record;
};

export const createProductionInterruptionReason = async ({
  session,
  accessContext,
  input,
}: ProductionActor & {
  input: ReasonInput;
}): Promise<ProductionInterruptionReasonRecord> => {
  await assertProductionReasonWriteAccess({ session, accessContext });

  const supabase = createServiceRoleSupabaseClient();
  const response = await supabase.request(
    "/rest/v1/production_interruption_reasons?select=id,code,label,is_active,sort_order,created_at",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        code: input.code,
        label: input.label,
        sort_order: input.sortOrder,
        is_active: input.isActive ?? true,
      }),
    },
  );

  if (!response.ok) {
    throw new Error("Failed to create interruption reason");
  }

  const [record] = (await response.json()) as ProductionInterruptionReasonRecord[];
  return record;
};

export const updateProductionDowntimeReason = async ({
  session,
  accessContext,
  reasonId,
  input,
}: ProductionActor & {
  reasonId: string;
  input: ReasonPatchInput;
}): Promise<ProductionDowntimeReasonRecord> => {
  await assertProductionReasonWriteAccess({ session, accessContext });

  const supabase = createServiceRoleSupabaseClient();
  const response = await supabase.request(
    `/rest/v1/production_downtime_reasons?id=eq.${reasonId}&select=id,code,label,is_active,sort_order,created_at`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        code: input.code,
        label: input.label,
        sort_order: input.sortOrder,
        is_active: input.isActive,
      }),
    },
  );

  if (!response.ok) {
    throw new Error("Failed to update downtime reason");
  }

  const [record] = (await response.json()) as ProductionDowntimeReasonRecord[];
  if (!record) {
    throw new Error("Downtime reason not found");
  }

  return record;
};

export const updateProductionInterruptionReason = async ({
  session,
  accessContext,
  reasonId,
  input,
}: ProductionActor & {
  reasonId: string;
  input: ReasonPatchInput;
}): Promise<ProductionInterruptionReasonRecord> => {
  await assertProductionReasonWriteAccess({ session, accessContext });

  const supabase = createServiceRoleSupabaseClient();
  const response = await supabase.request(
    `/rest/v1/production_interruption_reasons?id=eq.${reasonId}&select=id,code,label,is_active,sort_order,created_at`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        code: input.code,
        label: input.label,
        sort_order: input.sortOrder,
        is_active: input.isActive,
      }),
    },
  );

  if (!response.ok) {
    throw new Error("Failed to update interruption reason");
  }

  const [record] = (await response.json()) as ProductionInterruptionReasonRecord[];
  if (!record) {
    throw new Error("Interruption reason not found");
  }

  return record;
};
