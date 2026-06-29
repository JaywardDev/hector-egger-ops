import Link from "next/link";
import { createProductionProjectFileFormAction, updateProductionProjectFileFormAction, updateProductionProjectFormAction } from "@/app/(protected)/production/actions";
import { BackLink } from "@/app/(protected)/production/components/production-ui";
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
import { formatMinutesAsDuration } from "@/src/lib/production/format";
import { getProductionProjectDetail, listProductionProjectFileSummaries, listProductionProjects } from "@/src/lib/production/projects";


const formatCubicMetres = (value: number | null | undefined) => (value == null || !Number.isFinite(value) ? "—" : `${Number(value).toLocaleString("en-NZ", { maximumFractionDigits: 3 })} m³`);

const getRemainingValue = (planned: number | null | undefined, logged: number | null | undefined) => {
  if (planned == null || !Number.isFinite(planned)) return null;
  return Math.max(0, planned - (logged ?? 0));
};

const getOverValue = (planned: number | null | undefined, logged: number | null | undefined) => {
  if (planned == null || !Number.isFinite(planned)) return 0;
  return Math.max(0, (logged ?? 0) - planned);
};

const formatProgressPercent = (logged: number | null | undefined, planned: number | null | undefined) => {
  if (planned == null || planned <= 0 || !Number.isFinite(planned)) return "—";
  return `${Math.round(((logged ?? 0) / planned) * 100)}%`;
};

type ProjectDetailPageProps = {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ success?: string; error?: string }>;
};

export default async function ProductionProjectDetailPage({ params, searchParams }: ProjectDetailPageProps) {
  const route = "/production/projects";
  const { projectId } = await params;
  const { session, roles } = await requireProtectedAccess(route);

  const [messages, summary, projects, projectFileSummaries, entries] = await Promise.all([
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
    listProductionProjectFileSummaries({ session, accessContext: { accountStatus: "approved", roles }, route, projectId }),
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
      <BackLink href="/production/projects">Back to projects</BackLink>
      <PageHeader title={project.project_name} description={`${projectFileSummaries.length} project file${projectFileSummaries.length === 1 ? "" : "s"}`} />
      {messages.success ? <Alert variant="success">{messages.success}</Alert> : null}
      {messages.error ? <Alert variant="error">{messages.error}</Alert> : null}

      <Card>
        <p className="font-medium text-zinc-900">Core details</p>
        <div className="mt-2 grid gap-1 sm:grid-cols-2">
          <p>Total planned time from files: {formatMinutesAsDuration(summary.total_time_minutes)}</p>
          <p>Total planned volume from files: {summary.total_volume_m3 ?? "—"}</p>
          <p>Archived: {project.is_archived ? "yes" : "no"}</p>
          <p>Latest Time Remaining: {formatMinutesAsDuration(summary.latest_time_remaining_minutes)}</p>
        </div>
      </Card>

      <Card>
        <p className="font-medium text-zinc-900">Metrics snapshot</p>
        <div className="mt-2 grid gap-1 sm:grid-cols-2">
          <p>Total logged duration: {formatMinutesAsDuration(summary.total_logged_operational_minutes)}</p>
          <p>Total actual volume: {summary.total_volume_cut_m3}</p>
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
          {projectFileSummaries.map((file) => {
            const timeProgress = formatProgressPercent(file.total_logged_operational_minutes, file.total_time_minutes);
            const volumeProgress = formatProgressPercent(file.total_volume_cut_m3, file.total_volume_m3);
            const remainingTime = getRemainingValue(file.total_time_minutes, file.total_logged_operational_minutes);
            const overPlannedTime = getOverValue(file.total_time_minutes, file.total_logged_operational_minutes);
            const remainingVolume = getRemainingValue(file.total_volume_m3, file.total_volume_cut_m3);
            const overVolume = getOverValue(file.total_volume_m3, file.total_volume_cut_m3);

            return (
            <form key={file.project_file_id} action={updateProductionProjectFileFormAction} className="grid gap-2 rounded-md border border-zinc-200 p-3 sm:grid-cols-5">
              <input type="hidden" name="project_id" value={project.id} />
              <input type="hidden" name="project_file_id" value={file.project_file_id} />
              <div className="sm:col-span-5">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium text-zinc-900">{file.project_file}{file.project_sequence === null ? "" : ` / PS ${file.project_sequence}`}</p>
                  <span className={`rounded-full px-2 py-0.5 text-xs ${file.is_archived ? "bg-zinc-100 text-zinc-600" : "bg-emerald-50 text-emerald-700"}`}>{file.is_archived ? "Archived" : "Active"}</span>
                </div>
                <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
                  <p>Planned time: {formatMinutesAsDuration(file.total_time_minutes)}</p>
                  <p>Logged duration: {formatMinutesAsDuration(file.total_logged_operational_minutes)}</p>
                  <p>{overPlannedTime > 0 ? `Over planned by: ${formatMinutesAsDuration(overPlannedTime)}` : `Remaining planned time: ${formatMinutesAsDuration(remainingTime)}`}</p>
                  <p>Time progress: {timeProgress}</p>
                  <p>Planned volume: {formatCubicMetres(file.total_volume_m3)}</p>
                  <p>Actual volume cut: {formatCubicMetres(file.total_volume_cut_m3)}</p>
                  <p>{overVolume > 0 ? `Over volume by: ${formatCubicMetres(overVolume)}` : `Remaining volume: ${formatCubicMetres(remainingVolume)}`}</p>
                  <p>Volume progress: {volumeProgress}</p>
                  <p>Downtime duration: {formatMinutesAsDuration(file.total_downtime_minutes)}</p>
                  <p>Interruption duration: {formatMinutesAsDuration(file.total_interruption_minutes)}</p>
                  <p>Latest Time Remaining End: {formatMinutesAsDuration(file.latest_time_remaining_minutes)}</p>
                </div>
              </div>
              <Input name="project_file" defaultValue={file.project_file} required aria-label="Project file" />
              <Input name="project_sequence" type="number" min={0} defaultValue={file.project_sequence ?? ""} aria-label="Project sequence" />
              <Input name="total_time_minutes" type="number" min={0} defaultValue={file.total_time_minutes ?? ""} aria-label="Total planned time minutes" />
              <Input name="total_volume_m3" type="number" min={0} step="0.001" defaultValue={file.total_volume_m3 ?? ""} aria-label="Total planned volume m³" />
              <select name="is_archived" className="rounded-md border border-zinc-200 px-2 py-2" defaultValue={file.is_archived ? "true" : "false"} aria-label="Project file status"><option value="false">Active</option><option value="true">Archived</option></select>
              <div className="sm:col-span-5"><Button type="submit">Save file</Button></div>
            </form>
            );
          })}
        </div>
        <form action={createProductionProjectFileFormAction} className="mt-4 grid gap-2 border-t border-zinc-200 pt-4 sm:grid-cols-5">
          <input type="hidden" name="project_id" value={project.id} />
          <Input name="project_file" placeholder="Project file" required />
          <Input name="project_sequence" type="number" min={0} placeholder="PS" />
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
