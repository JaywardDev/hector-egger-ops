import { createHash } from "node:crypto";
import { inflateRawSync } from "node:zlib";

// Phase 1a — QA checklist template parser (C-base export → fields_json).
//
// Turns a C-base checklist-template .xlsx (one "Master List Templates" sheet)
// into the versioned `fields_json` shape defined in docs/qa-module-design.md
// §4.2, plus a stable content hash for the versioned upsert and the raw rows
// kept verbatim (the §2.3 hedge). Pure and dependency-light so it is trivially
// testable against the committed fixtures — no DB, no server-only.
//
// The low-level XLSX reader is adapted from
// src/lib/timesheets/c-base-import.ts. It is duplicated (not imported) to keep
// the QA module self-contained per the isolation principle; a future refactor
// could lift it into a shared util if a third consumer appears.

// ---- Public types ----------------------------------------------------------

/** C-base row `Type`s that become answerable/renderable template items. */
export type QaTemplateItemType = "select" | "note" | "signoff";

export type QaTemplateItem = {
  /** Stable C-base UUID for the row — the key evidence/answers attach to. */
  id: string;
  type: QaTemplateItemType;
  label: string;
  /** Allowed answers for `select` items (the C-base `Values` list), verbatim. */
  options?: string[];
};

export type QaTemplateStep = {
  id: string;
  title: string;
  /** True when the section is a formal checkpoint/gate (C-base `checkpoint`). */
  checkpoint: boolean;
  items: QaTemplateItem[];
};

/** The parsed template definition — one row per `qa_template_version`. */
export type QaTemplateFields = {
  source_id: string;
  version: number;
  name: string;
  steps: QaTemplateStep[];
};

/** A verbatim copy of one sheet row (the hedge — nothing C-base sends is lost). */
export type QaTemplateRawRow = {
  rowNumber: number;
  id: string;
  type: string;
  name: string;
  values: string;
  promptingName: string;
};

export type QaTemplateIssue = {
  rowNumber: number | null;
  field: string | null;
  message: string;
};

export type QaTemplateParseResult = {
  /** Null only when a fatal error prevented parsing (see `errors`). */
  fields: QaTemplateFields | null;
  /** SHA-256 of the canonical `fields` — the change-detection key for upsert. */
  sourceRowHash: string | null;
  /** Verbatim rows, in sheet order. */
  raw: QaTemplateRawRow[];
  /** Non-fatal (unknown row type, select with no options, orphan item, …). */
  warnings: QaTemplateIssue[];
  /** Fatal (missing sheet, bad header, no checklist row). */
  errors: QaTemplateIssue[];
};

export const QA_TEMPLATE_SHEET_NAME = "Master List Templates";
const EXPECTED_HEADERS = ["Id", "Type", "Name", "Values", "Prompting Name"] as const;

// ---- Low-level XLSX reader (adapted from timesheets/c-base-import.ts) -------

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

const readCellValue = (cell: string, sharedStrings: string[]): string => {
  const type = cell.match(/\bt="([^"]+)"/)?.[1];
  const inline = Array.from(cell.matchAll(/<is>[\s\S]*?<t[^>]*>([\s\S]*?)<\/t>[\s\S]*?<\/is>/g), ([, text]) => escapeXml(text)).join("");
  const inlineValue = inline || cell.match(/<v>([\s\S]*?)<\/v>/)?.[1];
  const value = (inlineValue ?? "").trim();

  if (type === "s") return sharedStrings[Number.parseInt(value, 10)] ?? "";
  return escapeXml(value);
};

type SheetRow = { rowNumber: number; cells: string[] };

const readWorksheetRows = (buffer: Buffer, sheetName: string): SheetRow[] | null => {
  const files = unzipXlsx(buffer);
  const worksheetPath = getWorksheetPath(files, sheetName);
  if (!worksheetPath) return null;

  const worksheetXml = files.get(worksheetPath);
  if (!worksheetXml) return null;

  const sharedStrings = parseSharedStrings(files);
  return Array.from(worksheetXml.matchAll(/<row\b[^>]*r="(\d+)"[^>]*>([\s\S]*?)<\/row>/g)).map(([, rowNumber, rowXml]) => {
    const cells: string[] = [];
    for (const [, cellXml, reference] of rowXml.matchAll(/(<c\b[^>]*r="([A-Z]+)\d+"[^>]*>[\s\S]*?<\/c>)/g)) {
      cells[columnIndex(cellColumn(reference))] = readCellValue(cellXml, sharedStrings).trim();
    }
    return { rowNumber: Number(rowNumber), cells };
  });
};

// ---- Grammar walk ----------------------------------------------------------

const splitOptions = (values: string): string[] =>
  values
    .split(",")
    .map((option) => option.trim())
    .filter((option) => option.length > 0);

const parseChecklistId = (id: string): { sourceId: string; version: number | null } => {
  const slash = id.lastIndexOf("/");
  if (slash < 0) return { sourceId: id, version: null };
  const version = Number.parseInt(id.slice(slash + 1), 10);
  return { sourceId: id.slice(0, slash), version: Number.isFinite(version) ? version : null };
};

