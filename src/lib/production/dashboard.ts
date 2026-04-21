import "server-only";

import { createServerSupabaseClient } from "@/src/lib/supabase/server";
import { withServerTiming } from "@/src/lib/server-timing";
import {
  assertProductionReadAccess,
  createSessionHeaders,
  type ProductionActor,
} from "@/src/lib/production/access";
import type {
  ProductionEntryWithMetricsRecord,
  ProductionOperatorSummaryRecord,
  ProductionProjectRecord,
  ProductionProjectSummaryRecord,
} from "@/src/lib/production/types";

export type ProductionDashboardFilters = {
  dateFrom?: string;
  dateTo?: string;
  operatorProfileId?: string;
  projectId?: string;
  projectStatus?: "active" | "completed" | "archived";
};

export type ProductionDashboardKpis = {
  totalVolumeCutM3: number;
  totalOperationalMinutes: number;
  averageMachineEfficiencyPct: number | null;
  averageProjectEfficiencyPct: number | null;
  totalDowntimeMinutes: number;
  totalInterruptionMinutes: number;
  activeProjectsCount: number;
};

export type ProductionDashboardDailyTrendRow = {
  workDate: string;
  totalVolumeCutM3: number;
  totalOperationalMinutes: number;
  avgMachineEfficiencyPct: number | null;
  avgProjectEfficiencyPct: number | null;
  totalDowntimeMinutes: number;
};

export type ProductionDashboardDowntimeRow = {
  reason: string;
  minutes: number;
  shiftCount: number;
};

export type ProductionDashboardProjectComparisonRow = {
  projectId: string;
  projectLabel: string;
  status: "active" | "completed" | "archived";
  shiftCount: number;
  totalVolumeCutM3: number;
  totalOperationalMinutes: number;
  avgProjectEfficiencyPct: number | null;
  totalDowntimeMinutes: number;
};

export type ProductionDashboardOperatorComparisonRow = {
  operatorProfileId: string;
  operatorName: string;
  shiftCount: number;
  totalVolumeCutM3: number;
  totalOperationalMinutes: number;
  avgProjectEfficiencyPct: number | null;
  totalDowntimeMinutes: number;
  totalInterruptionMinutes: number;
};

export type ProductionDashboardReport = {
  filters: ProductionDashboardFilters;
  kpis: ProductionDashboardKpis;
  dailyTrend: ProductionDashboardDailyTrendRow[];
  downtimeBreakdown: ProductionDashboardDowntimeRow[];
  projectComparisons: ProductionDashboardProjectComparisonRow[];
  operatorComparisons: ProductionDashboardOperatorComparisonRow[];
};

export const listProductionProjectSummaries = async ({
  session,
  accessContext,
  route,
}: ProductionActor): Promise<ProductionProjectSummaryRecord[]> =>
  withServerTiming({
    name: "listProductionProjectSummaries",
    route,
    operation: async () => {
      await assertProductionReadAccess({ session, accessContext, route });

      const supabase = createServerSupabaseClient();
      const response = await supabase.request(
        "/rest/v1/production_project_summaries?select=*&order=project_file.asc,project_sequence.asc",
        {
          cache: "no-store",
          headers: createSessionHeaders(session),
        },
      );

      if (!response.ok) {
        throw new Error("Failed to load production project summaries");
      }

      return (await response.json()) as ProductionProjectSummaryRecord[];
    },
  });

export const listProductionOperatorSummaries = async ({
  session,
  accessContext,
  route,
}: ProductionActor): Promise<ProductionOperatorSummaryRecord[]> =>
  withServerTiming({
    name: "listProductionOperatorSummaries",
    route,
    operation: async () => {
      await assertProductionReadAccess({ session, accessContext, route });

      const supabase = createServerSupabaseClient();
      const response = await supabase.request(
        "/rest/v1/production_operator_summaries?select=*&order=operator_name.asc",
        {
          cache: "no-store",
          headers: createSessionHeaders(session),
        },
      );

      if (!response.ok) {
        throw new Error("Failed to load production operator summaries");
      }

      return (await response.json()) as ProductionOperatorSummaryRecord[];
    },
  });

const buildEntriesSearchParams = ({
  filters,
  scopedProjectIds,
}: {
  filters: ProductionDashboardFilters;
  scopedProjectIds: string[] | null;
}) => {
  const searchParams = new URLSearchParams({
    select:
      "id,work_date,operator_profile_id,operator_name,project_id,project_file,project_sequence,actual_volume_cut_m3,operational_minutes,machine_efficiency_pct,project_efficiency_pct,downtime_minutes,interruption_minutes,downtime_reason_label",
    order: "work_date.asc,created_at.asc,id.asc",
  });

  if (filters.dateFrom) {
    searchParams.append("work_date", `gte.${filters.dateFrom}`);
  }
  if (filters.dateTo) {
    searchParams.append("work_date", `lte.${filters.dateTo}`);
  }
  if (filters.operatorProfileId) {
    searchParams.set("operator_profile_id", `eq.${filters.operatorProfileId}`);
  }
  if (filters.projectId) {
    searchParams.set("project_id", `eq.${filters.projectId}`);
  } else if (scopedProjectIds && scopedProjectIds.length > 0) {
    searchParams.set("project_id", `in.(${scopedProjectIds.join(",")})`);
  } else if (scopedProjectIds && scopedProjectIds.length === 0) {
    searchParams.set("id", "eq.00000000-0000-0000-0000-000000000000");
  }

  return searchParams;
};

