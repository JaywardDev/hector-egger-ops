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
export type ProductionImportIssue = {
  rowNumber: number | null;
  field: string | null;
  code: string;
  message: string;
};

const MAX_VALID_FILE_ROWS = 20_000;

const parseCsvLine = (line: string) => {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      const nextChar = line[index + 1];
      if (inQuotes && nextChar === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (char === "," && !inQuotes) {
      values.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  values.push(current);
  return { values, unclosedQuote: inQuotes };
};

export const buildProductionSourceRowHash = (sourceSystem: string, row: Record<string, string>) => {
  const canonical = JSON.stringify(Object.entries(row).sort(([a], [b]) => a.localeCompare(b)));
  return createHash("sha256").update(`${sourceSystem}|${canonical}`).digest("hex");
};

export async function prepareProductionImport(buffer: Buffer) {
  const text = buffer.toString("utf8");
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
  const header = lines.shift() ?? "";
  const headerColumns = parseCsvLine(header).values;
  const expectedHeader = PRODUCTION_IMPORT_CONTRACT.headers.join(",");
  const validationErrors: ProductionImportIssue[] = [];
  if (headerColumns.join(",").replace(/\s+/g, "") !== expectedHeader.replace(/\s+/g, "")) {
    validationErrors.push({
      rowNumber: 1,
      field: "header",
      code: "header_mismatch",
      message: "Header row does not match the configured production import contract.",
    });
  }
  if (lines.length > MAX_VALID_FILE_ROWS) {
    validationErrors.push({
      rowNumber: null,
      field: null,
      code: "too_many_rows",
      message: `Import exceeds maximum supported row count (${MAX_VALID_FILE_ROWS}).`,
    });
  }

  const normalizedRows: ProductionPreparedRow[] = lines.map((line, index) => {
    const { values: columns, unclosedQuote } = parseCsvLine(line);
    if (unclosedQuote) {
      validationErrors.push({
        rowNumber: index + 2,
        field: null,
        code: "csv_unclosed_quote",
        message: "Row has an unclosed quoted value.",
      });
    }
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
    if (!mapped.work_date) validationErrors.push({ rowNumber: row.rowNumber, field: "Date", code: "required", message: "Date is required and must be YYYY-MM-DD." });
    if (!mapped.operator_name) validationErrors.push({ rowNumber: row.rowNumber, field: "Operator", code: "required", message: "Operator is required." });
    if (!mapped.shift_start_time) validationErrors.push({ rowNumber: row.rowNumber, field: "Start Time", code: "invalid_time", message: "Start Time must be a valid time value." });
    if (!mapped.shift_end_time) validationErrors.push({ rowNumber: row.rowNumber, field: "Finish Time", code: "invalid_time", message: "Finish Time must be a valid time value." });
    if (!mapped.project_file) validationErrors.push({ rowNumber: row.rowNumber, field: "Project File", code: "required", message: "Project File is required." });
    if (!mapped.project_sequence || !Number.isInteger(Number(mapped.project_sequence))) validationErrors.push({ rowNumber: row.rowNumber, field: "Project Sequence", code: "invalid_integer", message: "Project Sequence must be an integer." });
    if (!mapped.project_name) validationErrors.push({ rowNumber: row.rowNumber, field: "Project Name", code: "required", message: "Project Name is required." });
    if (!mapped.file_minutes_left_start || Number.isNaN(Number(mapped.file_minutes_left_start))) validationErrors.push({ rowNumber: row.rowNumber, field: "Time Remaining Start", code: "invalid_duration", message: "Time Remaining Start must be hh:mm:ss." });
    if (!mapped.file_minutes_left_end || Number.isNaN(Number(mapped.file_minutes_left_end))) validationErrors.push({ rowNumber: row.rowNumber, field: "Time Remaining End", code: "invalid_duration", message: "Time Remaining End must be hh:mm:ss." });
    if (!Number.isFinite(Number(mapped.actual_volume_cut_m3))) validationErrors.push({ rowNumber: row.rowNumber, field: "Actual Volume Cut m3", code: "invalid_number", message: "Actual Volume Cut m3 must be numeric." });
    if (Number.isNaN(Number(mapped.downtime_minutes))) validationErrors.push({ rowNumber: row.rowNumber, field: "Downtime Hours", code: "invalid_number", message: "Downtime Hours must be a non-negative number." });
    if (Number.isNaN(Number(mapped.interruption_minutes))) validationErrors.push({ rowNumber: row.rowNumber, field: "Interruption Hours", code: "invalid_number", message: "Interruption Hours must be a non-negative number." });
    const source_row_hash = buildProductionSourceRowHash(PRODUCTION_IMPORT_CONTRACT.sourceSystem, mapped);
    return { ...mapped, source_row_number: row.rowNumber, source_row_hash };
  });
  const hashToRows = new Map<string, number[]>();
  for (const row of normalizedRows) {
    const existing = hashToRows.get(row.source_row_hash) ?? [];
    existing.push(row.source_row_number);
    hashToRows.set(row.source_row_hash, existing);
  }
  for (const [hash, rowNumbers] of hashToRows) {
    if (rowNumbers.length > 1) {
      for (const rowNumber of rowNumbers) {
        validationErrors.push({
          rowNumber,
          field: "source_row_hash",
          code: "duplicate_source_row",
          message: `Duplicate source row in payload (hash ${hash.slice(0, 12)}…, rows: ${rowNumbers.join(", ")}).`,
        });
      }
    }
  }

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
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Failed to apply production import: ${detail || response.statusText}`);
  }
  return { importBatchId, result: await response.json() };
}
