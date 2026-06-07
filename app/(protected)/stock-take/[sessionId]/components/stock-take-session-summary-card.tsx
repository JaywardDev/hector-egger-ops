import Link from "next/link";
import type { ReactNode } from "react";
import { Badge } from "@/src/components/ui/badge";
import { Alert } from "@/src/components/ui/alert";
import { Card } from "@/src/components/ui/card";
import { formatNzDateTime } from "@/src/lib/dateTime";

type SessionStatus = "draft" | "in_progress" | "submitted" | "reviewed" | "closed";

const statusBadgeVariantByStatus: Record<SessionStatus, "neutral" | "info" | "warning" | "accent" | "success"> = {
  draft: "neutral",
  in_progress: "info",
  submitted: "warning",
  reviewed: "accent",
  closed: "success",
};

const statusLabel: Record<SessionStatus, string> = {
  draft: "Draft",
  in_progress: "In progress",
  submitted: "Submitted",
  reviewed: "Reviewed",
  closed: "Closed",
};

const formatLocationLabel = (location: { name: string; code: string | null }) =>
  location.code ? `${location.name} (${location.code})` : location.name;

type StockTakeSessionSummaryCardProps = {
  sessionId: string;
  title: string;
  status: SessionStatus;
  stockLocation: { name: string; code: string | null } | null;
  notes: string | null;
  startedAt: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  closedAt: string | null;
  canTransitionStatus: boolean;
  hasNextTransition: boolean;
  deleteAction?: ReactNode;
};

export function StockTakeSessionSummaryCard({
  sessionId,
  title,
  status,
  stockLocation,
  notes,
  startedAt,
  submittedAt,
  reviewedAt,
  closedAt,
  canTransitionStatus,
  hasNextTransition,
  deleteAction,
}: StockTakeSessionSummaryCardProps) {
  const timestamps = [
    startedAt ? `Started ${formatNzDateTime(startedAt)}` : null,
    submittedAt ? `Submitted ${formatNzDateTime(submittedAt)}` : null,
    reviewedAt ? `Reviewed ${formatNzDateTime(reviewedAt)}` : null,
    closedAt ? `Closed ${formatNzDateTime(closedAt)}` : null,
  ].filter(Boolean);

  return (
    <Card className="py-3">
      <div className="space-y-2">
        {/* Row 1: title + status + action links */}
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-base font-semibold text-zinc-900">{title}</h1>
            <Badge variant={statusBadgeVariantByStatus[status]}>{statusLabel[status]}</Badge>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/stock-take/${sessionId}/export`}
              className="inline-flex rounded-md border border-zinc-300 px-2.5 py-1 text-xs text-zinc-700 hover:bg-zinc-50"
            >
              Export Excel
            </Link>
            <Link
              href="/stock-take"
              className="inline-flex rounded-md border border-zinc-300 px-2.5 py-1 text-xs text-zinc-700 hover:bg-zinc-50"
            >
              All sessions
            </Link>
            {deleteAction}
          </div>
        </div>

        {/* Row 2: location + notes */}
        {(stockLocation || notes) ? (
          <p className="text-xs text-zinc-500">
            {stockLocation ? formatLocationLabel(stockLocation) : "No default location"}
            {notes ? ` · ${notes}` : ""}
          </p>
        ) : null}

        {/* Row 3: timestamps (only non-null) */}
        {timestamps.length > 0 ? (
          <p className="text-xs text-zinc-400">{timestamps.join(" · ")}</p>
        ) : null}

        {/* Permission alerts */}
        {!canTransitionStatus ? (
          <Alert>Only supervisors and admins can change session status.</Alert>
        ) : !hasNextTransition ? (
          <Alert>No further status actions available.</Alert>
        ) : null}
      </div>
    </Card>
  );
}
