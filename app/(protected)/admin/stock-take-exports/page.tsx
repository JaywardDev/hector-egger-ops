import { PageContainer } from "@/src/components/layout/page-container";
import { PageHeader } from "@/src/components/layout/page-header";
import { Alert } from "@/src/components/ui/alert";
import { Card } from "@/src/components/ui/card";
import { requireAdminAccess } from "@/src/lib/auth/guards";
import { createServiceRoleSupabaseClient } from "@/src/lib/supabase/service-role";
import { formatNzDateTime } from "@/src/lib/dateTime";

type SnapshotRow = {
  id: string;
  exported_at: string;
  filename: string;
  row_count: number | null;
  exported_by: { full_name: string | null; email: string } | null;
};

export default async function StockTakeExportsPage() {
  await requireAdminAccess();

  const supabase = createServiceRoleSupabaseClient();
  const response = await supabase.request(
    "/rest/v1/stock_take_export_snapshots?select=id,exported_at,filename,row_count,exported_by:exported_by_profile_id(full_name,email)&order=exported_at.desc&limit=200",
    { cache: "no-store" },
  );

  const snapshots = response.ok ? ((await response.json()) as SnapshotRow[]) : [];

  return (
    <PageContainer>
      <PageHeader
        title="Stock take export history"
        description="A record is written every time a stock take export is generated. Showing the 200 most recent exports."
      />

      {!response.ok ? (
        <Alert variant="error">Could not load export history.</Alert>
      ) : snapshots.length === 0 ? (
        <Card>
          <p className="text-sm text-zinc-600">No stock take exports have been generated yet.</p>
        </Card>
      ) : (
        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-zinc-200 bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Exported</th>
                  <th className="px-4 py-3 font-medium">By</th>
                  <th className="px-4 py-3 font-medium">File</th>
                  <th className="px-4 py-3 text-right font-medium">Rows</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {snapshots.map((snapshot) => (
                  <tr key={snapshot.id} className="text-zinc-700">
                    <td className="whitespace-nowrap px-4 py-3 text-zinc-950">{formatNzDateTime(snapshot.exported_at)}</td>
                    <td className="px-4 py-3">
                      {snapshot.exported_by?.full_name ?? snapshot.exported_by?.email ?? "—"}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-zinc-600">{snapshot.filename}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{snapshot.row_count ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </PageContainer>
  );
}
