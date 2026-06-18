import Link from "next/link";
import { PageContainer } from "@/src/components/layout/page-container";
import { PageHeader } from "@/src/components/layout/page-header";
import { Card } from "@/src/components/ui/card";
import { requireProtectedAccess } from "@/src/lib/auth/guards";
import { listProductionEntries } from "@/src/lib/production/entries";
import { listProductionProjectSummaries } from "@/src/lib/production/dashboard";

const formatHours = (minutes: number) => `${(minutes / 60).toFixed(1)} h`;

export default async function DashboardPage() {
  const route = "/dashboard";
  const { session, roles } = await requireProtectedAccess(route);
  const [entries, projects] = await Promise.all([
    listProductionEntries({ session, accessContext: { accountStatus: "approved", roles }, route, limit: 200 }),
    listProductionProjectSummaries({ session, accessContext: { accountStatus: "approved", roles }, route }),
  ]);
  const totalOperationalMinutes = entries.reduce((sum, entry) => sum + entry.operational_minutes, 0);
  const totalVolumeCutM3 = entries.reduce((sum, entry) => sum + Number(entry.actual_volume_cut_m3), 0);
  const totalDowntimeMinutes = entries.reduce((sum, entry) => sum + entry.downtime_minutes, 0);
  const totalInterruptionMinutes = entries.reduce((sum, entry) => sum + entry.interruption_minutes, 0);
  return <PageContainer><PageHeader title="Dashboard" description="Manual production V1 overview with safe operational totals." />
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Card><p className="text-xs text-zinc-500">Total volume cut</p><p className="text-lg font-semibold text-zinc-900">{totalVolumeCutM3.toFixed(3)} m³</p></Card>
      <Card><p className="text-xs text-zinc-500">Total operational hours</p><p className="text-lg font-semibold text-zinc-900">{formatHours(totalOperationalMinutes)}</p></Card>
      <Card><p className="text-xs text-zinc-500">Total downtime minutes</p><p className="text-lg font-semibold text-zinc-900">{totalDowntimeMinutes} min</p></Card>
      <Card><p className="text-xs text-zinc-500">Total interruption minutes</p><p className="text-lg font-semibold text-zinc-900">{totalInterruptionMinutes} min</p></Card>
    </div>
    <Card><p className="font-medium text-zinc-900">Production workflow</p><div className="mt-2 flex flex-wrap gap-2"><Link className="rounded-md border border-zinc-200 px-3 py-1" href="/production/entries">Daily Entries</Link><Link className="rounded-md border border-zinc-200 px-3 py-1" href="/production/projects">Project Registry</Link><Link className="rounded-md border border-zinc-200 px-3 py-1" href="/production/reasons">Reason Management</Link></div></Card>
    <Card><p className="font-medium text-zinc-900">Project Registry</p><p className="mt-1 text-sm text-zinc-600">{projects.filter((project) => !project.is_archived).length} active projects, {projects.filter((project) => project.is_archived).length} archived projects.</p></Card>
  </PageContainer>;
}