/**
 * Parse a C-base checklist-template workbook into `fields_json` + a content hash.
 * Never throws — problems surface as `errors` (fatal) / `warnings` (non-fatal).
 */
export const parseQaChecklistTemplate = (buffer: Buffer): QaTemplateParseResult => {
  const warnings: QaTemplateIssue[] = [];
  const errors: QaTemplateIssue[] = [];
  const raw: QaTemplateRawRow[] = [];

  const sheetRows = readWorksheetRows(buffer, QA_TEMPLATE_SHEET_NAME);
  if (!sheetRows) {
    return {
      fields: null,
      sourceRowHash: null,
      raw,
      warnings,
      errors: [{ rowNumber: null, field: null, message: `Worksheet "${QA_TEMPLATE_SHEET_NAME}" was not found or could not be read.` }],
    };
  }

  const headerRow = sheetRows.find((row) => row.cells.some((cell) => cell));
  if (!headerRow) {
    return { fields: null, sourceRowHash: null, raw, warnings, errors: [{ rowNumber: null, field: null, message: "Worksheet is empty." }] };
  }

  const headers = headerRow.cells.map((cell) => (cell ?? "").trim());
  if (headers.length < EXPECTED_HEADERS.length || EXPECTED_HEADERS.some((expected, index) => headers[index] !== expected)) {
    return {
      fields: null,
      sourceRowHash: null,
      raw,
      warnings,
      errors: [{ rowNumber: headerRow.rowNumber, field: "headers", message: `Headers must start with: ${EXPECTED_HEADERS.join(", ")}.` }],
    };
  }

  const dataRows = sheetRows.filter((row) => row.rowNumber > headerRow.rowNumber && row.cells.some((cell) => cell));

  let sourceId = "";
  let version: number | null = null;
  let name = "";
  let sawChecklist = false;
  const steps: QaTemplateStep[] = [];
  let currentStep: QaTemplateStep | null = null;

  for (const row of dataRows) {
    const id = (row.cells[0] ?? "").trim();
    const type = (row.cells[1] ?? "").trim();
    const cellName = (row.cells[2] ?? "").trim();
    const values = (row.cells[3] ?? "").trim();
    const promptingName = (row.cells[4] ?? "").trim();
    raw.push({ rowNumber: row.rowNumber, id, type, name: cellName, values, promptingName });

    switch (type) {
      case "checklist": {
        if (sawChecklist) {
          warnings.push({ rowNumber: row.rowNumber, field: "Type", message: "Multiple checklist header rows; the first is used." });
          break;
        }
        sawChecklist = true;
        name = cellName;
        const parsed = parseChecklistId(id);
        sourceId = parsed.sourceId;
        version = parsed.version;
        if (!sourceId) errors.push({ rowNumber: row.rowNumber, field: "Id", message: "Checklist row has no source id." });
        if (version === null) warnings.push({ rowNumber: row.rowNumber, field: "Id", message: "Checklist Id has no /version suffix; defaulting to 1." });
        break;
      }
      case "section": {
        currentStep = { id, title: cellName, checkpoint: false, items: [] };
        steps.push(currentStep);
        break;
      }
      case "checkpoint": {
        if (currentStep) currentStep.checkpoint = true;
        else warnings.push({ rowNumber: row.rowNumber, field: "Type", message: "checkpoint row before any section." });
        break;
      }
      case "checkpoint-no-value": {
        // Section-level marker with no input; the section row already models it.
        break;
      }
      case "button": {
        const options = splitOptions(values);
        if (options.length === 0) warnings.push({ rowNumber: row.rowNumber, field: "Values", message: `Select item "${cellName}" has no options.` });
        if (!currentStep) {
          warnings.push({ rowNumber: row.rowNumber, field: "Type", message: "Item before any section; skipped." });
          break;
        }
        currentStep.items.push({ id, type: "select", label: cellName, options });
        break;
      }
      case "note":
      case "textbox": {
        // `textbox` carries an instruction (no Values in the observed exports),
        // so it is treated like a note. The original type is kept in `raw`.
        if (!currentStep) {
          warnings.push({ rowNumber: row.rowNumber, field: "Type", message: "Note before any section; skipped." });
          break;
        }
        currentStep.items.push({ id, type: "note", label: cellName });
        break;
      }
      case "signoff": {
        if (!currentStep) {
          warnings.push({ rowNumber: row.rowNumber, field: "Type", message: "Sign-off before any section; skipped." });
          break;
        }
        currentStep.items.push({ id, type: "signoff", label: cellName });
        break;
      }
      default: {
        warnings.push({ rowNumber: row.rowNumber, field: "Type", message: `Unknown row type "${type}"; skipped.` });
      }
    }
  }

  if (!sawChecklist) {
    return { fields: null, sourceRowHash: null, raw, warnings, errors: [...errors, { rowNumber: null, field: null, message: "No checklist header row found." }] };
  }
  if (steps.length === 0) {
    warnings.push({ rowNumber: null, field: null, message: "Template has no sections." });
  }

  const fields: QaTemplateFields = { source_id: sourceId, version: version ?? 1, name, steps };
  const sourceRowHash = createHash("sha256").update(JSON.stringify(fields)).digest("hex");

  return { fields, sourceRowHash, raw, warnings, errors };
};
