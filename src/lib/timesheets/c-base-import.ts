import "server-only";

import { createHash } from "node:crypto";
import { inflateRawSync } from "node:zlib";
import { createServiceRoleSupabaseClient } from "@/src/lib/supabase/service-role";
import type { AuthSession } from "@/src/lib/auth/session";
import type { StaffGroup, TimesheetLookupOption } from "@/src/lib/timesheets/types";

export type CBaseImportValidationError = {
  file: "buildings" | "costcodes";
  rowNumber: number | null;
  field: string | null;
  code: string | null;
  message: string;
};

export type CBaseImportDiffSummary = {
  insertedCount: number;
  updatedCount: number;
  unchangedCount: number;
  reactivatedCount: number;
  deactivatedByHiddenFlagCount: number;
  deactivatedByMissingCount: number;
  invalidRowsCount: number;
  duplicateProjectCodes: string[];
  duplicateCostCodes: string[];
};

type LookupKind = "project" | "task";
type SourceFile = "buildings" | "costcodes";

type CBaseImportRow = {
  code: string;
  label: string;
  isHidden: boolean;
  sortOrder: number;
  visibleToStaffGroups: StaffGroup[];
  sourceRowHash: string;
};

type ExistingLookupRow = TimesheetLookupOption & {
  source_system: "manual" | "c_base";
};

type CBaseImportDiffRow = {
  kind: LookupKind;
  code: string;
  desired: CBaseImportRow;
  existing: ExistingLookupRow | null;
  action: "insert" | "update" | "reactivate" | "deactivate_hidden" | "unchanged";
};

export type CBaseImportPreparationResult = {
  projects: CBaseImportRow[];
  tasks: CBaseImportRow[];
  projectDiffs: CBaseImportDiffRow[];
  taskDiffs: CBaseImportDiffRow[];
  projectDeactivationsByMissing: ExistingLookupRow[];
  taskDeactivationsByMissing: ExistingLookupRow[];
  summary: CBaseImportDiffSummary;
  validationErrors: CBaseImportValidationError[];
};

type WorkbookRow = {
  rowNumber: number;
  values: Record<string, string | boolean>;
};

const REQUIRED_HEADERS = {
  buildings: ["PRODUCTION_SEQUENCE", "TITLE", "DISPLAYAS", "STATUS", "TIMESHEET_SITE", "TIMESHEET_FACTORY", "TIMESHEET_OFFICE"],
  costcodes: ["COSTCODE_ID", "Description", "DisplayAs", "Department"],
} as const;

const ALLOWED_DEPARTMENTS = new Set(["ALL", "Factory", "Site", "Office", "Hide"]);

const allStaffGroups: StaffGroup[] = ["factory", "site", "office"];
const select = "id,code,label,is_active,sort_order,visible_to_staff_groups,source_system,source_row_hash,last_seen_at,inactive_reason,inactive_at";

const emptySummary = (): CBaseImportDiffSummary => ({
  insertedCount: 0,
  updatedCount: 0,
  unchangedCount: 0,
  reactivatedCount: 0,
  deactivatedByHiddenFlagCount: 0,
  deactivatedByMissingCount: 0,
  invalidRowsCount: 0,
  duplicateProjectCodes: [],
  duplicateCostCodes: [],
});

const normalizeHeader = (value: string) => value.trim();
const normalizeHeaderCell = (value: string | boolean) => (typeof value === "string" ? normalizeHeader(value) : "");
const normalizeCode = (value: string) => value.trim();
const normalizeLabel = (value: string) => value.trim().replace(/\s+/g, " ");

const escapeXml = (value: string) =>
  value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");

