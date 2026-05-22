import assert from "node:assert/strict";
import test from "node:test";

import { buildPayrollExportXlsx } from "@/src/lib/timesheets/payroll-export-xlsx";

const readStoredZipEntry = (buffer: Buffer, targetName: string) => {
  let offset = 0;
  while (offset + 30 <= buffer.length) {
    const signature = buffer.readUInt32LE(offset);
    if (signature !== 0x04034b50) break;

    const compressionMethod = buffer.readUInt16LE(offset + 8);
    const compressedSize = buffer.readUInt32LE(offset + 18);
    const fileNameLength = buffer.readUInt16LE(offset + 26);
    const extraFieldLength = buffer.readUInt16LE(offset + 28);
    const nameStart = offset + 30;
    const dataStart = nameStart + fileNameLength + extraFieldLength;
    const fileName = buffer.subarray(nameStart, nameStart + fileNameLength).toString("utf8");

    if (fileName === targetName) {
      assert.equal(compressionMethod, 0, "Expected uncompressed zip entry");
      return buffer.subarray(dataStart, dataStart + compressedSize).toString("utf8");
    }

    offset = dataStart + compressedSize;
  }

  throw new Error(`Zip entry not found: ${targetName}`);
};

const buildSheetXml = () => {
  const workbook = buildPayrollExportXlsx("2026-05-24", [
    {
      employeeName: "Ada Lovelace",
      totalHourWorked: 42.5,
      descriptionChargeup: "ORDINARY HOURS",
      leaveRows: [{ costCode: "SL", leaveHours: 2, leaveType: "sick", commentOther: "SICK" }],
    },
    {
      employeeName: "Bob",
      totalHourWorked: 40,
      descriptionChargeup: "ORDINARY HOURS",
      leaveRows: [],
    },
  ]);

  return readStoredZipEntry(workbook.content, "xl/worksheets/sheet1.xml");
};

test("xlsx layout uses dedicated week ending row and leaves employee name blank on leave rows", () => {
  const sheetXml = buildSheetXml();

  assert.match(sheetXml, /<c r="A1" t="inlineStr" s="1"><is><t xml:space="preserve">WEEK_ENDING<\/t><\/is><\/c>/);
  assert.match(sheetXml, /<c r="B1" t="inlineStr" s="1"><is><t xml:space="preserve">EMPLOYEE_NAME<\/t><\/is><\/c>/);

  assert.match(sheetXml, /<row r="2">\s*<c r="A2" s="2"><v>\d+<\/v><\/c>\s*<c r="B2" s="5"\/>\s*<c r="C2" s="3"\/>\s*<c r="D2" s="0"\/>\s*<c r="E2" s="3"\/>\s*<c r="F2" s="5"\/>\s*<c r="G2" s="5"\/>\s*<\/row>/);

  assert.match(sheetXml, /<row r="3">\s*<c r="A3" s="2"\/>\s*<c r="B3" t="inlineStr" s="5"><is><t xml:space="preserve">Ada Lovelace<\/t><\/is><\/c>/);
  assert.match(sheetXml, /<row r="4">\s*<c r="A4" s="2"\/>\s*<c r="B4" s="5"\/>/);

  assert.match(sheetXml, /<c r="C3" s="3"><v>42.5<\/v><\/c>/);
  assert.match(sheetXml, /<c r="C5" s="4"><v>40<\/v><\/c>/);
});

test("xlsx includes annual, bereavement, other, sick, and unpaid leave rows", () => {
  const workbook = buildPayrollExportXlsx("2026-05-24", [
    {
      employeeName: "Ada Lovelace",
      totalHourWorked: 42.5,
      descriptionChargeup: "ORDINARY HOURS",
      leaveRows: [
        { costCode: "LA - Leave Annual", leaveHours: 8, leaveType: "annual", commentOther: "Leave Annual" },
        { costCode: "LB - Leave Bereavement", leaveHours: 8, leaveType: "bereavement", commentOther: "Leave Bereavement" },
        { costCode: "TIL - Time In Lieu", leaveHours: 8, leaveType: "other", commentOther: "Time In Lieu" },
        { costCode: "LS - Leave Sick", leaveHours: 8, leaveType: "sick", commentOther: "Leave Sick" },
        { costCode: "LW - Leave Without Pay", leaveHours: 8, leaveType: "unpaid", commentOther: "Leave Without Pay" },
      ],
    },
  ]);

  const sheetXml = readStoredZipEntry(workbook.content, "xl/worksheets/sheet1.xml");
  assert.match(sheetXml, /LA - Leave Annual/);
  assert.match(sheetXml, /LB - Leave Bereavement/);
  assert.match(sheetXml, /TIL - Time In Lieu/);
  assert.match(sheetXml, /LS - Leave Sick/);
  assert.match(sheetXml, /LW - Leave Without Pay/);
  assert.match(sheetXml, /Leave Annual/);
  assert.match(sheetXml, /Leave Bereavement/);
  assert.match(sheetXml, /Time In Lieu/);
  assert.match(sheetXml, /Leave Sick/);
  assert.match(sheetXml, /Leave Without Pay/);
});
