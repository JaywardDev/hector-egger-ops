import "server-only";

import { createServerSupabaseClient } from "@/src/lib/supabase/server";
import type { StaffGroup } from "@/src/lib/timesheets/types";
import { createSessionHeaders, type TimesheetActor } from "@/src/lib/timesheets/access";

export type TimesheetLookupTable = "projects" | "tasks";
export type LookupStatusFilter = "all" | "active" | "inactive";
export type LookupSourceFilter = "all" | "c_base" | "manual" | "other";
export type LookupVisibilityFilter = "all" | StaffGroup | "none";

export type TimesheetLookupBrowserFilters = {
  table: TimesheetLookupTable;
  search: string;
  status: LookupStatusFilter;
  source: LookupSourceFilter;
  visibility: LookupVisibilityFilter;
  inactiveReason: string;
  sort: string;
  direction: "asc" | "desc";
  page: number;
  pageSize: 25 | 50 | 100;
};

export type TimesheetLookupBrowserRow = {
  id: string;
  code: string;
  label: string;
  source_system: string;
  is_active: boolean;
  visible_to_staff_groups: StaffGroup[];
  inactive_reason: string | null;
  inactive_at: string | null;
  last_seen_at: string | null;
  updated_at: string;
  created_at: string;
};

export type TimesheetLookupBrowserResult = {
  rows: TimesheetLookupBrowserRow[];
  totalCount: number;
  sourceValues: string[];
  inactiveReasonValues: string[];
};

const tablePath = (table: TimesheetLookupTable) =>
  table === "projects" ? "/rest/v1/timesheet_projects" : "/rest/v1/timesheet_tasks";

const sortableColumns = new Set([
  "code",
  "label",
  "is_active",
  "source_system",
  "last_seen_at",
  "updated_at",
  "inactive_at",
]);

export const sanitizeLookupFilters = (
  input: Partial<Record<string, string | string[] | undefined>>,
): TimesheetLookupBrowserFilters => {
  const take = (key: string) => {
    const value = input[key];
    return Array.isArray(value) ? value[0] : value;
  };

  const table = take("tab") === "tasks" ? "tasks" : "projects";
  const search = (take("q") ?? "").trim();
  const status = (["all", "active", "inactive"] as const).includes((take("status") ?? "all") as LookupStatusFilter)
    ? ((take("status") ?? "all") as LookupStatusFilter)
    : "all";
  const source = (["all", "c_base", "manual", "other"] as const).includes((take("source") ?? "all") as LookupSourceFilter)
    ? ((take("source") ?? "all") as LookupSourceFilter)
    : "all";
  const visibility = (["all", "factory", "site", "office", "none"] as const).includes((take("visibility") ?? "all") as LookupVisibilityFilter)
    ? ((take("visibility") ?? "all") as LookupVisibilityFilter)
    : "all";
  const inactiveReason = (take("inactiveReason") ?? "all").trim() || "all";
  const sortCandidate = (take("sort") ?? "code").trim();
  const sort = sortableColumns.has(sortCandidate) ? sortCandidate : "code";
  const direction = take("direction") === "desc" ? "desc" : "asc";
  const page = Math.max(1, Number.parseInt(take("page") ?? "1", 10) || 1);
  const pageSizeRaw = Number.parseInt(take("pageSize") ?? "50", 10);
  const pageSize = (pageSizeRaw === 25 || pageSizeRaw === 50 || pageSizeRaw === 100 ? pageSizeRaw : 50) as 25 | 50 | 100;

  return { table, search, status, source, visibility, inactiveReason, sort, direction, page, pageSize };
};

export const listTimesheetLookupsForAdmin = async (
  actor: TimesheetActor,
  filters: TimesheetLookupBrowserFilters,
): Promise<TimesheetLookupBrowserResult> => {
  const supabase = createServerSupabaseClient();
  const params = new URLSearchParams({
    select: "id,code,label,source_system,is_active,visible_to_staff_groups,inactive_reason,inactive_at,last_seen_at,updated_at,created_at",
    order: `${filters.sort}.${filters.direction},code.asc`,
    offset: String((filters.page - 1) * filters.pageSize),
    limit: String(filters.pageSize),
  });

  if (filters.search) {
    params.set("or", `code.ilike.*${filters.search}*,label.ilike.*${filters.search}*`);
  }
  if (filters.status === "active") params.set("is_active", "eq.true");
  if (filters.status === "inactive") params.set("is_active", "eq.false");
  if (filters.source === "c_base") params.set("source_system", "eq.c_base");
  if (filters.source === "manual") params.set("source_system", "eq.manual");
  if (filters.source === "other") params.set("source_system", "not.in.(c_base,manual)");
  if (filters.visibility === "none") params.set("visible_to_staff_groups", "eq.{}");
  if (filters.visibility === "factory" || filters.visibility === "site" || filters.visibility === "office") {
    params.set("visible_to_staff_groups", `cs.{${filters.visibility}}`);
  }
  if (filters.inactiveReason !== "all") {
    params.set("inactive_reason", `eq.${filters.inactiveReason}`);
  }

  const headers = createSessionHeaders(actor.session);
  const [rowsResponse, countResponse, sourceResponse, reasonResponse] = await Promise.all([
    supabase.request(`${tablePath(filters.table)}?${params.toString()}`, { cache: "no-store", headers }),
    supabase.request(`${tablePath(filters.table)}?select=id`, { cache: "no-store", headers }),
    supabase.request(`${tablePath(filters.table)}?select=source_system`, { cache: "no-store", headers }),
    supabase.request(`${tablePath(filters.table)}?select=inactive_reason&inactive_reason=not.is.null`, { cache: "no-store", headers }),
  ]);

  if (!rowsResponse.ok || !countResponse.ok || !sourceResponse.ok || !reasonResponse.ok) {
    throw new Error("Failed to load admin timesheet lookups");
  }

  const rows = (await rowsResponse.json()) as TimesheetLookupBrowserRow[];
  const countRows = (await countResponse.json()) as Array<{ id: string }>;
  const sourceRows = (await sourceResponse.json()) as Array<{ source_system: string }>;
  const reasonRows = (await reasonResponse.json()) as Array<{ inactive_reason: string | null }>;

  return {
    rows,
    totalCount: countRows.length,
    sourceValues: Array.from(new Set(sourceRows.map((row) => row.source_system))).sort(),
    inactiveReasonValues: Array.from(new Set(reasonRows.map((row) => row.inactive_reason).filter(Boolean) as string[])).sort(),
  };
};