const unzipXlsx = (buffer: Buffer) => {
  const files = new Map<string, string>();
  const eocdSignature = 0x06054b50;
  const centralDirSignature = 0x02014b50;
  const localFileSignature = 0x04034b50;
  let eocdOffset = -1;
  const eocdScanStart = Math.max(0, buffer.length - 65535 - 22);

  for (let offset = buffer.length - 22; offset >= eocdScanStart; offset -= 1) {
    if (buffer.readUInt32LE(offset) === eocdSignature) {
      eocdOffset = offset;
      break;
    }
  }
  if (eocdOffset < 0) return files;

  const centralDirectoryOffset = buffer.readUInt32LE(eocdOffset + 16);
  const totalEntries = buffer.readUInt16LE(eocdOffset + 10);
  let centralOffset = centralDirectoryOffset;

  for (let i = 0; i < totalEntries && centralOffset + 46 <= buffer.length; i += 1) {
    if (buffer.readUInt32LE(centralOffset) !== centralDirSignature) break;

    const method = buffer.readUInt16LE(centralOffset + 10);
    const compressedSize = buffer.readUInt32LE(centralOffset + 20);
    const fileNameLength = buffer.readUInt16LE(centralOffset + 28);
    const extraLength = buffer.readUInt16LE(centralOffset + 30);
    const commentLength = buffer.readUInt16LE(centralOffset + 32);
    const localHeaderOffset = buffer.readUInt32LE(centralOffset + 42);
    const fileName = buffer.subarray(centralOffset + 46, centralOffset + 46 + fileNameLength).toString("utf8");

    if (!fileName.endsWith("/") && localHeaderOffset + 30 <= buffer.length && buffer.readUInt32LE(localHeaderOffset) === localFileSignature) {
      const localNameLength = buffer.readUInt16LE(localHeaderOffset + 26);
      const localExtraLength = buffer.readUInt16LE(localHeaderOffset + 28);
      const dataStart = localHeaderOffset + 30 + localNameLength + localExtraLength;
      const compressed = buffer.subarray(dataStart, dataStart + compressedSize);

      try {
        if (method === 0) files.set(fileName, compressed.toString("utf8"));
        else if (method === 8) files.set(fileName, inflateRawSync(compressed).toString("utf8"));
      } catch {
        // Unsupported binary/invalid XML payloads are skipped.
      }
    }

    centralOffset += 46 + fileNameLength + extraLength + commentLength;
  }

  return files;
};

const parseSharedStrings = (files: Map<string, string>) => {
  const xml = files.get("xl/sharedStrings.xml");
  if (!xml) return [];

  return Array.from(xml.matchAll(/<si[\s\S]*?<\/si>/g), ([entry]) =>
    Array.from(entry.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g), ([, text]) => escapeXml(text)).join(""),
  );
};

const getWorksheetPath = (files: Map<string, string>, requestedSheetName: string) => {
  const workbookXml = files.get("xl/workbook.xml");
  const relsXml = files.get("xl/_rels/workbook.xml.rels");
  if (!workbookXml || !relsXml) return null;

  const sheet = Array.from(workbookXml.matchAll(/<sheet\b[^>]*>/g))
    .map(([tag]) => ({
      name: escapeXml(tag.match(/name="([^"]+)"/)?.[1] ?? ""),
      relId: tag.match(/r:id="([^"]+)"/)?.[1] ?? "",
    }))
    .find(({ name }) => name === requestedSheetName);

  if (!sheet) return null;

  const rel = Array.from(relsXml.matchAll(/<Relationship\b[^>]*>/g))
    .map(([tag]) => ({
      id: tag.match(/Id="([^"]+)"/)?.[1] ?? "",
      target: tag.match(/Target="([^"]+)"/)?.[1] ?? "",
    }))
    .find(({ id }) => id === sheet.relId);

  if (!rel) return null;
  return rel.target.startsWith("/") ? rel.target.slice(1) : `xl/${rel.target}`.replace(/\/[^/]+\/\.\.\//g, "/");
};

const cellColumn = (reference: string) => reference.replace(/[0-9]/g, "");
const columnIndex = (column: string) =>
  column.split("").reduce((total, character) => total * 26 + character.charCodeAt(0) - 64, 0) - 1;

const readCellValue = (cell: string, sharedStrings: string[]): string | boolean => {
  const type = cell.match(/\bt="([^"]+)"/)?.[1];
  const inline = Array.from(cell.matchAll(/<is>[\s\S]*?<t[^>]*>([\s\S]*?)<\/t>[\s\S]*?<\/is>/g), ([, text]) => escapeXml(text)).join("");
  const inlineValue = inline || cell.match(/<v>([\s\S]*?)<\/v>/)?.[1];
  const value = (inlineValue ?? "").trim();

  if (type === "s") return sharedStrings[Number.parseInt(value, 10)] ?? "";
  if (type === "b") return value === "1";

  return escapeXml(value);
};

