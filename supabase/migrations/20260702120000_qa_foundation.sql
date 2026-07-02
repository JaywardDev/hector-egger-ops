-- QA module — Phase 0 foundation (docs/qa-module-design.md, docs/qa-module-roadmap.md §0.2).
--
-- Template tables (home for the Phase 1a parser output), the Option C structure
-- spine (project -> optional section -> checklist -> check item), and the
-- capture/evidence/sign-off/audit tables. RLS throughout, consistent with the
-- production and stock-take modules.
--
-- Authorization: this phase uses thin QA permission helpers that currently defer
-- to the shared identity model (approved user / admin-supervisor). Phase 0.3
-- replaces the helper *bodies* with the isolated, C-base-driven per-hold-point
-- authority (design §3) — the policies below reference the helpers, so that
-- swap will not touch this schema.

-- ---------------------------------------------------------------------------
-- QA permission helpers (the Phase 0.3 seam)
-- ---------------------------------------------------------------------------

create or replace function public.qa_can_read()
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_current_user_approved();
$$;

create or replace function public.qa_can_configure()
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_current_user_admin_or_supervisor();
$$;

-- Phase 0 placeholder: any admin/supervisor may sign. Phase 0.3 replaces this
-- with the per-hold-point, C-base-driven authority.
create or replace function public.qa_can_sign()
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_current_user_admin_or_supervisor();
$$;

-- Operational capture: approved operator/supervisor/admin may fill checklists.
create or replace function public.qa_can_capture()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.profiles p
    join public.user_roles ur on ur.profile_id = p.id
    where p.auth_user_id = auth.uid()
      and p.account_status = 'approved'
      and ur.role in ('admin', 'supervisor', 'operator')
  );
$$;

grant execute on function public.qa_can_read() to authenticated;
grant execute on function public.qa_can_configure() to authenticated;
grant execute on function public.qa_can_sign() to authenticated;
grant execute on function public.qa_can_capture() to authenticated;

-- ---------------------------------------------------------------------------
-- Template tables (mirrored from C-base; qa_template_version is append-only)
-- ---------------------------------------------------------------------------

