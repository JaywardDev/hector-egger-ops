# Offline Timesheet Entry — Design Doc (Tier 3)

Status: **Proposed** — not yet implemented. Tier 1 (app-shell precache + offline
fallback page) has shipped; this document scopes the larger "true offline data
entry" effort, focused on the **timesheet entry** workflow.

## Goal

Let an approved staff member fill in and save daily timesheet entries while their
device has no/poor connectivity (on-site, in the factory). Entries are stored
locally, queued, and synced to the server automatically when connectivity
returns, with clear UI showing what is pending and what has synced.

Out of scope for Tier 3: offline approvals, offline stock take, offline editing
of already-approved entries. (Stock take can reuse the same queue infrastructure
in a later phase.)

## Why this is non-trivial in the current architecture

- **Writes go through Next.js server actions** (`saveTimesheetEntryAction`),
  which depend on cookies/RLS and are not plain, replayable REST endpoints. A
  service-worker Background Sync queue can only reliably replay a normal
  `fetch()` to a stable URL.
- **Pages are auth-gated RSC** and are deliberately *not* cached as HTML (see the
  Tier 1 SW comment). The offline form must be able to render from cached static
  assets plus locally stored data, not from cached server HTML.
- **Validation currently lives server-side** (`validateTimesheetEntryInput` +
  lookup-id checks). Offline entry needs enough of that logic client-side to
  catch errors before the user walks away, while the server stays the source of
  truth on replay.

## Proposed architecture

### 1. Dedicated idempotent write endpoint

Add `POST /api/timesheet/entries` (route handler, not a server action) that:

- Authenticates via the existing Supabase session cookie (works from the SW
  replay because cookies are sent with same-origin `fetch`).
- Accepts a single entry payload **plus a client-generated `client_mutation_id`
  (UUID)**.
- Is **idempotent**: a unique constraint / upsert keyed on
  `(profile_id, work_date)` plus a dedupe check on `client_mutation_id` so a
  replayed request that already succeeded returns 200 without double-writing.
- Reuses `validateTimesheetEntryInput` and the existing atomic save logic so the
  server remains the validation authority.
- Returns the canonical saved entry so the client can reconcile local state.

The existing server action can delegate to the same internal function to avoid
two code paths diverging.

Migration: add `client_mutation_id uuid` (nullable, unique where not null) to
`timesheet_entries`, or a separate `timesheet_mutations` ledger table if we want
a full audit trail of replays.

### 2. Client-side draft + outbox store (IndexedDB)

- Use a small IndexedDB wrapper (e.g. `idb`) with two stores:
  - `drafts`: in-progress entries keyed by `work_date` (last-write-wins locally).
  - `outbox`: queued mutations `{ client_mutation_id, payload, status, attempts,
    lastError }`.
- The timesheet form reads/writes drafts so a half-filled day survives reload and
  offline.
- On submit:
  - If **online**: POST directly; on success clear the draft.
  - If **offline**: enqueue in `outbox`, mark the day "Pending sync" in the UI.

### 3. Background sync + reconciliation

- Register a Background Sync tag (`timesheet-outbox`) when an item is queued; the
  SW wakes on reconnect and POSTs queued items in order.
- **Fallback for browsers without Background Sync** (notably iOS Safari): also
  flush the outbox on `online` events and on app foreground/visibilitychange.
- On each replay: 200 → remove from outbox + update local entry; 4xx validation
  error → mark item `failed` with the server message and surface it for the user
  to fix; network error → leave queued, increment `attempts` with backoff.
- Conflict policy: if the server entry was modified after the queued draft (e.g.
  a supervisor corrected it), the replay is rejected and the user is shown a
  "this day changed on the server" prompt rather than silently overwriting.

### 4. Client-side validation parity

- Extract the pure parts of `validateTimesheetEntryInput` into a module that is
  safe to import client-side (no `server-only`, no Supabase). Lookup IDs
  (projects/tasks for the user's staff group) are cached in IndexedDB when last
  online so offline validation can check them.

### 5. UX

- Per-day status chip: **Draft**, **Pending sync**, **Synced**, **Sync failed**.
- A global "X changes waiting to sync" indicator (e.g. in the header or on the
  timesheet page) with a manual "Retry sync" affordance.
- Clear messaging that offline entries are not submitted for approval until they
  sync.
- An offline indicator (reuse `navigator.onLine` + the existing SW) so users know
  they are working offline.

## Data integrity & security notes

- Idempotency keys are mandatory — Background Sync can replay the same request
  multiple times.
- The server must re-run **all** authorization and validation on replay; never
  trust the client payload's status/identity fields. `profile_id` is always
  derived from the session, never from the payload.
- IndexedDB is per-origin and unencrypted; avoid storing anything beyond the
  user's own timesheet drafts. Clear local stores on sign-out.

## Rollout plan (suggested phases)

1. **Endpoint + idempotency**: ship `POST /api/timesheet/entries` and route the
   existing online form through it (no offline yet). De-risks the server half.
2. **Drafts in IndexedDB**: persist in-progress form state locally; survives
   reload. Still online-only submit.
3. **Outbox + manual sync**: queue submits when offline, flush on `online` event
   with a visible pending/retry UI. Works on all browsers.
4. **Background Sync**: add the SW sync tag for automatic background flush where
   supported.
5. **Conflict handling polish** and optional extension of the outbox to stock
   take.

## Estimate

Rough order of magnitude: phases 1–3 are the bulk of the value and the safest to
ship incrementally; phase 4–5 are smaller add-ons. Each phase is independently
deployable behind the existing patch workflow.

## Open questions for product

- How many days back should offline entry be allowed (current week only, or
  prior weeks now that approvals support prior-week review)?
- Should a queued-but-not-synced day count against the "unsubmitted days"
  reminder banner, or be treated as effectively submitted?
- Is automatic submission-for-approval on sync desired, or should sync only save
  the entry and leave submission as a separate explicit action?