export const parseWorksheet = (buffer: Buffer, sheetName: string, file: SourceFile): { rows: WorkbookRow[]; errors: CBaseImportValidationError[] } => {
  const files = unzipXlsx(buffer);
  const worksheetPath = getWorksheetPath(files, sheetName);
  const errors: CBaseImportValidationError[] = [];

  if (!worksheetPath) {
    return {
      rows: [],
      errors: [{ file, rowNumber: null, field: null, code: null, message: `Worksheet ${sheetName} was not found.` }],
    };
  }

  const worksheetXml = files.get(worksheetPath);
  if (!worksheetXml) {
    return {
      rows: [],
      errors: [{ file, rowNumber: null, field: null, code: null, message: `Worksheet ${sheetName} could not be read.` }],
    };
  }

  const sharedStrings = parseSharedStrings(files);
  const rawRows = Array.from(worksheetXml.matchAll(/<row\b[^>]*r="(\d+)"[^>]*>([\s\S]*?)<\/row>/g)).map(([, rowNumber, rowXml]) => {
    const cells: Array<string | boolean> = [];
    for (const [, cellXml, reference] of rowXml.matchAll(/(<c\b[^>]*r="([A-Z]+)\d+"[^>]*>[\s\S]*?<\/c>)/g)) {
      const cellValue = readCellValue(cellXml, sharedStrings);
      cells[columnIndex(cellColumn(reference))] = typeof cellValue === "string" ? cellValue.trim() : cellValue;
    }
    return { rowNumber: Number(rowNumber), cells };
  });

  const headerRow = rawRows.find((row) => row.cells.some(Boolean));
  if (!headerRow) {
    return { rows: [], errors: [{ file, rowNumber: null, field: null, code: null, message: "Worksheet is empty." }] };
  }

  const headers = headerRow.cells.map(normalizeHeaderCell);
  const expectedHeaders = [...REQUIRED_HEADERS[file]];
  if (headers.length !== expectedHeaders.length || headers.some((header, index) => header !== expectedHeaders[index])) {
    return {
      rows: [],
      errors: [{ file, rowNumber: headerRow.rowNumber, field: "headers", code: null, message: `Headers must exactly match: ${expectedHeaders.join(", ")}.` }],
    };
  }
  const rows = rawRows
    .filter((row) => row.rowNumber > headerRow.rowNumber && row.cells.some(Boolean))
    .map((row) => ({
      rowNumber: row.rowNumber,
      values: Object.fromEntries(headers.map((header, index) => [header, row.cells[index] ?? ""])),
    }));

  return { rows, errors };
};

const parseStrictBoolean = (value: string | boolean): boolean | null => {
  if (typeof value === "boolean") return value;

  const normalized = value.trim().toLowerCase();
  if (normalized === "true") return true;
  if (normalized === "false") return false;
  if (normalized === "1") return true;
  if (normalized === "0") return false;
  return null;
};

const getRequiredStringCell = (row: WorkbookRow, key: string): string | null => {
  const value = row.values[key];
  if (typeof value !== "string") return null;
  return value;
};

