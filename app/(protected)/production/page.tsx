import Link from "next/link";
import { PageContainer } from "@/src/components/layout/page-container";
import { PageHeader } from "@/src/components/layout/page-header";
import { Badge } from "@/src/components/ui/badge";
import { Button } from "@/src/components/ui/button";
import { Card } from "@/src/components/ui/card";
import { FormField } from "@/src/components/ui/form-field";
import { Input } from "@/src/components/ui/input";
import { OperationalListRow } from "@/src/components/ui/operational-list-row";
import { Select } from "@/src/components/ui/select";
import { requireProtectedAccess } from "@/src/lib/auth/guards";
import { hasProductionReasonAdminRole } from "@/src/lib/production/access";
import { isAdmin } from "@/src/lib/permissions/roles";
import { listProductionEntries } from "@/src/lib/production/entries";
import { formatMinutesAsDuration } from "@/src/lib/production/format";
import {
  listProductionOperatorSummaries,
  listProductionProjectFileSummaries,
  listProductionProjectSummaries,
} from "@/src/lib/production/dashboard";
import {
  buildProductionDashboard,
  formatPercent,
  formatRate,
  formatVolume,
} from "@/src/lib/production/performance-dashboard";
import {
  ActionLink,
  DataTableCard,
  StatCard,
  Td,
  Th,
  dataTableClassName,
  dataTableRowClassName,
} from "./components/production-ui";

type ProductionPageProps = {
  searchParams: Promise<{
    dateFrom?: string;
    dateTo?: string;
    project?: string;
    projectFile?: string;
    operator?: string;
  }>;
};

const barHeight = (value: number | null, max = 100) =>
  `${Math.max(2, Math.min(100, ((value ?? 0) / max) * 100))}%`;
const segmentWidth = (value: number, total: number) => (total > 0 ? `${(value / total) * 100}%` : "0%");

