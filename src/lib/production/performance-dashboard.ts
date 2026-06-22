import type { ProductionEntryWithMetricsRecord, ProductionProjectFileSummaryRecord } from "@/src/lib/production/types";

export const safeRatioPercent = (numerator: number | null | undefined, denominator: number | null | undefined): number | null => {
  const n = Number(numerator ?? 0);
  const d = Number(denominator ?? 0);
  return Number.isFinite(n) && Number.isFinite(d) && d > 0 ? (n / d) * 100 : null;
};

export const formatVolume = (value: number | null | undefined) => (Number.isFinite(Number(value)) ? `${Number(value).toFixed(2)} m³` : "—");
export const formatRate = (value: number | null | undefined) => (Number.isFinite(Number(value)) ? `${Number(value).toFixed(2)} m³/h` : "—");
export const formatPercent = (value: number | null | undefined) => (Number.isFinite(Number(value)) ? `${Number(value).toFixed(1)}%` : "—");

export type DashboardFilters = { dateFrom?: string; dateTo?: string; project?: string; projectFile?: string; operator?: string; month?: string };

export const filterProductionEntries = (entries: ProductionEntryWithMetricsRecord[], filters: DashboardFilters) =>
  entries.filter((entry) => {
    if (filters.dateFrom && entry.entry_date < filters.dateFrom) return false;
    if (filters.dateTo && entry.entry_date > filters.dateTo) return false;
    if (filters.project && entry.project_id !== filters.project) return false;
    if (filters.projectFile && entry.project_file_id !== filters.projectFile) return false;
    if (filters.operator && entry.operator_profile_id !== filters.operator) return false;
    return true;
  });

export const utilizationPercent = (operational: number, downtime: number, interruption: number) =>
  safeRatioPercent(operational, operational + downtime + interruption);

export const projectPerformancePercent = (plannedMinutes: number | null | undefined, loggedOperationalMinutes: number | null | undefined) =>
  safeRatioPercent(plannedMinutes, loggedOperationalMinutes);

export const buildProductionDashboard = (entries: ProductionEntryWithMetricsRecord[], projectFiles: ProductionProjectFileSummaryRecord[], filters: DashboardFilters = {}) => {
  const filteredEntries = filterProductionEntries(entries, filters);
  const sum = (pick: (entry: ProductionEntryWithMetricsRecord) => number) => filteredEntries.reduce((total, entry) => total + (Number(pick(entry)) || 0), 0);
  const totalVolume = sum((entry) => entry.actual_volume_cut_m3);
  const totalOperationalMinutes = sum((entry) => entry.operational_minutes);
  const totalDowntimeMinutes = sum((entry) => entry.downtime_minutes);
  const totalInterruptionMinutes = sum((entry) => entry.interruption_minutes);
  const productionDays = new Set(filteredEntries.map((entry) => entry.entry_date));
  const month = filters.month ?? new Date().toISOString().slice(0, 7);
  const monthlyVolume = filteredEntries.filter((entry) => entry.entry_date.startsWith(month)).reduce((total, entry) => total + (Number(entry.actual_volume_cut_m3) || 0), 0);
  const projectIds = new Set(filteredEntries.map((entry) => entry.project_id));

  const byDate = new Map<string, { date: string; volume: number; operational: number; downtime: number; interruption: number }>();
  const byMonth = new Map<string, { month: string; volume: number }>();
  const byOperator = new Map<string, { operatorId: string; operator: string; entryCount: number; dates: Set<string>; operational: number; downtime: number; interruption: number; volume: number }>();
  for (const entry of filteredEntries) {
    const day = byDate.get(entry.entry_date) ?? { date: entry.entry_date, volume: 0, operational: 0, downtime: 0, interruption: 0 };
    day.volume += Number(entry.actual_volume_cut_m3) || 0; day.operational += entry.operational_minutes || 0; day.downtime += entry.downtime_minutes || 0; day.interruption += entry.interruption_minutes || 0; byDate.set(entry.entry_date, day);
    const monthKey = entry.entry_date.slice(0, 7); const monthly = byMonth.get(monthKey) ?? { month: monthKey, volume: 0 }; monthly.volume += Number(entry.actual_volume_cut_m3) || 0; byMonth.set(monthKey, monthly);
    const op = byOperator.get(entry.operator_profile_id) ?? { operatorId: entry.operator_profile_id, operator: entry.operator_name, entryCount: 0, dates: new Set<string>(), operational: 0, downtime: 0, interruption: 0, volume: 0 };
    op.entryCount += 1; op.dates.add(entry.entry_date); op.operational += entry.operational_minutes || 0; op.downtime += entry.downtime_minutes || 0; op.interruption += entry.interruption_minutes || 0; op.volume += Number(entry.actual_volume_cut_m3) || 0; byOperator.set(entry.operator_profile_id, op);
  }
  const dailyPerformance = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date)).map((day) => ({ ...day, utilization: utilizationPercent(day.operational, day.downtime, day.interruption) }));
  const finiteDaily = dailyPerformance.map((day) => day.utilization).filter((v): v is number => v !== null);
  const meanDailyUtilization = finiteDaily.length ? finiteDaily.reduce((a, b) => a + b, 0) / finiteDaily.length : null;
  const visibleProjectFiles = projectFiles.filter((file) => (!filters.project || file.project_id === filters.project) && (!filters.projectFile || file.project_file_id === filters.projectFile));

  return {
    kpis: { totalVolume, monthlyVolume, dailyOutput: productionDays.size ? totalVolume / productionDays.size : null, projectCount: projectIds.size, cuttingRate: totalOperationalMinutes > 0 ? totalVolume / (totalOperationalMinutes / 60) : null, totalOperationalMinutes, totalDowntimeMinutes, totalInterruptionMinutes, machineUtilization: utilizationPercent(totalOperationalMinutes, totalDowntimeMinutes, totalInterruptionMinutes) },
    projectRows: visibleProjectFiles.map((file) => ({ ...file, performance: projectPerformancePercent(file.total_time_minutes, file.total_logged_operational_minutes), utilization: utilizationPercent(file.total_logged_operational_minutes, file.total_downtime_minutes, file.total_interruption_minutes) })),
    dailyPerformance,
    meanDailyUtilization,
    dailyVolume: dailyPerformance.map((day) => ({ date: day.date, volume: day.volume })),
    monthlyVolume: [...byMonth.values()].sort((a, b) => a.month.localeCompare(b.month)).slice(-12),
    operators: [...byOperator.values()].sort((a, b) => a.operator.localeCompare(b.operator)).map((op) => ({ ...op, shiftCount: op.entryCount, productionDayCount: op.dates.size, utilization: utilizationPercent(op.operational, op.downtime, op.interruption), cuttingRate: op.operational > 0 ? op.volume / (op.operational / 60) : null })),
  };
};
