import "server-only";

import { formatWeekEndingForPayroll, PAYROLL_EXPORT_HEADERS, type PayrollExportEmployeeRow } from "@/src/lib/timesheets/payroll-export";

type CellValue = string | number | null;
const XML_ESCAPE_LOOKUP: Record<string, string> = {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&apos;"};
const escapeXml = (v:string)=>v.replace(/[&<>"']/g,(t)=>XML_ESCAPE_LOOKUP[t]??t);
const toCol=(i:number)=>{let v=i+1,s="";while(v>0){const r=(v-1)%26;s=String.fromCharCode(65+r)+s;v=Math.floor((v-1)/26);}return s;};

export const buildPayrollExportXlsx = (weekEnding:string, rows: PayrollExportEmployeeRow[]) => {
  const sheetRows: CellValue[][] = [Array.from(PAYROLL_EXPORT_HEADERS)];
  const redCells = new Set<string>();
  for (const employee of rows) {
    const rowIndex = sheetRows.length + 1;
    sheetRows.push([formatWeekEndingForPayroll(weekEnding), employee.employeeName, employee.totalHourWorked, "", "", employee.descriptionChargeup, ""]);
    if (Math.abs(employee.totalHourWorked - 42.5) > 0.001) redCells.add(`C${rowIndex}`);
    for (const leave of employee.leaveRows) {
      sheetRows.push([formatWeekEndingForPayroll(weekEnding), `  ${employee.employeeName}`, "", leave.costCode, leave.leaveHours, "", leave.commentOther]);
    }
  }
  const content = Buffer.from(sheetRows.map((r)=>r.map((c)=>c??"").join(",")).join("\n"));
  return { filename: `payroll-cutoff-${weekEnding}.xlsx`, content };
};
