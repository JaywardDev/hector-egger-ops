import { notFound } from "next/navigation";
import { Badge } from "@/src/components/ui/badge";
import { Card } from "@/src/components/ui/card";
import { PageContainer } from "@/src/components/layout/page-container";
import { PageHeader } from "@/src/components/layout/page-header";
import { requireQaReadAccess } from "@/src/lib/qa/access";
import { getQaChecklist } from "@/src/lib/qa/preview-data";
import type { QaHoldPoint } from "@/src/lib/qa/types";
import { QA_EYEBROW } from "@/src/lib/qa/ui-contract";
import {
  AnswerBadge,
  BackLink,
  EvidenceThumb,
  PreviewAction,
  SignoffBadge,
} from "../../components/qa-ui";

type QaChecklistPageProps = {
  params: Promise<{ checklistId: string }>;
};

function HoldPointRow({ holdPoint }: { holdPoint: QaHoldPoint }) {
  return (
    <div className="grid gap-2 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-zinc-950">{holdPoint.label}</span>
          <Badge variant={holdPoint.kind === "hold" ? "attention" : "info"}>
            {holdPoint.kind === "hold" ? "Hold point" : "Witness point"}
          </Badge>
        </div>
        {holdPoint.signed_by ? (
          <p className="mt-1 text-sm text-zinc-500">
            Signed by {holdPoint.signed_by} · {holdPoint.signed_at}
          </p>
        ) : (
          <p className="mt-1 text-sm text-zinc-500">Not yet signed</p>
        )}
      </div>
      <div className="flex items-center gap-2 sm:justify-end">
        <SignoffBadge status={holdPoint.status} />
        {holdPoint.status !== "signed_off" ? <PreviewAction>Sign off</PreviewAction> : null}
      </div>
    </div>
  );
}

export default async function QaChecklistPage({ params }: QaChecklistPageProps) {
  const { checklistId } = await params;
  const route = "/qa/checklists";
  await requireQaReadAccess(route);

  const checklist = getQaChecklist(checklistId);
  if (!checklist) {
    notFound();
  }

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
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <SignoffBadge status={checklist.status} />
            <PreviewAction title="QA report generation arrives in Phase 2">QA Report</PreviewAction>
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={checklist.fail_count > 0 ? "danger" : "muted"}>
          Fail {checklist.fail_count}
        </Badge>
        <Badge variant={checklist.pass_count > 0 ? "success" : "muted"}>
          Pass {checklist.pass_count}
        </Badge>
      </div>

      {checklist.steps.map((step) => (
        <Card key={step.id} className="space-y-3">
          <div className="space-y-0.5">
            <h3 className="font-medium text-zinc-900">{step.title}</h3>
            {step.instruction ? <p className="text-sm text-zinc-600">{step.instruction}</p> : null}
          </div>

          <div className="divide-y divide-zinc-100 rounded-md border border-zinc-100">
            {step.items.map((item) => (
              <div
                key={item.id}
                className="grid gap-2 p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
              >
                <span className="text-sm text-zinc-800">{item.label}</span>
                <div className="sm:justify-self-end">
                  <AnswerBadge answer={item.answer} />
                </div>
              </div>
            ))}
          </div>

          {step.evidence.length > 0 ? (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Evidence
              </p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {step.evidence.map((evidence) => (
                  <EvidenceThumb key={evidence.id} evidence={evidence} />
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-zinc-500">No evidence attached yet.</p>
          )}
        </Card>
      ))}

      {checklist.hold_points.length > 0 ? (
        <div className="space-y-2">
          <h3 className="font-medium text-zinc-900">Hold &amp; witness points</h3>
          <Card className="divide-y divide-zinc-100 p-0">
            {checklist.hold_points.map((holdPoint) => (
              <HoldPointRow key={holdPoint.id} holdPoint={holdPoint} />
            ))}
          </Card>
        </div>
      ) : null}
    </PageContainer>
  );
}
