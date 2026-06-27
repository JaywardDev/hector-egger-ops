-- Idempotency key for timesheet entry writes. A client generates a UUID per save
-- mutation so a replayed offline submit can be de-duplicated instead of writing
-- the same entry twice. Nullable: normal online saves may omit it.
alter table public.timesheet_entries
  add column if not exists client_mutation_id uuid;

-- Enforce global uniqueness of provided mutation ids at the database level so a
-- duplicate replay is rejected even if the application-level check races.
create unique index if not exists timesheet_entries_client_mutation_id_unique_idx
  on public.timesheet_entries (client_mutation_id)
  where client_mutation_id is not null;
