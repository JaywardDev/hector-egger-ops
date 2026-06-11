import { NextResponse } from "next/server";
import { requireProtectedAccess } from "@/src/lib/auth/guards";
import { getStockTakeExportData } from "@/src/lib/stock-take/export-data";
import { buildStockTakeExportXlsx } from "@/src/lib/stock-take/export-xlsx";

export async function GET() {
  const route = "/stock-take/export";
  const { session, roles } = await requireProtectedAccess(route);
  const data = await getStockTakeExportData({
    session,
    accessContext: { accountStatus: "approved", roles },
    route: "/stock-take",
  });
  const workbook = buildStockTakeExportXlsx(data);

  return new NextResponse(new Uint8Array(workbook.content), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${workbook.filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
