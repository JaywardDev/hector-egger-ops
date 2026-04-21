import Link from "next/link";
import { PageContainer } from "@/src/components/layout/page-container";
import { PageHeader } from "@/src/components/layout/page-header";
import { Card } from "@/src/components/ui/card";
import { requireProtectedAccess } from "@/src/lib/auth/guards";
import { listProductionOperatorSummaries, listProductionProjectSummaries } from "@/src/lib/production/dashboard";

const formatPct = (value: number | null) => (value === null ? "—" : `${(value * 100).toFixed(1)}%`);

export default async function DashboardPage() {
  const route = "/dashboard";
  const { session, roles } = await requireProtectedAccess(route);

  const [projectSummaries, operatorSummaries] = await Promise.all([
    listProductionProjectSummaries({ session, accessContext: { accountStatus: "approved", roles }, route }),
    listProductionOperatorSummaries({ session, accessContext: { accountStatus: "approved", roles }, route }),
  ]);

  const totals = projectSummaries.reduce(
    (acc, project) => {
      acc.totalVolume += Number(project.total_volume_cut_m3 ?? 0);
      acc.totalOperationalMinutes += project.total_logged_operational_minutes;
      acc.totalDowntime += project.total_downtime_minutes;
      if (project.avg_machine_efficiency_pct !== null) {
        acc.machine.push(project.avg_machine_efficiency_pct);
      }
      if (project.avg_project_efficiency_pct !== null) {
        acc.project.push(project.avg_project_efficiency_pct);
      }
      return acc;
    },
    {
      totalVolume: 0,
      totalOperationalMinutes: 0,
      totalDowntime: 0,
      machine: [] as number[],
      project: [] as number[],
    },
  );

  const avgMachine =
    totals.machine.length > 0
      ? totals.machine.reduce((sum, value) => sum + value, 0) / totals.machine.length
      : null;
  const avgProject =
    totals.project.length > 0
      ? totals.project.reduce((sum, value) => sum + value, 0) / totals.project.length
      : null;

  return (
    <PageContainer>
      <PageHeader title="Dashboard" description="Minimal KPI scaffold using production read models." />

      <Card>
        <form className="grid gap-2 sm:grid-cols-3">
          <input className="rounded-md border border-zinc-200 px-2 py-1" type="date" name="from" />
          <input className="rounded-md border border-zinc-200 px-2 py-1" type="date" name="to" />
          <button className="rounded-md border border-zinc-200 px-3 py-1" type="submit">Apply filters</button>
        </form>
      </Card>

      <div className="grid gap-3 sm:grid-cols-5">
        <Card><p className="text-xs text-zinc-500">Total volume</p><p className="text-lg font-semibold text-zinc-900">{totals.totalVolume.toFixed(3)} m³</p></Card>
        <Card><p className="text-xs text-zinc-500">Operational hours</p><p className="text-lg font-semibold text-zinc-900">{(totals.totalOperationalMinutes / 60).toFixed(1)} h</p></Card>
        <Card><p className="text-xs text-zinc-500">Avg machine efficiency</p><p className="text-lg font-semibold text-zinc-900">{formatPct(avgMachine)}</p></Card>
        <Card><p className="text-xs text-zinc-500">Avg project efficiency</p><p className="text-lg font-semibold text-zinc-900">{formatPct(avgProject)}</p></Card>
        <Card><p className="text-xs text-zinc-500">Total downtime</p><p className="text-lg font-semibold text-zinc-900">{totals.totalDowntime} min</p></Card>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Card>
          <p className="font-medium text-zinc-900">Project summary snippet</p>
          <ul className="mt-2 space-y-1">
            {projectSummaries.slice(0, 5).map((project) => (
              <li key={project.project_id}>
                <Link className="underline" href={`/production/projects/${project.project_id}`}>
                  {project.project_file} #{project.project_sequence} · {formatPct(project.progress_pct)}
                </Link>
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <p className="font-medium text-zinc-900">Operator summary snippet</p>
          <ul className="mt-2 space-y-1">
            {operatorSummaries.slice(0, 5).map((operator) => (
              <li key={operator.operator_profile_id}>
                {operator.operator_name} · {operator.total_operational_minutes} min · {formatPct(operator.avg_project_efficiency_pct)}
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </PageContainer>
  );
}
