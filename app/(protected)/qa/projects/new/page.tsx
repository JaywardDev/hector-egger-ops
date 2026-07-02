import { createQaProjectAction } from "@/app/(protected)/qa/projects/actions";
import { PageContainer } from "@/src/components/layout/page-container";
import { PageHeader } from "@/src/components/layout/page-header";
import { Alert } from "@/src/components/ui/alert";
import { Button } from "@/src/components/ui/button";
import { Card } from "@/src/components/ui/card";
import { FormField } from "@/src/components/ui/form-field";
import { Input } from "@/src/components/ui/input";
import { requireAdminAccess } from "@/src/lib/auth/guards";
import { QA_EYEBROW } from "@/src/lib/qa/ui-contract";
import { BackLink } from "../../components/qa-ui";

type NewQaProjectPageProps = {
  searchParams?: Promise<{ error?: string }>;
};

export default async function NewQaProjectPage({ searchParams }: NewQaProjectPageProps) {
  await requireAdminAccess();
  const params = (await searchParams) ?? {};

  return (
    <PageContainer>
      <BackLink href="/qa">Back to QA projects</BackLink>
      <PageHeader accent eyebrow={QA_EYEBROW} title="New QA project" description="Create a project to hold checklists. Manager-only." />

      {params.error ? <Alert variant="error">{params.error}</Alert> : null}

      <Card>
        <form action={createQaProjectAction} className="grid gap-4 sm:max-w-lg">
          <FormField label="Project name" htmlFor="name" helperText="e.g. Cardrona - Type A">
            <Input id="name" name="name" required placeholder="Project name" />
          </FormField>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Project ref" htmlFor="ref" helperText="Optional, e.g. 260013">
              <Input id="ref" name="ref" placeholder="260013" />
            </FormField>
            <FormField label="Lot" htmlFor="lot" helperText="Optional, e.g. Lot 306">
              <Input id="lot" name="lot" placeholder="Lot 306" />
            </FormField>
          </div>
          <div>
            <Button type="submit" variant="primary">
              Create project
            </Button>
          </div>
        </form>
      </Card>
    </PageContainer>
  );
}
