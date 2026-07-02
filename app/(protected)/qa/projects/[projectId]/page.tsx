import Link from "next/link";
import { notFound } from "next/navigation";
import { createQaSectionAction } from "@/app/(protected)/qa/projects/actions";
import { Alert } from "@/src/components/ui/alert";
import { Badge } from "@/src/components/ui/badge";
import { Button } from "@/src/components/ui/button";
import { Card } from "@/src/components/ui/card";
import { FormField } from "@/src/components/ui/form-field";
import { Input } from "@/src/components/ui/input";
import { OperationalListRow } from "@/src/components/ui/operational-list-row";
import { PageContainer } from "@/src/components/layout/page-container";
import { PageHeader } from "@/src/components/layout/page-header";
import { SectionHeader } from "@/src/components/layout/section-header";
import { isAdmin, isAdminOrSupervisor, isOperator } from "@/src/lib/permissions/roles";
import { requireQaReadAccess } from "@/src/lib/qa/access";
import { getQaProjectDetail } from "@/src/lib/qa/projects";
import type { QaChecklistSummary, QaSection } from "@/src/lib/qa/types";
import { QA_EYEBROW } from "@/src/lib/qa/ui-contract";
import { BackLink, PreviewAction, RowLink, SignoffBadge } from "../../components/qa-ui";

type QaProjectPageProps = {
  params: Promise<{ projectId: string }>;
  searchParams?: Promise<{ error?: string }>;
};

// A section plus the checklists that belong to it. Sections show even when empty
// (so a manager sees the folder they created); "Ungrouped" only shows when it
// actually holds checklists.
type ChecklistGroup = { section: QaSection | null; checklists: QaChecklistSummary[] };

function groupChecklists(sections: QaSection[], checklists: QaChecklistSummary[]): ChecklistGroup[] {
  const groups: ChecklistGroup[] = sections.map((section) => ({
    section,
    checklists: checklists.filter((checklist) => checklist.section_id === section.id),
  }));
  const ungrouped = checklists.filter((checklist) => checklist.section_id === null);
  if (ungrouped.length > 0) {
    groups.push({ section: null, checklists: ungrouped });
  }
  return groups;
}

export default async function QaProjectPage({ params, searchParams }: QaProjectPageProps) {
  const { projectId } = await params;
  const route = "/qa/projects";
  const { session, roles } = await requireQaReadAccess(route);
  const query = (await searchParams) ?? {};
  const canManage = isAdmin({ roles });
  const canCapture = isAdminOrSupervisor({ roles }) || isOperator({ roles });

  const project = await getQaProjectDetail(session, projectId);
  if (!project) {
    notFound();
  }

  const groups = groupChecklists(project.sections, project.checklists);

  return (
    <PageContainer>
      <BackLink href="/qa">Back to QA projects</BackLink>
      <PageHeader
        accent
        eyebrow={`${QA_EYEBROW} · ${project.project_ref}`}
        title={project.name}
        description={project.lot_code ?? "No lot"}
        metadata={
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="muted">{project.checklist_count} checklists</Badge>
            {project.hold_points_open > 0 ? (
              <Badge variant="warning">{project.hold_points_open} open hold points</Badge>
            ) : null}
            <SignoffBadge status={project.status} />
          </div>
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {canCapture ? (
              <Link
                href={`/qa/projects/${project.id}/checklists/new`}
                className="inline-flex items-center justify-center rounded-md border border-[var(--he-black)] bg-[var(--he-black)] px-3 py-1.5 text-sm font-medium text-white shadow-sm transition-colors hover:border-[var(--he-charcoal)] hover:bg-[var(--he-charcoal)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--he-yellow)]"
              >
                Start checklist
              </Link>
            ) : null}
            <PreviewAction title="QA report generation arrives in Phase 2">QA Report</PreviewAction>
          </div>
        }
      />

      {query.error ? <Alert variant="error">{query.error}</Alert> : null}

      {canManage ? (
        <Card>
          <SectionHeader title="Add section" description="Group checklists under a folder (e.g. PANEL, SiteQA). Manager-only." />
          <form action={createQaSectionAction} className="mt-3 grid items-end gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
            <input type="hidden" name="projectId" value={project.id} />
            <FormField label="Section name" htmlFor="section-name">
              <Input id="section-name" name="name" required placeholder="e.g. PANEL" />
            </FormField>
            <Button type="submit" variant="secondary">
              Add section
            </Button>
          </form>
        </Card>
      ) : null}

      {groups.length === 0 ? (
        <Card>
          <p className="text-sm text-zinc-500">
            {canCapture
              ? "No sections or checklists yet. Add a section, then start a checklist from a template."
              : "No checklists yet."}
          </p>
        </Card>
      ) : (
        groups.map((group) => (
          <div key={group.section?.id ?? "ungrouped"} className="space-y-2">
            <SectionHeader
              title={group.section?.name ?? "Ungrouped"}
              description={
                group.section
                  ? group.section.source_path.length > 0
                    ? `Folder: ${group.section.source_path.join(" / ")}`
                    : undefined
                  : "Checklists directly under the project"
              }
            />
            {group.checklists.length === 0 ? (
              <Card>
                <p className="text-sm text-zinc-500">No checklists in this section yet.</p>
              </Card>
            ) : (
              <Card className="divide-y divide-zinc-100 p-0">
                {group.checklists.map((checklist) => (
                  <RowLink key={checklist.id} href={`/qa/checklists/${checklist.id}`}>
                    <OperationalListRow
                      title={`${checklist.code} · ${checklist.title}`}
                      subtitle={`Template ${checklist.template_version}`}
                      metadata={
                        <>
                          {checklist.fail_count > 0 ? (
                            <Badge variant="danger">{checklist.fail_count} fail</Badge>
                          ) : null}
                          {checklist.pass_count > 0 ? (
                            <Badge variant="success">{checklist.pass_count} pass</Badge>
                          ) : null}
                          <SignoffBadge status={checklist.status} />
                          <span className="text-xs text-zinc-500">Updated {checklist.updated_at}</span>
                        </>
                      }
                    />
                  </RowLink>
                ))}
              </Card>
            )}
          </div>
        ))
      )}
    </PageContainer>
  );
}
