import { NextResponse } from "next/server";
import { requireAdminAccess } from "@/src/lib/auth/guards";
import { getPayrollExportData } from "@/src/lib/timesheets/payroll-export";
import { buildPayrollExportXlsx } from "@/src/lib/timesheets/payroll-export-xlsx";

export async function GET(request: Request) {
  const { session } = await requireAdminAccess();
  const { searchParams } = new URL(request.url);
  const weekEnding = searchParams.get("weekEnding") ?? "";
  const data = await getPayrollExportData(session, weekEnding);
  const workbook = buildPayrollExportXlsx(data.weekEnding, data.rows);
  return new NextResponse(new Uint8Array(workbook.content), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${workbook.filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