export default async function ProductionPage({ searchParams }: ProductionPageProps) {
  const route = "/production";
  const { session, roles } = await requireProtectedAccess(route);
  const params = await searchParams;
  const canManageReasons = hasProductionReasonAdminRole(roles);
  const canWrite = isAdmin({ roles });
  const currentMonth = new Date().toISOString().slice(0, 7);
  // "Monthly Volume" tracks a single calendar month; derive it from the selected
  // range (latest end, else start) so it stays consistent with the other filters
  // instead of being driven by a separate, easily-conflicting month control.
  const month = (params.dateTo || params.dateFrom || currentMonth).slice(0, 7);
  const hasActiveFilters = Boolean(
    params.dateFrom || params.dateTo || params.project || params.projectFile || params.operator,
  );

  const [projectSummaries, projectFiles, operators, allEntries] = await Promise.all([
    listProductionProjectSummaries({ session, accessContext: { accountStatus: "approved", roles }, route }),
    listProductionProjectFileSummaries({ session, accessContext: { accountStatus: "approved", roles }, route }),
    listProductionOperatorSummaries({ session, accessContext: { accountStatus: "approved", roles }, route }),
    listProductionEntries({ session, accessContext: { accountStatus: "approved", roles }, route, limit: 1000 }),
  ]);
  const dashboard = buildProductionDashboard(allEntries, projectFiles, { ...params, month });
  const maxDailyVolume = Math.max(1, ...dashboard.dailyVolume.map((day) => day.volume));
  const maxMonthlyVolume = Math.max(1, ...dashboard.monthlyVolume.map((row) => row.volume));

  const kpis: Array<{ label: string; value: string; hint?: string }> = [
    { label: "Total Volume Cut", value: formatVolume(dashboard.kpis.totalVolume) },
    { label: "Monthly Volume", value: formatVolume(dashboard.kpis.monthlyVolume), hint: `Month ${month}` },
    { label: "Daily Output", value: formatVolume(dashboard.kpis.dailyOutput) },
    { label: "Projects with entries", value: String(dashboard.kpis.projectCount) },
    { label: "Cutting Rate", value: formatRate(dashboard.kpis.cuttingRate) },
    { label: "Total Operational Duration", value: formatMinutesAsDuration(dashboard.kpis.totalOperationalMinutes) },
    { label: "Total Downtime", value: formatMinutesAsDuration(dashboard.kpis.totalDowntimeMinutes) },
    { label: "Machine Utilization", value: formatPercent(dashboard.kpis.machineUtilization) },
  ];

  return (
    <PageContainer>
      <PageHeader
        accent
        eyebrow="Production"
        title="Performance Dashboard"
        description="App-native production performance, volume, utilization, downtime, and operator summaries."
        actions={
          <>
            <ActionLink href="/production/entries">Production entries</ActionLink>
            {canWrite ? <ActionLink href="/production/projects">Projects</ActionLink> : null}
            {canManageReasons ? <ActionLink href="/production/reasons">Manage reasons</ActionLink> : null}
            {canWrite ? (
              <ActionLink href="/production/entries/new" variant="primary">
                New entry
              </ActionLink>
            ) : null}
          </>
        }
      />

      <Card>
        <form className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <FormField label="From" htmlFor="dateFrom">
            <Input id="dateFrom" type="date" name="dateFrom" defaultValue={params.dateFrom ?? ""} />
          </FormField>
          <FormField label="To" htmlFor="dateTo">
            <Input id="dateTo" type="date" name="dateTo" defaultValue={params.dateTo ?? ""} />
          </FormField>
          <FormField label="Project" htmlFor="project">
            <Select id="project" name="project" defaultValue={params.project ?? ""}>
              <option value="">All projects</option>
              {projectSummaries.map((project) => (
                <option key={project.project_id} value={project.project_id}>
                  {project.project_name}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Project file" htmlFor="projectFile">
            <Select id="projectFile" name="projectFile" defaultValue={params.projectFile ?? ""}>
              <option value="">All project files</option>
              {projectFiles.map((file) => (
                <option key={file.project_file_id} value={file.project_file_id}>
                  {file.project_name} — {file.project_file}
                  {file.project_sequence === null ? "" : ` / PS ${file.project_sequence}`}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Operator" htmlFor="operator">
            <Select id="operator" name="operator" defaultValue={params.operator ?? ""}>
              <option value="">All operators</option>
              {operators.map((operator) => (
                <option key={operator.operator_profile_id} value={operator.operator_profile_id}>
                  {operator.operator_name}
                </option>
              ))}
            </Select>
          </FormField>
          <div className="flex items-center gap-2">
            <Button type="submit">Apply filters</Button>
            {hasActiveFilters ? <ActionLink href="/production">Reset</ActionLink> : null}
          </div>
        </form>
      </Card>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <StatCard key={kpi.label} label={kpi.label} value={kpi.value} hint={kpi.hint} />
        ))}
      </section>

      <Card className="space-y-3">
        <div className="space-y-0.5">
          <h3 className="font-medium text-zinc-900">Project Performance vs Machine Utilization</h3>
          <p className="text-xs text-zinc-500">
            Project Performance = planned time ÷ logged operational time. Machine Utilization = operational ÷ (operational
            + downtime + interruption).
          </p>
        </div>
        {dashboard.projectRows.length ? (
          <div className="flex h-56 items-end gap-2 overflow-x-auto border-b border-zinc-200 pb-2">
            {dashboard.projectRows.slice(0, 24).map((row) => (
              <div key={row.project_file_id} className="flex min-w-14 flex-col items-center gap-1 text-[10px]">
                <div className="flex h-40 w-8 items-end gap-1">
                  <div
                    title={formatPercent(row.performance)}
                    className="w-3 rounded-t bg-zinc-700"
                    style={{ height: barHeight(row.performance) }}
                  />
                  <div
                    title={formatPercent(row.utilization)}
                    className="w-3 rounded-t bg-red-500"
                    style={{ height: barHeight(row.utilization) }}
                  />
                </div>
                <span className="truncate">{row.project_sequence ?? row.project_file}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-zinc-500">No project-file summaries found.</p>
        )}
        <p className="text-xs">
          <span className="text-zinc-700">■</span> Project Performance
          <span className="ml-3 text-red-500">■</span> Machine Utilization
        </p>
      </Card>

      <div className="grid gap-3 lg:grid-cols-2">
        <Card className="space-y-3">
          <div className="space-y-0.5">
            <h3 className="font-medium text-zinc-900">Daily Performance</h3>
            <p className="text-xs text-zinc-500">
              Daily utilization with mean line: {formatPercent(dashboard.meanDailyUtilization)}
            </p>
          </div>
          {dashboard.dailyPerformance.length === 0 ? (
            <p className="text-sm text-zinc-500">No entries in selected period.</p>
          ) : (
            <div className="flex h-44 items-end gap-1 overflow-x-auto">
              {dashboard.dailyPerformance.map((day) => (
                <div
                  key={day.date}
                  title={`${day.date}: ${formatPercent(day.utilization)}`}
                  className="min-w-3 rounded-t bg-blue-500"
                  style={{ height: barHeight(day.utilization) }}
                />
              ))}
            </div>
          )}
        </Card>
        <Card className="space-y-3">
          <h3 className="font-medium text-zinc-900">Daily Volume</h3>
          {dashboard.dailyVolume.length === 0 ? (
            <p className="text-sm text-zinc-500">No daily volume yet.</p>
          ) : (
            <div className="flex h-44 items-end gap-1 overflow-x-auto">
              {dashboard.dailyVolume.map((day) => (
                <div
                  key={day.date}
                  title={`${day.date}: ${formatVolume(day.volume)}`}
                  className="min-w-3 rounded-t bg-emerald-500"
                  style={{ height: barHeight(day.volume, maxDailyVolume) }}
                />
              ))}
            </div>
          )}
        </Card>
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <Card className="space-y-3 lg:col-span-2">
          <h3 className="font-medium text-zinc-900">Monthly Volume Produced</h3>
          {dashboard.monthlyVolume.length === 0 ? (
            <p className="text-sm text-zinc-500">No monthly volume yet.</p>
          ) : (
            <div className="flex h-44 items-end gap-3 overflow-x-auto">
              {dashboard.monthlyVolume.map((row) => (
                <div key={row.month} className="flex min-w-12 flex-col items-center text-[10px]">
                  <div
                    title={`${row.month}: ${formatVolume(row.volume)}`}
                    className="w-8 rounded-t bg-yellow-400"
                    style={{ height: barHeight(row.volume, maxMonthlyVolume) }}
                  />
                  <span>{row.month}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
        <Card className="space-y-3">
          <h3 className="font-medium text-zinc-900">Operational Duration vs Downtime</h3>
          <div className="space-y-2 text-sm">
            <p>Operational: {formatMinutesAsDuration(dashboard.kpis.totalOperationalMinutes)}</p>
            <p>Downtime: {formatMinutesAsDuration(dashboard.kpis.totalDowntimeMinutes)}</p>
            <p>Interruption: {formatMinutesAsDuration(dashboard.kpis.totalInterruptionMinutes)}</p>
            <div className="flex h-5 overflow-hidden rounded-full bg-zinc-100">
              <div
                className="bg-emerald-600"
                style={{
                  width: segmentWidth(
                    dashboard.kpis.totalOperationalMinutes,
                    dashboard.kpis.totalOperationalMinutes +
                      dashboard.kpis.totalDowntimeMinutes +
                      dashboard.kpis.totalInterruptionMinutes,
                  ),
                }}
              />
              <div
                className="bg-red-500"
                style={{
                  width: segmentWidth(
                    dashboard.kpis.totalDowntimeMinutes,
                    dashboard.kpis.totalOperationalMinutes +
                      dashboard.kpis.totalDowntimeMinutes +
                      dashboard.kpis.totalInterruptionMinutes,
                  ),
                }}
              />
              <div
                className="bg-amber-400"
                style={{
                  width: segmentWidth(
                    dashboard.kpis.totalInterruptionMinutes,
                    dashboard.kpis.totalOperationalMinutes +
                      dashboard.kpis.totalDowntimeMinutes +
                      dashboard.kpis.totalInterruptionMinutes,
                  ),
                }}
              />
            </div>
          </div>
        </Card>
      </div>

      <DataTableCard
        title="Project Summary"
        emptyMessage="No project-file summaries match the current filters."
        isEmpty={dashboard.projectRows.length === 0}
        mobile={
          <ul className="divide-y divide-zinc-100">
            {dashboard.projectRows.map((row) => (
              <li key={row.project_file_id}>
                <Link href={`/production/projects/${row.project_id}`} className="block rounded-md">
                  <OperationalListRow
                    density="dense"
                    className="rounded-md hover:bg-zinc-50"
                    title={`${row.project_name} / ${row.project_file}`}
                    subtitle={`PS ${row.project_sequence ?? "—"} · ${row.is_archived ? "Archived" : "Active"}`}
                    metadata={
                      <>
                        <Badge variant="muted">Perf {formatPercent(row.performance)}</Badge>
                        <Badge variant="muted">Util {formatPercent(row.utilization)}</Badge>
                        <Badge variant="muted">{formatVolume(row.total_volume_cut_m3)}</Badge>
                      </>
                    }
                  />
                </Link>
              </li>
            ))}
          </ul>
        }
      >
        <table className={`${dataTableClassName} min-w-[1000px]`}>
          <thead>
            <tr>
              <Th>Project / Project File</Th>
              <Th align="right">PS</Th>
              <Th align="right">Performance</Th>
              <Th align="right">Utilization</Th>
              <Th align="right">Planned Time</Th>
              <Th align="right">Logged Operational</Th>
              <Th align="right">Actual Volume Cut</Th>
              <Th align="right">Downtime</Th>
              <Th align="right">Interruption</Th>
              <Th>Status</Th>
            </tr>
          </thead>
          <tbody>
            {dashboard.projectRows.map((row) => (
              <tr key={row.project_file_id} className={dataTableRowClassName}>
                <Td>
                  <Link className="text-zinc-900 underline" href={`/production/projects/${row.project_id}`}>
                    {row.project_name} / {row.project_file}
                  </Link>
                </Td>
                <Td align="right">{row.project_sequence ?? "—"}</Td>
                <Td align="right">{formatPercent(row.performance)}</Td>
                <Td align="right">{formatPercent(row.utilization)}</Td>
                <Td align="right">{formatMinutesAsDuration(row.total_time_minutes)}</Td>
                <Td align="right">{formatMinutesAsDuration(row.total_logged_operational_minutes)}</Td>
                <Td align="right">{formatVolume(row.total_volume_cut_m3)}</Td>
                <Td align="right">{formatMinutesAsDuration(row.total_downtime_minutes)}</Td>
                <Td align="right">{formatMinutesAsDuration(row.total_interruption_minutes)}</Td>
                <Td>{row.is_archived ? "Archived" : "Active"}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </DataTableCard>

      <DataTableCard
        title="Operators Summary"
        emptyMessage="No operator data for the current filters."
        isEmpty={dashboard.operators.length === 0}
        mobile={
          <ul className="divide-y divide-zinc-100">
            {dashboard.operators.map((operator) => (
              <li key={operator.operatorId}>
                <Link href={`/production/entries?operator=${operator.operatorId}`} className="block rounded-md">
                  <OperationalListRow
                    density="dense"
                    className="rounded-md hover:bg-zinc-50"
                    title={operator.operator}
                    subtitle={`${operator.shiftCount} shift${operator.shiftCount === 1 ? "" : "s"} · Util ${formatPercent(operator.utilization)}`}
                    metadata={
                      <>
                        <Badge variant="muted">{formatVolume(operator.volume)}</Badge>
                        <Badge variant="muted">{formatRate(operator.cuttingRate)}</Badge>
                      </>
                    }
                  />
                </Link>
              </li>
            ))}
          </ul>
        }
      >
        <table className={`${dataTableClassName} min-w-[760px]`}>
          <thead>
            <tr>
              <Th>Operator</Th>
              <Th align="right">Utilization</Th>
              <Th align="right"># of shifts</Th>
              <Th align="right">Operational Duration</Th>
              <Th align="right">Actual Volume Cut</Th>
              <Th align="right">Cutting Rate</Th>
              <Th align="right">Downtime</Th>
              <Th align="right">Interruption</Th>
            </tr>
          </thead>
          <tbody>
            {dashboard.operators.map((operator) => (
              <tr key={operator.operatorId} className={dataTableRowClassName}>
                <Td>
                  <Link className="text-zinc-900 underline" href={`/production/entries?operator=${operator.operatorId}`}>
                    {operator.operator}
                  </Link>
                </Td>
                <Td align="right">{formatPercent(operator.utilization)}</Td>
                <Td align="right">{operator.shiftCount}</Td>
                <Td align="right">{formatMinutesAsDuration(operator.operational)}</Td>
                <Td align="right">{formatVolume(operator.volume)}</Td>
                <Td align="right">{formatRate(operator.cuttingRate)}</Td>
                <Td align="right">{formatMinutesAsDuration(operator.downtime)}</Td>
                <Td align="right">{formatMinutesAsDuration(operator.interruption)}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </DataTableCard>
    </PageContainer>
  );
}
