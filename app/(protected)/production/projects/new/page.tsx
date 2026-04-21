import { createProductionProjectFormAction } from "@/app/(protected)/production/actions";
import { PageContainer } from "@/src/components/layout/page-container";
import { PageHeader } from "@/src/components/layout/page-header";
import { Alert } from "@/src/components/ui/alert";
import { Button } from "@/src/components/ui/button";
import { Card } from "@/src/components/ui/card";
import { FormField } from "@/src/components/ui/form-field";
import { Input } from "@/src/components/ui/input";
import { Textarea } from "@/src/components/ui/textarea";

type NewProjectPageProps = {
  searchParams: Promise<{ error?: string }>;
};

export default async function NewProductionProjectPage({ searchParams }: NewProjectPageProps) {
  const params = await searchParams;

  return (
    <PageContainer>
      <PageHeader title="New production project" description="Create a new project registry item." />
      {params.error ? <Alert variant="error">{params.error}</Alert> : null}
      <Card>
        <form action={createProductionProjectFormAction} className="grid gap-3 sm:grid-cols-2">
          <FormField label="Project file" htmlFor="project_file">
            <Input id="project_file" name="project_file" required />
          </FormField>
          <FormField label="Project name" htmlFor="project_name">
            <Input id="project_name" name="project_name" required />
          </FormField>
          <FormField label="Project sequence" htmlFor="project_sequence">
            <Input id="project_sequence" name="project_sequence" type="number" min={1} required />
          </FormField>
          <FormField label="Total operational minutes" htmlFor="total_operational_minutes">
            <Input id="total_operational_minutes" name="total_operational_minutes" type="number" min={0} />
          </FormField>
          <FormField label="Estimated total volume m³" htmlFor="estimated_total_volume_m3">
            <Input id="estimated_total_volume_m3" name="estimated_total_volume_m3" type="number" min={0} step="0.001" />
          </FormField>
          <FormField label="Status" htmlFor="status">
            <select id="status" name="status" className="w-full rounded-md border border-zinc-200 px-2 py-2">
              <option value="active">active</option>
              <option value="completed">completed</option>
              <option value="archived">archived</option>
            </select>
          </FormField>
          <FormField className="sm:col-span-2" label="Notes" htmlFor="notes">
            <Textarea id="notes" name="notes" rows={4} />
          </FormField>
          <div className="sm:col-span-2">
            <Button type="submit">Create project</Button>
          </div>
        </form>
      </Card>
    </PageContainer>
  );
}
