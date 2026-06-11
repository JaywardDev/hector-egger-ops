import assert from "node:assert/strict";
import Module from "node:module";
import test from "node:test";

const originalLoad = Module._load;
Module._load = function loadWithServerOnlyStub(request, parent, isMain) {
  if (request === "server-only") {
    return {};
  }
  return originalLoad.call(this, request, parent, isMain);
};

const readStoredZipEntry = (buffer: Buffer, entryName: string) => {
  let offset = 0;
  while (offset < buffer.length - 30) {
    const signature = buffer.readUInt32LE(offset);
    if (signature !== 0x04034b50) break;
    const compressedSize = buffer.readUInt32LE(offset + 18);
    const fileNameLength = buffer.readUInt16LE(offset + 26);
    const extraLength = buffer.readUInt16LE(offset + 28);
    const nameStart = offset + 30;
    const name = buffer.subarray(nameStart, nameStart + fileNameLength).toString("utf8");
    const dataStart = nameStart + fileNameLength + extraLength;
    const dataEnd = dataStart + compressedSize;
    if (name === entryName) {
      return buffer.subarray(dataStart, dataEnd).toString("utf8");
    }
    offset = dataEnd;
  }
  throw new Error(`Could not find ${entryName}`);
};

const workbookData = {
  summaryRows: [
    { timberName: "90x45 H1.2 SG8 6.0", quantity: 12 },
    { timberName: "A&B <special> 'timber'", quantity: 6 },
  ],
  areas: [
    {
      name: "Rack/A:One*LongNameThatNeedsTrimming",
      bays: [
        {
          bay: "1",
          rows: [
            { areaName: "Rack A", bay: "1", level: "1", timberName: "90x45 H1.2 SG8 6.0", quantity: 10 },
            { areaName: "Rack A", bay: "1", level: "2", timberName: "A&B <special> 'timber'", quantity: 6 },
          ],
        },
        { bay: "2", rows: [{ areaName: "Rack A", bay: "2", level: "1", timberName: "140x45 H3.2 SG8 4.8", quantity: 2 }] },
        { bay: "10", rows: [{ areaName: "Rack A", bay: "10", level: "1", timberName: "190x45 SG8", quantity: 1 }] },
      ],
    },
    { name: "All Stock", bays: [] },
    { name: "All Stock", bays: [] },
  ],
};

test("stock-take xlsx creates All Stock first and one sheet per area with unique sanitized names", async () => {
  const { buildStockTakeExportXlsx } = await import("@/src/lib/stock-take/export-xlsx");
  const workbook = buildStockTakeExportXlsx(workbookData, new Date("2026-06-11T12:00:00.000Z"));
  const workbookXml = readStoredZipEntry(workbook.content, "xl/workbook.xml");

  assert.equal(workbook.filename, "stock-take-all-areas-2026-06-11.xlsx");
  assert.match(workbookXml, /<sheet name="All Stock" sheetId="1" r:id="rId1"\/>/);
  assert.match(workbookXml, /<sheet name="Rack A One LongNameThatNeedsTri" sheetId="2" r:id="rId2"\/>/);
  assert.match(workbookXml, /<sheet name="All Stock 2" sheetId="3" r:id="rId3"\/>/);
  assert.match(workbookXml, /<sheet name="All Stock 3" sheetId="4" r:id="rId4"\/>/);
});

test("stock-take xlsx summary sheet has timber and numeric quantity columns", async () => {
  const { buildStockTakeExportXlsx } = await import("@/src/lib/stock-take/export-xlsx");
  const workbook = buildStockTakeExportXlsx(workbookData, new Date("2026-06-11T12:00:00.000Z"));
  const sheetXml = readStoredZipEntry(workbook.content, "xl/worksheets/sheet1.xml");

  assert.match(sheetXml, /<c r="A1" t="inlineStr" s="1"><is><t xml:space="preserve">Timber<\/t><\/is><\/c>/);
  assert.match(sheetXml, /<c r="B1" t="inlineStr" s="1"><is><t xml:space="preserve">Quantity<\/t><\/is><\/c>/);
  assert.match(sheetXml, /<c r="A2" t="inlineStr" s="0"><is><t xml:space="preserve">90x45 H1\.2 SG8 6\.0<\/t><\/is><\/c>/);
  assert.match(sheetXml, /<c r="B2" s="0"><v>12<\/v><\/c>/);
  assert.match(sheetXml, /A&amp;B &lt;special&gt; &apos;timber&apos;/);
});

test("stock-take xlsx area sheets use bay columns in natural order and timber name quantity cells only", async () => {
  const { buildStockTakeExportXlsx } = await import("@/src/lib/stock-take/export-xlsx");
  const workbook = buildStockTakeExportXlsx(workbookData, new Date("2026-06-11T12:00:00.000Z"));
  const sheetXml = readStoredZipEntry(workbook.content, "xl/worksheets/sheet2.xml");

  assert.match(sheetXml, /<c r="A1" t="inlineStr" s="1"><is><t xml:space="preserve">Bay 1<\/t><\/is><\/c>/);
  assert.match(sheetXml, /<c r="B1" t="inlineStr" s="1"><is><t xml:space="preserve">Bay 2<\/t><\/is><\/c>/);
  assert.match(sheetXml, /<c r="C1" t="inlineStr" s="1"><is><t xml:space="preserve">Bay 10<\/t><\/is><\/c>/);
  assert.match(sheetXml, /90x45 H1\.2 SG8 6\.0 \(10\)/);
  assert.match(sheetXml, /140x45 H3\.2 SG8 4\.8 \(2\)/);
  assert.doesNotMatch(sheetXml, /area_id|updated_by_profile_id|created_at|updated_at|level/i);
});

test("stock-take xlsx handles empty stock areas with a simple note", async () => {
  const { buildStockTakeExportXlsx } = await import("@/src/lib/stock-take/export-xlsx");
  const workbook = buildStockTakeExportXlsx(workbookData, new Date("2026-06-11T12:00:00.000Z"));
  const sheetXml = readStoredZipEntry(workbook.content, "xl/worksheets/sheet3.xml");

  assert.match(sheetXml, /No saved stock rows/);
});
