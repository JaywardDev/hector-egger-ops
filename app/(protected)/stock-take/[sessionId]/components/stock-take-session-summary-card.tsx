import Link from "next/link";
import type { ReactNode } from "react";
import { PageHeader } from "@/src/components/layout/page-header";
import { Stack } from "@/src/components/layout/stack";
import { Badge } from "@/src/components/ui/badge";
import { Card } from "@/src/components/ui/card";
import { Alert } from "@/src/components/ui/alert";

type SessionStatus = "draft" | "in_progress" | "submitted" | "reviewed" | "closed";

const statusBadgeVariantByStatus: Record<SessionStatus, "neutral" | "info" | "warning" | "accent" | "success"> = {
  draft: "neutral",
  in_progress: "info",
  submitted: "warning",
  reviewed: "accent",
  closed: "success",
};

const formatLocationLabel = (location: { name: string; code: string | null }) =>
  location.code ? `${location.name} (${location.code})` : location.name;

const formatTimestamp = (value: string | null) => value ?? "—";

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
  return (
    <Card>
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <Stack gap="sm">
          <PageHeader title={title} />
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-zinc-600">Status:</span>
            <Badge variant={statusBadgeVariantByStatus[status]}>{status}</Badge>
          </div>
          <p className="text-zinc-600">
            Default location: {stockLocation ? formatLocationLabel(stockLocation) : "None"}
          </p>
          <p>Notes: {notes ?? "—"}</p>
          <p>Started at: {formatTimestamp(startedAt)}</p>
          <p>Submitted at: {formatTimestamp(submittedAt)}</p>
          <p>Reviewed at: {formatTimestamp(reviewedAt)}</p>
          <p>Closed at: {formatTimestamp(closedAt)}</p>
        </Stack>

        <Stack gap="sm" className="md:min-w-52">
          <h3 className="font-medium text-zinc-900">Session actions</h3>
          {!canTransitionStatus ? (
            <Alert>Only supervisors and admins can change session status.</Alert>
          ) : !hasNextTransition ? (
            <Alert>No further status actions available.</Alert>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/stock-take/${sessionId}/export`}
              className="inline-flex rounded-md border border-zinc-300 px-3 py-1.5 text-zinc-800 hover:bg-zinc-100"
            >
              Export Excel
            </Link>
            <Link
              href="/stock-take"
              className="inline-flex rounded-md border border-zinc-300 px-3 py-1.5 text-zinc-800 hover:bg-zinc-100"
            >
              Back to sessions
            </Link>
          </div>
          {deleteAction}
        </Stack>
      </div>
    </Card>
  );
}
