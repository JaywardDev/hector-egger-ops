import assert from "node:assert/strict";
import test from "node:test";

import { parseSourceRows, parseWorksheet } from "@/src/lib/timesheets/c-base-import";

const buildStoredZip = (entries: Array<{ name: string; content: string }>) => {
  const chunks: Buffer[] = [];

  for (const entry of entries) {
    const name = Buffer.from(entry.name, "utf8");
    const content = Buffer.from(entry.content, "utf8");
    const header = Buffer.alloc(30);

    header.writeUInt32LE(0x04034b50, 0);
    header.writeUInt16LE(20, 4);
    header.writeUInt16LE(0, 6);
    header.writeUInt16LE(0, 8);
    header.writeUInt16LE(0, 10);
    header.writeUInt16LE(0, 12);
    header.writeUInt32LE(0, 14);
    header.writeUInt32LE(content.length, 18);
    header.writeUInt32LE(content.length, 22);
    header.writeUInt16LE(name.length, 26);
    header.writeUInt16LE(0, 28);

    chunks.push(header, name, content);
  }

  return Buffer.concat(chunks);
};

const buildStoredZipWithDataDescriptors = (entries: Array<{ name: string; content: string }>) => {
  const localChunks: Buffer[] = [];
  const centralChunks: Buffer[] = [];
  let localOffset = 0;

  for (const entry of entries) {
    const name = Buffer.from(entry.name, "utf8");
    const content = Buffer.from(entry.content, "utf8");
    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0x0008, 6);
    localHeader.writeUInt16LE(0, 8);
    localHeader.writeUInt32LE(0, 14);
    localHeader.writeUInt32LE(0, 18);
    localHeader.writeUInt32LE(0, 22);
    localHeader.writeUInt16LE(name.length, 26);
    localHeader.writeUInt16LE(0, 28);

    const descriptor = Buffer.alloc(16);
    descriptor.writeUInt32LE(0x08074b50, 0);
    descriptor.writeUInt32LE(0, 4);
    descriptor.writeUInt32LE(content.length, 8);
    descriptor.writeUInt32LE(content.length, 12);

    localChunks.push(localHeader, name, content, descriptor);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0x0008, 8);
    centralHeader.writeUInt16LE(0, 10);
    centralHeader.writeUInt32LE(0, 16);
    centralHeader.writeUInt32LE(content.length, 20);
    centralHeader.writeUInt32LE(content.length, 24);
    centralHeader.writeUInt16LE(name.length, 28);
    centralHeader.writeUInt32LE(localOffset, 42);
    centralChunks.push(centralHeader, name);

    localOffset += localHeader.length + name.length + content.length + descriptor.length;
  }

  const centralDirectory = Buffer.concat(centralChunks);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralDirectory.length, 12);
  eocd.writeUInt32LE(localOffset, 16);

  return Buffer.concat([...localChunks, centralDirectory, eocd]);
};

const buildBuildingsWorkbookBuffer = (siteCell: string, factoryCell: string, officeCell: string) =>
  buildStoredZip([
    {
      name: "xl/workbook.xml",
      content:
        '<?xml version="1.0" encoding="UTF-8"?><workbook xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="qry_TIMESHEET_BuildingsExport" sheetId="1" r:id="rId1"/></sheets></workbook>',
    },
    {
      name: "xl/_rels/workbook.xml.rels",
      content:
        '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>',
    },
    {
      name: "xl/worksheets/sheet1.xml",
      content: `<?xml version="1.0" encoding="UTF-8"?><worksheet><sheetData>
        <row r="1">
          <c r="A1" t="inlineStr"><is><t>PRODUCTION_SEQUENCE</t></is></c>
          <c r="B1" t="inlineStr"><is><t>TITLE</t></is></c>
          <c r="C1" t="inlineStr"><is><t>DISPLAYAS</t></is></c>
          <c r="D1" t="inlineStr"><is><t>STATUS</t></is></c>
          <c r="E1" t="inlineStr"><is><t>TIMESHEET_SITE</t></is></c>
          <c r="F1" t="inlineStr"><is><t>TIMESHEET_FACTORY</t></is></c>
          <c r="G1" t="inlineStr"><is><t>TIMESHEET_OFFICE</t></is></c>
        </row>
        <row r="2">
          <c r="A2" t="inlineStr"><is><t>P1</t></is></c>
          <c r="B2" t="inlineStr"><is><t>Proj 1</t></is></c>
          <c r="C2"><v>1</v></c>
          <c r="D2" t="inlineStr"><is><t>Active</t></is></c>
          <c r="E2" ${siteCell}</c>
          <c r="F2" ${factoryCell}</c>
          <c r="G2" ${officeCell}</c>
        </row>
      </sheetData></worksheet>`,
    },
  ]);

test("worksheet parser converts boolean t=b 1/0 to native booleans", () => {
  const workbook = buildBuildingsWorkbookBuffer('t="b"><v>1</v>', 't="b"><v>0</v>', 't="b"><v>1</v>');
  const result = parseWorksheet(workbook, "qry_TIMESHEET_BuildingsExport", "buildings");

  assert.deepEqual(result.errors, []);
  assert.equal(result.rows[0]?.values.TIMESHEET_SITE, true);
  assert.equal(result.rows[0]?.values.TIMESHEET_FACTORY, false);
  assert.equal(result.rows[0]?.values.TIMESHEET_OFFICE, true);
});

