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
