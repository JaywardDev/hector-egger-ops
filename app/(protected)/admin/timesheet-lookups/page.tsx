import Link from "next/link";
import { notFound } from "next/navigation";
import { PageContainer } from "@/src/components/layout/page-container";
import { PageHeader } from "@/src/components/layout/page-header";
import { Alert } from "@/src/components/ui/alert";
import { Badge } from "@/src/components/ui/badge";
import { Card } from "@/src/components/ui/card";
import { requireAdminAccess } from "@/src/lib/auth/guards";
import { listTimesheetLookupsForAdmin, sanitizeLookupFilters, type TimesheetLookupBrowserRow } from "@/src/lib/admin/timesheet-lookups";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const formatDateTime = (value: string | null) => (value ? new Date(value).toLocaleString("en-NZ") : "—");

const rowClassName = (row: TimesheetLookupBrowserRow) =>
  row.is_active ? "border-b border-zinc-100" : "border-b border-zinc-100 bg-zinc-50/50 text-zinc-500";

const sourceLabel = (sourceSystem: string) => (sourceSystem === "c_base" ? "C Base" : sourceSystem === "manual" ? "Manual" : sourceSystem);

const sortLink = (name: string, currentSort: string, currentDirection: "asc" | "desc") => {
  if (currentSort !== name) return { sort: name, direction: "asc" as const };
  return { sort: name, direction: currentDirection === "asc" ? "desc" : "asc" as const };
};

