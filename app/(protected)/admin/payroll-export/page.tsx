import Link from "next/link";
import { PageContainer } from "@/src/components/layout/page-container";
import { PageHeader } from "@/src/components/layout/page-header";
import { Card } from "@/src/components/ui/card";
import { getNzWeekEnd, getTodayNzDate } from "@/src/lib/dateTime";
import { requireAdminAccess } from "@/src/lib/auth/guards";

export default async function PayrollExportPage() {
  await requireAdminAccess();
  const defaultWeekEnding = getNzWeekEnd(getTodayNzDate());

  return (
    <PageContainer>
      <PageHeader title="Payroll cutoff export" description="Export final-approved timesheets only as payroll cutoff summaries and leave detail rows in XLSX format." />
      <Card>
        <form className="flex flex-wrap items-end gap-3" action="/admin/payroll-export/export" method="get">
          <label className="text-sm font-medium text-zinc-800" htmlFor="weekEnding">Payroll week ending</label>
          <input className="rounded-md border border-zinc-300 px-2 py-1 text-sm" id="weekEnding" name="weekEnding" type="date" defaultValue={defaultWeekEnding} />
          <button className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium" type="submit">Download XLSX</button>
        </form>
        <p className="mt-3 text-sm text-zinc-600">Only final-approved timesheets are payroll-ready and included in exports. Supervisor-reviewed entries are excluded until final approval. Back to <Link className="underline" href="/admin">admin tools</Link>.</p>
      </Card>
    </PageContainer>
  );
}
