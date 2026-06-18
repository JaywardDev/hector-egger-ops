import { createProductionProjectFormAction } from "@/app/(protected)/production/actions";
import { PageContainer } from "@/src/components/layout/page-container";
import { PageHeader } from "@/src/components/layout/page-header";
import { Alert } from "@/src/components/ui/alert";
import { Button } from "@/src/components/ui/button";
import { Card } from "@/src/components/ui/card";
import { FormField } from "@/src/components/ui/form-field";
import { Input } from "@/src/components/ui/input";

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
          <FormField label="Total Time" htmlFor="total_time_minutes">
            <Input id="total_time_minutes" name="total_time_minutes" type="number" min={0} />
          </FormField>
          <FormField label="Total Volume m³" htmlFor="total_volume_m3">
            <Input id="total_volume_m3" name="total_volume_m3" type="number" min={0} step="0.001" />
          </FormField>
          <div className="sm:col-span-2">
            <Button type="submit">Create project</Button>
          </div>
        </form>
      </Card>
    </PageContainer>
  );
}
