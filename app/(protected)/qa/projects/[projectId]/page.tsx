import { notFound } from "next/navigation";
import { Badge } from "@/src/components/ui/badge";
import { Card } from "@/src/components/ui/card";
import { OperationalListRow } from "@/src/components/ui/operational-list-row";
import { PageContainer } from "@/src/components/layout/page-container";
import { PageHeader } from "@/src/components/layout/page-header";
import { SectionHeader } from "@/src/components/layout/section-header";
import { requireQaReadAccess } from "@/src/lib/qa/access";
import { getQaProjectDetail } from "@/src/lib/qa/projects";
import type { QaChecklistSummary, QaSection } from "@/src/lib/qa/types";
import { QA_EYEBROW } from "@/src/lib/qa/ui-contract";
import { BackLink, PreviewAction, RowLink, SignoffBadge } from "../../components/qa-ui";

type QaProjectPageProps = {
  params: Promise<{ projectId: string }>;
};

// A section plus the checklists that belong to it (grouping is one level deep;
// "Ungrouped" collects checklists that hang directly off the project).
type ChecklistGroup = { section: QaSection | null; checklists: QaChecklistSummary[] };

function groupChecklists(
  sections: QaSection[],
  checklists: QaChecklistSummary[],
): ChecklistGroup[] {
  const groups: ChecklistGroup[] = sections.map((section) => ({
    section,
    checklists: checklists.filter((checklist) => checklist.section_id === section.id),
  }));
  const ungrouped = checklists.filter((checklist) => checklist.section_id === null);
  if (ungrouped.length > 0) {
    groups.push({ section: null, checklists: ungrouped });
  }
  return groups.filter((group) => group.checklists.length > 0);
}

export default async function QaProjectPage({ params }: QaProjectPageProps) {
  const { projectId } = await params;
  const route = "/qa/projects";
  const { session } = await requireQaReadAccess(route);

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
        actions={<PreviewAction title="QA report generation arrives in Phase 2">QA Report</PreviewAction>}
      />

      {groups.length === 0 ? (
        <Card>
          <p className="text-sm text-zinc-500">
            This project has no checklists yet. Sections and checklists are mirrored from C-base.
          </p>
        </Card>
      ) : (
        groups.map((group) => (
          <div key={group.section?.id ?? "ungrouped"} className="space-y-2">
            <SectionHeader
              title={group.section?.name ?? "Ungrouped"}
              description={
                group.section
                  ? `Folder: ${group.section.source_path.join(" / ")}`
                  : "Checklists directly under the project"
              }
            />
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
          </div>
        ))
      )}
    </PageContainer>
  );
}
