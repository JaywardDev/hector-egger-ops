"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  answerQaCheckItemAction,
  signOffQaChecklistAction,
} from "@/app/(protected)/qa/checklists/actions";
import { Alert } from "@/src/components/ui/alert";
import { Badge } from "@/src/components/ui/badge";
import { Card } from "@/src/components/ui/card";
import { ConfirmDialog } from "@/src/components/ui/confirm-dialog";
import { PendingActionButton } from "@/src/components/ui/pending-button";
import { StatusBadge } from "@/src/components/ui/status-badge";
import type { QaChecklistDetail, QaCheckItem, QaEvidence, QaHoldPoint, QaSignoffStatus } from "@/src/lib/qa/types";
import { cn } from "@/src/lib/utils";
import { SignoffBadge } from "../../components/qa-ui";

// Interactive capture surface for one checklist: answer select items
// (optimistic — the tap paints immediately, the save runs in the background and
// reverts visibly on failure), attach compressed photos per step, and sign off
// hold points. Everything locks once the checklist is signed off.

type CaptureClientProps = {
  checklist: QaChecklistDetail;
  canCapture: boolean;
  canSign: boolean;
};

const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 0.82;

async function compressImage(file: File): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) return file;
    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY));
    return blob ?? file;
  } catch {
    return file; // fall back to the original; the server caps size anyway
  }
}

function AnswerControl({
  item,
  value,
  disabled,
  onSelect,
}: {
  item: QaCheckItem;
  value: string | null;
  disabled: boolean;
  onSelect: (value: string | null) => void;
}) {
  const options = item.options ?? [];

  if (options.length > 3) {
    return (
      <select
        aria-label={item.label}
        className="w-full rounded-md border border-zinc-300 bg-white px-2 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-400 disabled:cursor-not-allowed disabled:opacity-60 sm:w-64"
        disabled={disabled}
        value={value ?? ""}
        onChange={(event) => onSelect(event.currentTarget.value || null)}
      >
        <option value="">Not answered</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    );
  }

  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label={item.label}>
      {options.map((option) => {
        const isSelected = value === option;
        const tone =
          option === "Yes"
            ? "border-green-600 bg-green-600 text-white"
            : option === "No"
              ? "border-red-600 bg-red-600 text-white"
              : "border-[var(--he-charcoal)] bg-[var(--he-charcoal)] text-white";
        return (
          <button
            key={option}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(isSelected ? null : option)}
            className={cn(
              "min-h-10 rounded-md border px-4 py-2 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--he-yellow)] disabled:cursor-not-allowed disabled:opacity-60",
              isSelected ? tone : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50",
            )}
          >
            {option}
          </button>
        );
      })}
    </div>
  );
}