const parseOptionalIntegerCell = (value: string | boolean | undefined, fallback: number): number => {
  if (typeof value !== "string") return fallback;

  const trimmed = value.trim();
  if (!trimmed) return fallback;

  const parsed = Number.parseInt(trimmed, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const parseSourceRows = (rows: WorkbookRow[], file: SourceFile) => {
  const errors: CBaseImportValidationError[] = [];
  const parsed: CBaseImportRow[] = [];
  for (const row of rows) {
    const codeFieldKey = file === "buildings" ? "PRODUCTION_SEQUENCE" : "COSTCODE_ID";
    const labelFieldKey = file === "buildings" ? "TITLE" : "Description";
    const rawCode = getRequiredStringCell(row, codeFieldKey);
    const rawLabel = getRequiredStringCell(row, labelFieldKey);
    const code = rawCode === null ? "" : normalizeCode(rawCode);
    const label = rawLabel === null ? "" : normalizeLabel(rawLabel);

    if (!code) {
      errors.push({ file, rowNumber: row.rowNumber, field: "code", code: null, message: "Code is required." });
    }
    if (!label) {
      errors.push({ file, rowNumber: row.rowNumber, field: "label", code: code || null, message: "Label is required." });
    }
    if (!code || !label) continue;

    const sortOrder = parseOptionalIntegerCell(row.values[file === "buildings" ? "DISPLAYAS" : "DisplayAs"], row.rowNumber);

    let isHidden = false;
    let visibleToStaffGroups: StaffGroup[] = [];
    if (file === "buildings") {
      const site = parseStrictBoolean(row.values.TIMESHEET_SITE ?? "");
      const factory = parseStrictBoolean(row.values.TIMESHEET_FACTORY ?? "");
      const office = parseStrictBoolean(row.values.TIMESHEET_OFFICE ?? "");
      if (site === null) errors.push({ file, rowNumber: row.rowNumber, field: "TIMESHEET_SITE", code, message: "TIMESHEET_SITE must be strict boolean TRUE/FALSE." });
      if (factory === null) errors.push({ file, rowNumber: row.rowNumber, field: "TIMESHEET_FACTORY", code, message: "TIMESHEET_FACTORY must be strict boolean TRUE/FALSE." });
      if (office === null) errors.push({ file, rowNumber: row.rowNumber, field: "TIMESHEET_OFFICE", code, message: "TIMESHEET_OFFICE must be strict boolean TRUE/FALSE." });
      if (site !== null && factory !== null && office !== null) {
        visibleToStaffGroups = [site ? "site" : null, factory ? "factory" : null, office ? "office" : null].filter(Boolean) as StaffGroup[];
        isHidden = visibleToStaffGroups.length === 0;
      }
    } else {
      const departmentRaw = getRequiredStringCell(row, "Department");
      const department = departmentRaw === null ? "" : departmentRaw.trim();
      if (!ALLOWED_DEPARTMENTS.has(department)) {
        errors.push({ file, rowNumber: row.rowNumber, field: "Department", code, message: "Department must be one of ALL, Factory, Site, Office, Hide." });
      } else if (department === "Factory") visibleToStaffGroups = ["factory"];
      else if (department === "Site") visibleToStaffGroups = ["site"];
      else if (department === "Office") visibleToStaffGroups = ["office"];
      else if (department === "ALL") visibleToStaffGroups = [...allStaffGroups];
      else if (department === "Hide") {
        visibleToStaffGroups = [];
        isHidden = true;
      }
    }
    const canonical = {
      code,
      label,
      hidden: isHidden,
      sortOrder,
      visibleToStaffGroups,
    };

    parsed.push({
      code: canonical.code,
      label: canonical.label,
      isHidden: canonical.hidden,
      sortOrder: canonical.sortOrder,
      visibleToStaffGroups: canonical.visibleToStaffGroups,
      sourceRowHash: createHash("sha256").update(JSON.stringify(canonical)).digest("hex"),
    });
  }

  return { parsed, errors };
};

const duplicateCodes = (rows: CBaseImportRow[]) => {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const row of rows) {
    if (seen.has(row.code)) duplicates.add(row.code);
    seen.add(row.code);
  }
  return Array.from(duplicates).sort();
};

const loadExisting = async (path: string): Promise<ExistingLookupRow[]> => {
  const supabase = createServiceRoleSupabaseClient();
  const response = await supabase.request(`${path}?select=${select}&order=code.asc`, { cache: "no-store" });
  if (!response.ok) throw new Error("Failed to load existing timesheet lookup rows.");
  return (await response.json()) as ExistingLookupRow[];
};

const rowNeedsUpdate = (existing: ExistingLookupRow, desired: CBaseImportRow) =>
  existing.label !== desired.label ||
  existing.sort_order !== desired.sortOrder ||
  existing.source_row_hash !== desired.sourceRowHash ||
  JSON.stringify(existing.visible_to_staff_groups) !== JSON.stringify(desired.visibleToStaffGroups) ||
  existing.inactive_reason !== null ||
  existing.inactive_at !== null;

const diffRows = (kind: LookupKind, desiredRows: CBaseImportRow[], existingRows: ExistingLookupRow[]) => {
  const existingByCode = new Map(existingRows.filter((row) => row.source_system === "c_base").map((row) => [row.code, row]));
  const desiredByCode = new Set(desiredRows.map((row) => row.code));
  const diffs: CBaseImportDiffRow[] = desiredRows.map((desired) => {
    const existing = existingByCode.get(desired.code) ?? null;
    if (!existing) return { kind, code: desired.code, desired, existing, action: desired.isHidden ? "deactivate_hidden" : "insert" };
    if (desired.isHidden) return { kind, code: desired.code, desired, existing, action: "deactivate_hidden" };
    if (!existing.is_active) return { kind, code: desired.code, desired, existing, action: "reactivate" };
    if (rowNeedsUpdate(existing, desired)) return { kind, code: desired.code, desired, existing, action: "update" };
    return { kind, code: desired.code, desired, existing, action: "unchanged" };
  });

  const missing = existingRows.filter((row) => row.source_system === "c_base" && !desiredByCode.has(row.code) && row.is_active);
  return { diffs, missing };
};

const summarize = (
  projectDiffs: CBaseImportDiffRow[],
  taskDiffs: CBaseImportDiffRow[],
  projectDeactivationsByMissing: ExistingLookupRow[],
  taskDeactivationsByMissing: ExistingLookupRow[],
  validationErrors: CBaseImportValidationError[],
  duplicateProjectCodes: string[],
  duplicateCostCodes: string[],
) => {
  const summary = emptySummary();
  for (const diff of [...projectDiffs, ...taskDiffs]) {
    if (diff.action === "insert") summary.insertedCount += 1;
    if (diff.action === "update") summary.updatedCount += 1;
    if (diff.action === "unchanged") summary.unchangedCount += 1;
    if (diff.action === "reactivate") summary.reactivatedCount += 1;
    if (diff.action === "deactivate_hidden") summary.deactivatedByHiddenFlagCount += 1;
  }
  summary.deactivatedByMissingCount = projectDeactivationsByMissing.length + taskDeactivationsByMissing.length;
  summary.invalidRowsCount = validationErrors.length;
  summary.duplicateProjectCodes = duplicateProjectCodes;
  summary.duplicateCostCodes = duplicateCostCodes;
  return summary;
};

export const prepareCBaseImport = async (
  _session: AuthSession,
  buildingsBuffer: Buffer,
  costcodesBuffer: Buffer,
): Promise<CBaseImportPreparationResult> => {
  const buildingsWorksheet = parseWorksheet(buildingsBuffer, "qry_TIMESHEET_BuildingsExport", "buildings");
  const costcodesWorksheet = parseWorksheet(costcodesBuffer, "qry_TIMESHEET_CostcodesExport", "costcodes");
  const projects = parseSourceRows(buildingsWorksheet.rows, "buildings");
  const tasks = parseSourceRows(costcodesWorksheet.rows, "costcodes");
  const duplicateProjectCodes = duplicateCodes(projects.parsed);
  const duplicateCostCodes = duplicateCodes(tasks.parsed);
  const validationErrors = [...buildingsWorksheet.errors, ...costcodesWorksheet.errors, ...projects.errors, ...tasks.errors];

  for (const code of duplicateProjectCodes) {
    validationErrors.push({ file: "buildings", rowNumber: null, field: "code", code, message: "Duplicate project code in export." });
  }
  for (const code of duplicateCostCodes) {
    validationErrors.push({ file: "costcodes", rowNumber: null, field: "code", code, message: "Duplicate cost code in export." });
  }

  const [existingProjects, existingTasks] = await Promise.all([
    loadExisting("/rest/v1/timesheet_projects"),
    loadExisting("/rest/v1/timesheet_tasks"),
  ]);
  const projectDiff = diffRows("project", projects.parsed, existingProjects);
  const taskDiff = diffRows("task", tasks.parsed, existingTasks);

  return {
    projects: projects.parsed,
    tasks: tasks.parsed,
    projectDiffs: projectDiff.diffs,
    taskDiffs: taskDiff.diffs,
    projectDeactivationsByMissing: projectDiff.missing,
    taskDeactivationsByMissing: taskDiff.missing,
    summary: summarize(projectDiff.diffs, taskDiff.diffs, projectDiff.missing, taskDiff.missing, validationErrors, duplicateProjectCodes, duplicateCostCodes),
    validationErrors,
  };
};

const buildApplyRows = (diffs: CBaseImportDiffRow[], now: string) =>
  diffs
    .filter((diff) => diff.action !== "unchanged")
    .map((diff) => ({
      code: diff.code,
      label: diff.desired.label,
      is_active: !diff.desired.isHidden,
      sort_order: diff.desired.sortOrder,
      visible_to_staff_groups: diff.desired.visibleToStaffGroups,
      source_system: "c_base",
      source_row_hash: diff.desired.sourceRowHash,
      last_seen_at: now,
      inactive_reason: diff.desired.isHidden ? "hidden_in_c_base" : null,
      inactive_at: diff.desired.isHidden ? now : null,
      updated_at: now,
    }));

export const applyCBaseImport = async ({
  actorProfileId,
  buildingsFilename,
  costcodesFilename,
  result,
}: {
  session: AuthSession;
  actorProfileId: string;
  buildingsFilename: string;
  costcodesFilename: string;
  result: CBaseImportPreparationResult;
}) => {
  if (result.validationErrors.length > 0) {
    throw new Error("Cannot apply C Base import while validation errors exist.");
  }

  const now = new Date().toISOString();
  const supabase = createServiceRoleSupabaseClient();
  const payload = {
    p_actor_profile_id: actorProfileId,
    p_buildings_filename: buildingsFilename,
    p_costcodes_filename: costcodesFilename,
    p_projects: buildApplyRows(result.projectDiffs, now),
    p_tasks: buildApplyRows(result.taskDiffs, now),
    p_missing_project_codes: result.projectDeactivationsByMissing.map((row) => row.code),
    p_missing_task_codes: result.taskDeactivationsByMissing.map((row) => row.code),
    p_summary: result.summary,
    p_validation_errors: result.validationErrors,
  };
  const response = await supabase.request(`/rest/v1/rpc/apply_c_base_timesheet_lookup_import`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error("Failed to apply C Base import transaction.");
};