export default async function TimesheetLookupsPage({ searchParams }: Props) {
  const { session, profile } = await requireAdminAccess();
  if (!profile) {
    notFound();
  }
  const filters = sanitizeLookupFilters(await searchParams);
  const result = await listTimesheetLookupsForAdmin({ session, profileId: profile.id }, filters);

  const totalPages = Math.max(1, Math.ceil(result.totalCount / filters.pageSize));
  const clampedPage = Math.min(filters.page, totalPages);

  const paramsWith = (updates: Record<string, string>) => {
    const params = new URLSearchParams({
      tab: filters.table,
      q: filters.search,
      status: filters.status,
      source: filters.source,
      visibility: filters.visibility,
      inactiveReason: filters.inactiveReason,
      sort: filters.sort,
      direction: filters.direction,
      page: String(clampedPage),
      pageSize: String(filters.pageSize),
    });
    Object.entries(updates).forEach(([k, v]) => params.set(k, v));
    return `?${params.toString()}`;
  };

  return (
    <PageContainer>
      <PageHeader title="Timesheet lookups" description="Admin-only read-only view of C Base synced lookup data for projects and tasks.">
        <div className="pt-2">
          <Link className="rounded-md border border-zinc-200 px-3 py-1 text-sm" href="/admin/timesheet-lookups/import">Import C Base lookups</Link>
        </div>
      </PageHeader>

      <Alert variant="warning">Read-only browser: this page does not support edit, import, activate, or delete actions.</Alert>

      <Card>
        <div className="flex flex-wrap gap-2">
          <Link className={`rounded-md border px-3 py-1.5 text-sm ${filters.table === "projects" ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-300 bg-white text-zinc-900"}`} href={paramsWith({ tab: "projects", page: "1" })}>Projects</Link>
          <Link className={`rounded-md border px-3 py-1.5 text-sm ${filters.table === "tasks" ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-300 bg-white text-zinc-900"}`} href={paramsWith({ tab: "tasks", page: "1" })}>Tasks</Link>
        </div>

        <form className="mt-3 grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
          <input type="hidden" name="tab" value={filters.table} />
          <input type="hidden" name="sort" value={filters.sort} />
          <input type="hidden" name="direction" value={filters.direction} />
          <input type="hidden" name="pageSize" value={filters.pageSize} />
          <input className="rounded-md border border-zinc-200 px-2 py-1 text-sm" name="q" defaultValue={filters.search} placeholder="Search code or label" />
          <select className="rounded-md border border-zinc-200 px-2 py-1 text-sm" name="status" defaultValue={filters.status}>
            <option value="all">All status</option><option value="active">Active</option><option value="inactive">Inactive</option>
          </select>
          <select className="rounded-md border border-zinc-200 px-2 py-1 text-sm" name="source" defaultValue={filters.source}>
            <option value="all">All sources</option>
            <option value="c_base">C Base</option>
            <option value="manual">Manual</option>
            {result.sourceValues.some((value) => value !== "c_base" && value !== "manual") ? <option value="other">Other</option> : null}
          </select>
          <select className="rounded-md border border-zinc-200 px-2 py-1 text-sm" name="visibility" defaultValue={filters.visibility}>
            <option value="all">All visibility</option><option value="factory">Factory</option><option value="site">Site</option><option value="office">Office</option><option value="none">Hidden / none</option>
          </select>
          <select className="rounded-md border border-zinc-200 px-2 py-1 text-sm" name="inactiveReason" defaultValue={filters.inactiveReason}>
            <option value="all">All inactive reasons</option>
            {result.inactiveReasonValues.map((reason) => <option key={reason} value={reason}>{reason}</option>)}
          </select>
          <button className="rounded-md border border-zinc-200 px-3 py-1 text-sm" type="submit">Apply</button>
        </form>
      </Card>

      <Card className="overflow-x-auto">
        <table className="min-w-[1200px] text-left text-xs">
          <thead>
            <tr className="border-b border-zinc-200 text-zinc-500">
              {[
                ["code", "Code"], ["label", "Label"], ["is_active", "Status"], ["source_system", "Source"], ["visible", "Visibility"], ["inactive_reason", "Inactive reason"], ["inactive_at", "Inactive at"], ["last_seen_at", "Last seen"], ["updated_at", "Updated"], ["created_at", "Created"],
              ].map(([key, label]) => (
                <th key={key} className="px-2 py-1">
                  {key === "visible" || key === "inactive_reason" || key === "created_at" ? label : (
                    <Link className="hover:underline" href={paramsWith({ ...sortLink(key, filters.sort, filters.direction), page: "1" })}>{label}</Link>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {result.rows.map((row) => (
              <tr key={row.id} className={rowClassName(row)}>
                <td className="px-2 py-1 font-medium">{row.code}</td>
                <td className="px-2 py-1">{row.label}</td>
                <td className="px-2 py-1">{row.is_active ? <Badge variant="success">Active</Badge> : <Badge>Inactive</Badge>}</td>
                <td className="px-2 py-1"><Badge variant={row.source_system === "c_base" ? "muted" : "neutral"}>{sourceLabel(row.source_system)}</Badge></td>
                <td className="px-2 py-1">{row.visible_to_staff_groups.length > 0 ? row.visible_to_staff_groups.join(", ") : "none"}</td>
                <td className="px-2 py-1">{row.inactive_reason ? <Badge>{row.inactive_reason}</Badge> : "—"}</td>
                <td className="px-2 py-1">{formatDateTime(row.inactive_at)}</td>
                <td className="px-2 py-1">{formatDateTime(row.last_seen_at)}</td>
                <td className="px-2 py-1">{formatDateTime(row.updated_at)}</td>
                <td className="px-2 py-1">{formatDateTime(row.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {result.rows.length === 0 ? <p className="px-2 py-2 text-sm text-zinc-600">No lookup rows matched the current filters.</p> : null}

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-zinc-100 pt-3 text-sm">
          <p className="text-zinc-600">{result.totalCount} total rows</p>
          <div className="flex items-center gap-2">
            <Link className="rounded border border-zinc-300 px-2 py-1 disabled:pointer-events-none" href={paramsWith({ page: String(Math.max(1, clampedPage - 1)) })}>Previous</Link>
            <span>Page {clampedPage} of {totalPages}</span>
            <Link className="rounded border border-zinc-300 px-2 py-1" href={paramsWith({ page: String(Math.min(totalPages, clampedPage + 1)) })}>Next</Link>
            <form>
              <input type="hidden" name="tab" value={filters.table} />
              <input type="hidden" name="q" value={filters.search} />
              <input type="hidden" name="status" value={filters.status} />
              <input type="hidden" name="source" value={filters.source} />
              <input type="hidden" name="visibility" value={filters.visibility} />
              <input type="hidden" name="inactiveReason" value={filters.inactiveReason} />
              <input type="hidden" name="sort" value={filters.sort} />
              <input type="hidden" name="direction" value={filters.direction} />
              <select className="rounded border border-zinc-300 px-2 py-1" name="pageSize" defaultValue={String(filters.pageSize)}>
                <option value="25">25</option><option value="50">50</option><option value="100">100</option>
              </select>
              <button className="ml-2 rounded border border-zinc-300 px-2 py-1" type="submit">Set</button>
            </form>
          </div>
        </div>
      </Card>
    </PageContainer>
  );
}
