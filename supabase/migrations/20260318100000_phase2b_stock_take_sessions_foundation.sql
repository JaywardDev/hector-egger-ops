alter table public.stock_admin_events
  drop constraint if exists stock_admin_events_event_type_check;

alter table public.stock_admin_events
  add constraint stock_admin_events_event_type_check
  check (
    event_type in (
      'inventory_item_created',
      'inventory_item_updated',
      'inventory_item_timber_spec_upserted',
      'inventory_item_timber_spec_deleted',
      'stock_location_created',
      'stock_location_updated',
      'stock_take_session_created',
      'stock_take_session_updated',
      'stock_take_entry_created',
      'stock_take_entry_updated'
    )
  );

alter table public.stock_admin_events
  drop constraint if exists stock_admin_events_entity_type_check;

alter table public.stock_admin_events
  add constraint stock_admin_events_entity_type_check
  check (entity_type in ('inventory_item', 'stock_location', 'stock_take_session', 'stock_take_entry'));

create or replace function public.is_current_user_approved()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.auth_user_id = auth.uid()
      and p.account_status = 'approved'
  );
$$;

grant execute on function public.is_current_user_approved() to authenticated;

create table public.stock_take_sessions (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  stock_location_id uuid not null references public.stock_locations (id) on delete restrict,
  status text not null check (status in ('draft', 'in_progress', 'submitted', 'reviewed', 'closed')) default 'draft',
  notes text,
  created_by uuid references auth.users (id) on delete set null,
  started_at timestamptz,
  submitted_at timestamptz,
  reviewed_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index stock_take_sessions_stock_location_id_idx on public.stock_take_sessions (stock_location_id);
create index stock_take_sessions_status_idx on public.stock_take_sessions (status, created_at desc);
create index stock_take_sessions_created_at_idx on public.stock_take_sessions (created_at desc);

create table public.stock_take_entries (
  id uuid primary key default gen_random_uuid(),
  stock_take_session_id uuid not null references public.stock_take_sessions (id) on delete cascade,
  inventory_item_id uuid not null references public.inventory_items (id) on delete restrict,
  counted_quantity numeric not null check (counted_quantity >= 0),
  notes text,
  entered_by uuid references auth.users (id) on delete set null,
  entered_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint stock_take_entries_session_inventory_item_unique unique (stock_take_session_id, inventory_item_id)
);

create index stock_take_entries_session_id_idx on public.stock_take_entries (stock_take_session_id, updated_at desc);
create index stock_take_entries_inventory_item_id_idx on public.stock_take_entries (inventory_item_id);

create trigger stock_take_sessions_set_updated_at
before update on public.stock_take_sessions
for each row
execute function public.set_current_timestamp_updated_at();

create trigger stock_take_entries_set_updated_at
before update on public.stock_take_entries
for each row
execute function public.set_current_timestamp_updated_at();

alter table public.stock_take_sessions enable row level security;
alter table public.stock_take_entries enable row level security;

create policy "stock_take_sessions_select_approved"
on public.stock_take_sessions
for select
to authenticated
using (public.is_current_user_approved());

create policy "stock_take_sessions_insert_operational"
on public.stock_take_sessions
for insert
to authenticated
with check (public.is_current_user_admin_or_supervisor());

create policy "stock_take_sessions_update_operational"
on public.stock_take_sessions
for update
to authenticated
using (public.is_current_user_admin_or_supervisor())
with check (public.is_current_user_admin_or_supervisor());

create policy "stock_take_entries_select_approved"
on public.stock_take_entries
for select
to authenticated
using (public.is_current_user_approved());

create policy "stock_take_entries_insert_approved_open_session"
on public.stock_take_entries
for insert
to authenticated
with check (
  public.is_current_user_approved()
  and exists (
    select 1
    from public.stock_take_sessions sts
    where sts.id = stock_take_entries.stock_take_session_id
      and sts.status in ('draft', 'in_progress')
  )
);

create policy "stock_take_entries_update_approved_open_session"
on public.stock_take_entries
for update
to authenticated
using (
  public.is_current_user_approved()
  and exists (
    select 1
    from public.stock_take_sessions sts
    where sts.id = stock_take_entries.stock_take_session_id
      and sts.status in ('draft', 'in_progress')
  )
)
with check (
  public.is_current_user_approved()
  and exists (
    select 1
    from public.stock_take_sessions sts
    where sts.id = stock_take_entries.stock_take_session_id
      and sts.status in ('draft', 'in_progress')
  )
);
