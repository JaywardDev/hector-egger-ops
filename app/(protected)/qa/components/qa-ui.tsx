import { Eye, Lock } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Card } from "@/src/components/ui/card";
import { StatusBadge, type StatusBadgeTone } from "@/src/components/ui/status-badge";
import type { QaCheckAnswer, QaEvidence, QaSignoffStatus } from "@/src/lib/qa/types";
import { cn } from "@/src/lib/utils";

// Small QA-local presentational helpers. Kept inside the QA route (rather than
// shared) so the module stays self-contained per the isolation principle in the
// design doc — nothing else in the app depends on QA, and QA leans only on the
// shared design-system primitives.

const SIGNOFF_BADGE: Record<QaSignoffStatus, { tone: StatusBadgeTone; label: string }> = {
  not_started: { tone: "neutral", label: "Not started" },
  in_progress: { tone: "info", label: "In progress" },
  awaiting_signoff: { tone: "warning", label: "Awaiting sign-off" },
  signed_off: { tone: "success", label: "Signed off" },
};

export function SignoffBadge({ status }: { status: QaSignoffStatus }) {
  const { tone, label } = SIGNOFF_BADGE[status];
  return <StatusBadge tone={tone} label={label} />;
}

export function AnswerBadge({ answer }: { answer: QaCheckAnswer }) {
  if (answer === "yes") return <StatusBadge tone="success" label="Yes" />;
  if (answer === "no") return <StatusBadge tone="danger" label="No" />;
  if (answer === "na") return <StatusBadge tone="neutral" label="N/A" />;
  return <StatusBadge tone="outline" label="Not answered" />;
}

export function BackLink({ href, children = "Back" }: { href: string; children?: ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1 text-sm font-medium text-zinc-600 transition-colors hover:text-zinc-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--he-yellow)]"
    >
      <span aria-hidden="true">←</span> {children}
    </Link>
  );
}

export function StatCard({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <Card>
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">{label}</p>
      <p className="mt-1 text-xl font-semibold text-zinc-900">{value}</p>
      {hint ? <p className="mt-0.5 text-xs text-zinc-500">{hint}</p> : null}
    </Card>
  );
}

// A disabled action styled like a real button — signals "this is where sign-off
// / report generation will live" without pretending to work in the preview.
export function PreviewAction({ children, title }: { children: ReactNode; title?: string }) {
  return (
    <span
      title={title ?? "Available once QA capture is wired up"}
      className="inline-flex cursor-not-allowed items-center gap-1.5 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-sm font-medium text-zinc-400"
    >
      <Lock aria-hidden="true" className="h-3.5 w-3.5" /> {children}
    </span>
  );
}

// Placeholder evidence tile — a dashed frame in place of the real photo, with
// the same caption/attribution a real thumbnail will carry.
export function EvidenceThumb({ evidence }: { evidence: QaEvidence }) {
  return (
    <figure className="space-y-1">
      <div className="flex aspect-square items-center justify-center rounded-md border border-dashed border-zinc-300 bg-zinc-50 text-zinc-400">
        <Eye aria-hidden="true" className="h-5 w-5" />
      </div>
      <figcaption className="space-y-0.5 text-xs text-zinc-500">
        <span className="block truncate font-medium text-zinc-700">{evidence.caption}</span>
        <span className="block truncate">
          {evidence.added_by} · {evidence.added_at}
        </span>
      </figcaption>
    </figure>
  );
}

// Anchor styled as a subtle list row, used to make server-rendered lists
// navigable (the shared OperationalListRow's clickable variant needs a client
// handler; wrapping a static row in a Link keeps these pages server components).
export function RowLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className={cn(
        "block transition-colors hover:bg-zinc-50",
        "focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--he-yellow)]",
      )}
    >
      {children}
    </Link>
  );
}
