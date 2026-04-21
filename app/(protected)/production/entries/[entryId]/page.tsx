import Link from "next/link";
import {
  deleteProductionEntryAction,
  updateProductionEntryFormAction,
} from "@/app/(protected)/production/actions";
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
import { getProductionEntryDetail } from "@/src/lib/production/entries";
import { listProductionProjects } from "@/src/lib/production/projects";
import { listProductionDowntimeReasons, listProductionInterruptionReasons } from "@/src/lib/production/reasons";

type EntryDetailPageProps = {
  params: Promise<{ entryId: string }>;
  searchParams: Promise<{ success?: string; error?: string }>;
};

export default async function ProductionEntryDetailPage({ params, searchParams }: EntryDetailPageProps) {
  const route = "/production/entries";
  const { entryId } = await params;
  const { session, roles } = await requireProtectedAccess(route);

  const [messages, entry, projects, downtimeReasons, interruptionReasons] = await Promise.all([
    searchParams,
    getProductionEntryDetail({
      session,
      accessContext: { accountStatus: "approved", roles },
      route,
      entryId,
    }),
    listProductionProjects({ session, accessContext: { accountStatus: "approved", roles }, route }),
    listProductionDowntimeReasons({ session, accessContext: { accountStatus: "approved", roles }, route }),
    listProductionInterruptionReasons({ session, accessContext: { accountStatus: "approved", roles }, route }),
  ]);

  if (!entry) {
    return (
      <PageContainer>
        <PageHeader title="Entry not found" description="This production entry is missing or unavailable." />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader title={`Entry ${entry.work_date}`} description={`${entry.operator_name} · ${entry.project_file} #${entry.project_sequence}`} />
      {messages.success ? <Alert variant="success">{messages.success}</Alert> : null}
      {messages.error ? <Alert variant="error">{messages.error}</Alert> : null}
      <EntryMetricsPreview />
      <Card>
        <form action={updateProductionEntryFormAction} className="grid gap-3 sm:grid-cols-2">
          <input type="hidden" name="entry_id" value={entry.id} />
          <FormField label="Work date" htmlFor="work_date">
            <Input id="work_date" name="work_date" type="date" defaultValue={entry.work_date} required />
          </FormField>
          <FormField label="Operator profile id" htmlFor="operator_profile_id">
            <Input id="operator_profile_id" name="operator_profile_id" defaultValue={entry.operator_profile_id} required />
          </FormField>
          <FormField label="Project" htmlFor="project_id">
            <select id="project_id" name="project_id" className="w-full rounded-md border border-zinc-200 px-2 py-2" defaultValue={entry.project_id}>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>{project.project_file} #{project.project_sequence}</option>
              ))}
            </select>
          </FormField>
          <FormField label="Shift start" htmlFor="shift_start_time">
            <Input id="shift_start_time" name="shift_start_time" type="time" defaultValue={entry.shift_start_time.slice(0, 5)} required />
          </FormField>
          <FormField label="Shift end" htmlFor="shift_end_time">
            <Input id="shift_end_time" name="shift_end_time" type="time" defaultValue={entry.shift_end_time.slice(0, 5)} required />
          </FormField>
          <FormField label="File minutes left start" htmlFor="file_minutes_left_start">
            <Input id="file_minutes_left_start" name="file_minutes_left_start" type="number" min={0} defaultValue={entry.file_minutes_left_start} required />
          </FormField>
          <FormField label="File minutes left end" htmlFor="file_minutes_left_end">
            <Input id="file_minutes_left_end" name="file_minutes_left_end" type="number" min={0} defaultValue={entry.file_minutes_left_end} required />
          </FormField>
          <FormField label="Actual volume cut" htmlFor="actual_volume_cut_m3">
            <Input id="actual_volume_cut_m3" name="actual_volume_cut_m3" type="number" min={0} step="0.001" defaultValue={entry.actual_volume_cut_m3} />
          </FormField>
          <FormField label="Downtime minutes" htmlFor="downtime_minutes">
            <Input id="downtime_minutes" name="downtime_minutes" type="number" min={0} defaultValue={entry.downtime_minutes} />
          </FormField>
          <FormField label="Downtime reason" htmlFor="downtime_reason_id">
            <select id="downtime_reason_id" name="downtime_reason_id" className="w-full rounded-md border border-zinc-200 px-2 py-2" defaultValue={entry.downtime_reason_id ?? ""}>
              <option value="">None</option>
              {downtimeReasons.map((reason) => (
                <option key={reason.id} value={reason.id}>{reason.label}</option>
              ))}
            </select>
          </FormField>
          <FormField label="Interruption minutes" htmlFor="interruption_minutes">
            <Input id="interruption_minutes" name="interruption_minutes" type="number" min={0} defaultValue={entry.interruption_minutes} />
          </FormField>
          <FormField label="Interruption reason" htmlFor="interruption_reason_id">
            <select id="interruption_reason_id" name="interruption_reason_id" className="w-full rounded-md border border-zinc-200 px-2 py-2" defaultValue={entry.interruption_reason_id ?? ""}>
              <option value="">None</option>
              {interruptionReasons.map((reason) => (
                <option key={reason.id} value={reason.id}>{reason.label}</option>
              ))}
            </select>
          </FormField>
          <FormField className="sm:col-span-2" label="Notes" htmlFor="notes">
            <Textarea id="notes" name="notes" rows={3} defaultValue={entry.notes ?? ""} />
          </FormField>
          <div className="sm:col-span-2 flex gap-2">
            <Button type="submit">Save entry</Button>
          </div>
        </form>
      </Card>

      <Card>
        <p className="font-medium text-zinc-900">Metadata</p>
        <p className="mt-1">Created at: {entry.created_at}</p>
        <p>Updated at: {entry.updated_at}</p>
        <p>Created by profile: {entry.created_by_profile_id}</p>
      </Card>

      <Card>
        <form
          action={async () => {
            "use server";
            await deleteProductionEntryAction(entry.id);
          }}
        >
          <Button type="submit" variant="danger">Delete entry</Button>
        </form>
        <p className="mt-2">
          <Link className="underline" href="/production/entries">Back to entries</Link>
        </p>
      </Card>
    </PageContainer>
  );
}
