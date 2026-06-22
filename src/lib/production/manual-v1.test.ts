import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { ProductionEntryWithMetricsRecord } from "@/src/lib/production/types";
import { join } from "node:path";

const repoRoot = process.cwd();
const productionFiles = [
  "src/lib/production/types.ts",
  "src/lib/production/entries.ts",
  "src/lib/production/projects.ts",
  "app/(protected)/production/actions.ts",
  "app/(protected)/production/components/production-entry-form.tsx",
  "app/(protected)/production/projects/new/page.tsx",
  "app/(protected)/production/projects/[projectId]/page.tsx",
  "app/(protected)/production/entries/new/page.tsx",
  "app/(protected)/production/entries/[entryId]/page.tsx",
  "supabase/migrations/20260618120000_production_manual_v1_rebuild.sql",
];

test("production manual V1 uses approved project and entry field names", () => {
  const types = readFileSync(join(repoRoot, "src/lib/production/types.ts"), "utf8");
  assert.match(types, /total_time_minutes/);
  assert.match(types, /total_volume_m3/);
  assert.match(types, /entry_date/);
  assert.match(types, /run_through_break/);
  assert.match(types, /ProductionEntryReasonLine/);
});

test("production manual V1 keeps Run Through Break as stored boolean only", () => {
  const migration = readFileSync(join(repoRoot, "supabase/migrations/20260618120000_production_manual_v1_rebuild.sql"), "utf8");
  assert.match(migration, /run_through_break boolean not null default false/);
  assert.doesNotMatch(migration, /run_through_break.*(operational|downtime|interruption|volume|efficiency)/i);
});

test("production manual V1 totals downtime and interruption from child rows", () => {
  const migration = readFileSync(join(repoRoot, "supabase/migrations/20260618120000_production_manual_v1_rebuild.sql"), "utf8");
  assert.match(migration, /production_entry_downtime_reasons/);
  assert.match(migration, /production_entry_interruption_reasons/);
  assert.match(migration, /sum\(edr\.duration_minutes\) as downtime_minutes/);
  assert.match(migration, /sum\(eir\.duration_minutes\) as interruption_minutes/);
});

test("production manual V1 active sources reject forbidden free-text explanation fields", () => {
  const forbidden = /\b(notes?|comments?|remarks?)\b/i;
  const offenders = productionFiles.flatMap((file) => {
    const text = readFileSync(join(repoRoot, file), "utf8");
    return forbidden.test(text) ? [file] : [];
  });
  assert.deepEqual(offenders, []);
});

const atomicMigrationPath = "supabase/migrations/20260618143000_production_entry_atomic_rpc_and_import_cleanup.sql";

test("production entry writes use atomic RPCs instead of child-row REST sync", () => {
  const entries = readFileSync(join(repoRoot, "src/lib/production/entries.ts"), "utf8");
  assert.match(entries, /\/rest\/v1\/rpc\/create_production_entry_with_reasons/);
  assert.match(entries, /\/rest\/v1\/rpc\/update_production_entry_with_reasons/);
  assert.doesNotMatch(entries, /syncReasonRows/);
  assert.doesNotMatch(entries, /production_entry_downtime_reasons\?entry_id=eq/);
  assert.doesNotMatch(entries, /production_entry_interruption_reasons\?entry_id=eq/);
});