const collectAverage = (values: Array<number | null>) => {
  const valid = values.filter((value): value is number => value !== null);
  if (valid.length === 0) {
    return null;
  }
  return valid.reduce((sum, value) => sum + value, 0) / valid.length;
};

export const getProductionDashboardReport = async ({
  session,
  accessContext,
  route,
  filters,
}: ProductionActor & {
  filters: ProductionDashboardFilters;
}): Promise<ProductionDashboardReport> =>
  withServerTiming({
    name: "getProductionDashboardReport",
    route,
    operation: async () => {
      await assertProductionReadAccess({ session, accessContext, route });

      const supabase = createServerSupabaseClient();

      const projectsResponse = await supabase.request(
        "/rest/v1/production_projects?select=id,project_file,project_sequence,status&order=project_file.asc,project_sequence.asc",
        {
          cache: "no-store",
          headers: createSessionHeaders(session),
        },
      );

      if (!projectsResponse.ok) {
        throw new Error("Failed to load production projects for dashboard filters");
      }

      const projects = (await projectsResponse.json()) as Array<
        Pick<ProductionProjectRecord, "id" | "project_file" | "project_sequence" | "status">
      >;

      const scopedProjectIds = filters.projectStatus
        ? projects
            .filter((project) => project.status === filters.projectStatus)
            .map((project) => project.id)
        : null;

      const entriesParams = buildEntriesSearchParams({ filters, scopedProjectIds });
      const entriesResponse = await supabase.request(
        `/rest/v1/production_entries_with_metrics?${entriesParams.toString()}`,
        {
          cache: "no-store",
          headers: createSessionHeaders(session),
        },
      );

      if (!entriesResponse.ok) {
        throw new Error("Failed to load production dashboard entries");
      }

      const entries = (await entriesResponse.json()) as Pick<
        ProductionEntryWithMetricsRecord,
        | "id"
        | "work_date"
        | "operator_profile_id"
        | "operator_name"
        | "project_id"
        | "project_file"
        | "project_sequence"
        | "actual_volume_cut_m3"
        | "operational_minutes"
        | "machine_efficiency_pct"
        | "project_efficiency_pct"
        | "downtime_minutes"
        | "interruption_minutes"
        | "downtime_reason_label"
      >[];

      const projectIndex = new Map(projects.map((project) => [project.id, project]));

      const totalVolumeCutM3 = entries.reduce(
        (sum, entry) => sum + Number(entry.actual_volume_cut_m3 ?? 0),
        0,
      );
      const totalOperationalMinutes = entries.reduce(
        (sum, entry) => sum + entry.operational_minutes,
        0,
      );
      const totalDowntimeMinutes = entries.reduce((sum, entry) => sum + entry.downtime_minutes, 0);
      const totalInterruptionMinutes = entries.reduce(
        (sum, entry) => sum + entry.interruption_minutes,
        0,
      );

      const activeProjectsCount = new Set(
        entries
          .filter((entry) => projectIndex.get(entry.project_id)?.status === "active")
          .map((entry) => entry.project_id),
      ).size;

      const dailyMap = new Map<
        string,
        {
          totalVolumeCutM3: number;
          totalOperationalMinutes: number;
          machineEfficiencies: Array<number | null>;
          projectEfficiencies: Array<number | null>;
          totalDowntimeMinutes: number;
        }
      >();

      const downtimeMap = new Map<string, { minutes: number; shiftIds: Set<string> }>();
      const projectMap = new Map<
        string,
        {
          projectLabel: string;
          status: "active" | "completed" | "archived";
          shiftIds: Set<string>;
          totalVolumeCutM3: number;
          totalOperationalMinutes: number;
          projectEfficiencies: Array<number | null>;
          totalDowntimeMinutes: number;
        }
      >();
      const operatorMap = new Map<
        string,
        {
          operatorName: string;
          shiftIds: Set<string>;
          totalVolumeCutM3: number;
          totalOperationalMinutes: number;
          projectEfficiencies: Array<number | null>;
          totalDowntimeMinutes: number;
          totalInterruptionMinutes: number;
        }
      >();

      for (const entry of entries) {
        const daily = dailyMap.get(entry.work_date) ?? {
          totalVolumeCutM3: 0,
          totalOperationalMinutes: 0,
          machineEfficiencies: [],
          projectEfficiencies: [],
          totalDowntimeMinutes: 0,
        };
        daily.totalVolumeCutM3 += Number(entry.actual_volume_cut_m3 ?? 0);
        daily.totalOperationalMinutes += entry.operational_minutes;
        daily.machineEfficiencies.push(entry.machine_efficiency_pct);
        daily.projectEfficiencies.push(entry.project_efficiency_pct);
        daily.totalDowntimeMinutes += entry.downtime_minutes;
        dailyMap.set(entry.work_date, daily);

        if (entry.downtime_minutes > 0) {
          const reason = entry.downtime_reason_label ?? "Unspecified";
          const downtime = downtimeMap.get(reason) ?? { minutes: 0, shiftIds: new Set<string>() };
          downtime.minutes += entry.downtime_minutes;
          downtime.shiftIds.add(entry.id);
          downtimeMap.set(reason, downtime);
        }

        const projectMeta = projectIndex.get(entry.project_id);
        const project = projectMap.get(entry.project_id) ?? {
          projectLabel: `${entry.project_file} #${entry.project_sequence}`,
          status: projectMeta?.status ?? "active",
          shiftIds: new Set<string>(),
          totalVolumeCutM3: 0,
          totalOperationalMinutes: 0,
          projectEfficiencies: [],
          totalDowntimeMinutes: 0,
        };
        project.shiftIds.add(entry.id);
        project.totalVolumeCutM3 += Number(entry.actual_volume_cut_m3 ?? 0);
        project.totalOperationalMinutes += entry.operational_minutes;
        project.projectEfficiencies.push(entry.project_efficiency_pct);
        project.totalDowntimeMinutes += entry.downtime_minutes;
        projectMap.set(entry.project_id, project);

        const operator = operatorMap.get(entry.operator_profile_id) ?? {
          operatorName: entry.operator_name,
          shiftIds: new Set<string>(),
          totalVolumeCutM3: 0,
          totalOperationalMinutes: 0,
          projectEfficiencies: [],
          totalDowntimeMinutes: 0,
          totalInterruptionMinutes: 0,
        };
        operator.shiftIds.add(entry.id);
        operator.totalVolumeCutM3 += Number(entry.actual_volume_cut_m3 ?? 0);
        operator.totalOperationalMinutes += entry.operational_minutes;
        operator.projectEfficiencies.push(entry.project_efficiency_pct);
        operator.totalDowntimeMinutes += entry.downtime_minutes;
        operator.totalInterruptionMinutes += entry.interruption_minutes;
        operatorMap.set(entry.operator_profile_id, operator);
      }

      return {
        filters,
        kpis: {
          totalVolumeCutM3,
          totalOperationalMinutes,
          averageMachineEfficiencyPct: collectAverage(entries.map((entry) => entry.machine_efficiency_pct)),
          averageProjectEfficiencyPct: collectAverage(entries.map((entry) => entry.project_efficiency_pct)),
          totalDowntimeMinutes,
          totalInterruptionMinutes,
          activeProjectsCount,
        },
        dailyTrend: [...dailyMap.entries()]
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([workDate, row]) => ({
            workDate,
            totalVolumeCutM3: row.totalVolumeCutM3,
            totalOperationalMinutes: row.totalOperationalMinutes,
            avgMachineEfficiencyPct: collectAverage(row.machineEfficiencies),
            avgProjectEfficiencyPct: collectAverage(row.projectEfficiencies),
            totalDowntimeMinutes: row.totalDowntimeMinutes,
          })),
        downtimeBreakdown: [...downtimeMap.entries()]
          .map(([reason, row]) => ({
            reason,
            minutes: row.minutes,
            shiftCount: row.shiftIds.size,
          }))
          .sort((a, b) => b.minutes - a.minutes),
        projectComparisons: [...projectMap.entries()]
          .map(([projectId, row]) => ({
            projectId,
            projectLabel: row.projectLabel,
            status: row.status,
            shiftCount: row.shiftIds.size,
            totalVolumeCutM3: row.totalVolumeCutM3,
            totalOperationalMinutes: row.totalOperationalMinutes,
            avgProjectEfficiencyPct: collectAverage(row.projectEfficiencies),
            totalDowntimeMinutes: row.totalDowntimeMinutes,
          }))
          .sort((a, b) => b.totalVolumeCutM3 - a.totalVolumeCutM3),
        operatorComparisons: [...operatorMap.entries()]
          .map(([operatorProfileId, row]) => ({
            operatorProfileId,
            operatorName: row.operatorName,
            shiftCount: row.shiftIds.size,
            totalVolumeCutM3: row.totalVolumeCutM3,
            totalOperationalMinutes: row.totalOperationalMinutes,
            avgProjectEfficiencyPct: collectAverage(row.projectEfficiencies),
            totalDowntimeMinutes: row.totalDowntimeMinutes,
            totalInterruptionMinutes: row.totalInterruptionMinutes,
          }))
          .sort((a, b) => b.totalVolumeCutM3 - a.totalVolumeCutM3),
      };
    },
  });
