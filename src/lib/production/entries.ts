import "server-only";

import { createServerSupabaseClient } from "@/src/lib/supabase/server";
import { createServiceRoleSupabaseClient } from "@/src/lib/supabase/service-role";
import { withServerTiming } from "@/src/lib/server-timing";
import {
  assertProductionEntryWriteAccess,
  assertProductionReadAccess,
  createSessionHeaders,
  type ProductionActor,
} from "@/src/lib/production/access";
import type {
  ProductionEntryRecord,
  ProductionEntryWithMetricsRecord,
  ProductionOperatorOption,
} from "@/src/lib/production/types";

type ProductionEntryInput = {
  workDate: string;
  operatorProfileId: string;
  shiftStartTime: string;
  shiftEndTime: string;
  projectId: string;
  fileMinutesLeftStart: number;
  fileMinutesLeftEnd: number;
  actualVolumeCutM3: number;
  downtimeMinutes: number;
  downtimeReasonId: string | null;
  interruptionMinutes: number;
  interruptionReasonId: string | null;
  notes: string | null;
  createdByProfileId: string;
};

type OperatorProfileRow = {
  id: string;
  full_name: string | null;
  email: string;
};

const entrySelect =
  "id,work_date,operator_profile_id,shift_start_time,shift_end_time,project_id,file_minutes_left_start,file_minutes_left_end,actual_volume_cut_m3,downtime_minutes,downtime_reason_id,interruption_minutes,interruption_reason_id,notes,created_by_profile_id,created_at,updated_at";

export const listProductionEntries = async ({
  session,
  accessContext,
  route,
  projectId,
  operatorProfileId,
  dateFrom,
  dateTo,
  limit,
}: ProductionActor & {
  projectId?: string;
  operatorProfileId?: string;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
}): Promise<ProductionEntryWithMetricsRecord[]> =>
  withServerTiming({
    name: "listProductionEntries",
    route,
    operation: async () => {
      await assertProductionReadAccess({ session, accessContext, route });

      const searchParams = new URLSearchParams({
        select: "*",
        order: "work_date.desc,created_at.desc,id.desc",
      });

      if (projectId) {
        searchParams.set("project_id", `eq.${projectId}`);
      }
      if (operatorProfileId) {
        searchParams.set("operator_profile_id", `eq.${operatorProfileId}`);
      }
      if (dateFrom) {
        searchParams.append("work_date", `gte.${dateFrom}`);
      }
      if (dateTo) {
        searchParams.append("work_date", `lte.${dateTo}`);
      }
      if (limit && Number.isFinite(limit)) {
        searchParams.set("limit", String(limit));
      }

      const supabase = createServerSupabaseClient();
      const response = await supabase.request(
        `/rest/v1/production_entries_with_metrics?${searchParams.toString()}`,
        {
          cache: "no-store",
          headers: createSessionHeaders(session),
        },
      );

      if (!response.ok) {
        throw new Error("Failed to load production entries");
      }

      return (await response.json()) as ProductionEntryWithMetricsRecord[];
    },
  });

