import Link from "next/link";
import { PageContainer } from "@/src/components/layout/page-container";
import { PageHeader } from "@/src/components/layout/page-header";
import { Button } from "@/src/components/ui/button";
import { Card } from "@/src/components/ui/card";
import { Input } from "@/src/components/ui/input";
import { Select } from "@/src/components/ui/select";
import { requireProtectedAccess } from "@/src/lib/auth/guards";
import {
  getProductionDashboardReport,
  listProductionOperatorSummaries,
  listProductionProjectSummaries,
  type ProductionDashboardFilters,
} from "@/src/lib/production/dashboard";

type DashboardPageProps = {
  searchParams: Promise<{
    dateFrom?: string;
    dateTo?: string;
    operator?: string;
    project?: string;
    projectStatus?: "active" | "completed" | "archived";
  }>;
};

const formatPct = (value: number | null) => (value === null ? "—" : `${(value * 100).toFixed(1)}%`);

const formatHours = (minutes: number) => `${(minutes / 60).toFixed(1)} h`;

const isIsoDate = (value: string | undefined) =>
  Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));

const normalizeFilters = (params: Awaited<DashboardPageProps["searchParams"]>): ProductionDashboardFilters => ({
  dateFrom: isIsoDate(params.dateFrom) ? params.dateFrom : undefined,
  dateTo: isIsoDate(params.dateTo) ? params.dateTo : undefined,
  operatorProfileId: params.operator?.trim() || undefined,
  projectId: params.project?.trim() || undefined,
  projectStatus: params.projectStatus || undefined,
});

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const route = "/dashboard";
  const { session, roles } = await requireProtectedAccess(route);
  const params = await searchParams;
  const filters = normalizeFilters(params);

  const [report, operatorSummaries, projectSummaries] = await Promise.all([
    getProductionDashboardReport({
      session,
      accessContext: { accountStatus: "approved", roles },
      route,
      filters,
    }),
    listProductionOperatorSummaries({ session, accessContext: { accountStatus: "approved", roles }, route }),
    listProductionProjectSummaries({ session, accessContext: { accountStatus: "approved", roles }, route })
  ]);

  return (
    <PageContainer>
      <PageHeader title="Dashboard" description="Operational production overview with live filters and summary reporting." />

      <Card>
        <form className="grid gap-2 md:grid-cols-6" method="get">
          <Input type="date" name="dateFrom" defaultValue={filters.dateFrom ?? ""} />
          <Input type="date" name="dateTo" defaultValue={filters.dateTo ?? ""} />
          <Select name="operator" defaultValue={filters.operatorProfileId ?? ""}>
            <option value="">All operators</option>
            {operatorSummaries.map((operator) => (
              <option key={operator.operator_profile_id} value={operator.operator_profile_id}>
                {operator.operator_name}
              </option>
            ))}
          </Select>
          <Select name="project" defaultValue={filters.projectId ?? ""}>
            <option value="">All projects</option>
            {projectSummaries.map((project) => (
              <option key={project.project_id} value={project.project_id}>
                {project.project_file} #{project.project_sequence}
              </option>
            ))}
          </Select>
          <Select name="projectStatus" defaultValue={filters.projectStatus ?? ""}>
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="completed">Completed</option>
            <option value="archived">Archived</option>
          </Select>
          <div className="flex gap-2">
            <Button className="w-full" type="submit">Apply</Button>
            <Link className="inline-flex w-full items-center justify-center rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-800 hover:bg-zinc-100" href="/dashboard">
              Reset
            </Link>
          </div>
        </form>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card><p className="text-xs text-zinc-500">Total volume cut</p><p className="text-lg font-semibold text-zinc-900">{report.kpis.totalVolumeCutM3.toFixed(3)} m³</p></Card>
        <Card><p className="text-xs text-zinc-500">Total operational hours</p><p className="text-lg font-semibold text-zinc-900">{formatHours(report.kpis.totalOperationalMinutes)}</p></Card>
        <Card><p className="text-xs text-zinc-500">Avg machine efficiency</p><p className="text-lg font-semibold text-zinc-900">{formatPct(report.kpis.averageMachineEfficiencyPct)}</p></Card>
        <Card><p className="text-xs text-zinc-500">Avg project efficiency</p><p className="text-lg font-semibold text-zinc-900">{formatPct(report.kpis.averageProjectEfficiencyPct)}</p></Card>
        <Card><p className="text-xs text-zinc-500">Total downtime minutes</p><p className="text-lg font-semibold text-zinc-900">{report.kpis.totalDowntimeMinutes} min</p></Card>
        <Card><p className="text-xs text-zinc-500">Total interruption minutes</p><p className="text-lg font-semibold text-zinc-900">{report.kpis.totalInterruptionMinutes} min</p></Card>
        <Card><p className="text-xs text-zinc-500">Active projects in scope</p><p className="text-lg font-semibold text-zinc-900">{report.kpis.activeProjectsCount}</p></Card>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Card className="overflow-x-auto">
          <p className="font-medium text-zinc-900">Daily trend</p>
          {report.dailyTrend.length === 0 ? (
            <p className="mt-2 text-sm">No daily data for current filters.</p>
          ) : (
            <table className="mt-2 min-w-full text-left text-xs">
              <thead>
                <tr className="border-b border-zinc-200 text-zinc-500">
                  <th className="px-2 py-1">Date</th>
                  <th className="px-2 py-1">Volume</th>
                  <th className="px-2 py-1">Op hours</th>
                  <th className="px-2 py-1">Machine eff.</th>
                  <th className="px-2 py-1">Project eff.</th>
                </tr>
              </thead>
              <tbody>
                {report.dailyTrend.map((row) => (
                  <tr key={row.workDate} className="border-b border-zinc-100">
                    <td className="px-2 py-1">{row.workDate}</td>
                    <td className="px-2 py-1">{row.totalVolumeCutM3.toFixed(3)} m³</td>
                    <td className="px-2 py-1">{formatHours(row.totalOperationalMinutes)}</td>
                    <td className="px-2 py-1">{formatPct(row.avgMachineEfficiencyPct)}</td>
                    <td className="px-2 py-1">{formatPct(row.avgProjectEfficiencyPct)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        <Card className="overflow-x-auto">
          <p className="font-medium text-zinc-900">Downtime breakdown</p>
          {report.downtimeBreakdown.length === 0 ? (
            <p className="mt-2 text-sm">No downtime minutes recorded for current filters.</p>
          ) : (
            <table className="mt-2 min-w-full text-left text-xs">
              <thead>
                <tr className="border-b border-zinc-200 text-zinc-500">
                  <th className="px-2 py-1">Reason</th>
                  <th className="px-2 py-1">Minutes</th>
                  <th className="px-2 py-1">Shifts impacted</th>
                </tr>
              </thead>
              <tbody>
                {report.downtimeBreakdown.map((row) => (
                  <tr key={row.reason} className="border-b border-zinc-100">
                    <td className="px-2 py-1">{row.reason}</td>
                    <td className="px-2 py-1">{row.minutes}</td>
                    <td className="px-2 py-1">{row.shiftCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Card className="overflow-x-auto">
          <p className="font-medium text-zinc-900">Project performance comparison</p>
          {report.projectComparisons.length === 0 ? (
            <p className="mt-2 text-sm">No project performance data for current filters.</p>
          ) : (
            <table className="mt-2 min-w-full text-left text-xs">
              <thead>
                <tr className="border-b border-zinc-200 text-zinc-500">
                  <th className="px-2 py-1">Project</th>
                  <th className="px-2 py-1">Status</th>
                  <th className="px-2 py-1">Shifts</th>
                  <th className="px-2 py-1">Volume</th>
                  <th className="px-2 py-1">Project eff.</th>
                </tr>
              </thead>
              <tbody>
                {report.projectComparisons.slice(0, 10).map((project) => (
                  <tr key={project.projectId} className="border-b border-zinc-100">
                    <td className="px-2 py-1">{project.projectLabel}</td>
                    <td className="px-2 py-1">{project.status}</td>
                    <td className="px-2 py-1">{project.shiftCount}</td>
                    <td className="px-2 py-1">{project.totalVolumeCutM3.toFixed(3)} m³</td>
                    <td className="px-2 py-1">{formatPct(project.avgProjectEfficiencyPct)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        <Card className="overflow-x-auto">
          <p className="font-medium text-zinc-900">Operator performance summary</p>
          {report.operatorComparisons.length === 0 ? (
            <p className="mt-2 text-sm">No operator performance data for current filters.</p>
          ) : (
            <table className="mt-2 min-w-full text-left text-xs">
              <thead>
                <tr className="border-b border-zinc-200 text-zinc-500">
                  <th className="px-2 py-1">Operator</th>
                  <th className="px-2 py-1">Shifts</th>
                  <th className="px-2 py-1">Volume</th>
                  <th className="px-2 py-1">Op hours</th>
                  <th className="px-2 py-1">Project eff.</th>
                </tr>
              </thead>
              <tbody>
                {report.operatorComparisons.slice(0, 10).map((operator) => (
                  <tr key={operator.operatorProfileId} className="border-b border-zinc-100">
                    <td className="px-2 py-1">{operator.operatorName}</td>
                    <td className="px-2 py-1">{operator.shiftCount}</td>
                    <td className="px-2 py-1">{operator.totalVolumeCutM3.toFixed(3)} m³</td>
                    <td className="px-2 py-1">{formatHours(operator.totalOperationalMinutes)}</td>
                    <td className="px-2 py-1">{formatPct(operator.avgProjectEfficiencyPct)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>

      {report.dailyTrend.length === 0 && report.projectComparisons.length === 0 ? (
        <Card>
          <p className="text-sm">No production data matches the selected filter set.</p>
        </Card>
      ) : null}
    </PageContainer>
  );
}
