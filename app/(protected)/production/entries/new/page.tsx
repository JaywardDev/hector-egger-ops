import { createProductionEntryFormAction } from "@/app/(protected)/production/actions";
import { EntryMetricsPreview } from "@/app/(protected)/production/components/entry-metrics-preview";
import { PageContainer } from "@/src/components/layout/page-container";
import { PageHeader } from "@/src/components/layout/page-header";
import { Alert } from "@/src/components/ui/alert";
import { Button } from "@/src/components/ui/button";
import { Card } from "@/src/components/ui/card";
import { FormField } from "@/src/components/ui/form-field";
import { Input } from "@/src/components/ui/input";
import { Textarea } from "@/src/components/ui/textarea";
import { requireProtectedAccess } from "@/src/lib/auth/guards";
import { listProductionProjects } from "@/src/lib/production/projects";
import { listProductionDowntimeReasons, listProductionInterruptionReasons } from "@/src/lib/production/reasons";

type NewEntryPageProps = {
  searchParams: Promise<{ error?: string; warn?: string }>;
};

export default async function NewProductionEntryPage({ searchParams }: NewEntryPageProps) {
  const route = "/production/entries/new";
  const { session, roles, profile } = await requireProtectedAccess(route);

  const [params, projects, downtimeReasons, interruptionReasons] = await Promise.all([
    searchParams,
    listProductionProjects({ session, accessContext: { accountStatus: "approved", roles }, route }),
    listProductionDowntimeReasons({ session, accessContext: { accountStatus: "approved", roles }, route }),
    listProductionInterruptionReasons({ session, accessContext: { accountStatus: "approved", roles }, route }),
  ]);

  return (
    <PageContainer>
      <PageHeader title="New production entry" description="Create a daily production entry." />
      {params.error ? <Alert variant="error">{params.error}</Alert> : null}
      {params.warn ? <Alert>{params.warn}</Alert> : null}
      <EntryMetricsPreview />
      <Card>
        <form action={createProductionEntryFormAction} className="grid gap-3 sm:grid-cols-2">
          <FormField label="Work date" htmlFor="work_date">
            <Input id="work_date" name="work_date" type="date" required />
          </FormField>
          <FormField label="Operator" htmlFor="operator_profile_id">
            <select id="operator_profile_id" name="operator_profile_id" className="w-full rounded-md border border-zinc-200 px-2 py-2" defaultValue={profile?.id ?? ""} required>
              {profile ? <option value={profile.id}>{profile.full_name ?? profile.email}</option> : null}
            </select>
          </FormField>
          <FormField label="Project" htmlFor="project_id">
            <select id="project_id" name="project_id" className="w-full rounded-md border border-zinc-200 px-2 py-2" required>
              <option value="">Select project</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>{project.project_file} #{project.project_sequence} · {project.project_name}</option>
              ))}
            </select>
          </FormField>
          <FormField label="Shift start" htmlFor="shift_start_time">
            <Input id="shift_start_time" name="shift_start_time" type="time" required />
          </FormField>
          <FormField label="Shift end" htmlFor="shift_end_time">
            <Input id="shift_end_time" name="shift_end_time" type="time" required />
          </FormField>
          <FormField label="File minutes left start" htmlFor="file_minutes_left_start">
            <Input id="file_minutes_left_start" name="file_minutes_left_start" type="number" min={0} required />
          </FormField>
          <FormField label="File minutes left end" htmlFor="file_minutes_left_end">
            <Input id="file_minutes_left_end" name="file_minutes_left_end" type="number" min={0} required />
          </FormField>
          <FormField label="Actual volume cut m³" htmlFor="actual_volume_cut_m3">
            <Input id="actual_volume_cut_m3" name="actual_volume_cut_m3" type="number" min={0} step="0.001" defaultValue="0" />
          </FormField>
          <FormField label="Downtime minutes" htmlFor="downtime_minutes">
            <Input id="downtime_minutes" name="downtime_minutes" type="number" min={0} defaultValue="0" />
          </FormField>
          <FormField label="Downtime reason" htmlFor="downtime_reason_id">
            <select id="downtime_reason_id" name="downtime_reason_id" className="w-full rounded-md border border-zinc-200 px-2 py-2">
              <option value="">None</option>
              {downtimeReasons.map((reason) => (
                <option key={reason.id} value={reason.id}>{reason.label}</option>
              ))}
            </select>
          </FormField>
          <FormField label="Interruption minutes" htmlFor="interruption_minutes">
            <Input id="interruption_minutes" name="interruption_minutes" type="number" min={0} defaultValue="0" />
          </FormField>
          <FormField label="Interruption reason" htmlFor="interruption_reason_id">
            <select id="interruption_reason_id" name="interruption_reason_id" className="w-full rounded-md border border-zinc-200 px-2 py-2">
              <option value="">None</option>
              {interruptionReasons.map((reason) => (
                <option key={reason.id} value={reason.id}>{reason.label}</option>
              ))}
            </select>
          </FormField>
          <FormField className="sm:col-span-2" label="Notes" htmlFor="notes">
            <Textarea id="notes" name="notes" rows={4} />
          </FormField>
          <div className="sm:col-span-2">
            <Button type="submit">Create entry</Button>
          </div>
        </form>
      </Card>
    </PageContainer>
  );
}
