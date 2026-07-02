import Link from "next/link";
import { notFound } from "next/navigation";
import { PageContainer } from "@/src/components/layout/page-container";
import { PageHeader } from "@/src/components/layout/page-header";
import { Alert } from "@/src/components/ui/alert";
import { Badge } from "@/src/components/ui/badge";
import { Card } from "@/src/components/ui/card";
import { requireAdminAccess } from "@/src/lib/auth/guards";
import { listQaTemplatesForAdmin, sanitizeTemplateFilters } from "@/src/lib/qa/template-browser";
import { QaTemplatesTableClient } from "./templates-table-client";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const formatDateTime = (value: string | null) => (value ? new Date(value).toLocaleString("en-NZ") : "—");

const ACTION_TONE: Record<string, string> = {
  inserted: "success",
  unchanged: "muted",
  version_conflict: "danger",
};

export default async function QaTemplatesPage({ searchParams }: Props) {
  const { session, profile } = await requireAdminAccess();
  if (!profile) {
    notFound();
  }

  const filters = sanitizeTemplateFilters(await searchParams);
  const { templates, history } = await listQaTemplatesForAdmin(session, filters);

  return (
    <PageContainer>
      <PageHeader
        title="QA checklist templates"
        description="Admin-only read-only view of imported checklist templates and their versions."
        actions={
          <Link className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-900 shadow-sm hover:bg-zinc-50" href="/admin/qa-templates/import">
            Import templates
          </Link>
        }
      />

      <Alert variant="warning">
        Read-only browser. Templates are mirrored from C-base and are append-only — each import that changes a template
        adds a new version rather than editing an existing one.
      </Alert>

      <Card>
        <form className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
          <input
            className="rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
            name="q"
            defaultValue={filters.search}
            placeholder="Search name or source id"
          />
          <button className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm" type="submit">
            Search
          </button>
        </form>
      </Card>

      <Card className="overflow-x-auto">
        <QaTemplatesTableClient templates={templates} />
        {templates.length === 0 ? (
          <p className="px-2 py-3 text-sm text-zinc-600">
            No templates imported yet. Use{" "}
            <Link className="font-medium text-zinc-900 underline" href="/admin/qa-templates/import">
              QA template import
            </Link>{" "}
            to load checklist templates from C-base.
          </p>
        ) : null}
      </Card>

      <Card>
        <h2 className="text-lg font-semibold text-zinc-900">Recent imports</h2>
        {history.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-600">No imports recorded yet.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-[700px] text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-xs uppercase tracking-wide text-zinc-500">
                  <th className="px-2 py-1">When</th>
                  <th className="px-2 py-1">File</th>
                  <th className="px-2 py-1">Source id</th>
                  <th className="px-2 py-1">Version</th>
                  <th className="px-2 py-1">Result</th>
                </tr>
              </thead>
              <tbody>
                {history.map((row) => (
                  <tr key={row.id} className="border-b border-zinc-100">
                    <td className="px-2 py-1 text-zinc-600">{formatDateTime(row.created_at)}</td>
                    <td className="px-2 py-1">{row.filename}</td>
                    <td className="px-2 py-1 font-mono text-xs text-zinc-500">{row.source_id}</td>
                    <td className="px-2 py-1">{row.version ?? "—"}</td>
                    <td className="px-2 py-1">
                      <Badge variant={(ACTION_TONE[row.action] ?? "neutral") as "success" | "muted" | "danger" | "neutral"}>
                        {row.action}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </PageContainer>
  );
}