create table if not exists public.qa_template (
  id uuid primary key default gen_random_uuid(),
  source_id text not null unique,
  name text not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.qa_template_version (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.qa_template (id) on delete cascade,
  source_id text not null,
  version integer not null check (version >= 1),
  name text not null,
  fields_json jsonb not null,
  raw_rows jsonb,
  source_row_hash text not null,
  imported_by_profile_id uuid references public.profiles (id) on delete set null,
  imported_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  constraint qa_template_version_template_version_unique unique (template_id, version)
);

create index if not exists qa_template_version_template_idx on public.qa_template_version (template_id, version desc);
create index if not exists qa_template_version_hash_idx on public.qa_template_version (source_row_hash);

-- ---------------------------------------------------------------------------
-- Structure: project -> optional section -> checklist -> check item
-- ---------------------------------------------------------------------------

create table if not exists public.qa_project (
  id uuid primary key default gen_random_uuid(),
  source_project_ref text,
  name text not null,
  lot_code text,
  status text not null default 'not_started'
    check (status in ('not_started', 'in_progress', 'awaiting_signoff', 'signed_off')),
  archive_location text,
  is_archived boolean not null default false,
  created_by_profile_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists qa_project_source_ref_unique
  on public.qa_project (source_project_ref) where source_project_ref is not null;
create index if not exists qa_project_status_idx on public.qa_project (status);
create index if not exists qa_project_archived_idx on public.qa_project (is_archived);

create table if not exists public.qa_section (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.qa_project (id) on delete cascade,
  name text not null,
  sort_order integer not null default 0,
  source_path text[],
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists qa_section_project_idx on public.qa_section (project_id, sort_order);

create table if not exists public.qa_checklist (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.qa_project (id) on delete cascade,
  section_id uuid references public.qa_section (id) on delete set null,
  template_version_id uuid not null references public.qa_template_version (id) on delete restrict,
  fields_snapshot jsonb not null,
  source_path text[],
  code text not null,
  title text not null,
  status text not null default 'not_started'
    check (status in ('not_started', 'in_progress', 'awaiting_signoff', 'signed_off')),
  signed_off_at timestamptz,
  signed_off_by_profile_id uuid references public.profiles (id) on delete set null,
  created_by_profile_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint qa_checklist_signoff_metadata check (
    (status = 'signed_off' and signed_off_at is not null and signed_off_by_profile_id is not null)
    or (status <> 'signed_off' and signed_off_at is null and signed_off_by_profile_id is null)
  )
);

create index if not exists qa_checklist_project_idx on public.qa_checklist (project_id);
create index if not exists qa_checklist_section_idx on public.qa_checklist (section_id);
create index if not exists qa_checklist_template_version_idx on public.qa_checklist (template_version_id);
create index if not exists qa_checklist_status_idx on public.qa_checklist (status);

create table if not exists public.qa_check_item (
  id uuid primary key default gen_random_uuid(),
  checklist_id uuid not null references public.qa_checklist (id) on delete cascade,
  source_item_id text not null,
  item_type text not null check (item_type in ('select', 'note', 'signoff')),
  label text not null,
  options jsonb,
  selected_value text,
  answered_by_profile_id uuid references public.profiles (id) on delete set null,
  answered_at timestamptz,
  sort_order integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint qa_check_item_checklist_source_unique unique (checklist_id, source_item_id)
);

create index if not exists qa_check_item_checklist_idx on public.qa_check_item (checklist_id, sort_order);

-- ---------------------------------------------------------------------------
-- Evidence, sign-off, audit ledger
-- ---------------------------------------------------------------------------

create table if not exists public.qa_evidence (
  id uuid primary key default gen_random_uuid(),
  checklist_id uuid not null references public.qa_checklist (id) on delete cascade,
  check_item_id uuid references public.qa_check_item (id) on delete cascade,
  storage_path text not null,
  caption text,
  content_type text,
  byte_size integer check (byte_size is null or byte_size >= 0),
  added_by_profile_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists qa_evidence_checklist_idx on public.qa_evidence (checklist_id);
create index if not exists qa_evidence_check_item_idx on public.qa_evidence (check_item_id);

create table if not exists public.qa_signoff (
  id uuid primary key default gen_random_uuid(),
  checklist_id uuid not null references public.qa_checklist (id) on delete cascade,
  source_item_id text,
  label text not null,
  kind text not null default 'signoff' check (kind in ('signoff', 'hold', 'witness')),
  status text not null default 'pending' check (status in ('pending', 'signed', 'returned')),
  signed_by_profile_id uuid references public.profiles (id) on delete set null,
  signed_at timestamptz,
  return_comment text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint qa_signoff_status_metadata check (
    (status = 'pending' and signed_at is null and signed_by_profile_id is null)
    or (status = 'signed' and signed_at is not null and signed_by_profile_id is not null)
    or (status = 'returned' and nullif(btrim(return_comment), '') is not null)
  )
);

create index if not exists qa_signoff_checklist_idx on public.qa_signoff (checklist_id);
create index if not exists qa_signoff_status_idx on public.qa_signoff (status);

create table if not exists public.qa_signoff_event (
  id uuid primary key default gen_random_uuid(),
  signoff_id uuid references public.qa_signoff (id) on delete cascade,
  checklist_id uuid not null references public.qa_checklist (id) on delete cascade,
  actor_profile_id uuid not null references public.profiles (id) on delete cascade,
  action text not null check (action in ('signed', 'returned', 'reopened')),
  comment text,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists qa_signoff_event_checklist_idx on public.qa_signoff_event (checklist_id, created_at desc);
create index if not exists qa_signoff_event_actor_idx on public.qa_signoff_event (actor_profile_id, created_at desc);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------

drop trigger if exists qa_template_set_updated_at on public.qa_template;
create trigger qa_template_set_updated_at before update on public.qa_template
  for each row execute function public.set_current_timestamp_updated_at();

drop trigger if exists qa_project_set_updated_at on public.qa_project;
create trigger qa_project_set_updated_at before update on public.qa_project
  for each row execute function public.set_current_timestamp_updated_at();

drop trigger if exists qa_section_set_updated_at on public.qa_section;
create trigger qa_section_set_updated_at before update on public.qa_section
  for each row execute function public.set_current_timestamp_updated_at();

drop trigger if exists qa_checklist_set_updated_at on public.qa_checklist;
create trigger qa_checklist_set_updated_at before update on public.qa_checklist
  for each row execute function public.set_current_timestamp_updated_at();

drop trigger if exists qa_check_item_set_updated_at on public.qa_check_item;
create trigger qa_check_item_set_updated_at before update on public.qa_check_item
  for each row execute function public.set_current_timestamp_updated_at();

drop trigger if exists qa_signoff_set_updated_at on public.qa_signoff;
create trigger qa_signoff_set_updated_at before update on public.qa_signoff
  for each row execute function public.set_current_timestamp_updated_at();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.qa_template enable row level security;
alter table public.qa_template_version enable row level security;
alter table public.qa_project enable row level security;
alter table public.qa_section enable row level security;
alter table public.qa_checklist enable row level security;
alter table public.qa_check_item enable row level security;
alter table public.qa_evidence enable row level security;
alter table public.qa_signoff enable row level security;
alter table public.qa_signoff_event enable row level security;

-- qa_template: read for approved; configure (write) for admin/supervisor.
create policy "qa_template_select" on public.qa_template for select to authenticated using (public.qa_can_read());
create policy "qa_template_insert" on public.qa_template for insert to authenticated with check (public.qa_can_configure());
create policy "qa_template_update" on public.qa_template for update to authenticated using (public.qa_can_configure()) with check (public.qa_can_configure());

-- qa_template_version: read for approved; insert for configure; append-only (no update/delete).
create policy "qa_template_version_select" on public.qa_template_version for select to authenticated using (public.qa_can_read());
create policy "qa_template_version_insert" on public.qa_template_version for insert to authenticated with check (public.qa_can_configure());

-- qa_project / qa_section: read for approved; full write for configure.
create policy "qa_project_select" on public.qa_project for select to authenticated using (public.qa_can_read());
create policy "qa_project_insert" on public.qa_project for insert to authenticated with check (public.qa_can_configure());
create policy "qa_project_update" on public.qa_project for update to authenticated using (public.qa_can_configure()) with check (public.qa_can_configure());
create policy "qa_project_delete" on public.qa_project for delete to authenticated using (public.qa_can_configure());

create policy "qa_section_select" on public.qa_section for select to authenticated using (public.qa_can_read());
create policy "qa_section_insert" on public.qa_section for insert to authenticated with check (public.qa_can_configure());
create policy "qa_section_update" on public.qa_section for update to authenticated using (public.qa_can_configure()) with check (public.qa_can_configure());
create policy "qa_section_delete" on public.qa_section for delete to authenticated using (public.qa_can_configure());

-- qa_checklist: read for approved; capture may create; capture may edit while not
-- signed off; signers may edit (for the sign-off transition); delete is admin.
create policy "qa_checklist_select" on public.qa_checklist for select to authenticated using (public.qa_can_read());
create policy "qa_checklist_insert" on public.qa_checklist for insert to authenticated with check (public.qa_can_capture());
create policy "qa_checklist_update" on public.qa_checklist for update to authenticated
  using ((public.qa_can_capture() and status <> 'signed_off') or public.qa_can_sign())
  with check ((public.qa_can_capture() and status <> 'signed_off') or public.qa_can_sign());
create policy "qa_checklist_delete" on public.qa_checklist for delete to authenticated using (public.qa_can_configure());

-- qa_check_item: read for approved; capture may write while the parent checklist
-- is not signed off (immutability of signed records enforced here at the DB).
create policy "qa_check_item_select" on public.qa_check_item for select to authenticated using (public.qa_can_read());
create policy "qa_check_item_insert" on public.qa_check_item for insert to authenticated
  with check (public.qa_can_capture() and exists (
    select 1 from public.qa_checklist c where c.id = qa_check_item.checklist_id and c.status <> 'signed_off'
  ));
create policy "qa_check_item_update" on public.qa_check_item for update to authenticated
  using (public.qa_can_capture() and exists (
    select 1 from public.qa_checklist c where c.id = qa_check_item.checklist_id and c.status <> 'signed_off'
  ))
  with check (public.qa_can_capture() and exists (
    select 1 from public.qa_checklist c where c.id = qa_check_item.checklist_id and c.status <> 'signed_off'
  ));

-- qa_evidence: read for approved; capture may add/remove while not signed off.
create policy "qa_evidence_select" on public.qa_evidence for select to authenticated using (public.qa_can_read());
create policy "qa_evidence_insert" on public.qa_evidence for insert to authenticated
  with check (public.qa_can_capture() and exists (
    select 1 from public.qa_checklist c where c.id = qa_evidence.checklist_id and c.status <> 'signed_off'
  ));
create policy "qa_evidence_delete" on public.qa_evidence for delete to authenticated
  using (public.qa_can_capture() and exists (
    select 1 from public.qa_checklist c where c.id = qa_evidence.checklist_id and c.status <> 'signed_off'
  ));

-- qa_signoff: read for approved; signers create and may modify only while pending
-- (signed/returned rows are immutable).
create policy "qa_signoff_select" on public.qa_signoff for select to authenticated using (public.qa_can_read());
create policy "qa_signoff_insert" on public.qa_signoff for insert to authenticated with check (public.qa_can_sign());
create policy "qa_signoff_update" on public.qa_signoff for update to authenticated
  using (public.qa_can_sign() and status = 'pending')
  with check (public.qa_can_sign());

-- qa_signoff_event: append-only ledger; read for approved, insert by the acting signer.
create policy "qa_signoff_event_select" on public.qa_signoff_event for select to authenticated using (public.qa_can_read());
create policy "qa_signoff_event_insert" on public.qa_signoff_event for insert to authenticated
  with check (public.qa_can_sign() and actor_profile_id = public.current_profile_id());

-- ---------------------------------------------------------------------------
-- Grants (RLS still governs row visibility)
-- ---------------------------------------------------------------------------

grant select, insert, update, delete on public.qa_template to authenticated;
grant select, insert on public.qa_template_version to authenticated;
grant select, insert, update, delete on public.qa_project to authenticated;
grant select, insert, update, delete on public.qa_section to authenticated;
grant select, insert, update, delete on public.qa_checklist to authenticated;
grant select, insert, update, delete on public.qa_check_item to authenticated;
grant select, insert, delete on public.qa_evidence to authenticated;
grant select, insert, update on public.qa_signoff to authenticated;
grant select, insert on public.qa_signoff_event to authenticated;
