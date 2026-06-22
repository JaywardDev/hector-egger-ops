import "server-only";

import { parseNzDate } from "@/src/lib/dateTime";
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
  ProductionEntryReasonLine,
  ProductionEntryRecord,
  ProductionEntryWithMetricsRecord,
  ProductionOperatorOption,
} from "@/src/lib/production/types";

type ProductionEntryInput = {
  entryDate: string;
  operatorProfileId: string;
  startTime: string;
  finishTime: string;
  projectFileId: string;
  timeRemainingStartMinutes: number;
  timeRemainingEndMinutes: number;
  actualVolumeCutM3: number;
  runThroughBreak: boolean;
  downtimeReasons: ProductionEntryReasonLine[];
  interruptionReasons: ProductionEntryReasonLine[];
  createdByProfileId: string;
};

type OperatorProfileRow = { id: string; full_name: string | null; email: string };

const toReasonRpcRows = (rows: ProductionEntryReasonLine[]) =>
  rows.map((row, index) => ({
    reason_id: row.reasonId,
    duration_minutes: row.durationMinutes,
    sort_order: row.sortOrder ?? index,
  }));

export const listProductionEntries = async ({
  session,
  accessContext,
  route,
  projectId,
  operatorProfileId,
  dateFrom,
  dateTo,
  limit,
}: ProductionActor & { projectId?: string; operatorProfileId?: string; dateFrom?: string; dateTo?: string; limit?: number }): Promise<ProductionEntryWithMetricsRecord[]> =>
  withServerTiming({
    name: "listProductionEntries",
    route,
    operation: async () => {
      await assertProductionReadAccess({ session, accessContext, route });
      const searchParams = new URLSearchParams({ select: "*", order: "entry_date.desc,created_at.desc,id.desc" });
      if (projectId) searchParams.set("project_id", `eq.${projectId}`);
      if (operatorProfileId) searchParams.set("operator_profile_id", `eq.${operatorProfileId}`);
      const parsedDateFrom = dateFrom ? parseNzDate(dateFrom) : undefined;
      const parsedDateTo = dateTo ? parseNzDate(dateTo) : undefined;
      if ((dateFrom && !parsedDateFrom) || (dateTo && !parsedDateTo)) throw new Error("Enter valid production entry date filters in YYYY-MM-DD format.");
      if (parsedDateFrom) searchParams.append("entry_date", `gte.${parsedDateFrom}`);
      if (parsedDateTo) searchParams.append("entry_date", `lte.${parsedDateTo}`);
      if (limit && Number.isFinite(limit)) searchParams.set("limit", String(limit));
      const supabase = createServerSupabaseClient();
      const response = await supabase.request(`/rest/v1/production_entries_with_metrics?${searchParams.toString()}`, {
        cache: "no-store",
        headers: createSessionHeaders(session),
      });
      if (!response.ok) throw new Error("Failed to load production entries");
      return (await response.json()) as ProductionEntryWithMetricsRecord[];
    },
  });

export const createProductionEntry = async ({ session, accessContext, input }: ProductionActor & { input: ProductionEntryInput }): Promise<ProductionEntryRecord> => {
  await assertProductionEntryWriteAccess({ session, accessContext });
  const supabase = createServiceRoleSupabaseClient();
  const response = await supabase.request("/rest/v1/rpc/create_production_entry_with_reasons", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      p_entry_date: input.entryDate,
      p_operator_profile_id: input.operatorProfileId,
      p_start_time: input.startTime,
      p_finish_time: input.finishTime,
      p_project_file_id: input.projectFileId,
      p_time_remaining_start_minutes: input.timeRemainingStartMinutes,
      p_time_remaining_end_minutes: input.timeRemainingEndMinutes,
      p_actual_volume_cut_m3: input.actualVolumeCutM3,
      p_run_through_break: input.runThroughBreak,
      p_created_by_profile_id: input.createdByProfileId,
      p_downtime_reasons: toReasonRpcRows(input.downtimeReasons),
      p_interruption_reasons: toReasonRpcRows(input.interruptionReasons),
    }),
  });
  if (!response.ok) throw new Error("Failed to create production entry");
  return (await response.json()) as ProductionEntryRecord;
};

