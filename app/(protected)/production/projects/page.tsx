import Link from "next/link";
import { PageContainer } from "@/src/components/layout/page-container";
import { PageHeader } from "@/src/components/layout/page-header";
import { Alert } from "@/src/components/ui/alert";
import { Card } from "@/src/components/ui/card";
import { Input } from "@/src/components/ui/input";
import { requireProtectedAccess } from "@/src/lib/auth/guards";
import { listProductionProjectSummaries } from "@/src/lib/production/dashboard";
import { listProductionProjects } from "@/src/lib/production/projects";

type ProjectsPageProps = {
  searchParams: Promise<{
    q?: string;
    status?: string;
    success?: string;
    error?: string;
  }>;
};

export default async function ProductionProjectsPage({ searchParams }: ProjectsPageProps) {
  const route = "/production/projects";
  const { session, roles } = await requireProtectedAccess(route);
  const [params, summaries, projects] = await Promise.all([
    searchParams,
    listProductionProjectSummaries({
      session,
      accessContext: { accountStatus: "approved", roles },
      route,
    }),
    listProductionProjects({
      session,
      accessContext: { accountStatus: "approved", roles },
      route,
    }),
  ]);

  const q = (params.q ?? "").trim().toLowerCase();
  const status = (params.status ?? "active").trim().toLowerCase();

  const archivedById = new Map(projects.map((project) => [project.id, project.is_archived]));

  const filtered = summaries.filter((project) => {
    const matchesSearch =
      !q ||
      `${project.project_file} ${project.project_name} ${project.project_sequence}`
        .toLowerCase()
        .includes(q);
    const archived = archivedById.get(project.project_id) ?? project.is_archived;
    const matchesStatus = status === "all" || (status === "archived" ? archived : !archived);
    return matchesSearch && matchesStatus;
  });

  return (
    <PageContainer>
      <PageHeader
        title="Production Projects"
        description="Manual Project Registry for production work."
      >
        <div className="pt-2">
          <Link className="rounded-md border border-zinc-200 px-3 py-1" href="/production/projects/new">
            Add project
          </Link>
        </div>
      </PageHeader>

      {params.success ? <Alert variant="success">{params.success}</Alert> : null}
      {params.error ? <Alert variant="error">{params.error}</Alert> : null}

      <Card>
        <form className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_180px_auto]">
          <Input name="q" defaultValue={params.q ?? ""} placeholder="Search file, name, sequence" />
          <select
            className="rounded-md border border-zinc-200 px-2 py-1"
            name="status"
            defaultValue={params.status ?? "all"}
          >
            <option value="active">Active</option>
            <option value="archived">Archived</option>
            <option value="all">All</option>
          </select>
          <button className="rounded-md border border-zinc-200 px-3 py-1" type="submit">
            Apply
          </button>
        </form>
      </Card>

      <Card className="overflow-x-auto">
        <table className="min-w-full text-left text-xs">
          <thead>
            <tr className="border-b border-zinc-200 text-zinc-500">
              <th className="px-2 py-1">Project file</th><th className="px-2 py-1">Project name</th><th className="px-2 py-1">Sequence</th>
              <th className="px-2 py-1">Total Time</th><th className="px-2 py-1">Latest Time Remaining</th>
              <th className="px-2 py-1">Total Volume</th><th className="px-2 py-1">Volume Cut</th>
              <th className="px-2 py-1">Downtime</th><th className="px-2 py-1">Interruption</th><th className="px-2 py-1">Archived</th><th className="px-2 py-1">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((project) => (
              <tr key={project.project_id} className="border-b border-zinc-100">
                <td className="px-2 py-1">{project.project_file}</td>
                <td className="px-2 py-1">{project.project_name}</td>
                <td className="px-2 py-1">{project.project_sequence}</td>
                <td className="px-2 py-1">{project.total_time_minutes ?? "—"}</td>
                <td className="px-2 py-1">{project.latest_time_remaining_minutes ?? "—"}</td>
                <td className="px-2 py-1">{project.total_volume_m3 ?? "—"}</td>
                <td className="px-2 py-1">{project.total_volume_cut_m3}</td>
                <td className="px-2 py-1">{project.total_downtime_minutes}</td>
                <td className="px-2 py-1">{project.total_interruption_minutes}</td>
                <td className="px-2 py-1">{(archivedById.get(project.project_id) ?? project.is_archived) ? "Yes" : "No"}</td>
                <td className="px-2 py-1">
                  <Link href={`/production/projects/${project.project_id}`} className="underline">Open</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 ? <p className="px-2 py-2">No matching projects.</p> : null}
      </Card>
    </PageContainer>
  );
}
