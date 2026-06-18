import { createProductionReasonFormAction, updateProductionReasonFormAction } from "@/app/(protected)/production/actions";
import { PageContainer } from "@/src/components/layout/page-container";
import { PageHeader } from "@/src/components/layout/page-header";
import { Alert } from "@/src/components/ui/alert";
import { Button } from "@/src/components/ui/button";
import { Card } from "@/src/components/ui/card";
import { Input } from "@/src/components/ui/input";
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
  if (!hasProductionReasonAdminRole(roles)) return <PageContainer><PageHeader title="Production reasons" description="Admin access is required for reason management." /></PageContainer>;
  const renderList = (kind: "downtime" | "interruption", rows: typeof downtimeReasons) => <Card><p className="font-medium text-zinc-900">{kind === "downtime" ? "Downtime" : "Interruption"} reasons</p><div className="mt-3 space-y-2">{rows.map((reason) => <form key={reason.id} action={updateProductionReasonFormAction} className="flex items-center justify-between gap-2 rounded-md border border-zinc-200 p-2"><input type="hidden" name="kind" value={kind} /><input type="hidden" name="reason_id" value={reason.id} /><span>{reason.label}</span><select name="is_active" defaultValue={reason.is_active ? "true" : "false"} className="rounded-md border border-zinc-200 px-2 py-1"><option value="true">Active</option><option value="false">Inactive</option></select><Button type="submit" variant="secondary">Save</Button></form>)}</div></Card>;
  return <PageContainer><PageHeader title="Production reasons" description="Admin controlled downtime and interruption lookup values." />{messages.success ? <Alert variant="success">{messages.success}</Alert> : null}{messages.error ? <Alert variant="error">{messages.error}</Alert> : null}<Card><form action={createProductionReasonFormAction} className="grid gap-2 sm:grid-cols-[160px_minmax(0,1fr)_auto]"><select name="kind" className="rounded-md border border-zinc-200 px-2 py-2"><option value="downtime">Downtime</option><option value="interruption">Interruption</option></select><Input name="label" required placeholder="Reason label" /><Button type="submit">Add reason</Button></form></Card>{renderList("downtime", downtimeReasons)}{renderList("interruption", interruptionReasons)}</PageContainer>;
}
