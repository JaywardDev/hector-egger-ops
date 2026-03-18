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
      'stock_location_updated'
    )
  );

create table public.inventory_item_timber_specs (
  inventory_item_id uuid primary key references public.inventory_items (id) on delete cascade,
  thickness_mm numeric,
  width_mm numeric,
  length_mm numeric,
  grade text,
  treatment text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint inventory_item_timber_specs_thickness_nonnegative check (thickness_mm is null or thickness_mm > 0),
  constraint inventory_item_timber_specs_width_nonnegative check (width_mm is null or width_mm > 0),
  constraint inventory_item_timber_specs_length_nonnegative check (length_mm is null or length_mm > 0)
);

create trigger inventory_item_timber_specs_set_updated_at
before update on public.inventory_item_timber_specs
for each row
execute function public.set_current_timestamp_updated_at();

alter table public.inventory_item_timber_specs enable row level security;

create policy "inventory_item_timber_specs_select_approved"
on public.inventory_item_timber_specs
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.auth_user_id = auth.uid()
      and p.account_status = 'approved'
  )
);

create policy "inventory_item_timber_specs_insert_operational"
on public.inventory_item_timber_specs
for insert
to authenticated
with check (public.is_current_user_admin_or_supervisor());

create policy "inventory_item_timber_specs_update_operational"
on public.inventory_item_timber_specs
for update
to authenticated
using (public.is_current_user_admin_or_supervisor())
with check (public.is_current_user_admin_or_supervisor());

create policy "inventory_item_timber_specs_delete_operational"
on public.inventory_item_timber_specs
for delete
to authenticated
using (public.is_current_user_admin_or_supervisor());
