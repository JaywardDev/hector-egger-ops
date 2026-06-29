import {
  createProductionReasonFormAction,
  updateProductionReasonFormAction,
} from "@/app/(protected)/production/actions";
import { BackLink } from "@/app/(protected)/production/components/production-ui";
import { PageContainer } from "@/src/components/layout/page-container";
import { PageHeader } from "@/src/components/layout/page-header";
import { Alert } from "@/src/components/ui/alert";
import { Card } from "@/src/components/ui/card";
import { FormField } from "@/src/components/ui/form-field";
import { Input } from "@/src/components/ui/input";
import { PendingSubmitButton } from "@/src/components/ui/pending-button";
import { Select } from "@/src/components/ui/select";
import { requireProtectedAccess } from "@/src/lib/auth/guards";
import { hasProductionReasonAdminRole } from "@/src/lib/production/access";
import { listProductionDowntimeReasons, listProductionInterruptionReasons } from "@/src/lib/production/reasons";

type Props = { searchParams: Promise<{ success?: string; error?: string }> };

export default async function ProductionReasonsPage({ searchParams }: Props) {
  const route = "/production/reasons";
  const { session, roles } = await requireProtectedAccess(route);
  const [messages, downtimeReasons, interruptionReasons] = await Promise.all([
    searchParams,
    listProductionDowntimeReasons({ session, accessContext: { accountStatus: "approved", roles }, route }),
    listProductionInterruptionReasons({ session, accessContext: { accountStatus: "approved", roles }, route }),
  ]);

  if (!hasProductionReasonAdminRole(roles)) {
    return (
      <PageContainer>
        <PageHeader title="Production reasons" description="Admin access is required for reason management." />
      </PageContainer>
    );
  }

  const renderList = (kind: "downtime" | "interruption", rows: typeof downtimeReasons) => (
    <Card className="space-y-3">
      <h3 className="font-medium text-zinc-900">{kind === "downtime" ? "Downtime" : "Interruption"} reasons</h3>
      <div className="space-y-2">
        {rows.length === 0 ? <p className="text-sm text-zinc-500">No reasons yet.</p> : null}
        {rows.map((reason) => (
          <form
            key={reason.id}
            action={updateProductionReasonFormAction}
            className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-zinc-200 p-2"
          >
            <input type="hidden" name="kind" value={kind} />
            <input type="hidden" name="reason_id" value={reason.id} />
            <span className="min-w-0 flex-1 truncate text-zinc-900">{reason.label}</span>
            <Select name="is_active" defaultValue={reason.is_active ? "true" : "false"} className="w-auto">
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </Select>
            <PendingSubmitButton type="submit" variant="secondary">
              Save
            </PendingSubmitButton>
          </form>
        ))}
      </div>
    </Card>
  );

  return (
    <PageContainer>
      <BackLink href="/production">Back to dashboard</BackLink>
      <PageHeader
        accent
        eyebrow="Production"
        title="Production reasons"
        description="Admin controlled downtime and interruption lookup values."
      />
      {messages.success ? <Alert variant="success">{messages.success}</Alert> : null}
      {messages.error ? <Alert variant="error">{messages.error}</Alert> : null}

      <Card>
        <form action={createProductionReasonFormAction} className="grid items-end gap-3 sm:grid-cols-[160px_minmax(0,1fr)_auto]">
          <FormField label="Type" htmlFor="kind">
            <Select id="kind" name="kind">
              <option value="downtime">Downtime</option>
              <option value="interruption">Interruption</option>
            </Select>
          </FormField>
          <FormField label="Label" htmlFor="label">
            <Input id="label" name="label" required placeholder="Reason label" />
          </FormField>
          <PendingSubmitButton type="submit">Add reason</PendingSubmitButton>
        </form>
      </Card>

      {renderList("downtime", downtimeReasons)}
      {renderList("interruption", interruptionReasons)}
    </PageContainer>
  );
}
