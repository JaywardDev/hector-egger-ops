import Link from "next/link";
import { updateProductionProjectFormAction } from "@/app/(protected)/production/actions";
import { PageContainer } from "@/src/components/layout/page-container";
import { PageHeader } from "@/src/components/layout/page-header";
import { Alert } from "@/src/components/ui/alert";
import { Button } from "@/src/components/ui/button";
import { Card } from "@/src/components/ui/card";
import { FormField } from "@/src/components/ui/form-field";
import { Input } from "@/src/components/ui/input";
import { Textarea } from "@/src/components/ui/textarea";
import { requireProtectedAccess } from "@/src/lib/auth/guards";
import { listProductionEntries } from "@/src/lib/production/entries";
import { getProductionProjectDetail, listProductionProjects } from "@/src/lib/production/projects";

type ProjectDetailPageProps = {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ success?: string; error?: string }>;
};

const formatPct = (value: number | null) => (value === null ? "—" : `${(value * 100).toFixed(1)}%`);

export default async function ProductionProjectDetailPage({ params, searchParams }: ProjectDetailPageProps) {
  const route = "/production/projects";
  const { projectId } = await params;
  const { session, roles } = await requireProtectedAccess(route);

  const [messages, summary, projects, entries] = await Promise.all([
    searchParams,
    getProductionProjectDetail({
      session,
      accessContext: { accountStatus: "approved", roles },
      route,
      projectId,
    }),
    listProductionProjects({
      session,
      accessContext: { accountStatus: "approved", roles },
      route,
    }),
    listProductionEntries({
      session,
      accessContext: { accountStatus: "approved", roles },
      route,
      projectId,
      limit: 8,
    }),
  ]);

  const project = projects.find((item) => item.id === projectId);

  if (!summary || !project) {
    return (
      <PageContainer>
        <PageHeader title="Project not found" description="The project id is missing or inaccessible." />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader title={`${summary.project_file} #${summary.project_sequence}`} description={summary.project_name} />
      {messages.success ? <Alert variant="success">{messages.success}</Alert> : null}
      {messages.error ? <Alert variant="error">{messages.error}</Alert> : null}

      <Card>
        <p className="font-medium text-zinc-900">Core details</p>
        <div className="mt-2 grid gap-1 sm:grid-cols-2">
          <p>Total operational minutes: {project.total_operational_minutes ?? "—"}</p>
          <p>Estimated volume m³: {project.estimated_total_volume_m3 ?? "—"}</p>
          <p>Status: {project.status}</p>
          <p>Latest file minutes left: {summary.latest_file_minutes_left ?? "—"}</p>
          <p>Remaining: {formatPct(summary.remaining_pct)}</p>
          <p>Progress: {formatPct(summary.progress_pct)}</p>
        </div>
      </Card>

      <Card>
        <p className="font-medium text-zinc-900">Metrics snapshot</p>
        <div className="mt-2 grid gap-1 sm:grid-cols-2">
          <p>Total logged operational minutes: {summary.total_logged_operational_minutes}</p>
          <p>Total volume cut m³: {summary.total_volume_cut_m3}</p>
          <p>Avg machine efficiency: {formatPct(summary.avg_machine_efficiency_pct)}</p>
          <p>Avg project efficiency: {formatPct(summary.avg_project_efficiency_pct)}</p>
        </div>
      </Card>

      <Card>
        <p className="font-medium text-zinc-900">Edit scaffold</p>
        <form action={updateProductionProjectFormAction} className="mt-2 grid gap-3 sm:grid-cols-2">
          <input type="hidden" name="project_id" value={project.id} />
          <FormField label="Project file" htmlFor="project_file">
            <Input id="project_file" name="project_file" defaultValue={project.project_file} required />
          </FormField>
          <FormField label="Project name" htmlFor="project_name">
            <Input id="project_name" name="project_name" defaultValue={project.project_name} required />
          </FormField>
          <FormField label="Sequence" htmlFor="project_sequence">
            <Input id="project_sequence" name="project_sequence" type="number" defaultValue={project.project_sequence} />
          </FormField>
          <FormField label="Status" htmlFor="status">
            <select id="status" name="status" className="w-full rounded-md border border-zinc-200 px-2 py-2" defaultValue={project.status}>
              <option value="active">active</option>
              <option value="completed">completed</option>
              <option value="archived">archived</option>
            </select>
          </FormField>
          <FormField label="Total operational minutes" htmlFor="total_operational_minutes">
            <Input id="total_operational_minutes" name="total_operational_minutes" type="number" min={0} defaultValue={project.total_operational_minutes ?? ""} />
          </FormField>
          <FormField label="Estimated total volume" htmlFor="estimated_total_volume_m3">
            <Input id="estimated_total_volume_m3" name="estimated_total_volume_m3" type="number" min={0} step="0.001" defaultValue={project.estimated_total_volume_m3 ?? ""} />
          </FormField>
          <FormField className="sm:col-span-2" label="Notes" htmlFor="notes">
            <Textarea id="notes" name="notes" rows={3} defaultValue={project.notes ?? ""} />
          </FormField>
          <div className="sm:col-span-2">
            <Button type="submit">Save project</Button>
          </div>
        </form>
      </Card>

      <Card>
        <p className="font-medium text-zinc-900">Linked entries</p>
        {entries.length === 0 ? (
          <p className="mt-2">No entries for this project yet.</p>
        ) : (
          <ul className="mt-2 space-y-1">
            {entries.map((entry) => (
              <li key={entry.id}>
                <Link className="underline" href={`/production/entries/${entry.id}`}>
                  {entry.work_date} · {entry.operator_name} · done {entry.project_file_done_minutes} min
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </PageContainer>
  );
}
