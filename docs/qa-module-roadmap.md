# QA Module — Implementation Roadmap

Status: **Guideline.** Companion to `docs/qa-module-design.md` (the *what* and
*why*). This document is the *how* and *in what order* — phases, tasks, exit
criteria, and which existing pattern each task clones. Check items off as they
land.

Deploy-first, prove-each-phase approach, matching the platform's working style.
Reuse over rebuild everywhere: the codebase already contains a working
versioned-import pipeline, a sign-off + audit pattern, a blob-storage pattern,
and a full module template — QA assembles these more than it invents.

Rough sizing (one experienced engineer, at the `/timesheet` + `/approval` bar):
**Phase 0 + Phase 1 ≈ 7–9 weeks.** Phases 2–4 are separately scoped.

---

## Legend

- `[ ]` not started · `[~]` in progress · `[x]` done
- **Reuse:** the existing file/pattern to copy-adapt
- **Exit:** the observable condition that means the phase is done

---

## Phase 0 — Foundation (schema + data layer + authz seam)

**Goal:** the real QA data model live in production, role-gated, with the
preview pages reading from Postgres instead of placeholder data. No changes to
CONQA or any external tooling.

### 0.1 Already done (do not repeat)
- [x] Corrected domain model + decisions — `docs/qa-module-design.md`
- [x] Preview UI in the app's UX: `/qa`, `/qa/projects/[projectId]`,
      `/qa/checklists/[checklistId]`, nav entry, QA-local components
- [x] View-shaped types + accessor seam — `src/lib/qa/{types,preview-data,access}.ts`

### 0.2 Database schema + migration
- [ ] Migration `supabase/migrations/<ts>_qa_foundation.sql` for the **spine only**:
      `qa_project`, `qa_section`, `qa_checklist`, `qa_check_item`, `qa_evidence`,
      `qa_signoff`, `qa_signoff_event`. **Reuse:** table/constraint/index style
      from `20260421120000_phase1_production_foundation.sql`.
- [ ] Template tables `qa_template`, `qa_template_version(source_id, version,
      fields_json, source_row_hash, imported_at)` — **append-only per version**.
- [ ] `qa_checklist` carries `template_version_id` FK **and** a `fields_snapshot`
      column (snapshot-on-instantiate, design §4.1). **Reuse:** the
      `*_snapshot` columns on `timesheet_entry_activities`.
- [ ] `qa_checklist.source_path text[]` hedge for imported folder depth (design §2.3).
- [ ] Status columns as text + CHECK constraints (`not_started` / `in_progress`
      / `awaiting_signoff` / `signed_off`), not Postgres enums. **Reuse:**
      `timesheet_entries_status_check`.
- [ ] Audit columns on every table: `created_by`, `created_at`, `updated_at` +
      `set_current_timestamp_updated_at` trigger. **Reuse:** existing trigger fn.

### 0.3 QA authorization model (isolated, per design §3)
> **Decision (parked hold point):** the rich per-hold-point authority is **not**
> being built for now while user handling is still being sorted. Accepted interim
> model: **shared identity (the same `profiles` / `user_roles` the timesheet
> feature uses), and any admin/supervisor may sign.** The signer's identity and
> timestamp are captured immutably (`qa_signoff.signed_by_profile_id` /
> `signed_at` + the append-only `qa_signoff_event` ledger) and surface in the
> Phase 2 report — which is the only hard requirement. The tables/helpers below
> become an **additive** layer on the same identity if management later wants
> stricter, per-signer authority; nothing here needs re-plumbing to get there.
- [ ] Tables `qa_assignment(profile_id, project_id, qa_role)`,
      `qa_signoff_authority(...)`, `qa_person_link(source_person_ref, profile_id)`.
- [ ] QA RLS helper functions, security-definer, reading **only** QA tables:
      `qa_current_can_read_project(project_id)`, `qa_current_can_sign(hold_point_id)`.
      **Reuse:** shape of `can_approved_actor_manage_timesheet_profile()`.
- [ ] RLS policies on every QA table using the QA helpers (plus the shared
      "approved user" gate for reads). **Reuse:** production/stock-take policies.
- [ ] Confirm **all three write layers** enforce authority (app assertion + RLS +
      CHECK), since mutations use the service-role client.

