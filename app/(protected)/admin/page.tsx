import Link from "next/link";
import { PageContainer } from "@/src/components/layout/page-container";
import { PageHeader } from "@/src/components/layout/page-header";
import { Card } from "@/src/components/ui/card";
import { requireAdminAccess } from "@/src/lib/auth/guards";

export default async function AdminPage() {
  await requireAdminAccess();

  return (
    <PageContainer>
      <PageHeader
        title="Admin"
        description="Admin tools for user access management and C Base timesheet lookup imports."
      />

      <Card>
        <h2 className="text-lg font-semibold text-zinc-950">User management</h2>
        <p className="mt-1 text-sm text-zinc-600">Review pending access requests, assign roles and staff groups, and manage approved or disabled accounts.</p>
        <Link className="mt-3 inline-flex rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-900 shadow-sm hover:bg-zinc-50" href="/admin/users">
          Open user management
        </Link>
      </Card>


      <Card>
        <h2 className="text-lg font-semibold text-zinc-950">Timesheet lookups</h2>
        <p className="mt-1 text-sm text-zinc-600">Browse synced projects and tasks with read-only filters, sorting, and pagination.</p>
        <Link className="mt-3 inline-flex rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-900 shadow-sm hover:bg-zinc-50" href="/admin/timesheet-lookups">
          Open timesheet lookups
        </Link>
      </Card>

      <Card>
        <h2 className="text-lg font-semibold text-zinc-950">Timesheet lookup imports</h2>
        <p className="mt-1 text-sm text-zinc-600">Validate and sync C Base BuildingsExport and CostcodesExport snapshots for timesheet projects and tasks.</p>
        <Link className="mt-3 inline-flex rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-900 shadow-sm hover:bg-zinc-50" href="/admin/timesheet-lookups/import">
          Open C Base import
        </Link>
      </Card>
    
      <Card>
        <h2 className="text-lg font-semibold text-zinc-950">Payroll cutoff export</h2>
        <p className="mt-1 text-sm text-zinc-600">Generate weekly payroll cutoff XLSX exports for approved staff and approved timesheet statuses.</p>
        <Link className="mt-3 inline-flex rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-900 shadow-sm hover:bg-zinc-50" href="/admin/payroll-export">
          Open payroll export
        </Link>
      </Card>
</PageContainer>
  );
}
