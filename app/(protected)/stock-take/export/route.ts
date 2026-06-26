import { NextResponse } from "next/server";
import { requireProtectedAccess } from "@/src/lib/auth/guards";
import { createServiceRoleSupabaseClient } from "@/src/lib/supabase/service-role";
import { getStockTakeExportData } from "@/src/lib/stock-take/export-data";
import { buildStockTakeExportXlsx } from "@/src/lib/stock-take/export-xlsx";

export async function GET() {
  const route = "/stock-take/export";
  const { session, profile, roles } = await requireProtectedAccess(route);
  const data = await getStockTakeExportData({
    session,
    accessContext: { accountStatus: "approved", roles },
    route: "/stock-take",
  });
  const workbook = buildStockTakeExportXlsx(data);

  const rowCount = data.areas.reduce((total, area) => total + area.bays.reduce((n, bay) => n + bay.rows.length, 0), 0);
  try {
    const supabase = createServiceRoleSupabaseClient();
    await supabase.request("/rest/v1/stock_take_export_snapshots", {
      method: "POST",
      headers: { "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({
        exported_by_profile_id: profile?.id ?? null,
        filename: workbook.filename,
        row_count: rowCount,
      }),
    });
  } catch {
    // snapshot write is non-critical — export still succeeds
  }

  return new NextResponse(new Uint8Array(workbook.content), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${workbook.filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
