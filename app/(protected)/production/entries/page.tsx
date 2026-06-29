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
import { formatNzDate, parseNzDate } from "@/src/lib/dateTime";
import { listProductionEntries } from "@/src/lib/production/entries";
import { formatMinutesAsDuration } from "@/src/lib/production/format";
import { listProductionOperatorSummaries, listProductionProjectSummaries } from "@/src/lib/production/dashboard";
import {
  ActionLink,
  DataTableCard,
  Td,
  Th,
  dataTableClassName,
  dataTableRowClassName,
} from "../components/production-ui";

type EntriesPageProps = {
  searchParams: Promise<{
    dateFrom?: string;
    dateTo?: string;
    operator?: string;
    project?: string;
    success?: string;
    error?: string;
  }>;
};

export default async function ProductionEntriesPage({ searchParams }: EntriesPageProps) {
  const route = "/production/entries";
  const { session, roles } = await requireProtectedAccess(route);

  const params = await searchParams;
  const dateFrom = params.dateFrom ? parseNzDate(params.dateFrom) ?? undefined : undefined;
  const dateTo = params.dateTo ? parseNzDate(params.dateTo) ?? undefined : undefined;
  const hasInvalidDateFilter = Boolean((params.dateFrom && !dateFrom) || (params.dateTo && !dateTo));
  const hasActiveFilters = Boolean(params.dateFrom || params.dateTo || params.operator || params.project);

  const [operators, projects, entries] = await Promise.all([
    listProductionOperatorSummaries({ session, accessContext: { accountStatus: "approved", roles }, route }),
    listProductionProjectSummaries({ session, accessContext: { accountStatus: "approved", roles }, route }),
    hasInvalidDateFilter
      ? Promise.resolve([])
      : listProductionEntries({
          session,
          accessContext: { accountStatus: "approved", roles },
          route,
          operatorProfileId: params.operator?.trim() || undefined,
          projectId: params.project?.trim() || undefined,
          dateFrom,
          dateTo,
          limit: 200,
        }),
  ]);

  return (
    <PageContainer>
      <PageHeader
        accent
        eyebrow="Production"
        title="Production entries"
        description="Manual Daily Production Entries with simple totals."
        actions={
          <ActionLink href="/production/entries/new" variant="primary">
            Add entry
          </ActionLink>
        }
      />
      {params.success ? <Alert variant="success">{params.success}</Alert> : null}
      {params.error ? <Alert variant="error">{params.error}</Alert> : null}
      {hasInvalidDateFilter ? <Alert variant="error">Enter valid date filters in YYYY-MM-DD format.</Alert> : null}

      <Card>
        <form className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <FormField label="From" htmlFor="dateFrom">
            <Input id="dateFrom" type="date" name="dateFrom" defaultValue={dateFrom ?? ""} />
          </FormField>
          <FormField label="To" htmlFor="dateTo">
            <Input id="dateTo" type="date" name="dateTo" defaultValue={dateTo ?? ""} />
          </FormField>
          <FormField label="Operator" htmlFor="operator">
            <Select id="operator" name="operator" defaultValue={params.operator ?? ""}>
              <option value="">All operators</option>
              {operators.map((operator) => (
                <option key={operator.operator_profile_id} value={operator.operator_profile_id}>
                  {operator.operator_name}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Project" htmlFor="project">
            <Select id="project" name="project" defaultValue={params.project ?? ""}>
              <option value="">All projects</option>
              {projects.map((project) => (
                <option key={project.project_id} value={project.project_id}>
                  {project.project_file} #{project.project_sequence}
                </option>
              ))}
            </Select>
          </FormField>
          <div className="flex items-center gap-2">
            <Button type="submit">Apply</Button>
            {hasActiveFilters ? <ActionLink href="/production/entries">Reset</ActionLink> : null}
          </div>
        </form>
      </Card>

      <DataTableCard
        title="Entries"
        description={`${entries.length} ${entries.length === 1 ? "entry" : "entries"}`}
        emptyMessage="No entries found for the current filters."
        isEmpty={entries.length === 0}
        mobile={
          <ul className="divide-y divide-zinc-100">
            {entries.map((entry) => (
              <li key={entry.id}>
                <Link href={`/production/entries/${entry.id}`} className="block rounded-md">
                  <OperationalListRow
                    density="dense"
                    className="rounded-md hover:bg-zinc-50"
                    title={entry.project_name}
                    subtitle={`${formatNzDate(entry.entry_date)} · ${entry.operator_name} · ${entry.project_file} #${entry.project_sequence}`}
                    metadata={
                      <>
                        <Badge variant="muted">
                          {entry.start_time.slice(0, 5)}–{entry.finish_time.slice(0, 5)}
                        </Badge>
                        <Badge variant="muted">{formatMinutesAsDuration(entry.operational_minutes)}</Badge>
                        <Badge variant="muted">{entry.actual_volume_cut_m3} m³</Badge>
                      </>
                    }
                  />
                </Link>
              </li>
            ))}
          </ul>
        }
      >
        <table className={`${dataTableClassName} min-w-[1400px]`}>
          <thead>
            <tr>
              <Th>Date</Th>
              <Th>Operator</Th>
              <Th>Project File</Th>
              <Th align="right">Sequence</Th>
              <Th>Project Name</Th>
              <Th>Start</Th>
              <Th>Finish</Th>
              <Th align="right">Operational</Th>
              <Th align="right">Remaining Start</Th>
              <Th align="right">Remaining End</Th>
              <Th align="right">Volume Cut</Th>
              <Th align="center">Run Through Break</Th>
              <Th align="right">Downtime</Th>
              <Th align="right">Interruption</Th>
              <Th>Actions</Th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr key={entry.id} className={dataTableRowClassName}>
                <Td>{formatNzDate(entry.entry_date)}</Td>
                <Td>{entry.operator_name}</Td>
                <Td>{entry.project_file}</Td>
                <Td align="right">{entry.project_sequence}</Td>
                <Td>{entry.project_name}</Td>
                <Td>{entry.start_time.slice(0, 5)}</Td>
                <Td>{entry.finish_time.slice(0, 5)}</Td>
                <Td align="right">{formatMinutesAsDuration(entry.operational_minutes)}</Td>
                <Td align="right">{formatMinutesAsDuration(entry.time_remaining_start_minutes)}</Td>
                <Td align="right">{formatMinutesAsDuration(entry.time_remaining_end_minutes)}</Td>
                <Td align="right">{entry.actual_volume_cut_m3}</Td>
                <Td align="center">{entry.run_through_break ? "Yes" : "No"}</Td>
                <Td align="right">{formatMinutesAsDuration(entry.downtime_minutes)}</Td>
                <Td align="right">{formatMinutesAsDuration(entry.interruption_minutes)}</Td>
                <Td>
                  <Link className="text-zinc-900 underline" href={`/production/entries/${entry.id}`}>
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
