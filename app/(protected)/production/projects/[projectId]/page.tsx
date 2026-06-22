import Link from "next/link";
import { createProductionProjectFileFormAction, updateProductionProjectFileFormAction, updateProductionProjectFormAction } from "@/app/(protected)/production/actions";
import { PageContainer } from "@/src/components/layout/page-container";
import { PageHeader } from "@/src/components/layout/page-header";
import { Alert } from "@/src/components/ui/alert";
import { Button } from "@/src/components/ui/button";
import { Card } from "@/src/components/ui/card";
import { FormField } from "@/src/components/ui/form-field";
import { Input } from "@/src/components/ui/input";
import { requireProtectedAccess } from "@/src/lib/auth/guards";
import { formatNzDate } from "@/src/lib/dateTime";
import { listProductionEntries } from "@/src/lib/production/entries";
import { getProductionProjectDetail, listProductionProjectFiles, listProductionProjects } from "@/src/lib/production/projects";

type ProjectDetailPageProps = {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ success?: string; error?: string }>;
};

export default async function ProductionProjectDetailPage({ params, searchParams }: ProjectDetailPageProps) {
  const route = "/production/projects";
  const { projectId } = await params;
  const { session, roles } = await requireProtectedAccess(route);

  const [messages, summary, projects, projectFiles, entries] = await Promise.all([
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
    listProductionProjectFiles({ session, accessContext: { accountStatus: "approved", roles }, route, projectId }),
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
      <PageHeader title={project.project_name} description={`${projectFiles.length} project file${projectFiles.length === 1 ? "" : "s"}`} />
      {messages.success ? <Alert variant="success">{messages.success}</Alert> : null}
      {messages.error ? <Alert variant="error">{messages.error}</Alert> : null}

      <Card>
        <p className="font-medium text-zinc-900">Core details</p>
        <div className="mt-2 grid gap-1 sm:grid-cols-2">
          <p>Total Time from files: {summary.total_time_minutes ?? "—"}</p>
          <p>Total Volume m³ from files: {summary.total_volume_m3 ?? "—"}</p>
          <p>Archived: {project.is_archived ? "yes" : "no"}</p>
          <p>Latest Time Remaining: {summary.latest_time_remaining_minutes ?? "—"}</p>
        </div>
      </Card>

      <Card>
        <p className="font-medium text-zinc-900">Metrics snapshot</p>
        <div className="mt-2 grid gap-1 sm:grid-cols-2">
          <p>Total logged operational minutes: {summary.total_logged_operational_minutes}</p>
          <p>Total volume cut m³: {summary.total_volume_cut_m3}</p>
        </div>
      </Card>

      <Card>
        <p className="font-medium text-zinc-900">Edit project</p>
        <form action={updateProductionProjectFormAction} className="mt-2 grid gap-3 sm:grid-cols-2">
          <input type="hidden" name="project_id" value={project.id} />
          <FormField label="Project name" htmlFor="project_name">
            <Input id="project_name" name="project_name" defaultValue={project.project_name} required />
          </FormField>
          <FormField label="Archived" htmlFor="is_archived">
            <select id="is_archived" name="is_archived" className="w-full rounded-md border border-zinc-200 px-2 py-2" defaultValue={project.is_archived ? "true" : "false"}>
              <option value="false">No</option>
              <option value="true">Yes</option>
            </select>
          </FormField>
          <div className="sm:col-span-2"><Button type="submit">Save project</Button></div>
        </form>
      </Card>

      <Card>
        <p className="font-medium text-zinc-900">Project files</p>
        <div className="mt-3 space-y-3">
          {projectFiles.map((file) => (
            <form key={file.id} action={updateProductionProjectFileFormAction} className="grid gap-2 rounded-md border border-zinc-200 p-3 sm:grid-cols-5">
              <input type="hidden" name="project_id" value={project.id} />
              <input type="hidden" name="project_file_id" value={file.id} />
              <Input name="project_file" defaultValue={file.project_file} required />
              <Input name="project_sequence" type="number" min={0} defaultValue={file.project_sequence ?? ""} />
              <Input name="total_time_minutes" type="number" min={0} defaultValue={file.total_time_minutes ?? ""} />
              <Input name="total_volume_m3" type="number" min={0} step="0.001" defaultValue={file.total_volume_m3 ?? ""} />
              <select name="is_archived" className="rounded-md border border-zinc-200 px-2 py-2" defaultValue={file.is_archived ? "true" : "false"}><option value="false">Active</option><option value="true">Archived</option></select>
              <div className="sm:col-span-5"><Button type="submit">Save file</Button></div>
            </form>
          ))}
        </div>
        <form action={createProductionProjectFileFormAction} className="mt-4 grid gap-2 border-t border-zinc-200 pt-4 sm:grid-cols-5">
          <input type="hidden" name="project_id" value={project.id} />
          <Input name="project_file" placeholder="Project file" required />
          <Input name="project_sequence" type="number" min={0} placeholder="Sequence" />
          <Input name="total_time_minutes" type="number" min={0} placeholder="Total time" />
          <Input name="total_volume_m3" type="number" min={0} step="0.001" placeholder="Total volume" />
          <Button type="submit">Add file</Button>
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
                  {formatNzDate(entry.entry_date)} · {entry.operator_name} · cut {entry.actual_volume_cut_m3} m³
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </PageContainer>
  );
}
