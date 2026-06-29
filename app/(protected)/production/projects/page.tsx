import Link from "next/link";
import { PageContainer } from "@/src/components/layout/page-container";
import { PageHeader } from "@/src/components/layout/page-header";
import { Alert } from "@/src/components/ui/alert";
import { Badge } from "@/src/components/ui/badge";
import { Button } from "@/src/components/ui/button";
import { Card } from "@/src/components/ui/card";
import { FormField } from "@/src/components/ui/form-field";
import { Input } from "@/src/components/ui/input";
import { OperationalListRow } from "@/src/components/ui/operational-list-row";
import { Select } from "@/src/components/ui/select";
import { requireProtectedAccess } from "@/src/lib/auth/guards";
import { listProductionProjectSummaries } from "@/src/lib/production/dashboard";
import { listProductionProjects } from "@/src/lib/production/projects";
import { formatMinutesAsDuration } from "@/src/lib/production/format";
import {
  ActionLink,
  DataTableCard,
  Td,
  Th,
  dataTableClassName,
  dataTableRowClassName,
} from "../components/production-ui";

type ProjectsPageProps = {
  searchParams: Promise<{
    q?: string;
    status?: string;
    success?: string;
    error?: string;
  }>;
};

export default async function ProductionProjectsPage({ searchParams }: ProjectsPageProps) {
  const route = "/production/projects";
  const { session, roles } = await requireProtectedAccess(route);
  const [params, summaries, projects] = await Promise.all([
    searchParams,
    listProductionProjectSummaries({
      session,
      accessContext: { accountStatus: "approved", roles },
      route,
    }),
    listProductionProjects({
      session,
      accessContext: { accountStatus: "approved", roles },
      route,
    }),
  ]);

  const q = (params.q ?? "").trim().toLowerCase();
  const status = (params.status ?? "active").trim().toLowerCase();
  const hasActiveFilters = Boolean(params.q || (params.status && params.status !== "active"));

  const archivedById = new Map(projects.map((project) => [project.id, project.is_archived]));

  const filtered = summaries.filter((project) => {
    const matchesSearch =
      !q ||
      `${project.project_file} ${project.project_name} ${project.project_sequence}`
        .toLowerCase()
        .includes(q);
    const archived = archivedById.get(project.project_id) ?? project.is_archived;
    const matchesStatus = status === "all" || (status === "archived" ? archived : !archived);
    return matchesSearch && matchesStatus;
  });

  return (
    <PageContainer>
      <PageHeader
        accent
        eyebrow="Production"
        title="Production Projects"
        description="Manual Project Registry for production work."
        actions={
          <ActionLink href="/production/projects/new" variant="primary">
            Add project
          </ActionLink>
        }
      />

      {params.success ? <Alert variant="success">{params.success}</Alert> : null}
      {params.error ? <Alert variant="error">{params.error}</Alert> : null}

      <Card>
        <form className="grid items-end gap-3 sm:grid-cols-[minmax(0,1fr)_180px_auto]">
          <FormField label="Search" htmlFor="q">
            <Input id="q" name="q" defaultValue={params.q ?? ""} placeholder="Search file, name, sequence" />
          </FormField>
          <FormField label="Status" htmlFor="status">
            <Select id="status" name="status" defaultValue={params.status ?? "active"}>
              <option value="active">Active</option>
              <option value="archived">Archived</option>
              <option value="all">All</option>
            </Select>
          </FormField>
          <div className="flex items-center gap-2">
            <Button type="submit">Apply</Button>
            {hasActiveFilters ? <ActionLink href="/production/projects">Reset</ActionLink> : null}
          </div>
        </form>
      </Card>

      <DataTableCard
        title="Projects"
        description={`${filtered.length} ${filtered.length === 1 ? "project" : "projects"}`}
        emptyMessage="No matching projects."
        isEmpty={filtered.length === 0}
        mobile={
          <ul className="divide-y divide-zinc-100">
            {filtered.map((project) => {
              const archived = archivedById.get(project.project_id) ?? project.is_archived;
              return (
                <li key={project.project_id}>
                  <Link href={`/production/projects/${project.project_id}`} className="block rounded-md">
                    <OperationalListRow
                      density="dense"
                      className="rounded-md hover:bg-zinc-50"
                      title={project.project_name}
                      subtitle={`${project.project_file} #${project.project_sequence} · ${archived ? "Archived" : "Active"}`}
                      metadata={
                        <>
                          <Badge variant="muted">{formatMinutesAsDuration(project.total_time_minutes)}</Badge>
                          <Badge variant="muted">Cut {project.total_volume_cut_m3} m³</Badge>
                        </>
                      }
                    />
                  </Link>
                </li>
              );
            })}
          </ul>
        }
      >
        <table className={`${dataTableClassName} min-w-[960px]`}>
          <thead>
            <tr>
              <Th>Project file</Th>
              <Th>Project name</Th>
              <Th align="right">Sequence</Th>
              <Th align="right">Total Duration</Th>
              <Th align="right">Latest Time Remaining</Th>
              <Th align="right">Total Volume</Th>
              <Th align="right">Volume Cut</Th>
              <Th align="right">Downtime</Th>
              <Th align="right">Interruption</Th>
              <Th align="center">Archived</Th>
              <Th>Actions</Th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((project) => (
              <tr key={project.project_id} className={dataTableRowClassName}>
                <Td>{project.project_file}</Td>
                <Td>{project.project_name}</Td>
                <Td align="right">{project.project_sequence}</Td>
                <Td align="right">{formatMinutesAsDuration(project.total_time_minutes)}</Td>
                <Td align="right">{formatMinutesAsDuration(project.latest_time_remaining_minutes)}</Td>
                <Td align="right">{project.total_volume_m3 ?? "—"}</Td>
                <Td align="right">{project.total_volume_cut_m3}</Td>
                <Td align="right">{formatMinutesAsDuration(project.total_downtime_minutes)}</Td>
                <Td align="right">{formatMinutesAsDuration(project.total_interruption_minutes)}</Td>
                <Td align="center">{(archivedById.get(project.project_id) ?? project.is_archived) ? "Yes" : "No"}</Td>
                <Td>
                  <Link href={`/production/projects/${project.project_id}`} className="text-zinc-900 underline">
                    Open
                  </Link>
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </DataTableCard>
    </PageContainer>
  );
}
