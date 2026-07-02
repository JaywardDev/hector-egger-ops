import { notFound } from "next/navigation";
import { Badge } from "@/src/components/ui/badge";
import { PageContainer } from "@/src/components/layout/page-container";
import { PageHeader } from "@/src/components/layout/page-header";
import { isAdmin, isAdminOrSupervisor, isOperator } from "@/src/lib/permissions/roles";
import { requireQaReadAccess } from "@/src/lib/qa/access";
import { getQaChecklistDetail } from "@/src/lib/qa/checklists";
import { QA_EYEBROW } from "@/src/lib/qa/ui-contract";
import { BackLink, PreviewAction } from "../../components/qa-ui";
import { CaptureClient } from "./capture-client";

type QaChecklistPageProps = {
  params: Promise<{ checklistId: string }>;
};

export default async function QaChecklistPage({ params }: QaChecklistPageProps) {
  const { checklistId } = await params;
  const route = "/qa/checklists";
  const { session, roles } = await requireQaReadAccess(route);

  const checklist = await getQaChecklistDetail(session, checklistId);
  if (!checklist) {
    notFound();
  }

  const canCapture = isAdminOrSupervisor({ roles }) || isOperator({ roles });
  // Sign-off authority is admin/supervisor until the C-base-driven per-hold-point
  // model lands (design §3); isAdmin kept explicit for readability.
  const canSign = isAdmin({ roles }) || isAdminOrSupervisor({ roles });

  return (
    <PageContainer>
      <BackLink href={`/qa/projects/${checklist.project_id}`}>
        Back to {checklist.project_ref} · {checklist.project_name}
      </BackLink>

      <PageHeader
        accent
        eyebrow={`${QA_EYEBROW} · ${checklist.code}`}
        title={checklist.title}
        metadata={
          <div className="flex flex-wrap items-center gap-2 text-sm text-zinc-500">
            <span>
              {checklist.project_ref} · {checklist.project_name}
            </span>
            {checklist.lot_code ? <span>· {checklist.lot_code}</span> : null}
            {checklist.section_name ? <span>· {checklist.section_name}</span> : null}
            <Badge variant="muted">Template {checklist.template_version}</Badge>
          </div>
        }
        actions={<PreviewAction title="QA report generation arrives in Phase 2">QA Report</PreviewAction>}
      />

      <CaptureClient checklist={checklist} canCapture={canCapture} canSign={canSign} />
    </PageContainer>
  );
}
