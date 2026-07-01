import Link from "next/link";
import { Alert } from "@/src/components/ui/alert";
import { Badge } from "@/src/components/ui/badge";
import { Card } from "@/src/components/ui/card";
import { FormField } from "@/src/components/ui/form-field";
import { Input } from "@/src/components/ui/input";
import { OperationalListRow } from "@/src/components/ui/operational-list-row";
import { Select } from "@/src/components/ui/select";
import { PageContainer } from "@/src/components/layout/page-container";
import { PageHeader } from "@/src/components/layout/page-header";
import { requireQaReadAccess } from "@/src/lib/qa/access";
import { listQaProjects } from "@/src/lib/qa/preview-data";
import type { QaSignoffStatus } from "@/src/lib/qa/types";
import {
  QA_EYEBROW,
  QA_LIST_DESCRIPTION,
  QA_LIST_TITLE,
  QA_PREVIEW_NOTICE,
} from "@/src/lib/qa/ui-contract";
import { SignoffBadge, StatCard } from "./components/qa-ui";

type QaProjectsPageProps = {
  searchParams?: Promise<{ q?: string; status?: string }>;
};

const STATUS_FILTERS: { value: string; label: string }[] = [
  { value: "all", label: "All statuses" },
  { value: "open", label: "Open (not signed off)" },
  { value: "signed_off", label: "Signed off" },
];

export default async function QaProjectsPage({ searchParams }: QaProjectsPageProps) {
  const route = "/qa";
  await requireQaReadAccess(route);
  const params = (await searchParams) ?? {};

  const projects = listQaProjects();
  const q = (params.q ?? "").trim().toLowerCase();
  const status = (params.status ?? "all").trim();

  const filtered = projects.filter((project) => {
    const matchesSearch =
      !q ||
      `${project.project_ref} ${project.name} ${project.lot_code ?? ""}`.toLowerCase().includes(q);
    const matchesStatus =
      status === "all" ||
      (status === "signed_off"
        ? project.status === "signed_off"
        : project.status !== "signed_off");
    return matchesSearch && matchesStatus;
  });

  const totals = projects.reduce(
    (acc, project) => {
      acc.checklists += project.checklist_count;
      acc.holdPoints += project.hold_points_open;
      return acc;
    },
    { checklists: 0, holdPoints: 0 },
  );

  return (
    <PageContainer>
      <PageHeader
        accent
        eyebrow={QA_EYEBROW}
        title={QA_LIST_TITLE}
        description={QA_LIST_DESCRIPTION}
      />

      <Alert variant="info">{QA_PREVIEW_NOTICE}</Alert>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Projects" value={projects.length} hint="Top-level QA containers" />
        <StatCard label="Checklists" value={totals.checklists} hint="Across all projects" />
        <StatCard
          label="Open hold points"
          value={totals.holdPoints}
          hint="Awaiting sign-off"
        />
      </div>

      <Card>
        <form className="grid items-end gap-3 sm:grid-cols-[minmax(0,1fr)_200px_auto]">
          <FormField label="Search" htmlFor="q">
            <Input id="q" name="q" defaultValue={params.q ?? ""} placeholder="Search ref, name, lot" />
          </FormField>
          <FormField label="Status" htmlFor="status">
            <Select id="status" name="status" defaultValue={status}>
              {STATUS_FILTERS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </FormField>
          <button
            type="submit"
            className="inline-flex items-center justify-center rounded-md border border-[var(--he-black)] bg-[var(--he-black)] px-3 py-1.5 text-sm font-medium text-white shadow-sm transition-colors hover:border-[var(--he-charcoal)] hover:bg-[var(--he-charcoal)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--he-yellow)]"
          >
            Filter
          </button>
        </form>
      </Card>

      {filtered.length === 0 ? (
        <Card>
          <p className="text-sm text-zinc-500">No projects match your filters.</p>
        </Card>
      ) : (
        <Card className="divide-y divide-zinc-100 p-0">
          {filtered.map((project) => (
            <Link
              key={project.id}
              href={`/qa/projects/${project.id}`}
              className="block transition-colors hover:bg-zinc-50 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--he-yellow)]"
            >
              <OperationalListRow
                accent={project.hold_points_open > 0}
                title={`${project.project_ref} · ${project.name}`}
                subtitle={project.lot_code ?? "No lot"}
                metadata={
                  <>
                    <Badge variant="muted">{project.checklist_count} checklists</Badge>
                    {project.hold_points_open > 0 ? (
                      <Badge variant="warning">{project.hold_points_open} hold points</Badge>
                    ) : null}
                    <SignoffBadge status={project.status as QaSignoffStatus} />
                    <span className="text-xs text-zinc-500">Updated {project.updated_at}</span>
                  </>
                }
              />
            </Link>
          ))}
        </Card>
      )}
    </PageContainer>
  );
}
