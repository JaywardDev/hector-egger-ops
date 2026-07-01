import { Eye, Lock, StickyNote } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Card } from "@/src/components/ui/card";
import { StatusBadge, type StatusBadgeTone } from "@/src/components/ui/status-badge";
import type { QaCheckItem, QaEvidence, QaSignoffStatus } from "@/src/lib/qa/types";
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

// The chosen answer of a `select` item. Yes/No drive the pass/fail rollup;
// everything else (domain enums, N/A) is shown neutral/info.
export function ItemValue({ value }: { value: string | null | undefined }) {
  if (!value) return <StatusBadge tone="outline" label="Not answered" />;
  if (value === "Yes") return <StatusBadge tone="success" label="Yes" />;
  if (value === "No") return <StatusBadge tone="danger" label="No" />;
  if (value === "Not Applicable" || value === "N/A") {
    return <StatusBadge tone="neutral" label={value} />;
  }
  return <StatusBadge tone="info" label={value} />;
}

// Renders one template row by its type (select / note / signoff), matching the
// CONQA grammar (docs/qa-module-design.md §4.2).
export function StepItemRow({ item }: { item: QaCheckItem }) {
  if (item.type === "note") {
    return (
      <div className="flex items-start gap-2 p-3 text-sm text-zinc-600">
        <StickyNote aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-zinc-400" />
        <span>{item.label}</span>
      </div>
    );
  }

  if (item.type === "signoff") {
    return (
      <div className="grid gap-2 p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
        <span className="text-sm font-medium text-zinc-800">{item.label}</span>
        <div className="sm:justify-self-end">
          <PreviewAction>Sign off</PreviewAction>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-2 p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
      <div className="min-w-0">
        <span className="text-sm text-zinc-800">{item.label}</span>
        {item.options && item.options.length > 0 ? (
          <span className="mt-0.5 block truncate text-xs text-zinc-400">
            {item.options.join(" · ")}
          </span>
        ) : null}
      </div>
      <div className="sm:justify-self-end">
        <ItemValue value={item.selected_value} />
      </div>
    </div>
  );
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
