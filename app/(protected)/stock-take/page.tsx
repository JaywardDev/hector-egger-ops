import Link from "next/link";
import { createStockTakeSessionAction } from "@/app/(protected)/stock-take/actions";
import { DeleteEmptyDraftForm } from "@/app/(protected)/stock-take/delete-empty-draft-form";
import { PageContainer } from "@/src/components/layout/page-container";
import { PageHeader } from "@/src/components/layout/page-header";
import { SectionHeader } from "@/src/components/layout/section-header";
import { Stack } from "@/src/components/layout/stack";
import { Alert } from "@/src/components/ui/alert";
import { Badge } from "@/src/components/ui/badge";
import { Button } from "@/src/components/ui/button";
import { Card } from "@/src/components/ui/card";
import { FormField } from "@/src/components/ui/form-field";
import { Label } from "@/src/components/ui/label";
import { Select } from "@/src/components/ui/select";
import { Textarea } from "@/src/components/ui/textarea";
import {
  hasSupervisorOrAdminRole,
  requireProtectedAccess,
} from "@/src/lib/auth/guards";
import { listStockLocations } from "@/src/lib/inventory/locations";
import { withServerTiming } from "@/src/lib/server-timing";
import { listStockTakeSessions } from "@/src/lib/stock-take/sessions";

type StockTakePageProps = {
  searchParams: Promise<{
    success?: string;
    error?: string;
  }>;
};

const statusBadgeVariant = {
  draft: "neutral",
  in_progress: "info",
  submitted: "warning",
  reviewed: "accent",
  closed: "success",
} as const;

const formatLocationLabel = (location: { name: string; code: string | null }) =>
  location.code ? `${location.name} (${location.code})` : location.name;

export default async function StockTakePage({
  searchParams,
}: StockTakePageProps) {
  const route = "/stock-take";

  return withServerTiming({
    name: "StockTakePage",
    route,
    operation: async () => {
      const { session, roles } = await requireProtectedAccess(route);
      const [stockTakeSessions, stockLocations, params] = await Promise.all([
        listStockTakeSessions({
          session,
          accessContext: { accountStatus: "approved", roles },
          route,
        }),
        listStockLocations({ session, route }),
        searchParams,
      ]);
      const canCreateSessions = hasSupervisorOrAdminRole(roles);
      const canDeleteEmptyDraft = hasSupervisorOrAdminRole(roles);

      return (
        <PageContainer>
          <PageHeader
            title="Stock Take"
            description="Create and manage stock-take sessions."
          />

          {params.success ? <Alert variant="success">{params.success}</Alert> : null}
          {params.error ? <Alert variant="error">{params.error}</Alert> : null}

          {canCreateSessions ? (
            <details className="rounded-md border border-zinc-200 bg-white p-3">
              <summary className="cursor-pointer list-none font-medium text-zinc-900">
                Start new stock take
              </summary>
              <form action={createStockTakeSessionAction} className="mt-3 space-y-2">
                <div className="grid gap-2 md:grid-cols-2">
                  <FormField>
                    <Label htmlFor="stock-location">Default location</Label>
                    <Select id="stock-location" name="stockLocationId" defaultValue="">
                      <option value="">No default location</option>
                      {stockLocations.map((location) => (
                        <option key={location.id} value={location.id}>
                          {formatLocationLabel(location)}
                        </option>
                      ))}
                    </Select>
                  </FormField>
                  <Alert variant="info" className="text-xs md:self-end">
                    Session title is generated automatically when the session is created.
                  </Alert>
                  <FormField className="md:col-span-2">
                    <Label htmlFor="new-session-notes">Notes</Label>
                    <Textarea
                      id="new-session-notes"
                      name="notes"
                      placeholder="Notes (optional)"
                      rows={3}
                    />
                  </FormField>
                </div>
                <Button type="submit" className="w-full sm:w-auto">
                  Start stock take
                </Button>
              </form>
            </details>
          ) : (
            <Alert>
              You can review stock take sessions, but only supervisors and admins can create them.
            </Alert>
          )}

          <Stack gap="sm">
            <SectionHeader title="Sessions" />
            {stockTakeSessions.length === 0 ? (
              <Card>No stock take sessions yet.</Card>
            ) : (
              <Stack>
                {stockTakeSessions.map((stockTakeSession) => (
                  <Card key={stockTakeSession.id}>
                    <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                      <div className="space-y-1">
                        <p className="font-medium text-zinc-900">{stockTakeSession.title}</p>
                        <div className="flex flex-wrap items-center gap-2">
                          <span>Status:</span>
                          <Badge variant={statusBadgeVariant[stockTakeSession.status]}>
                            {stockTakeSession.status}
                          </Badge>
                        </div>
                        <p>
                          Default location:{" "}
                          {stockTakeSession.stock_location
                            ? formatLocationLabel(stockTakeSession.stock_location)
                            : "None"}
                        </p>
                        {stockTakeSession.notes ? <p>Notes: {stockTakeSession.notes}</p> : null}
                      </div>
                      <div className="flex flex-col gap-2 sm:flex-row md:flex-col">
                        <Link
                          href={`/stock-take/${stockTakeSession.id}`}
                          className="inline-flex w-full items-center justify-center rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-800 transition-colors hover:bg-zinc-100 sm:w-auto"
                        >
                          Open session
                        </Link>
                        {canDeleteEmptyDraft && stockTakeSession.status === "draft" ? (
                          <DeleteEmptyDraftForm sessionId={stockTakeSession.id} />
                        ) : null}
                      </div>
                    </div>
                  </Card>
                ))}
              </Stack>
            )}
          </Stack>
        </PageContainer>
      );
    },
  });
}
