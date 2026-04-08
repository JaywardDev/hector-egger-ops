import "server-only";

import { resolveInventoryItemNameCandidate } from "@/src/lib/inventory/item-labels";
import type {
  StockTakeEntryExportRecord,
  StockTakeSessionRecord,
} from "@/src/lib/stock-take/sessions";

type LayoutCoordinate = {
  bay: string;
  bayNumber: number;
  level: string;
  levelNumber: number;
};

type NormalizedExportRow = {
  materialLabel: string;
  qty: number;
  location: string;
  notes: string;
  mapping: LayoutCoordinate | null;
};

type ExportFile = {
  filename: string;
  content: Buffer;
};

type CellValue = string | number | null;

type SheetData = {
  name: string;
  rows: CellValue[][];
  wrapTextCells?: Set<string>;
};

const XML_ESCAPE_LOOKUP: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&apos;",
};

const excelDateToken = (value: string) => value.slice(0, 10);

const toSlugToken = (value: string | null | undefined) => {
  const base = (value ?? "").trim().toLowerCase();
  if (!base) {
    return null;
  }

  const slug = base
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return slug.length > 0 ? slug : null;
};

const escapeXml = (value: string) => value.replace(/[&<>"']/g, (token) => XML_ESCAPE_LOOKUP[token] ?? token);

const toColumnName = (index: number) => {
  let value = index + 1;
  let column = "";

  while (value > 0) {
    const remainder = (value - 1) % 26;
    column = String.fromCharCode(65 + remainder) + column;
    value = Math.floor((value - 1) / 26);
  }

  return column;
};

const parseBayLevelHint = (value: string | null): LayoutCoordinate | null => {
  const normalized = value?.trim() ?? "";
  if (!normalized) {
    return null;
  }

  const patterns = [
    /\bB\s*0*(\d{1,3})\s*[-/ ]\s*L\s*0*(\d{1,3})\b/i,
    /\bBay\s*0*(\d{1,3})\s*[,;:/\- ]+\s*Level\s*0*(\d{1,3})\b/i,
  ] as const;

  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (!match) {
      continue;
    }

    const bayNumber = Number(match[1]);
    const levelNumber = Number(match[2]);

    if (!Number.isInteger(bayNumber) || !Number.isInteger(levelNumber)) {
      continue;
    }

    return {
      bay: `B${bayNumber}`,
      bayNumber,
      level: `L${levelNumber}`,
      levelNumber,
    };
  }

  return null;
};

const toMaterialLabel = (entry: StockTakeEntryExportRecord) => {
  const inventoryItem = entry.inventory_item;
  if (!inventoryItem) {
    return "Unknown material";
  }

  return (
    resolveInventoryItemNameCandidate({
      name: inventoryItem.name,
      timberSpec: inventoryItem.timber_spec,
      selectedMaterialGroupKey: inventoryItem.material_group?.key,
      timberLabelMode: "auto",
      existingAutoLabel: inventoryItem.name,
    }) ?? inventoryItem.name
  );
};

const toLocationLabel = (entry: StockTakeEntryExportRecord) => {
  const location = entry.stock_location;
  if (!location) {
    return "";
  }

  return location.code ? `${location.name} (${location.code})` : location.name;
};

const normalizeRows = (entries: StockTakeEntryExportRecord[]): NormalizedExportRow[] =>
  entries.map((entry) => {
    const mapping =
      parseBayLevelHint(entry.stock_location?.code ?? null) ??
      parseBayLevelHint(entry.stock_location?.name ?? null) ??
      parseBayLevelHint(entry.notes);

    return {
      materialLabel: toMaterialLabel(entry),
      qty: entry.counted_quantity,
      location: toLocationLabel(entry),
      notes: entry.notes ?? "",
      mapping,
    };
  });

const buildLayoutSheet = (rows: NormalizedExportRow[]): SheetData => {
  const mapped = rows.filter((row) => row.mapping !== null);
  const bays = Array.from(new Set(mapped.map((row) => row.mapping!.bayNumber))).sort(
    (a, b) => a - b,
  );
  const levels = Array.from(
    new Set(mapped.map((row) => row.mapping!.levelNumber)),
  ).sort((a, b) => b - a);

  const matrix = new Map<string, string[]>();
  for (const row of mapped) {
    const key = `${row.mapping!.bayNumber}:${row.mapping!.levelNumber}`;
    const current = matrix.get(key) ?? [];
    current.push(`${row.materialLabel} (${row.qty})`);
    matrix.set(key, current);
  }

  const sheetRows: CellValue[][] = [];
  sheetRows.push(["Level/Bay", ...bays.map((bay) => `B${bay}`)]);

  const wrapTextCells = new Set<string>();

  for (const level of levels) {
    const line: CellValue[] = [`L${level}`];

    for (const bay of bays) {
      const key = `${bay}:${level}`;
      const entries = matrix.get(key) ?? [];
      entries.sort((a, b) => a.localeCompare(b));
      const value = entries.join("\n");
      line.push(value || null);
    }

    sheetRows.push(line);
  }

  for (let rowIndex = 1; rowIndex < sheetRows.length; rowIndex += 1) {
    for (let columnIndex = 1; columnIndex < sheetRows[rowIndex]!.length; columnIndex += 1) {
      const cellValue = sheetRows[rowIndex]![columnIndex];
      if (typeof cellValue === "string" && cellValue.includes("\n")) {
        const cellRef = `${toColumnName(columnIndex)}${rowIndex + 1}`;
        wrapTextCells.add(cellRef);
      }
    }
  }

  return {
    name: "Layout",
    rows: sheetRows,
    wrapTextCells,
  };
};

const buildRawDataSheet = (rows: NormalizedExportRow[]): SheetData => ({
  name: "Raw Data",
  rows: [
    ["Material Label", "Qty", "Location", "Notes"],
    ...rows.map((row) => [row.materialLabel, row.qty, row.location, row.notes]),
  ],
});

const buildSummarySheet = (rows: NormalizedExportRow[]): SheetData => {
  const totals = new Map<string, number>();

  for (const row of rows) {
    totals.set(row.materialLabel, (totals.get(row.materialLabel) ?? 0) + row.qty);
  }

  const summaryRows = Array.from(totals.entries())
    .sort(([labelA], [labelB]) => labelA.localeCompare(labelB))
    .map(([label, total]) => [label, total] as CellValue[]);

  return {
    name: "Summary",
    rows: [["Material Label", "Total Pieces"], ...summaryRows],
  };
};

const crcTable = new Uint32Array(256).map((_, index) => {
  let c = index;
  for (let bit = 0; bit < 8; bit += 1) {
    c = (c & 1) !== 0 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  return c >>> 0;
});

const crc32 = (buffer: Buffer) => {
  let c = 0xffffffff;
  for (const byte of buffer) {
    c = crcTable[(c ^ byte) & 0xff]! ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
};

type ZipEntry = { name: string; data: Buffer };

const createZip = (entries: ZipEntry[]) => {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBuffer = Buffer.from(entry.name, "utf8");
    const data = entry.data;
    const crc = crc32(data);

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0, 6);
    localHeader.writeUInt16LE(0, 8);
    localHeader.writeUInt16LE(0, 10);
    localHeader.writeUInt16LE(0, 12);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(data.length, 18);
    localHeader.writeUInt32LE(data.length, 22);
    localHeader.writeUInt16LE(nameBuffer.length, 26);
    localHeader.writeUInt16LE(0, 28);

    localParts.push(localHeader, nameBuffer, data);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0, 8);
    centralHeader.writeUInt16LE(0, 10);
    centralHeader.writeUInt16LE(0, 12);
    centralHeader.writeUInt16LE(0, 14);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(data.length, 20);
    centralHeader.writeUInt32LE(data.length, 24);
    centralHeader.writeUInt16LE(nameBuffer.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42);

    centralParts.push(centralHeader, nameBuffer);
    offset += localHeader.length + nameBuffer.length + data.length;
  }

  const centralDirectory = Buffer.concat(centralParts);
  const endRecord = Buffer.alloc(22);
  endRecord.writeUInt32LE(0x06054b50, 0);
  endRecord.writeUInt16LE(0, 4);
  endRecord.writeUInt16LE(0, 6);
  endRecord.writeUInt16LE(entries.length, 8);
  endRecord.writeUInt16LE(entries.length, 10);
  endRecord.writeUInt32LE(centralDirectory.length, 12);
  endRecord.writeUInt32LE(offset, 16);
  endRecord.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, centralDirectory, endRecord]);
};