export const createProductionEntry = async ({
  session,
  accessContext,
  input,
}: ProductionActor & {
  input: ProductionEntryInput;
}): Promise<ProductionEntryRecord> => {
  await assertProductionEntryWriteAccess({ session, accessContext });

  const supabase = createServiceRoleSupabaseClient();
  const response = await supabase.request(`/rest/v1/production_entries?select=${entrySelect}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify({
      work_date: input.workDate,
      operator_profile_id: input.operatorProfileId,
      shift_start_time: input.shiftStartTime,
      shift_end_time: input.shiftEndTime,
      project_id: input.projectId,
      file_minutes_left_start: input.fileMinutesLeftStart,
      file_minutes_left_end: input.fileMinutesLeftEnd,
      actual_volume_cut_m3: input.actualVolumeCutM3,
      downtime_minutes: input.downtimeMinutes,
      downtime_reason_id: input.downtimeReasonId,
      interruption_minutes: input.interruptionMinutes,
      interruption_reason_id: input.interruptionReasonId,
      notes: input.notes,
      created_by_profile_id: input.createdByProfileId,
    }),
  });

  if (!response.ok) {
    throw new Error("Failed to create production entry");
  }

  const [record] = (await response.json()) as ProductionEntryRecord[];
  return record;
};

export const updateProductionEntry = async ({
  session,
  accessContext,
  entryId,
  input,
}: ProductionActor & {
  entryId: string;
  input: Partial<ProductionEntryInput>;
}): Promise<ProductionEntryRecord> => {
  await assertProductionEntryWriteAccess({ session, accessContext });

  const supabase = createServiceRoleSupabaseClient();
  const response = await supabase.request(
    `/rest/v1/production_entries?id=eq.${entryId}&select=${entrySelect}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        work_date: input.workDate,
        operator_profile_id: input.operatorProfileId,
        shift_start_time: input.shiftStartTime,
        shift_end_time: input.shiftEndTime,
        project_id: input.projectId,
        file_minutes_left_start: input.fileMinutesLeftStart,
        file_minutes_left_end: input.fileMinutesLeftEnd,
        actual_volume_cut_m3: input.actualVolumeCutM3,
        downtime_minutes: input.downtimeMinutes,
        downtime_reason_id: input.downtimeReasonId,
        interruption_minutes: input.interruptionMinutes,
        interruption_reason_id: input.interruptionReasonId,
        notes: input.notes,
      }),
    },
  );

  if (!response.ok) {
    throw new Error("Failed to update production entry");
  }

  const [record] = (await response.json()) as ProductionEntryRecord[];
  if (!record) {
    throw new Error("Production entry not found");
  }

  return record;
};

export const deleteProductionEntry = async ({
  session,
  accessContext,
  entryId,
}: ProductionActor & {
  entryId: string;
}): Promise<void> => {
  await assertProductionEntryWriteAccess({ session, accessContext });

  const supabase = createServiceRoleSupabaseClient();
  const response = await supabase.request(`/rest/v1/production_entries?id=eq.${entryId}`, {
    method: "DELETE",
    headers: {
      Prefer: "return=minimal",
    },
  });

  if (!response.ok) {
    throw new Error("Failed to delete production entry");
  }
};


export const getProductionEntryDetail = async ({
  session,
  accessContext,
  route,
  entryId,
}: ProductionActor & {
  entryId: string;
}): Promise<ProductionEntryWithMetricsRecord | null> =>
  withServerTiming({
    name: "getProductionEntryDetail",
    route,
    meta: { entryId },
    operation: async () => {
      await assertProductionReadAccess({ session, accessContext, route });

      const supabase = createServerSupabaseClient();
      const response = await supabase.request(
        `/rest/v1/production_entries_with_metrics?id=eq.${entryId}&select=*&limit=1`,
        {
          cache: "no-store",
          headers: createSessionHeaders(session),
        },
      );

      if (!response.ok) {
        throw new Error("Failed to load production entry");
      }

      const [record] = (await response.json()) as ProductionEntryWithMetricsRecord[];
      return record ?? null;
    },
  });

export const listAssignableProductionOperators = async ({
  session,
  accessContext,
  route,
}: ProductionActor): Promise<ProductionOperatorOption[]> =>
  withServerTiming({
    name: "listAssignableProductionOperators",
    route,
    operation: async () => {
      await assertProductionEntryWriteAccess({ session, accessContext, route });
      const roles = accessContext?.roles ?? [];

      if (!roles.includes("admin") && !roles.includes("supervisor")) {
        return [];
      }

      const supabase = createServiceRoleSupabaseClient();
      const response = await supabase.request(
        "/rest/v1/profiles?select=id,full_name,email,user_roles!inner(role)&account_status=eq.approved&user_roles.role=eq.operator&order=full_name.asc,email.asc",
        {
          cache: "no-store",
        },
      );

      if (!response.ok) {
        throw new Error("Failed to load assignable production operators");
      }

      const rows = (await response.json()) as OperatorProfileRow[];
      return rows.map((row) => ({
        profile_id: row.id,
        display_name: row.full_name?.trim() || row.email,
      }));
    },
  });
