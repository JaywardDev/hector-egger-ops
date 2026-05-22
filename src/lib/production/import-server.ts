import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { PRODUCTION_IMPORT_CONTRACT } from "@/src/lib/production/import-contract";
import {
  normalizeDate,
  normalizeTimeOfDay,
  normalizeWhitespace,
  parseDecimalHoursToMinutes,
  parseDurationHoursMinutesSecondsToMinutes,
} from "@/src/lib/production/import";
import { createServiceRoleSupabaseClient } from "@/src/lib/supabase/service-role";

export type ProductionPreparedRow = Record<string, string | number> & { source_row_number: number; source_row_hash: string };

export const buildProductionSourceRowHash = (sourceSystem: string, row: Record<string, string>) => {
  const canonical = JSON.stringify(Object.entries(row).sort(([a], [b]) => a.localeCompare(b)));
  return createHash("sha256").update(`${sourceSystem}|${canonical}`).digest("hex");
};

export async function prepareProductionImport(buffer: Buffer) {
  const text = buffer.toString("utf8");
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
  const header = lines.shift() ?? "";
  const expectedHeader = PRODUCTION_IMPORT_CONTRACT.headers.join(",");
  const validationErrors: Array<{ rowNumber: number | null; message: string }> = [];
  if (header.replace(/\s+/g, "") !== expectedHeader.replace(/\s+/g, "")) {
    validationErrors.push({ rowNumber: 1, message: "Header row does not match the configured production import contract." });
  }

  const normalizedRows: ProductionPreparedRow[] = lines.map((line, index) => {
    const columns = line.split(",");
    const row = {
      rowNumber: index + 2,
      values: Object.fromEntries(PRODUCTION_IMPORT_CONTRACT.headers.map((h, i) => [h, columns[i] ?? ""])),
    };
    const mapped: Record<string, string> = {
      work_date: normalizeDate(String(row.values["Date"] ?? "")) ?? "",
      operator_name: normalizeWhitespace(String(row.values["Operator"] ?? "")),
      shift_start_time: normalizeTimeOfDay(String(row.values["Start Time"] ?? "")) ?? "",
      shift_end_time: normalizeTimeOfDay(String(row.values["Finish Time"] ?? "")) ?? "",
      project_file: normalizeWhitespace(String(row.values["Project File"] ?? "")),
      project_sequence: String(row.values["Project Sequence"] ?? "").trim(),
      project_name: normalizeWhitespace(String(row.values["Project Name"] ?? "")),
      file_minutes_left_start: String(parseDurationHoursMinutesSecondsToMinutes(String(row.values["Time Remaining Start"] ?? "")) ?? ""),
      file_minutes_left_end: String(parseDurationHoursMinutesSecondsToMinutes(String(row.values["Time Remaining End"] ?? "")) ?? ""),
      actual_volume_cut_m3: String(row.values["Actual Volume Cut m3"] ?? "0").trim(),
      downtime_minutes: String(parseDecimalHoursToMinutes(String(row.values["Downtime Hours"] ?? ""))),
      downtime_reason_label: normalizeWhitespace(String(row.values["Downtime Reason"] ?? "")),
      interruption_minutes: String(parseDecimalHoursToMinutes(String(row.values["Interruption Hours"] ?? ""))),
      interruption_reason_label: normalizeWhitespace(String(row.values["Interruption Reason"] ?? "")),
    };
    const source_row_hash = buildProductionSourceRowHash(PRODUCTION_IMPORT_CONTRACT.sourceSystem, mapped);
    return { ...mapped, source_row_number: row.rowNumber, source_row_hash };
  });

  return {
    parsedRows: lines,
    normalizedRows,
    warnings: [] as string[],
    validationErrors,
    summary: { rowCount: normalizedRows.length, errorCount: validationErrors.length, warningCount: 0 },
  };
}

export async function applyProductionImport(params: {
  actorProfileId: string;
  fileName: string;
  prepared: Awaited<ReturnType<typeof prepareProductionImport>>;
}) {
  if (params.prepared.validationErrors.length > 0) {
    throw new Error("Validation errors must be resolved before apply.");
  }

  const supabase = createServiceRoleSupabaseClient();
  const importBatchId = randomUUID();
  const response = await supabase.request(`/rest/v1/rpc/apply_production_import`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      p_import_batch_id: importBatchId,
      p_actor_profile_id: params.actorProfileId,
      p_source_system: PRODUCTION_IMPORT_CONTRACT.sourceSystem,
      p_file_name: params.fileName,
      p_rows: params.prepared.normalizedRows,
      p_metadata: { preparedSummary: params.prepared.summary },
    }),
  });
  if (!response.ok) throw new Error("Failed to apply production import.");
  return { importBatchId, result: await response.json() };
}