test("worksheet parser reads ZIPs that use data descriptors and central-directory sizes", () => {
  const workbook = buildStoredZipWithDataDescriptors([
    {
      name: "xl/workbook.xml",
      content:
        '<?xml version="1.0" encoding="UTF-8"?><workbook xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="qry_TIMESHEET_BuildingsExport" sheetId="1" r:id="rId1"/></sheets></workbook>',
    },
    {
      name: "xl/_rels/workbook.xml.rels",
      content:
        '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>',
    },
    {
      name: "xl/worksheets/sheet1.xml",
      content: `<?xml version="1.0" encoding="UTF-8"?><worksheet><sheetData>
        <row r="1">
          <c r="A1" t="inlineStr"><is><t>PRODUCTION_SEQUENCE</t></is></c>
          <c r="B1" t="inlineStr"><is><t>TITLE</t></is></c>
          <c r="C1" t="inlineStr"><is><t>DISPLAYAS</t></is></c>
          <c r="D1" t="inlineStr"><is><t>STATUS</t></is></c>
          <c r="E1" t="inlineStr"><is><t>TIMESHEET_SITE</t></is></c>
          <c r="F1" t="inlineStr"><is><t>TIMESHEET_FACTORY</t></is></c>
          <c r="G1" t="inlineStr"><is><t>TIMESHEET_OFFICE</t></is></c>
        </row>
        <row r="2">
          <c r="A2" t="inlineStr"><is><t>P1</t></is></c>
          <c r="B2" t="inlineStr"><is><t>Proj 1</t></is></c>
          <c r="C2"><v>1</v></c>
          <c r="D2" t="inlineStr"><is><t>Active</t></is></c>
          <c r="E2" t="b"><v>1</v></c>
          <c r="F2" t="b"><v>0</v></c>
          <c r="G2" t="b"><v>1</v></c>
        </row>
      </sheetData></worksheet>`,
    },
  ]);

  const result = parseWorksheet(workbook, "qry_TIMESHEET_BuildingsExport", "buildings");
  assert.deepEqual(result.errors, []);
  assert.equal(result.rows[0]?.values.TIMESHEET_SITE, true);
});

test("costcodes rejects invalid Department", () => {
  const result = parseSourceRows([{ rowNumber: 2, values: { COSTCODE_ID: "T1", Description: "Task 1", DisplayAs: "1", Department: "Invalid" } }], "costcodes");
  assert.equal(result.errors.some((error) => error.field === "Department"), true);
});

test("buildings rejects non-boolean TIMESHEET flags", () => {
  const result = parseSourceRows([{ rowNumber: 2, values: { PRODUCTION_SEQUENCE: "P1", TITLE: "Proj 1", DISPLAYAS: "1", TIMESHEET_SITE: "yes", TIMESHEET_FACTORY: "FALSE", TIMESHEET_OFFICE: "FALSE" } }], "buildings");
  assert.equal(result.errors.some((error) => error.field === "TIMESHEET_SITE"), true);
});

test("buildings accepts native boolean TIMESHEET flags", () => {
  const result = parseSourceRows(
    [{ rowNumber: 2, values: { PRODUCTION_SEQUENCE: "P1", TITLE: "Proj 1", DISPLAYAS: "1", TIMESHEET_SITE: true, TIMESHEET_FACTORY: false, TIMESHEET_OFFICE: true } }],
    "buildings",
  );
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.parsed[0]?.visibleToStaffGroups, ["site", "office"]);
});

test("buildings accepts lowercase and whitespace boolean strings", () => {
  const result = parseSourceRows(
    [{ rowNumber: 2, values: { PRODUCTION_SEQUENCE: "P1", TITLE: "Proj 1", DISPLAYAS: "1", TIMESHEET_SITE: " true ", TIMESHEET_FACTORY: " false ", TIMESHEET_OFFICE: "TRUE" } }],
    "buildings",
  );
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.parsed[0]?.visibleToStaffGroups, ["site", "office"]);
});

test("buildings accepts exact numeric string TIMESHEET flags", () => {
  const result = parseSourceRows(
    [{ rowNumber: 2, values: { PRODUCTION_SEQUENCE: "P1", TITLE: "Proj 1", DISPLAYAS: "1", TIMESHEET_SITE: "1", TIMESHEET_FACTORY: "0", TIMESHEET_OFFICE: "FALSE" } }],
    "buildings",
  );
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.parsed[0]?.visibleToStaffGroups, ["site"]);
});

test("department ALL maps all staff groups", () => {
  const result = parseSourceRows([{ rowNumber: 2, values: { COSTCODE_ID: "T2", Description: "Task 2", DisplayAs: "1", Department: "ALL" } }], "costcodes");
  assert.deepEqual(result.parsed[0]?.visibleToStaffGroups, ["factory", "site", "office"]);
});

test("buildings rejects boolean in code field", () => {
  const result = parseSourceRows(
    [{ rowNumber: 2, values: { PRODUCTION_SEQUENCE: true, TITLE: "Proj 1", DISPLAYAS: "1", TIMESHEET_SITE: "TRUE", TIMESHEET_FACTORY: "FALSE", TIMESHEET_OFFICE: "FALSE" } }],
    "buildings",
  );
  assert.equal(result.errors.some((error) => error.field === "code" && error.message === "Code is required."), true);
});

test("costcodes rejects boolean in label field", () => {
  const result = parseSourceRows([{ rowNumber: 2, values: { COSTCODE_ID: "T1", Description: false, DisplayAs: "1", Department: "ALL" } }], "costcodes");
  assert.equal(result.errors.some((error) => error.field === "label" && error.message === "Label is required."), true);
});

test("costcodes string code/label fields still pass", () => {
  const result = parseSourceRows([{ rowNumber: 2, values: { COSTCODE_ID: "T3", Description: "Task 3", DisplayAs: "1", Department: "Factory" } }], "costcodes");
  assert.deepEqual(result.errors, []);
  assert.equal(result.parsed[0]?.code, "T3");
  assert.equal(result.parsed[0]?.label, "Task 3");
});