export const updateProductionEntry = async ({ session, accessContext, entryId, input }: ProductionActor & { entryId: string; input: Partial<ProductionEntryInput> }): Promise<ProductionEntryRecord> => {
  await assertProductionEntryWriteAccess({ session, accessContext });
  const supabase = createServiceRoleSupabaseClient();
  const response = await supabase.request("/rest/v1/rpc/update_production_entry_with_reasons", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      p_entry_id: entryId,
      p_entry_date: input.entryDate,
      p_operator_profile_id: input.operatorProfileId,
      p_start_time: input.startTime,
      p_finish_time: input.finishTime,
      p_project_file_id: input.projectFileId,
      p_time_remaining_start_minutes: input.timeRemainingStartMinutes,
      p_time_remaining_end_minutes: input.timeRemainingEndMinutes,
      p_actual_volume_cut_m3: input.actualVolumeCutM3,
      p_run_through_break: input.runThroughBreak,
      p_downtime_reasons: toReasonRpcRows(input.downtimeReasons ?? []),
      p_interruption_reasons: toReasonRpcRows(input.interruptionReasons ?? []),
    }),
  });
  if (!response.ok) throw new Error("Failed to update production entry");
  return (await response.json()) as ProductionEntryRecord;
};

export const deleteProductionEntry = async ({ session, accessContext, entryId }: ProductionActor & { entryId: string }): Promise<void> => {
  await assertProductionEntryWriteAccess({ session, accessContext });
  const supabase = createServiceRoleSupabaseClient();
  const response = await supabase.request(`/rest/v1/production_entries?id=eq.${entryId}`, { method: "DELETE", headers: { Prefer: "return=minimal" } });
  if (!response.ok) throw new Error("Failed to delete production entry");
};

export const getProductionEntryDetail = async ({ session, accessContext, route, entryId }: ProductionActor & { entryId: string }): Promise<ProductionEntryWithMetricsRecord | null> =>
  withServerTiming({
    name: "getProductionEntryDetail",
    route,
    meta: { entryId },
    operation: async () => {
      await assertProductionReadAccess({ session, accessContext, route });
      const supabase = createServerSupabaseClient();
      const response = await supabase.request(`/rest/v1/production_entries_with_metrics?id=eq.${entryId}&select=*&limit=1`, { cache: "no-store", headers: createSessionHeaders(session) });
      if (!response.ok) throw new Error("Failed to load production entry");
      const [record] = (await response.json()) as ProductionEntryWithMetricsRecord[];
      return record ?? null;
    },
  });

export const listLatestTimeRemainingEndByProjectFile = async ({
  session,
  accessContext,
  route,
}: ProductionActor): Promise<Record<string, number>> =>
  withServerTiming({
    name: "listLatestTimeRemainingEndByProjectFile",
    route,
    operation: async () => {
      await assertProductionReadAccess({ session, accessContext, route });
      const searchParams = new URLSearchParams({
        select: "project_file_id,time_remaining_end_minutes,entry_date,created_at,updated_at,id",
        order: "entry_date.desc,created_at.desc,updated_at.desc,id.desc",
      });
      const supabase = createServerSupabaseClient();
      const response = await supabase.request(`/rest/v1/production_entries?${searchParams.toString()}`, {
        cache: "no-store",
        headers: createSessionHeaders(session),
      });
      if (!response.ok) throw new Error("Failed to load latest project-file time remaining values");
      const rows = (await response.json()) as Array<{ project_file_id: string | null; time_remaining_end_minutes: number | null }>;
      const latestByProjectFile: Record<string, number> = {};
      for (const row of rows) {
        if (row.project_file_id && row.time_remaining_end_minutes != null && latestByProjectFile[row.project_file_id] == null) {
          latestByProjectFile[row.project_file_id] = row.time_remaining_end_minutes;
        }
      }
      return latestByProjectFile;
    },
  });

export const listAssignableProductionOperators = async ({ session, accessContext, route }: ProductionActor): Promise<ProductionOperatorOption[]> =>
  withServerTiming({
    name: "listAssignableProductionOperators",
    route,
    operation: async () => {
      await assertProductionEntryWriteAccess({ session, accessContext, route });
      const roles = accessContext?.roles ?? [];
      if (!roles.includes("admin") && !roles.includes("supervisor")) return [];
      const supabase = createServiceRoleSupabaseClient();
      const response = await supabase.request(
        "/rest/v1/profiles?select=id,full_name,email,user_roles!inner(role)&account_status=eq.approved&user_roles.role=eq.operator&order=full_name.asc,email.asc",
        { cache: "no-store" },
      );
      if (!response.ok) throw new Error("Failed to load assignable production operators");
      return ((await response.json()) as OperatorProfileRow[]).map((row) => ({ profile_id: row.id, display_name: row.full_name?.trim() || row.email }));
    },
  });