test("atomic production entry migration defines transactional RPCs and validates before update replacement", () => {
  const migration = readFileSync(join(repoRoot, atomicMigrationPath), "utf8");
  assert.match(migration, /create or replace function public\.create_production_entry_with_reasons/);
  assert.match(migration, /create or replace function public\.update_production_entry_with_reasons/);
  assert.match(migration, /perform public\.validate_production_entry_reason_rows\(p_downtime_reasons/);
  assert.match(migration, /perform public\.validate_production_entry_reason_rows\(p_interruption_reasons/);
  assert.match(migration, /Validate all replacement rows before deleting current rows/);
  assert.match(migration, /delete from public\.production_entry_downtime_reasons/);
});

test("production entry update action validates finite non-negative numbers before persistence", () => {
  const actions = readFileSync(join(repoRoot, "app/(protected)/production/actions.ts"), "utf8");
  assert.match(actions, /assertFiniteNonNegative\(timeRemainingStartMinutes, "Time Remaining Start"\)/);
  assert.match(actions, /assertFiniteNonNegative\(timeRemainingEndMinutes, "Time Remaining End"\)/);
  assert.match(actions, /assertFiniteNonNegative\(actualVolumeCutM3, "Actual Volume Cut"\)/);
  assert.ok(actions.indexOf("assertFiniteNonNegative(timeRemainingStartMinutes") < actions.indexOf("await updateProductionEntry"));
});

test("reason management allows admin and initial-admin but not plain approved users", () => {
  const access = readFileSync(join(repoRoot, "src/lib/production/access.ts"), "utf8");
  const actions = readFileSync(join(repoRoot, "app/(protected)/production/actions.ts"), "utf8");
  const page = readFileSync(join(repoRoot, "app/(protected)/production/reasons/page.tsx"), "utf8");
  assert.match(access, /roles\.includes\("admin"\) \|\| roles\.includes\("initial-admin"\)/);
  assert.match(access, /assertProductionReasonWriteAccess/);
  assert.doesNotMatch(access.match(/hasProductionReasonAdminRole[^\n]+/)?.[0] ?? "", /supervisor/);
  assert.match(actions, /const hasReasonAdminRole = hasProductionReasonAdminRole/);
  assert.match(page, /hasProductionReasonAdminRole\(roles\)/);
});

test("reason management links are hidden unless the user has a reason admin role", () => {
  const productionPage = readFileSync(join(repoRoot, "app/(protected)/production/page.tsx"), "utf8");
  const dashboardPage = readFileSync(join(repoRoot, "app/(protected)/dashboard/page.tsx"), "utf8");
  assert.match(productionPage, /const canManageReasons = hasProductionReasonAdminRole\(roles\)/);
  assert.match(productionPage, /canManageReasons \? \([\s\S]*Manage reasons/);
  assert.match(dashboardPage, /const canManageReasons = hasProductionReasonAdminRole\(roles\)/);
  assert.match(dashboardPage, /canManageReasons \? <Link[\s\S]*Reason Management/);
});

test("legacy production import RPCs are dropped and no import routes are linked", () => {
  const migration = readFileSync(join(repoRoot, atomicMigrationPath), "utf8");
  const productionPage = readFileSync(join(repoRoot, "app/(protected)/production/page.tsx"), "utf8");
  const dashboardPage = readFileSync(join(repoRoot, "app/(protected)/dashboard/page.tsx"), "utf8");
  assert.match(migration, /drop function if exists public\.apply_production_import/);
  assert.match(migration, /p\.proname in \('apply_production_import'\)/);
  assert.doesNotMatch(productionPage, /\/production\/import/);
  assert.doesNotMatch(dashboardPage, /\/production\/import/);
});

test("dashboard avoids forbidden Manual V1 efficiency and progress formulas", () => {
  const dashboardPage = readFileSync(join(repoRoot, "app/(protected)/dashboard/page.tsx"), "utf8");
  assert.doesNotMatch(dashboardPage, /Machine Efficiency|Project Efficiency|Project Progress/i);
});

const projectFilesMigrationPath = "supabase/migrations/20260622120000_production_project_files_priority1.sql";

test("production project files migration creates table and backfills projects safely", () => {
  const migration = readFileSync(join(repoRoot, projectFilesMigrationPath), "utf8");
  assert.match(migration, /create table if not exists public\.production_project_files/);
  assert.match(migration, /project_id uuid not null references public\.production_projects/);
  assert.match(migration, /project_file text not null/);
  assert.match(migration, /total_time_minutes integer/);
  assert.match(migration, /total_volume_m3 numeric\(12,3\)/);
  assert.match(migration, /insert into public\.production_project_files[\s\S]*from public\.production_projects p/);
  assert.doesNotMatch(migration, /group by p\.project_name/i);
  assert.doesNotMatch(migration, /delete from public\.production_projects/i);
});

test("production entries are linked to project files and new writes use project_file_id", () => {
  const migration = readFileSync(join(repoRoot, projectFilesMigrationPath), "utf8");
  const entries = readFileSync(join(repoRoot, "src/lib/production/entries.ts"), "utf8");
  const actions = readFileSync(join(repoRoot, "app/(protected)/production/actions.ts"), "utf8");
  assert.match(migration, /alter table public\.production_entries add column if not exists project_file_id/);
  assert.match(migration, /update public\.production_entries e[\s\S]*set project_file_id = pf\.id/);
  assert.match(migration, /alter table public\.production_entries alter column project_file_id set not null/);
  assert.match(entries, /p_project_file_id: input\.projectFileId/);
  assert.match(actions, /project_file_id/);
  assert.doesNotMatch(entries, /p_project_id: input\.projectId/);
});

test("project-file entry RPC migration drops old project_id signatures before recreation", () => {
  const migration = readFileSync(join(repoRoot, projectFilesMigrationPath), "utf8");
  const createDrop = /drop function if exists public\.create_production_entry_with_reasons\(\s*date,\s*uuid,\s*time without time zone,\s*time without time zone,\s*uuid,\s*integer,\s*integer,\s*numeric,\s*boolean,\s*uuid,\s*jsonb,\s*jsonb\s*\);/;
  const updateDrop = /drop function if exists public\.update_production_entry_with_reasons\(\s*uuid,\s*date,\s*uuid,\s*time without time zone,\s*time without time zone,\s*uuid,\s*integer,\s*integer,\s*numeric,\s*boolean,\s*jsonb,\s*jsonb\s*\);/;
  assert.match(migration, createDrop);
  assert.match(migration, updateDrop);
  assert.ok(migration.search(createDrop) < migration.indexOf("create or replace function public.create_production_entry_with_reasons"));
  assert.ok(migration.search(updateDrop) < migration.indexOf("create or replace function public.update_production_entry_with_reasons"));
  assert.doesNotMatch(migration, /drop function if exists public\.(create|update)_production_entry_with_reasons[\s\S]{0,240}cascade/i);
});

test("project-file entry RPCs expose project_file_id as caller input and restore grants", () => {
  const migration = readFileSync(join(repoRoot, projectFilesMigrationPath), "utf8");
  const createFunction = migration.slice(
    migration.indexOf("create or replace function public.create_production_entry_with_reasons"),
    migration.indexOf("create or replace function public.update_production_entry_with_reasons"),
  );
  const updateFunction = migration.slice(
    migration.indexOf("create or replace function public.update_production_entry_with_reasons"),
    migration.indexOf("grant select, insert, update, delete on public.production_project_files"),
  );
  assert.match(createFunction, /p_project_file_id uuid/);
  assert.match(updateFunction, /p_project_file_id uuid/);
  assert.doesNotMatch(createFunction, /p_project_id uuid/);
  assert.doesNotMatch(updateFunction, /p_project_id uuid/);
  assert.match(createFunction, /select project_id into resolved_project_id from public\.production_project_files where id = p_project_file_id/);
  assert.match(updateFunction, /select project_id into resolved_project_id from public\.production_project_files where id = p_project_file_id/);
  assert.match(createFunction, /insert into public\.production_entries[\s\S]*resolved_project_id, p_project_file_id/);
  assert.match(updateFunction, /project_id = resolved_project_id, project_file_id = p_project_file_id/);
  assert.match(migration, /grant execute on function public\.create_production_entry_with_reasons\(date, uuid, time, time, uuid, integer, integer, numeric, boolean, uuid, jsonb, jsonb\) to service_role;/);
  assert.match(migration, /grant execute on function public\.update_production_entry_with_reasons\(uuid, date, uuid, time, time, uuid, integer, integer, numeric, boolean, jsonb, jsonb\) to service_role;/);
});

test("project detail loads and edits project files without reintroducing production import", () => {
  const page = readFileSync(join(repoRoot, "app/(protected)/production/projects/[projectId]/page.tsx"), "utf8");
  const projects = readFileSync(join(repoRoot, "src/lib/production/projects.ts"), "utf8");
  const productionTree = productionFiles.map((file) => readFileSync(join(repoRoot, file), "utf8")).join("\n");
  assert.match(page, /listProductionProjectFileSummaries/);
  assert.match(page, /Project files/);
  assert.match(projects, /createProductionProjectFile/);
  assert.match(projects, /updateProductionProjectFile/);
  assert.doesNotMatch(productionTree, /\/production\/import/);
  assert.doesNotMatch(productionTree, /apply_production_import\(/);
});

test("entry form selects project files and preserves archived selections on edit", () => {
  const form = readFileSync(join(repoRoot, "app/(protected)/production/components/production-entry-form.tsx"), "utf8");
  const newPage = readFileSync(join(repoRoot, "app/(protected)/production/entries/new/page.tsx"), "utf8");
  const editPage = readFileSync(join(repoRoot, "app/(protected)/production/entries/[entryId]/page.tsx"), "utf8");
  assert.match(form, /name="project_file_id"/);
  assert.match(form, /activeProjectFiles = projectFiles\.filter\(\(project\) => !project\.is_archived \|\| project\.id === initialValues\?\.projectFileId\)/);
  assert.match(newPage, /projectFiles=\{projectFiles\.filter\(\(projectFile\) => !projectFile\.is_archived\)\}/);
  assert.match(editPage, /projectFileId: entry\.project_file_id/);
});

test("project-level planned totals are derived from project files", () => {
  const migration = readFileSync(join(repoRoot, projectFilesMigrationPath), "utf8");
  assert.match(migration, /create or replace view public\.production_project_summaries/);
  assert.match(migration, /sum\(pf\.total_time_minutes\)::integer as total_time_minutes/);
  assert.match(migration, /sum\(pf\.total_volume_m3\)::numeric\(12,3\) as total_volume_m3/);
  assert.doesNotMatch(migration, /select p\.id as project_id[\s\S]{0,120}p\.total_time_minutes/);
});

test("project-file priority 1 migration uses existing updated_at trigger helper", () => {
  const migration = readFileSync(join(repoRoot, projectFilesMigrationPath), "utf8");
  assert.match(migration, /execute function public\.set_current_timestamp_updated_at\(\)/);
  assert.doesNotMatch(migration, /public\.set_updated_at\(\)/);
});

test("production project-file write RLS matches project admin-or-supervisor write access", () => {
  const migration = readFileSync(join(repoRoot, projectFilesMigrationPath), "utf8");
  assert.match(migration, /production_project_files_insert_admin_or_supervisor[\s\S]*public\.is_current_user_admin_or_supervisor\(\)/);
  assert.match(migration, /production_project_files_update_admin_or_supervisor[\s\S]*public\.is_current_user_admin_or_supervisor\(\)/);
  assert.match(migration, /production_project_files_delete_admin_or_supervisor[\s\S]*public\.is_current_user_admin_or_supervisor\(\)/);
  assert.doesNotMatch(migration, /production_project_files_insert_operational[\s\S]{0,180}with check \(public\.is_current_user_approved\(\)\)/);
  assert.doesNotMatch(migration, /production_project_files_update_operational[\s\S]{0,220}public\.is_current_user_approved\(\)/);
  assert.doesNotMatch(migration, /production_project_files_delete_operational[\s\S]{0,180}using \(public\.is_current_user_approved\(\)\)/);
});

test("initial project creation uses atomic project-with-file RPC", () => {
  const migration = readFileSync(join(repoRoot, projectFilesMigrationPath), "utf8");
  const projects = readFileSync(join(repoRoot, "src/lib/production/projects.ts"), "utf8");
  assert.match(migration, /create or replace function public\.create_production_project_with_file/);
  assert.match(migration, /insert into public\.production_projects[\s\S]*returning \* into created_project[\s\S]*insert into public\.production_project_files/);
  assert.match(projects, /\/rest\/v1\/rpc\/create_production_project_with_file/);
  const createProjectBody = projects.slice(projects.indexOf("export const createProductionProject"), projects.indexOf("export const updateProductionProject"));
  assert.doesNotMatch(createProjectBody, /\/rest\/v1\/production_projects\?select/);
  assert.doesNotMatch(createProjectBody, /createProductionProjectFile\(/);
});

test("project-file uniqueness treats null project_sequence as not distinct per project and file", () => {
  const migration = readFileSync(join(repoRoot, projectFilesMigrationPath), "utf8");
  assert.match(migration, /create unique index if not exists production_project_files_project_file_sequence_unique_idx on public\.production_project_files \(project_id, project_file, project_sequence\) nulls not distinct/);
  assert.match(migration, /pf\.project_sequence is not distinct from p\.project_sequence/);
});

test("project-file dropdown labels include project name", () => {
  const form = readFileSync(join(repoRoot, "app/(protected)/production/components/production-entry-form.tsx"), "utf8");
  const types = readFileSync(join(repoRoot, "src/lib/production/types.ts"), "utf8");
  const projects = readFileSync(join(repoRoot, "src/lib/production/projects.ts"), "utf8");
  assert.match(types, /project_name: string/);
  assert.match(projects, /production_projects\(project_name\)/);
  assert.match(form, /project\.project_name} — \{project\.project_file/);
});

test("formatMinutesAsDuration renders HH:MM durations without wrapping at 24 hours", async () => {
  const { formatMinutesAsDuration } = await import("@/src/lib/production/format");
  assert.equal(formatMinutesAsDuration(0), "00:00");
  assert.equal(formatMinutesAsDuration(30), "00:30");
  assert.equal(formatMinutesAsDuration(75), "01:15");
  assert.equal(formatMinutesAsDuration(4200), "70:00");
  assert.equal(formatMinutesAsDuration(4235), "70:35");
});

test("production UI uses duration formatting instead of decimal operational hours", () => {
  const form = readFileSync("app/(protected)/production/components/production-entry-form.tsx", "utf8");
  const dashboard = readFileSync("app/(protected)/dashboard/page.tsx", "utf8");
  const entries = readFileSync("app/(protected)/production/entries/page.tsx", "utf8");
  assert.match(form, /formatMinutesAsDuration\(warnings\.operational\)/);
  assert.match(form, /Operational Duration/);
  assert.doesNotMatch(form, /toFixed\(2\)/);
  assert.match(dashboard, /formatMinutesAsDuration\(totalOperationalMinutes\)/);
  assert.match(entries, /formatMinutesAsDuration\(entry\.operational_minutes\)/);
});

test("new production entry defaults operator to current profile while edit preserves existing operator", () => {
  const newPage = readFileSync("app/(protected)/production/entries/new/page.tsx", "utf8");
  const editPage = readFileSync("app/(protected)/production/entries/[entryId]/page.tsx", "utf8");
  assert.match(newPage, /operatorProfileId: profile\?\.id \?\? operators\[0\]\?\.profile_id/);
  assert.match(editPage, /operatorProfileId: selectedOperatorId/);
});

test("production new entry prefill uses project_file_id latest end and preserves manual or edit values", () => {
  const entriesData = readFileSync("src/lib/production/entries.ts", "utf8");
  const form = readFileSync("app/(protected)/production/components/production-entry-form.tsx", "utf8");
  const newPage = readFileSync("app/(protected)/production/entries/new/page.tsx", "utf8");
  assert.match(entriesData, /listLatestTimeRemainingEndByProjectFile/);
  assert.match(entriesData, /select: "project_file_id,time_remaining_end_minutes/);
  assert.match(entriesData, /order: "entry_date\.desc,created_at\.desc,updated_at\.desc,id\.desc"/);
  assert.doesNotMatch(entriesData, /project_id=eq/);
  assert.match(newPage, /latestTimeRemainingEndByProjectFile=\{latestTimeRemainingEndByProjectFile\}/);
  assert.match(form, /latestTimeRemainingEndByProjectFile\[initialProjectFileId\]/);
  assert.match(form, /latestTimeRemainingEndByProjectFile\[nextProjectFileId\]/);
  assert.match(form, /timeRemainingStartTouched/);
  assert.match(form, /initialValues\?\.entryId \? undefined : latestTimeRemainingEndByProjectFile/);
});

test("project detail shows project-file progress from file summaries with display-only calculations", () => {
  const page = readFileSync(join(repoRoot, "app/(protected)/production/projects/[projectId]/page.tsx"), "utf8");
  const projects = readFileSync(join(repoRoot, "src/lib/production/projects.ts"), "utf8");
  const types = readFileSync(join(repoRoot, "src/lib/production/types.ts"), "utf8");
  assert.match(projects, /listProductionProjectFileSummaries/);
  assert.match(projects, /production_project_file_summaries/);
  assert.match(types, /ProductionProjectFileSummaryRecord/);
  assert.match(page, /listProductionProjectFileSummaries/);
  assert.match(page, /Planned time: \{formatMinutesAsDuration\(file\.total_time_minutes\)\}/);
  assert.match(page, /Logged duration: \{formatMinutesAsDuration\(file\.total_logged_operational_minutes\)\}/);
  assert.match(page, /Downtime duration: \{formatMinutesAsDuration\(file\.total_downtime_minutes\)\}/);
  assert.match(page, /Interruption duration: \{formatMinutesAsDuration\(file\.total_interruption_minutes\)\}/);
  assert.match(page, /Latest Time Remaining End: \{formatMinutesAsDuration\(file\.latest_time_remaining_minutes\)\}/);
  assert.match(page, /Planned volume: \{formatCubicMetres\(file\.total_volume_m3\)\}/);
  assert.match(page, /Actual volume cut: \{formatCubicMetres\(file\.total_volume_cut_m3\)\}/);
});

test("project detail calculates remaining and overrun states without negative or NaN displays", () => {
  const page = readFileSync(join(repoRoot, "app/(protected)/production/projects/[projectId]/page.tsx"), "utf8");
  assert.match(page, /const getRemainingValue/);
  assert.match(page, /Math\.max\(0, planned - \(logged \?\? 0\)\)/);
  assert.match(page, /const getOverValue/);
  assert.match(page, /Math\.max\(0, \(logged \?\? 0\) - planned\)/);
  assert.match(page, /Over planned by: \$\{formatMinutesAsDuration\(overPlannedTime\)\}/);
  assert.match(page, /Remaining planned time: \$\{formatMinutesAsDuration\(remainingTime\)\}/);
  assert.match(page, /Over volume by: \$\{formatCubicMetres\(overVolume\)\}/);
  assert.match(page, /Remaining volume: \$\{formatCubicMetres\(remainingVolume\)\}/);
  assert.match(page, /planned == null \|\| planned <= 0 \|\| !Number\.isFinite\(planned\)/);
  assert.match(page, /return "—"/);
  assert.match(page, /Time progress: \{timeProgress\}/);
  assert.match(page, /Volume progress: \{volumeProgress\}/);
});

test("project detail keeps project-file controls and labels project totals as file-derived", () => {
  const page = readFileSync(join(repoRoot, "app/(protected)/production/projects/[projectId]/page.tsx"), "utf8");
  assert.match(page, /Total planned time from files/);
  assert.match(page, /Total planned volume from files/);
  assert.match(page, /Total logged duration/);
  assert.match(page, /Total actual volume/);
  assert.match(page, /file\.is_archived \? "Archived" : "Active"/);
  assert.match(page, /updateProductionProjectFileFormAction/);
  assert.match(page, /createProductionProjectFileFormAction/);
  assert.match(page, /<Button type="submit">Save file<\/Button>/);
  assert.match(page, /<Button type="submit">Add file<\/Button>/);
});

test("production performance dashboard helpers calculate safe KPIs, grouped chart data, and filters", async () => {
  const { buildProductionDashboard, formatRate, formatVolume, formatPercent } = await import("@/src/lib/production/performance-dashboard");
  const entries: ProductionEntryWithMetricsRecord[] = [
    { id: "e1", entry_date: "2026-06-01", operator_profile_id: "op1", operator_name: "Jayward", project_id: "p1", project_file_id: "f1", project_file: "A", project_name: "Alpine", project_sequence: 105, actual_volume_cut_m3: 6, operational_minutes: 120, downtime_minutes: 30, interruption_minutes: 0, start_time: "07:00", finish_time: "09:00", time_remaining_start_minutes: 120, time_remaining_end_minutes: 0, run_through_break: false, created_by_profile_id: "u1", created_at: "2026-06-01", updated_at: "2026-06-01", project_file_done_minutes: 120, downtime_reasons: [], interruption_reasons: [] },
    { id: "e2", entry_date: "2026-06-02", operator_profile_id: "op1", operator_name: "Jayward", project_id: "p1", project_file_id: "f1", project_file: "A", project_name: "Alpine", project_sequence: 105, actual_volume_cut_m3: 4, operational_minutes: 0, downtime_minutes: 0, interruption_minutes: 0, start_time: "09:00", finish_time: "09:00", time_remaining_start_minutes: 0, time_remaining_end_minutes: 0, run_through_break: false, created_by_profile_id: "u1", created_at: "2026-06-02", updated_at: "2026-06-02", project_file_done_minutes: 120, downtime_reasons: [], interruption_reasons: [] },
    { id: "e3", entry_date: "2026-05-31", operator_profile_id: "op2", operator_name: "Angel", project_id: "p2", project_file_id: "f2", project_file: "B", project_name: "Beta", project_sequence: 108, actual_volume_cut_m3: 3, operational_minutes: 60, downtime_minutes: 0, interruption_minutes: 30, start_time: "10:00", finish_time: "11:00", time_remaining_start_minutes: 60, time_remaining_end_minutes: 0, run_through_break: false, created_by_profile_id: "u2", created_at: "2026-05-31", updated_at: "2026-05-31", project_file_done_minutes: 60, downtime_reasons: [], interruption_reasons: [] },
  ];
  const files = [
    { project_file_id: "f1", project_id: "p1", project_file: "A", project_name: "Alpine", project_sequence: 105, total_time_minutes: 100, total_volume_m3: 10, total_logged_operational_minutes: 120, total_volume_cut_m3: 10, total_downtime_minutes: 30, total_interruption_minutes: 0, latest_time_remaining_minutes: 0, is_archived: false },
    { project_file_id: "f2", project_id: "p2", project_file: "B", project_name: "Beta", project_sequence: 108, total_time_minutes: null, total_volume_m3: 3, total_logged_operational_minutes: 0, total_volume_cut_m3: 3, total_downtime_minutes: 0, total_interruption_minutes: 0, latest_time_remaining_minutes: null, is_archived: false },
  ];
  const dashboard = buildProductionDashboard(entries, files, { dateFrom: "2026-06-01", dateTo: "2026-06-30", project: "p1", month: "2026-06" });
  assert.equal(formatVolume(dashboard.kpis.totalVolume), "10.00 m³");
  assert.equal(formatRate(dashboard.kpis.cuttingRate), "5.00 m³/h");
  assert.equal(dashboard.kpis.dailyOutput, 5);
  assert.equal(dashboard.kpis.projectCount, 1);
  assert.equal(dashboard.dailyPerformance.length, 2);
  assert.equal(dashboard.dailyVolume[0].date, "2026-06-01");
  assert.equal(dashboard.monthlyVolume[0].month, "2026-06");
  assert.equal(formatPercent(dashboard.projectRows[0].performance), "83.3%");
  assert.equal(dashboard.projectRows.some((row) => row.project_id === "p2"), false);
  assert.equal(dashboard.operators[0].shiftCount, 2);
  assert.doesNotMatch(JSON.stringify(dashboard), /NaN|Infinity/);
});

test("production dashboard page exposes required sections and does not reintroduce import links", () => {
  const page = readFileSync(join(repoRoot, "app/(protected)/production/page.tsx"), "utf8");
  assert.match(page, /Production Performance Dashboard/);
  assert.match(page, /Total Volume Cut/);
  assert.match(page, /Monthly Volume/);
  assert.match(page, /Daily Output/);
  assert.match(page, /Cutting Rate/);
  assert.match(page, /Project Summary/);
  assert.match(page, /Daily Performance/);
  assert.match(page, /Daily Volume/);
  assert.match(page, /Monthly Volume Produced/);
  assert.match(page, /Operational Duration vs Downtime/);
  assert.match(page, /Operators Summary/);
  assert.match(page, /formatMinutesAsDuration/);
  assert.match(page, /formatVolume/);
  assert.match(page, /formatRate/);
  assert.match(page, /formatPercent/);
  assert.doesNotMatch(page, /\/production\/import/);
});
