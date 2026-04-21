import Link from "next/link";
import { PageContainer } from "@/src/components/layout/page-container";
import { PageHeader } from "@/src/components/layout/page-header";
import { Card } from "@/src/components/ui/card";
import { requireProtectedAccess } from "@/src/lib/auth/guards";
import { listProductionEntries } from "@/src/lib/production/entries";
import { listProductionProjectSummaries } from "@/src/lib/production/dashboard";

export default async function ProductionPage() {
  const route = "/production";
  const { session, roles } = await requireProtectedAccess(route);

  const [projectSummaries, recentEntries] = await Promise.all([
    listProductionProjectSummaries({
      session,
      accessContext: { accountStatus: "approved", roles },
      route,
    }),
    listProductionEntries({
      session,
      accessContext: { accountStatus: "approved", roles },
      route,
      limit: 5,
    }),
  ]);

  return (
    <PageContainer>
      <PageHeader
        title="Production"
        description="Operational home for production projects and daily production entries."
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <p className="text-xs uppercase tracking-wide text-zinc-500">Projects</p>
          <p className="text-xl font-semibold text-zinc-900">{projectSummaries.length}</p>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-wide text-zinc-500">Recent entries</p>
          <p className="text-xl font-semibold text-zinc-900">{recentEntries.length}</p>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-wide text-zinc-500">Open project work</p>
          <p className="text-xl font-semibold text-zinc-900">
            {
              projectSummaries.filter(
                (project) => (project.latest_file_minutes_left ?? 0) > 0,
              ).length
            }
          </p>
        </Card>
      </div>

      <Card>
        <p className="font-medium text-zinc-900">Quick links</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <Link className="rounded-md border border-zinc-200 px-3 py-1" href="/production/entries">
            Production entries
          </Link>
          <Link className="rounded-md border border-zinc-200 px-3 py-1" href="/production/projects">
            Projects
          </Link>
          <Link className="rounded-md border border-zinc-200 px-3 py-1" href="/production/entries/new">
            Create new entry
          </Link>
          <Link className="rounded-md border border-zinc-200 px-3 py-1" href="/production/projects/new">
            Create new project
          </Link>
        </div>
      </Card>

      <Card>
        <p className="font-medium text-zinc-900">Recent activity</p>
        {recentEntries.length === 0 ? (
          <p className="mt-2">No production entries yet.</p>
        ) : (
          <ul className="mt-2 space-y-1">
            {recentEntries.map((entry) => (
              <li key={entry.id}>
                <Link href={`/production/entries/${entry.id}`} className="underline">
                  {entry.work_date} · {entry.operator_name} · {entry.project_file} #{entry.project_sequence}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </PageContainer>
  );
}
