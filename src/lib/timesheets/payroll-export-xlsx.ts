import "server-only";

import { formatWeekEndingForPayroll, PAYROLL_EXPORT_HEADERS, type PayrollExportEmployeeRow } from "@/src/lib/timesheets/payroll-export";

type CellType = "string" | "number" | "date";
type Cell = {
  value: string | number;
  type: CellType;
  styleId: number;
};

type ZipEntry = { name: string; data: Buffer };

const XML_ESCAPE_LOOKUP: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" };
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

const excelDateSerial = (isoDate: string) => {
  const [year, month, day] = isoDate.split("-").map(Number);
  const utcDate = Date.UTC(year, month - 1, day);
  return utcDate / 86400000 + 25569;
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

const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <numFmts count="2">
    <numFmt numFmtId="164" formatCode="dd/mm/yyyy"/>
    <numFmt numFmtId="165" formatCode="0.00"/>
  </numFmts>
  <fonts count="3">
    <font><sz val="11"/><name val="Calibri"/></font>
    <font><b/><sz val="11"/><name val="Calibri"/></font>
    <font><color rgb="FF9C0006"/><sz val="11"/><name val="Calibri"/></font>
  </fonts>
  <fills count="4">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFD9D9D9"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFFFC7CE"/><bgColor indexed="64"/></patternFill></fill>
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
  <cellXfs count="6">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1"/>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/>
    <xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"/>
    <xf numFmtId="165" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"/>
    <xf numFmtId="165" fontId="2" fillId="3" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1"/>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1"/>
  </cellXfs>
</styleSheet>`;

const buildPayrollRows = (weekEnding: string, rows: PayrollExportEmployeeRow[]) => {
  const sheetRows: Cell[][] = [
    PAYROLL_EXPORT_HEADERS.map((header) => ({ value: header, type: "string", styleId: 1 })),
  ];
  let hasWrittenWeekEnding = false;

  for (const employee of rows) {
    const totalHoursStyle = Math.abs(employee.totalHourWorked - 42.5) > 0.001 ? 4 : 3;
    const employeeWeekEndingValue = hasWrittenWeekEnding ? "" : excelDateSerial(weekEnding);
    const employeeWeekEndingType: CellType = hasWrittenWeekEnding ? "string" : "date";
    hasWrittenWeekEnding = true;
    sheetRows.push([
      { value: employeeWeekEndingValue, type: employeeWeekEndingType, styleId: 2 },
      { value: employee.employeeName, type: "string", styleId: 5 },
      { value: employee.totalHourWorked, type: "number", styleId: totalHoursStyle },
      { value: "", type: "string", styleId: 0 },
      { value: "", type: "string", styleId: 3 },
      { value: employee.descriptionChargeup, type: "string", styleId: 5 },
      { value: "", type: "string", styleId: 5 },
    ]);

    for (const leave of employee.leaveRows) {
      sheetRows.push([
        { value: "", type: "string", styleId: 2 },
        { value: employee.employeeName, type: "string", styleId: 5 },
        { value: "", type: "string", styleId: 3 },
        { value: leave.costCode, type: "string", styleId: 5 },
        { value: leave.leaveHours, type: "number", styleId: 3 },
        { value: "", type: "string", styleId: 5 },
        { value: leave.commentOther, type: "string", styleId: 5 },
      ]);
    }
  }

  return sheetRows;
};

const buildWorksheetXml = (rows: Cell[][]) => {
  const dimension = `A1:G${Math.max(rows.length, 1)}`;
  const xmlRows = rows
    .map((row, rowIndex) => {
      const xmlCells = row
        .map((cell, columnIndex) => {
          if (cell.value === "") return `<c r="${toColumnName(columnIndex)}${rowIndex + 1}" s="${cell.styleId}"/>`;
          const ref = `${toColumnName(columnIndex)}${rowIndex + 1}`;
          if (cell.type === "string") {
            return `<c r="${ref}" t="inlineStr" s="${cell.styleId}"><is><t xml:space="preserve">${escapeXml(String(cell.value))}</t></is></c>`;
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
  <cols>
    <col min="1" max="1" width="14" customWidth="1"/>
    <col min="2" max="2" width="28" customWidth="1"/>
    <col min="3" max="3" width="18" customWidth="1"/>
    <col min="4" max="4" width="24" customWidth="1"/>
    <col min="5" max="5" width="20" customWidth="1"/>
    <col min="6" max="6" width="26" customWidth="1"/>
    <col min="7" max="7" width="30" customWidth="1"/>
  </cols>
  <sheetData>${xmlRows}</sheetData>
</worksheet>`;
};

export const buildPayrollExportXlsx = (weekEnding: string, rows: PayrollExportEmployeeRow[]) => {
  const workbookRows = buildPayrollRows(weekEnding, rows);
  const worksheetXml = buildWorksheetXml(workbookRows);
  const workbookSheetName = `Payroll ${weekEnding.split("-").reverse().join("-")}`.slice(0, 31);

  const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`;

  const rootRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;

  const workbookXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets><sheet name="${escapeXml(workbookSheetName)}" sheetId="1" r:id="rId1"/></sheets>
</workbook>`;

  const workbookRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

  const content = createZip([
    { name: "[Content_Types].xml", data: Buffer.from(contentTypesXml, "utf8") },
    { name: "_rels/.rels", data: Buffer.from(rootRelsXml, "utf8") },
    { name: "xl/workbook.xml", data: Buffer.from(workbookXml, "utf8") },
    { name: "xl/_rels/workbook.xml.rels", data: Buffer.from(workbookRelsXml, "utf8") },
    { name: "xl/styles.xml", data: Buffer.from(stylesXml, "utf8") },
    { name: "xl/worksheets/sheet1.xml", data: Buffer.from(worksheetXml, "utf8") },
  ]);

  return { filename: `payroll-cutoff-${weekEnding}.xlsx`, content, displayWeekEnding: formatWeekEndingForPayroll(weekEnding) };
};