function EvidenceTile({
  evidence,
  editable,
  onDelete,
}: {
  evidence: QaEvidence;
  editable: boolean;
  onDelete: () => void;
}) {
  return (
    <figure className="space-y-1">
      <div className="relative aspect-square overflow-hidden rounded-md border border-zinc-200 bg-zinc-50">
        {/* Served via the auth-gated evidence route; Next image optimization is
            bypassed on purpose (private, per-user content). */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img alt={evidence.caption} src={`/api/qa/evidence/${evidence.id}`} className="h-full w-full object-cover" loading="lazy" />
        {editable ? (
          <button
            type="button"
            aria-label="Remove photo"
            onClick={onDelete}
            className="absolute right-1 top-1 rounded-md bg-black/60 px-2 py-0.5 text-xs font-medium text-white hover:bg-black/80"
          >
            ✕
          </button>
        ) : null}
      </div>
      <figcaption className="space-y-0.5 text-xs text-zinc-500">
        <span className="block truncate">{evidence.added_by} · {evidence.added_at}</span>
      </figcaption>
    </figure>
  );
}

export function CaptureClient({ checklist, canCapture, canSign }: CaptureClientProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [status, setStatus] = useState<QaSignoffStatus>(checklist.status);
  const [answers, setAnswers] = useState<Record<string, string | null>>(() => {
    const initial: Record<string, string | null> = {};
    for (const step of checklist.steps) {
      for (const item of step.items) {
        if (item.record_id) initial[item.record_id] = item.selected_value ?? null;
      }
    }
    return initial;
  });
  const [evidenceByStep, setEvidenceByStep] = useState<Record<string, QaEvidence[]>>(() => {
    const initial: Record<string, QaEvidence[]> = {};
    for (const step of checklist.steps) initial[step.id] = step.evidence;
    return initial;
  });
  const [holdPoints, setHoldPoints] = useState<QaHoldPoint[]>(checklist.hold_points);
  const [error, setError] = useState<string | null>(null);
  const [uploadingStep, setUploadingStep] = useState<string | null>(null);
  const [confirmSignoff, setConfirmSignoff] = useState<QaHoldPoint | null>(null);
  const [signPending, setSignPending] = useState(false);
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({});

  const locked = status === "signed_off";
  const editable = canCapture && !locked;

  let passCount = 0;
  let failCount = 0;
  for (const value of Object.values(answers)) {
    if (value === "Yes") passCount += 1;
    else if (value === "No") failCount += 1;
  }

  const selectAnswer = (recordId: string, value: string | null) => {
    const previous = answers[recordId] ?? null;
    if (previous === value) return;
    setError(null);
    setAnswers((current) => ({ ...current, [recordId]: value }));
    if (status === "not_started") setStatus("in_progress");
    startTransition(async () => {
      const result = await answerQaCheckItemAction(recordId, value);
      if (!result.ok) {
        setAnswers((current) => ({ ...current, [recordId]: previous }));
        setError(result.message ?? "Could not save the answer.");
      }
    });
  };

  const uploadEvidence = async (stepId: string, file: File) => {
    setError(null);
    setUploadingStep(stepId);
    try {
      const blob = await compressImage(file);
      const response = await fetch(
        `/api/qa/evidence?checklistId=${checklist.id}&stepId=${encodeURIComponent(stepId)}`,
        { method: "POST", headers: { "Content-Type": blob.type || "image/jpeg" }, body: blob },
      );
      const payload = (await response.json().catch(() => null)) as
        | { ok: boolean; message?: string; evidence?: QaEvidence }
        | null;
      if (!response.ok || !payload?.ok || !payload.evidence) {
        setError(payload?.message ?? "Could not upload the photo.");
        return;
      }
      const evidence = payload.evidence;
      setEvidenceByStep((current) => ({ ...current, [stepId]: [...(current[stepId] ?? []), evidence] }));
    } catch {
      setError("Could not upload the photo. Check your connection and try again.");
    } finally {
      setUploadingStep(null);
    }
  };

  const deleteEvidence = async (stepId: string, evidenceId: string) => {
    setError(null);
    const previous = evidenceByStep[stepId] ?? [];
    setEvidenceByStep((current) => ({
      ...current,
      [stepId]: (current[stepId] ?? []).filter((row) => row.id !== evidenceId),
    }));
    const response = await fetch(`/api/qa/evidence/${evidenceId}`, { method: "DELETE" });
    if (!response.ok) {
      setEvidenceByStep((current) => ({ ...current, [stepId]: previous }));
      const payload = (await response.json().catch(() => null)) as { message?: string } | null;
      setError(payload?.message ?? "Could not remove the photo.");
    }
  };

  const performSignoff = async () => {
    if (!confirmSignoff) return;
    const target = confirmSignoff;
    setSignPending(true);
    setError(null);
    const result = await signOffQaChecklistAction(checklist.id, target.id);
    setSignPending(false);
    setConfirmSignoff(null);
    if (!result.ok) {
      setError(result.message ?? "Could not sign off.");
      return;
    }
    setHoldPoints((current) =>
      current.map((holdPoint) =>
        holdPoint.id === target.id ? { ...holdPoint, status: "signed_off" as const } : holdPoint,
      ),
    );
    if (result.checklistStatus === "signed_off") setStatus("signed_off");
    else if (result.checklistStatus === "awaiting_signoff") setStatus("awaiting_signoff");
    router.refresh();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <SignoffBadge status={status} />
        <Badge variant={failCount > 0 ? "danger" : "muted"}>Fail {failCount}</Badge>
        <Badge variant={passCount > 0 ? "success" : "muted"}>Pass {passCount}</Badge>
        {locked ? <StatusBadge tone="neutral" label="Locked — corrections require a new checklist" /> : null}
      </div>

      {error ? <Alert variant="error">{error}</Alert> : null}
      {!canCapture && !locked ? (
        <Alert variant="info">You have read-only access to this checklist.</Alert>
      ) : null}

      {checklist.steps.map((step) => (
        <Card key={step.id} className="space-y-3">
          <div className="flex items-center gap-2">
            <h3 className="font-medium text-zinc-900">{step.title}</h3>
            {step.checkpoint ? <Badge variant="attention">Checkpoint</Badge> : null}
          </div>

          <div className="divide-y divide-zinc-100 rounded-md border border-zinc-100">
            {step.items.map((item) => {
              if (item.type === "note") {
                return (
                  <div key={item.id} className="p-3 text-sm text-zinc-600">
                    📷 {item.label}
                  </div>
                );
              }
              if (item.type === "signoff") {
                return (
                  <div key={item.id} className="p-3 text-sm font-medium text-zinc-800">
                    {item.label}
                    <span className="ml-2 text-xs font-normal text-zinc-500">(sign-off below)</span>
                  </div>
                );
              }
              const recordId = item.record_id;
              return (
                <div key={item.id} className="grid gap-2 p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                  <span className="text-sm text-zinc-800">{item.label}</span>
                  <div className="sm:justify-self-end">
                    {recordId ? (
                      <AnswerControl
                        item={item}
                        value={answers[recordId] ?? null}
                        disabled={!editable}
                        onSelect={(value) => selectAnswer(recordId, value)}
                      />
                    ) : (
                      <StatusBadge tone="outline" label="Unavailable" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Evidence</p>
              {editable ? (
                <>
                  <input
                    ref={(element) => {
                      fileInputs.current[step.id] = element;
                    }}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={(event) => {
                      const file = event.currentTarget.files?.[0];
                      event.currentTarget.value = "";
                      if (file) void uploadEvidence(step.id, file);
                    }}
                  />
                  <PendingActionButton
                    variant="secondary"
                    size="sm"
                    isPending={uploadingStep === step.id}
                    pendingLabel="Uploading…"
                    onClick={() => fileInputs.current[step.id]?.click()}
                  >
                    Add photo
                  </PendingActionButton>
                </>
              ) : null}
            </div>
            {(evidenceByStep[step.id] ?? []).length > 0 ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {(evidenceByStep[step.id] ?? []).map((evidence) => (
                  <EvidenceTile
                    key={evidence.id}
                    evidence={evidence}
                    editable={editable}
                    onDelete={() => void deleteEvidence(step.id, evidence.id)}
                  />
                ))}
              </div>
            ) : (
              <p className="text-sm text-zinc-500">No photos attached yet.</p>
            )}
          </div>
        </Card>
      ))}

      {holdPoints.length > 0 ? (
        <div className="space-y-2">
          <h3 className="font-medium text-zinc-900">Sign-off</h3>
          <Card className="divide-y divide-zinc-100 p-0">
            {holdPoints.map((holdPoint) => (
              <div key={holdPoint.id} className="grid gap-2 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                <div className="min-w-0">
                  <span className="font-medium text-zinc-950">{holdPoint.label}</span>
                  {holdPoint.status === "signed_off" && holdPoint.signed_by ? (
                    <p className="mt-1 text-sm text-zinc-500">
                      Signed by {holdPoint.signed_by}
                      {holdPoint.signed_at ? ` · ${holdPoint.signed_at}` : ""}
                    </p>
                  ) : (
                    <p className="mt-1 text-sm text-zinc-500">Not yet signed</p>
                  )}
                </div>
                <div className="flex items-center gap-2 sm:justify-end">
                  <SignoffBadge status={holdPoint.status} />
                  {holdPoint.status !== "signed_off" && canSign && !locked ? (
                    <PendingActionButton
                      variant="primary"
                      isPending={signPending && confirmSignoff?.id === holdPoint.id}
                      pendingLabel="Signing…"
                      onClick={() => setConfirmSignoff(holdPoint)}
                    >
                      Sign off
                    </PendingActionButton>
                  ) : null}
                </div>
              </div>
            ))}
          </Card>
        </div>
      ) : null}

      <ConfirmDialog
        open={confirmSignoff !== null}
        title="Sign off this checklist?"
        description={
          confirmSignoff
            ? `"${confirmSignoff.label}" — signing off locks the checklist. Answers and photos can no longer be changed; corrections require a new checklist.`
            : ""
        }
        confirmLabel="Sign off"
        onConfirm={() => void performSignoff()}
        onCancel={() => setConfirmSignoff(null)}
      />
    </div>
  );
}
