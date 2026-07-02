import { notFound, redirect } from "next/navigation";
import { startQaChecklistAction } from "@/app/(protected)/qa/projects/actions";
import { Alert } from "@/src/components/ui/alert";
import { Button } from "@/src/components/ui/button";
import { Card } from "@/src/components/ui/card";
import { FormField } from "@/src/components/ui/form-field";
import { Input } from "@/src/components/ui/input";
import { Select } from "@/src/components/ui/select";
import { PageContainer } from "@/src/components/layout/page-container";
import { PageHeader } from "@/src/components/layout/page-header";
import { requireProtectedAccess } from "@/src/lib/auth/guards";
import { isAdminOrSupervisor, isOperator } from "@/src/lib/permissions/roles";
import { listQaTemplateChoices } from "@/src/lib/qa/checklists";
import { getQaProjectDetail } from "@/src/lib/qa/projects";
import { QA_EYEBROW } from "@/src/lib/qa/ui-contract";
import { BackLink } from "../../../../components/qa-ui";

type Props = {
  params: Promise<{ projectId: string }>;
  searchParams?: Promise<{ error?: string }>;
};

export default async function StartQaChecklistPage({ params, searchParams }: Props) {
  const { projectId } = await params;
  const route = "/qa/projects";
  const context = await requireProtectedAccess(route);
  if (!isAdminOrSupervisor(context) && !isOperator(context)) {
    redirect("/qa");
  }

  const [project, templates] = await Promise.all([
    getQaProjectDetail(context.session, projectId),
    listQaTemplateChoices(context.session),
  ]);
  if (!project) {
    notFound();
  }
  const query = (await searchParams) ?? {};

  return (
    <PageContainer>
      <BackLink href={`/qa/projects/${project.id}`}>
        Back to {project.project_ref} · {project.name}
      </BackLink>
      <PageHeader
        accent
        eyebrow={QA_EYEBROW}
        title="Start a checklist"
        description={`Create a fillable checklist for ${project.name} from an imported template.`}
      />

      {query.error ? <Alert variant="error">{query.error}</Alert> : null}

      {templates.length === 0 ? (
        <Card>
          <p className="text-sm text-zinc-600">
            No checklist templates are available yet. Ask an admin to import templates before starting a checklist.
          </p>
        </Card>
      ) : (
        <Card>
          <form action={startQaChecklistAction} className="grid gap-4 sm:max-w-lg">
            <input type="hidden" name="projectId" value={project.id} />
            <FormField label="Template" htmlFor="templateVersionId" helperText="Uses the latest imported version of the template.">
              <Select id="templateVersionId" name="templateVersionId" required defaultValue="">
                <option value="" disabled>
                  Choose a template…
                </option>
                {templates.map((choice) => (
                  <option key={choice.versionId} value={choice.versionId}>
                    {choice.label}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="Section" htmlFor="sectionId" helperText="Optional — leave blank to hang it directly off the project.">
              <Select id="sectionId" name="sectionId" defaultValue="">
                <option value="">No section</option>
                {project.sections.map((section) => (
                  <option key={section.id} value={section.id}>
                    {section.name}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="Checklist code" htmlFor="code" helperText="Optional, e.g. EW_0007. Defaults to the template name.">
              <Input id="code" name="code" placeholder="EW_0007" />
            </FormField>
            <div>
              <Button type="submit" variant="primary">
                Start checklist
              </Button>
            </div>
          </form>
        </Card>
      )}
    </PageContainer>
  );
}
