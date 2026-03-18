create table public.material_groups (
  id uuid primary key default gen_random_uuid(),
  key text not null,
  label text not null,
  sort_order integer,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint material_groups_key_unique unique (key)
);

create index material_groups_label_idx on public.material_groups (label);
create index material_groups_sort_order_idx on public.material_groups (sort_order nulls last, label);

alter table public.inventory_items
add column material_group_id uuid references public.material_groups (id) on delete set null;

create index inventory_items_material_group_id_idx on public.inventory_items (material_group_id);

create trigger material_groups_set_updated_at
before update on public.material_groups
for each row
execute function public.set_current_timestamp_updated_at();

alter table public.material_groups enable row level security;

create policy "material_groups_select_approved"
on public.material_groups
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

create policy "material_groups_insert_operational"
on public.material_groups
for insert
to authenticated
with check (public.is_current_user_admin_or_supervisor());

create policy "material_groups_update_operational"
on public.material_groups
for update
to authenticated
using (public.is_current_user_admin_or_supervisor())
with check (public.is_current_user_admin_or_supervisor());

insert into public.material_groups (key, label, sort_order)
values
  ('timber', 'Timber', 10),
  ('screws', 'Screws', 20),
  ('nails', 'Nails', 30),
  ('board', 'Board', 40),
  ('insulation', 'Insulation', 50),
  ('other', 'Other', 999)
on conflict (key) do update
set
  label = excluded.label,
  sort_order = excluded.sort_order,
  is_active = true;