const buildWorksheetXml = ({
  rows,
  sharedStringIndex,
  wrapTextCells,
}: {
  rows: CellValue[][];
  sharedStringIndex: Map<string, number>;
  wrapTextCells?: Set<string>;
}) => {
  const maxColumns = rows.reduce((max, row) => Math.max(max, row.length), 0);
  const dimension = `${toColumnName(0)}1:${toColumnName(Math.max(maxColumns - 1, 0))}${Math.max(rows.length, 1)}`;

  const xmlRows = rows
    .map((row, rowIndex) => {
      const cells = row
        .map((value, columnIndex) => {
          if (value === null || value === "") {
            return null;
          }

          const ref = `${toColumnName(columnIndex)}${rowIndex + 1}`;
          const isHeader = rowIndex === 0;
          const isWrapText = wrapTextCells?.has(ref) ?? false;
          const styleId = isHeader ? 1 : isWrapText ? 2 : 0;

          if (typeof value === "number") {
            return `<c r="${ref}" s="${styleId}"><v>${value}</v></c>`;
          }

          const sharedIndex = sharedStringIndex.get(value);
          if (sharedIndex === undefined) {
            throw new Error("Shared string index missing");
          }

          return `<c r="${ref}" t="s" s="${styleId}"><v>${sharedIndex}</v></c>`;
        })
        .filter((cell): cell is string => Boolean(cell))
        .join("");

      return `<row r="${rowIndex + 1}">${cells}</row>`;
    })
    .join("");

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetViews><sheetView workbookViewId="0"/></sheetViews>
  <sheetFormatPr defaultRowHeight="15"/>
  <cols>${Array.from({ length: maxColumns }, (_, index) => `<col min="${index + 1}" max="${index + 1}" width="${index === 0 ? 18 : 28}" customWidth="1"/>`).join("")}</cols>
  <sheetData>${xmlRows}</sheetData>
  <dimension ref="${dimension}"/>
  <pageMargins left="0.7" right="0.7" top="0.75" bottom="0.75" header="0.3" footer="0.3"/>
</worksheet>`;
};

const createWorkbookBuffer = (sheets: SheetData[]) => {
  const sharedStrings: string[] = [];
  const sharedStringIndex = new Map<string, number>();

  for (const sheet of sheets) {
    for (const row of sheet.rows) {
      for (const cell of row) {
        if (typeof cell !== "string" || cell.length === 0) {
          continue;
        }

        if (!sharedStringIndex.has(cell)) {
          sharedStringIndex.set(cell, sharedStrings.length);
          sharedStrings.push(cell);
        }
      }
    }
  }

  const worksheetEntries: ZipEntry[] = sheets.map((sheet, index) => ({
    name: `xl/worksheets/sheet${index + 1}.xml`,
    data: Buffer.from(
      buildWorksheetXml({
        rows: sheet.rows,
        sharedStringIndex,
        wrapTextCells: sheet.wrapTextCells,
      }),
      "utf8",
    ),
  }));

  const sharedStringsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${sharedStrings.length}" uniqueCount="${sharedStrings.length}">
${sharedStrings.map((value) => `  <si><t xml:space="preserve">${escapeXml(value)}</t></si>`).join("\n")}
</sst>`;

  const workbookXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
${sheets
  .map((sheet, index) => `    <sheet name="${escapeXml(sheet.name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`)
  .join("\n")}
  </sheets>
</workbook>`;

  const workbookRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
${sheets
  .map(
    (_, index) =>
      `  <Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`,
  )
  .join("\n")}
  <Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
  <Relationship Id="rId${sheets.length + 2}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/>
</Relationships>`;

  const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
  <Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>
${sheets
  .map(
    (_, index) =>
      `  <Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
  )
  .join("\n")}
</Types>`;

  const rootRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;

  const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="2">
    <font><sz val="11"/><name val="Calibri"/></font>
    <font><b/><sz val="11"/><name val="Calibri"/></font>
  </fonts>
  <fills count="2">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
  </fills>
  <borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="3">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top"/></xf>
    <xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment vertical="top"/></xf>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment wrapText="1" vertical="top"/></xf>
  </cellXfs>
</styleSheet>`;

  return createZip([
    { name: "[Content_Types].xml", data: Buffer.from(contentTypesXml, "utf8") },
    { name: "_rels/.rels", data: Buffer.from(rootRelsXml, "utf8") },
    { name: "xl/workbook.xml", data: Buffer.from(workbookXml, "utf8") },
    {
      name: "xl/_rels/workbook.xml.rels",
      data: Buffer.from(workbookRelsXml, "utf8"),
    },
    { name: "xl/styles.xml", data: Buffer.from(stylesXml, "utf8") },
    {
      name: "xl/sharedStrings.xml",
      data: Buffer.from(sharedStringsXml, "utf8"),
    },
    ...worksheetEntries,
  ]);
};

export const buildStockTakeSessionExcelExport = ({
  session,
  entries,
}: {
  session: StockTakeSessionRecord;
  entries: StockTakeEntryExportRecord[];
}): ExportFile => {
  const rows = normalizeRows(entries);
  const sheets = [
    buildLayoutSheet(rows),
    buildRawDataSheet(rows),
    buildSummarySheet(rows),
  ];

  const workbook = createWorkbookBuffer(sheets);
  const dateToken = excelDateToken(session.created_at);
  const locationToken =
    toSlugToken(session.stock_location?.code) ??
    toSlugToken(session.stock_location?.name) ??
    "all_locations";

  return {
    filename: `stock_take_${dateToken}_${locationToken}.xlsx`,
    content: workbook,
  };
};
