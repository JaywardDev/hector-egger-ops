import { NextResponse } from "next/server";
import { requireProtectedAccess } from "@/src/lib/auth/guards";
import { buildStockTakeSessionExcelExport } from "@/src/lib/stock-take/session-excel-export";
import {
  getStockTakeSessionDetail,
  listStockTakeEntries,
} from "@/src/lib/stock-take/sessions";

export async function GET(
  _request: Request,
  context: { params: Promise<{ sessionId: string }> },
) {
  const { sessionId } = await context.params;
  const route = `/stock-take/${sessionId}/export`;
  const { session, roles } = await requireProtectedAccess(route);
  const accessContext = { accountStatus: "approved" as const, roles };

  const [stockTakeSession, stockTakeEntries] = await Promise.all([
    getStockTakeSessionDetail({
      session,
      accessContext,
      route,
      sessionId,
    }),
    listStockTakeEntries({
      session,
      accessContext,
      route,
      sessionId,
    }),
  ]);

  const workbook = buildStockTakeSessionExcelExport({
    session: stockTakeSession,
    entries: stockTakeEntries,
  });

  return new NextResponse(workbook.content, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${workbook.filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
