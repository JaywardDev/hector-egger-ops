import { PageContainer } from "@/src/components/layout/page-container";
import { PageHeader } from "@/src/components/layout/page-header";
import { SectionHeader } from "@/src/components/layout/section-header";
import { Stack } from "@/src/components/layout/stack";
import { Alert } from "@/src/components/ui/alert";
import { Badge } from "@/src/components/ui/badge";
import { Button } from "@/src/components/ui/button";
import { Card } from "@/src/components/ui/card";
import { FormField } from "@/src/components/ui/form-field";
import { Input } from "@/src/components/ui/input";
import { Select } from "@/src/components/ui/select";
import { Textarea } from "@/src/components/ui/textarea";
import {
  mockApprovalRows,
  mockKpis,
  mockProjectInventoryRows,
  mockTimesheetRows,
  mockUsers,
} from "./fixtures";

const badgeVariantByStatus = {
  Approved: "success",
  Submitted: "info",
  Draft: "neutral",
  Pending: "warning",
  Disabled: "danger",
  Ready: "success",
  Blocked: "danger",
  Queued: "warning",
  High: "danger",
  Medium: "warning",
  Low: "success",
} as const;

const kpiBadgeVariant = {
  warning: "warning",
  success: "success",
  danger: "danger",
  info: "info",
} as const;

type BadgeStatus = keyof typeof badgeVariantByStatus;

export function PreviewContent() {
  return (
    <PageContainer className="space-y-6">
      <PageHeader
        title="UI preview sandbox"
        description="Development-only mock screen for redesigning the app shell, shared layout primitives, and dense operations views without Supabase or real user data."
      >
        <div className="flex flex-wrap gap-2 pt-2">
          <Badge variant="accent">Local preview</Badge>
          <Badge variant="success">Mock data only</Badge>
          <Badge variant="warning">No server actions</Badge>
        </div>
      </PageHeader>

      <Alert variant="info">
        This sandbox is intentionally isolated from protected routes. Controls are static, disabled, or type=&quot;button&quot; only.
      </Alert>

      <DashboardKpis />
      <DenseOperationsLayout />
      <TableLayout />
      <FormLayout />
      <AlertAndBadgeStates />
      <EmptyStateCard />
    </PageContainer>
  );
}

function DashboardKpis() {
  return (
    <section className="space-y-3">
      <SectionHeader
        title="Dashboard KPI cards"
        description="Compact cards with labels, totals, trend copy, and state colors."
      />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {mockKpis.map((kpi) => (
          <Card key={kpi.label} className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">{kpi.label}</p>
              <Badge variant={kpiBadgeVariant[kpi.tone]}>{kpi.trend}</Badge>
            </div>
            <p className="text-3xl font-semibold text-zinc-950">{kpi.value}</p>
            <div className="h-2 rounded-full bg-zinc-100">
              <div className="h-2 w-2/3 rounded-full bg-[var(--he-yellow)]" />
            </div>
          </Card>
        ))}
      </div>
    </section>
  );
}

function DenseOperationsLayout() {
  return (
    <section className="space-y-3">
      <SectionHeader
        title="Dense operations layout"
        description="A high-density work queue layout for judging spacing, hierarchy, and scanability."
      />
      <div className="grid gap-3 xl:grid-cols-[1.4fr_0.8fr]">
        <Card className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-zinc-900">Today&apos;s review queue</p>
              <p className="text-xs text-zinc-600">Mock approvals grouped by operational urgency.</p>
            </div>
            <div className="flex gap-2">
              <Button type="button" size="sm" variant="secondary">Filter</Button>
              <Button type="button" size="sm" disabled>Apply changes</Button>
            </div>
          </div>
          <div className="divide-y divide-zinc-100 rounded-md border border-zinc-200">
            {mockApprovalRows.map((row) => (
              <div key={row.id} className="grid gap-2 p-3 sm:grid-cols-[1fr_auto] sm:items-center">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-zinc-900">{row.item}</p>
                    <Badge variant={badgeVariant(row.state)}>{row.state}</Badge>
                    <Badge variant={badgeVariant(row.risk)}>{row.risk} risk</Badge>
                  </div>
                  <p className="mt-1 text-xs text-zinc-600">{row.owner} · submitted {row.submittedAt} · {row.id}</p>
                </div>
                <Button type="button" size="sm" variant="ghost">Preview</Button>
              </div>
            ))}
          </div>
        </Card>

        <Card className="space-y-3">
          <SectionHeader title="Shift snapshot" description="Narrow side-card treatment." />
          <Stack gap="sm">
            {mockUsers.map((user) => (
              <div key={user.id} className="rounded-md border border-zinc-200 bg-zinc-50 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium text-zinc-900">{user.name}</p>
                  <Badge variant={badgeVariant(user.status)}>{user.status}</Badge>
                </div>
                <p className="mt-1 text-xs text-zinc-600">{user.email}</p>
                <p className="text-xs text-zinc-500">{user.role} · {user.crew}</p>
              </div>
            ))}
          </Stack>
        </Card>
      </div>
    </section>
  );
}

