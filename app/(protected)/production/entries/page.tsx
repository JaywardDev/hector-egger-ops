import Link from "next/link";
import { PageContainer } from "@/src/components/layout/page-container";
import { PageHeader } from "@/src/components/layout/page-header";
import { Alert } from "@/src/components/ui/alert";
import { Card } from "@/src/components/ui/card";
import { Input } from "@/src/components/ui/input";
import { requireProtectedAccess } from "@/src/lib/auth/guards";
import { listProductionEntries } from "@/src/lib/production/entries";
import { listProductionOperatorSummaries, listProductionProjectSummaries } from "@/src/lib/production/dashboard";

type EntriesPageProps = {
  searchParams: Promise<{
    dateFrom?: string;
    dateTo?: string;
    operator?: string;
    project?: string;
    success?: string;
    error?: string;
  }>;
};

const formatPct = (value: number | null) => (value === null ? "—" : `${(value * 100).toFixed(1)}%`);

export default async function ProductionEntriesPage({ searchParams }: EntriesPageProps) {
  const route = "/production/entries";
  const { session, roles } = await requireProtectedAccess(route);

  const [params, operators, projects, entries] = await Promise.all([
    searchParams,
    listProductionOperatorSummaries({ session, accessContext: { accountStatus: "approved", roles }, route }),
    listProductionProjectSummaries({ session, accessContext: { accountStatus: "approved", roles }, route }),
    listProductionEntries({
      session,
      accessContext: { accountStatus: "approved", roles },
      route,
      operatorProfileId: undefined,
      projectId: undefined,
      limit: 200,
    }),
  ]);

  const filtered = entries.filter((entry) => {
    if (params.operator && entry.operator_profile_id !== params.operator) return false;
    if (params.project && entry.project_id !== params.project) return false;
    if (params.dateFrom && entry.work_date < params.dateFrom) return false;
    if (params.dateTo && entry.work_date > params.dateTo) return false;
    return true;
  });

  return (
    <PageContainer>
      <PageHeader title="Production entries" description="Operational daily registry scaffold with filters and metrics table.">
        <div className="pt-2">
          <Link className="rounded-md border border-zinc-200 px-3 py-1" href="/production/entries/new">
            Add entry
          </Link>
        </div>
      </PageHeader>
      {params.success ? <Alert variant="success">{params.success}</Alert> : null}
      {params.error ? <Alert variant="error">{params.error}</Alert> : null}

      <Card>
        <form className="grid gap-2 sm:grid-cols-5">
          <Input type="date" name="dateFrom" defaultValue={params.dateFrom ?? ""} />
          <Input type="date" name="dateTo" defaultValue={params.dateTo ?? ""} />
          <select className="rounded-md border border-zinc-200 px-2 py-1" name="operator" defaultValue={params.operator ?? ""}>
            <option value="">All operators</option>
            {operators.map((operator) => (
              <option key={operator.operator_profile_id} value={operator.operator_profile_id}>{operator.operator_name}</option>
            ))}
          </select>
          <select className="rounded-md border border-zinc-200 px-2 py-1" name="project" defaultValue={params.project ?? ""}>
            <option value="">All projects</option>
            {projects.map((project) => (
              <option key={project.project_id} value={project.project_id}>{project.project_file} #{project.project_sequence}</option>
            ))}
          </select>
          <button className="rounded-md border border-zinc-200 px-3 py-1" type="submit">Apply</button>
        </form>
      </Card>

      <Card className="overflow-x-auto">
        <table className="min-w-[1400px] text-left text-xs">
          <thead>
            <tr className="border-b border-zinc-200 text-zinc-500">
              <th className="px-2 py-1">Work date</th><th className="px-2 py-1">Operator</th><th className="px-2 py-1">Project file</th><th className="px-2 py-1">Sequence</th><th className="px-2 py-1">Project name</th><th className="px-2 py-1">Shift start</th><th className="px-2 py-1">Shift end</th><th className="px-2 py-1">Operational minutes</th><th className="px-2 py-1">File left start</th><th className="px-2 py-1">File left end</th><th className="px-2 py-1">File done minutes</th><th className="px-2 py-1">Actual volume</th><th className="px-2 py-1">Machine efficiency</th><th className="px-2 py-1">Project efficiency</th><th className="px-2 py-1">Downtime</th><th className="px-2 py-1">Interruption</th><th className="px-2 py-1">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((entry) => (
              <tr key={entry.id} className="border-b border-zinc-100">
                <td className="px-2 py-1">{entry.work_date}</td><td className="px-2 py-1">{entry.operator_name}</td><td className="px-2 py-1">{entry.project_file}</td><td className="px-2 py-1">{entry.project_sequence}</td><td className="px-2 py-1">{entry.project_name}</td><td className="px-2 py-1">{entry.shift_start_time}</td><td className="px-2 py-1">{entry.shift_end_time}</td><td className="px-2 py-1">{entry.operational_minutes}</td><td className="px-2 py-1">{entry.file_minutes_left_start}</td><td className="px-2 py-1">{entry.file_minutes_left_end}</td><td className="px-2 py-1">{entry.project_file_done_minutes}</td><td className="px-2 py-1">{entry.actual_volume_cut_m3}</td><td className="px-2 py-1">{formatPct(entry.machine_efficiency_pct)}</td><td className="px-2 py-1">{formatPct(entry.project_efficiency_pct)}</td><td className="px-2 py-1">{entry.downtime_minutes}</td><td className="px-2 py-1">{entry.interruption_minutes}</td><td className="px-2 py-1"><Link className="underline" href={`/production/entries/${entry.id}`}>Open</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 ? <p className="px-2 py-2">No entries found for the current filters.</p> : null}
      </Card>
    </PageContainer>
  );
}