### 0.4 Data layer + wiring
- [ ] `src/lib/qa/data.ts` — real read queries via `createServerSupabaseClient`,
      returning the **same shapes** already in `types.ts`. **Reuse:**
      `src/lib/stock-take/data.ts`.
- [ ] Delete `preview-data.ts`; point pages at `data.ts` (drop-in — shapes match).
- [ ] Implement `requireQaReadAccess` for real in `access.ts` (currently delegates
      to the shared guard).
- [ ] Promote nav from the `internalTools` gate to a dedicated `"qa"` permission
      in `src/lib/permissions/navigation.ts` (+ `canAccessNavigationPermission` case).
- [ ] Remove the "Preview" notices from `ui-contract.ts` and the pages.

### 0.5 Tests
- [ ] Pure rule/unit tests for status transitions + immutability predicates.
      **Reuse:** `src/lib/timesheets/final-approval-rules.test.ts` style.

**Exit:** QA tables exist in prod with RLS; `/qa` renders real (initially empty)
data; role-gated; nothing external changed.

---

## Phase 1 — Connected capture MVP

**Goal:** an inspector can open a project, fill a checklist, attach compressed
photos, and route a hold point for sign-off — all online, in-app.

### 1a. C-base template + authority import (Phase A pipeline)
> Lowest-risk workstream — a near-clone of the timesheet lookup import. Can start
> as soon as 0.2/0.3 tables exist.
- [ ] `src/lib/qa/c-base-import.ts` — parse the C-base export (format TBD from the
      real query), validate, diff by **SHA-256 `source_row_hash`**, soft-deactivate
      missing rows. **Reuse wholesale:** `src/lib/timesheets/c-base-import.ts`.
- [ ] RPC `apply_qa_template_import(...)` with `INSERT … ON CONFLICT … DO UPDATE`
      + append a new `qa_template_version` per changed template. **Reuse:**
      `apply_c_base_timesheet_lookup_import`.
- [ ] Import of **QA authority** (roles / per-project assignment / signer rights)
      into `qa_assignment` + `qa_signoff_authority` from the same export.
- [ ] **Identity mapping:** match C-base people → `profiles` (by email); populate
      `qa_person_link`. Decide unknown-login policy (recommend read-only until matched).
- [ ] Import history table + dry-run mode + "fail loudly, keep last-known-good".
      **Reuse:** `timesheet_lookup_import_history` + the block-on-validation-error rule.
- [ ] Admin UI `/admin/qa-templates` (browser) + `/admin/qa-templates/import`
      (upload, dry-run, apply). **Reuse:** `app/(protected)/admin/timesheet-lookups`.
- [ ] Manual trigger first; move to a Vercel cron once cadence is predictable.
      **Reuse:** `vercel.json` cron + `CRON_SECRET` auth in `app/api/cron/*`.

### 1b. Checklist capture UI
- [ ] Server actions `src/lib/qa/actions.ts` to create/update check-item answers
      (Yes/No/NA + measurement value) via an atomic RPC. **Reuse:** the
      `create_production_entry_with_reasons` atomic-multi-row RPC + server-action
      wrapper pattern.
- [ ] Client capture component (the interactive part) — modelled on the
      `/timesheet` quality bar. **Reuse:** `stock-take-client.tsx` structure +
      `useActionState`.
- [ ] Snapshot the template version into the checklist on first instantiation.
- [ ] Optimistic/idempotent writes via a `client_mutation_id`. **Reuse:**
      `20260627120000_timesheet_entry_client_mutation_id.sql`.
- [ ] Validation as pure, tested functions.

### 1c. Evidence photos (Supabase Storage first — design §5)
- [ ] Private `qa-evidence` bucket; `qa_evidence` rows store metadata + storage path.
- [ ] Upload route `app/api/qa/evidence/route.ts` (auth-checked, size/type limits).
      **Reuse verbatim:** `app/api/profile/avatar/route.ts`.
- [ ] Serve route `app/api/qa/evidence/[id]/route.ts` (service-role, auth-gated).
      **Reuse:** `app/api/avatar/[profileId]/route.ts`.
- [ ] **Client-side compression/resize before upload** (canvas). **Reuse:** the
      avatar uploader's canvas resize. Provider-independent win.