function TableLayout() {
  return (
    <section className="space-y-3">
      <SectionHeader title="Table layout" description="Mock timesheets and inventory rows for table density tests." />
      <div className="grid gap-3 xl:grid-cols-2">
        <Card className="overflow-hidden p-0">
          <TableTitle title="Timesheet rows" description="Static worker-hour data." />
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-zinc-200 text-left text-sm">
              <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500">
                <tr>
                  <th className="px-3 py-2 font-medium">Worker</th>
                  <th className="px-3 py-2 font-medium">Date</th>
                  <th className="px-3 py-2 font-medium">Hours</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 bg-white">
                {mockTimesheetRows.map((row) => (
                  <tr key={row.id}>
                    <td className="px-3 py-2">
                      <p className="font-medium text-zinc-900">{row.worker}</p>
                      <p className="text-xs text-zinc-500">{row.project}</p>
                    </td>
                    <td className="px-3 py-2 text-zinc-600">{row.date}</td>
                    <td className="px-3 py-2 text-zinc-900">{row.hours}</td>
                    <td className="px-3 py-2"><Badge variant={badgeVariant(row.status)}>{row.status}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="overflow-hidden p-0">
          <TableTitle title="Project inventory" description="Static material-location data." />
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-zinc-200 text-left text-sm">
              <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500">
                <tr>
                  <th className="px-3 py-2 font-medium">Code</th>
                  <th className="px-3 py-2 font-medium">Material</th>
                  <th className="px-3 py-2 font-medium">Location</th>
                  <th className="px-3 py-2 font-medium">Qty</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 bg-white">
                {mockProjectInventoryRows.map((row) => (
                  <tr key={row.id}>
                    <td className="px-3 py-2 font-mono text-xs text-zinc-700">{row.code}</td>
                    <td className="px-3 py-2">
                      <p className="font-medium text-zinc-900">{row.material}</p>
                      <p className="text-xs text-zinc-500">{row.project}</p>
                    </td>
                    <td className="px-3 py-2 text-zinc-600">{row.location}</td>
                    <td className="px-3 py-2 text-zinc-900">{row.quantity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </section>
  );
}

function FormLayout() {
  return (
    <section className="space-y-3">
      <SectionHeader title="Form layout" description="Static controls only; no action, API call, or server action is wired." />
      <Card className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2">
          <FormField label="Mock project" htmlFor="preview-project" helperText="Uses static preview options.">
            <Select id="preview-project" defaultValue="he-2401">
              <option value="he-2401">Mock Project HE-2401</option>
              <option value="he-2418">Mock Project HE-2418</option>
              <option value="he-2422">Mock Project HE-2422</option>
            </Select>
          </FormField>
          <FormField label="Reference" htmlFor="preview-reference">
            <Input id="preview-reference" defaultValue="MOCK-REF-042" />
          </FormField>
          <FormField label="Assigned operator" htmlFor="preview-operator">
            <Select id="preview-operator" defaultValue="noah.operator@example.test">
              {mockUsers.map((user) => (
                <option key={user.id} value={user.email}>{user.name} · {user.email}</option>
              ))}
            </Select>
          </FormField>
          <FormField label="Planned date" htmlFor="preview-date" errorText="Mock validation state example only.">
            <Input id="preview-date" type="date" defaultValue="2026-05-13" />
          </FormField>
        </div>
        <FormField label="Preview notes" htmlFor="preview-notes" helperText="This textarea is not persisted.">
          <Textarea id="preview-notes" rows={4} defaultValue="Mock note for testing vertical rhythm, long labels, and form helper text." />
        </FormField>
        <div className="flex flex-wrap gap-2">
          <Button type="button">No-op primary</Button>
          <Button type="button" variant="secondary">Secondary</Button>
          <Button type="button" variant="danger">Danger</Button>
          <Button type="button" disabled>Disabled submit</Button>
        </div>
      </Card>
    </section>
  );
}

function AlertAndBadgeStates() {
  return (
    <section className="space-y-3">
      <SectionHeader title="Alert and badge states" description="All shared badge and alert variants in one place." />
      <div className="grid gap-3 lg:grid-cols-2">
        <Card className="space-y-2">
          <Alert variant="success">Success alert: mock approval saved locally.</Alert>
          <Alert variant="warning">Warning alert: mock queue is approaching the review threshold.</Alert>
          <Alert variant="error">Error alert: sample destructive state with no real side effects.</Alert>
          <Alert variant="info">Info alert: static guidance for preview-only workflows.</Alert>
        </Card>
        <Card className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Badge variant="neutral">Neutral</Badge>
            <Badge variant="info">Info</Badge>
            <Badge variant="warning">Warning</Badge>
            <Badge variant="accent">Accent</Badge>
            <Badge variant="success">Success</Badge>
            <Badge variant="danger">Danger</Badge>
          </div>
          <p className="text-xs text-zinc-600">
            Combine these states with table rows, queue cards, and form helper text while redesigning shared UI.
          </p>
        </Card>
      </div>
    </section>
  );
}

function EmptyStateCard() {
  return (
    <section className="space-y-3">
      <SectionHeader title="Empty state card" description="Useful for first-run screens and filtered views." />
      <Card className="flex flex-col items-center justify-center gap-3 py-10 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100 text-xl" aria-hidden="true">□</div>
        <div>
          <p className="font-semibold text-zinc-900">No mock records match this filter</p>
          <p className="mt-1 max-w-md text-sm text-zinc-600">
            Adjust the local preview controls or use this card to test empty-list spacing and calls to action.
          </p>
        </div>
        <Button type="button" variant="secondary">Reset mock filters</Button>
      </Card>
    </section>
  );
}

function TableTitle({ title, description }: { title: string; description: string }) {
  return (
    <div className="border-b border-zinc-200 p-3">
      <p className="font-medium text-zinc-900">{title}</p>
      <p className="text-xs text-zinc-600">{description}</p>
    </div>
  );
}

function badgeVariant(status: string) {
  return status in badgeVariantByStatus ? badgeVariantByStatus[status as BadgeStatus] : "neutral";
}
