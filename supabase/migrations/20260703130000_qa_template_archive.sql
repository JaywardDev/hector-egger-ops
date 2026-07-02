-- Archive QA templates. Archived templates stay in the admin browser (and their
-- existing checklists keep working via the snapshot) but drop out of the
-- "start a checklist" picker. No effect on versioning or on already-started
-- checklists — archiving is purely "stop offering this template for new work".

alter table public.qa_template
  add column if not exists is_archived boolean not null default false,
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by_profile_id uuid references public.profiles (id) on delete set null;

create index if not exists qa_template_archived_idx on public.qa_template (is_archived);