- [ ] Thumbnails + lazy full-res load on checklist/report views.
- [ ] Replace the preview's dashed evidence tiles with real images.
- [ ] (Deferred to Phase 2+) R2 migration + four-tier lifecycle + `archive_location`
      — only after measuring real egress.

### 1d. Hold-point sign-off (generalise `/approval`)
- [ ] `qa_signoff` + `qa_signoff_event` write path with immutability:
      CHECK constraint (status ↔ `signed_at`/`signed_by`) + RLS `UPDATE` `USING`
      gate + app assertion. **Reuse:** the timesheet approval constraints +
      `timesheet_approval_events`.
- [ ] Corrections as **new versioned entries** with before/after JSONB snapshot.
      **Reuse:** `timesheet_entry_change_events`.
- [ ] Sign-off UI wired to the (currently disabled) preview affordances, using the
      shared `ConfirmDialog` / `FullScreenDialog` / `PendingButton`.
- [ ] Authority enforced via `qa_current_can_sign()` (from 0.3).
- [ ] **Copy-adapt, do not build a generic sign-off engine** (design §6).

**Exit:** real checklists (from C-base) can be filled, photographed, and signed
off online; signed records are immutable; every action is audited.

---

## Phase 2 — QA report generation (PDF)

**Goal:** reproducible per-lot/per-project QA report export.
- [ ] **Decide the PDF approach up front** (design §5.2 flag): a dependency
      (`pdf-lib` / React-PDF) vs. HTML→print. No PDF lib exists and hand-rolling
      PDF is far harder than the existing hand-rolled XLSX — treat as a real
      dependency decision, not a routine add.
- [ ] Build the report from the checklist's `fields_snapshot` + `template_version_id`
      (never the live template) so regeneration is deterministic.
- [ ] Reproducibility test: regenerate → byte/structure-stable output.
- [ ] Report served through an auth-gated route; large evidence pulled lazily.
- [ ] Optional: persist a report snapshot row for audit. **Reuse:**
      `stock_take_export_snapshots`.

**Exit:** any signed-off lot exports a correct PDF that regenerates identically.

---

## Phase 3 — Extensions (once the core loop is proven)
- [ ] Real-time monitoring / dashboards (open hold points, aging, pass-rate).
      **Reuse:** the production dashboard aggregation views/pattern.
- [ ] Custom analytics.
- [ ] **C-base Phase B — direct read access** (design §"Phase B"): least-privilege
      read-only DB user scoped to a view/replica; polling "what changed since last
      sync" with the same versioned-upsert pattern; webhooks only if justified.

**Exit:** live QA visibility; template/authority sync no longer needs manual export files.

---

## Phase 4 — Offline-first site capture (separately scoped)
- [ ] IndexedDB/local store + write queue + background photo-upload queue +
      conflict resolution. **Foundation exists:** the `client_mutation_id`
      idempotency pattern; the hard part is the photo queue. **Reference:**
      `docs/offline-timesheet-design.md`.

**Exit:** inspectors capture and sign fully offline; sync on reconnect.

---

## Cross-cutting (apply in every phase, not optional)

- **Audit trail:** who/created/edited/signed + when, on every record.
- **Immutability:** signed-off = read-only; corrections are new versioned rows.
- **RLS + app-layer + CHECK:** all three, because writes use the service role.
- **Identity mapping:** keep `qa_person_link` current as staff change.
- **Tests:** pure rule modules unit-tested (sign-off, immutability, import diff).
- **Isolation:** QA touches no existing module except the one nav entry + shared
  design-system/identity — preserves the freedom to pivot the authz model.

## Open questions to close before/at Phase 1 (from design §11)
- [ ] C-base export **format + cadence** for sheet definitions and authority.
- [x] ~~Authority model~~ **Parked (see §0.3):** any admin/supervisor signs,
      shared timesheet identity, signer captured immutably for the report.
      Revisit only if management wants stricter per-signer authority.
- [ ] Identity-mapping **key** (email vs. a stable C-base user id). *(Moot while
      authority is parked — shared `profiles` is the identity source.)*
- [ ] Unknown-login QA people: provision vs. read-only-until-matched. *(Moot
      while parked.)*
- [ ] Check-item **value types** (pass/fail/NA vs. numeric measurement vs. text).
- [ ] **PDF** approach (dependency vs. HTML→print) — before Phase 2.
