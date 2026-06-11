import "server-only";

import type { StockTakeExportArea, StockTakeExportData } from "@/src/lib/stock-take/export-data";

type CellType = "string" | "number";
type Cell = { value: string | number; type: CellType; styleId: number };
type ZipEntry = { name: string; data: Buffer };

type WorksheetDefinition = {
  name: string;
  rows: Cell[][];
  columnCount: number;
};

const XML_ESCAPE_LOOKUP: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" };
export const escapeStockTakeXlsxXml = (value: string) => value.replace(/[&<>"']/g, (token) => XML_ESCAPE_LOOKUP[token] ?? token);

const INVALID_SHEET_NAME_CHARS = /[\\/?*:[\]]/g;
const SUMMARY_SHEET_NAME = "All Stock";

export const sanitizeStockTakeWorksheetNames = (areaNames: readonly string[]) => {
  const usedNames = new Set<string>([SUMMARY_SHEET_NAME.toLowerCase()]);

  return areaNames.map((areaName, index) => {
    const fallbackName = `Area ${index + 1}`;
    const base = areaName.replace(INVALID_SHEET_NAME_CHARS, " ").replace(/\s+/g, " ").trim() || fallbackName;
    let suffix = "";
    let candidate = base.slice(0, 31);
    let duplicateIndex = 2;

    while (usedNames.has(candidate.toLowerCase())) {
      suffix = ` ${duplicateIndex}`;
      candidate = base.slice(0, 31 - suffix.length).trimEnd() + suffix;
      duplicateIndex += 1;
    }

    usedNames.add(candidate.toLowerCase());
    return candidate;
  });
};

const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="2">
    <font><sz val="11"/><name val="Calibri"/></font>
    <font><b/><sz val="11"/><name val="Calibri"/></font>
  </fonts>
  <fills count="3">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFD9D9D9"/><bgColor indexed="64"/></patternFill></fill>
  </fills>
  <borders count="2">
    <border><left/><right/><top/><bottom/><diagonal/></border>
    <border>
      <left style="thin"><color rgb="FFD9D9D9"/></left>
      <right style="thin"><color rgb="FFD9D9D9"/></right>
      <top style="thin"><color rgb="FFD9D9D9"/></top>
      <bottom style="thin"><color rgb="FFD9D9D9"/></bottom>
      <diagonal/>
    </border>
  </borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="2">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1"/>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/>
  </cellXfs>
</styleSheet>`;

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

const buildWorksheetXml = ({ rows, columnCount }: WorksheetDefinition) => {
  const safeColumnCount = Math.max(columnCount, 1);
  const dimension = `A1:${toColumnName(safeColumnCount - 1)}${Math.max(rows.length, 1)}`;
  const columnsXml = Array.from({ length: safeColumnCount }, (_, index) =>
    `<col min="${index + 1}" max="${index + 1}" width="28" customWidth="1"/>`,
  ).join("");
  const xmlRows = rows
    .map((row, rowIndex) => {
      const xmlCells = row
        .map((cell, columnIndex) => {
          const ref = `${toColumnName(columnIndex)}${rowIndex + 1}`;
          if (cell.value === "") return `<c r="${ref}" s="${cell.styleId}"/>`;
          if (cell.type === "string") {
            return `<c r="${ref}" t="inlineStr" s="${cell.styleId}"><is><t xml:space="preserve">${escapeStockTakeXlsxXml(String(cell.value))}</t></is></c>`;
          }
          return `<c r="${ref}" s="${cell.styleId}"><v>${cell.value}</v></c>`;
        })
        .join("");
      return `<row r="${rowIndex + 1}">${xmlCells}</row>`;
    })
    .join("");

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <dimension ref="${dimension}"/>
  <sheetViews><sheetView workbookViewId="0"/></sheetViews>
  <sheetFormatPr defaultRowHeight="15"/>
  <cols>${columnsXml}</cols>
  <sheetData>${xmlRows}</sheetData>
</worksheet>`;
};

const crcTable = new Uint32Array(256).map((_, index) => {
  let c = index;
  for (let bit = 0; bit < 8; bit += 1) c = (c & 1) !== 0 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

const crc32 = (buffer: Buffer) => {
  let c = 0xffffffff;
  for (const byte of buffer) c = crcTable[(c ^ byte) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};

const createZip = (entries: ZipEntry[]) => {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBuffer = Buffer.from(entry.name, "utf8");
    const crc = crc32(entry.data);

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0, 6);
    localHeader.writeUInt16LE(0, 8);
    localHeader.writeUInt16LE(0, 10);
    localHeader.writeUInt16LE(0, 12);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(entry.data.length, 18);
    localHeader.writeUInt32LE(entry.data.length, 22);
    localHeader.writeUInt16LE(nameBuffer.length, 26);

    localParts.push(localHeader, nameBuffer, entry.data);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(entry.data.length, 20);
    centralHeader.writeUInt32LE(entry.data.length, 24);
    centralHeader.writeUInt16LE(nameBuffer.length, 28);
    centralHeader.writeUInt32LE(offset, 42);

    centralParts.push(centralHeader, nameBuffer);
    offset += localHeader.length + nameBuffer.length + entry.data.length;
  }

  const centralDirectory = Buffer.concat(centralParts);
  const endRecord = Buffer.alloc(22);
  endRecord.writeUInt32LE(0x06054b50, 0);
  endRecord.writeUInt16LE(entries.length, 8);
  endRecord.writeUInt16LE(entries.length, 10);
  endRecord.writeUInt32LE(centralDirectory.length, 12);
  endRecord.writeUInt32LE(offset, 16);

  return Buffer.concat([...localParts, centralDirectory, endRecord]);
};

const buildSummarySheet = (data: StockTakeExportData): WorksheetDefinition => ({
  name: SUMMARY_SHEET_NAME,
  columnCount: 2,
  rows: [
    [
      { value: "Timber", type: "string", styleId: 1 },
      { value: "Quantity", type: "string", styleId: 1 },
    ],
    ...data.summaryRows.map<Cell[]>((row) => [
      { value: row.timberName, type: "string", styleId: 0 },
      { value: row.quantity, type: "number", styleId: 0 },
    ]),
  ],
});

const formatBayLabel = (bay: string) => (bay ? `Bay ${bay}` : "Unassigned");
const formatAreaCell = (timberName: string, quantity: number) => `${timberName} (${quantity})`;

const buildAreaSheet = (area: StockTakeExportArea, sheetName: string): WorksheetDefinition => {
  if (area.bays.length === 0) {
    return {
      name: sheetName,
      columnCount: 1,
      rows: [[{ value: "No saved stock rows", type: "string", styleId: 0 }]],
    };
  }

  const maxRows = Math.max(...area.bays.map((bay) => bay.rows.length));
  const rows: Cell[][] = [area.bays.map<Cell>((bay) => ({ value: formatBayLabel(bay.bay), type: "string", styleId: 1 }))];
  for (let rowIndex = 0; rowIndex < maxRows; rowIndex += 1) {
    rows.push(
      area.bays.map<Cell>((bay) => {
        const row = bay.rows[rowIndex];
        return row
          ? { value: formatAreaCell(row.timberName, row.quantity), type: "string", styleId: 0 }
          : { value: "", type: "string", styleId: 0 };
      }),
    );
  }

  return { name: sheetName, columnCount: area.bays.length, rows };
};

export const buildStockTakeExportXlsx = (data: StockTakeExportData, exportDate = new Date()) => {
  const dateStamp = exportDate.toISOString().slice(0, 10);
  const areaSheetNames = sanitizeStockTakeWorksheetNames(data.areas.map((area) => area.name));
  const worksheets: WorksheetDefinition[] = [
    buildSummarySheet(data),
    ...data.areas.map((area, index) => buildAreaSheet(area, areaSheetNames[index] ?? `Area ${index + 1}`)),
  ];

  const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  ${worksheets.map((_, index) => `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("\n  ")}
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`;

  const rootRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;

  const workbookXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>${worksheets.map((sheet, index) => `<sheet name="${escapeStockTakeXlsxXml(sheet.name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`).join("")}</sheets>
</workbook>`;

  const workbookRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  ${worksheets.map((_, index) => `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`).join("\n  ")}
  <Relationship Id="rId${worksheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

  const content = createZip([
    { name: "[Content_Types].xml", data: Buffer.from(contentTypesXml, "utf8") },
    { name: "_rels/.rels", data: Buffer.from(rootRelsXml, "utf8") },
    { name: "xl/workbook.xml", data: Buffer.from(workbookXml, "utf8") },
    { name: "xl/_rels/workbook.xml.rels", data: Buffer.from(workbookRelsXml, "utf8") },
    { name: "xl/styles.xml", data: Buffer.from(stylesXml, "utf8") },
    ...worksheets.map((worksheet, index) => ({
      name: `xl/worksheets/sheet${index + 1}.xml`,
      data: Buffer.from(buildWorksheetXml(worksheet), "utf8"),
    })),
  ]);

  return { filename: `stock-take-all-areas-${dateStamp}.xlsx`, content };
};
