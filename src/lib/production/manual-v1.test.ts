import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
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
  assert.match(page, /listProductionProjectFiles/);
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
