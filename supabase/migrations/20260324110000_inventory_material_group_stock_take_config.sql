create table public.stock_take_group_field_settings (
  material_group_id uuid not null references public.material_groups (id) on delete cascade,
  field_key text not null,
  is_enabled boolean not null default false,
  is_required boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint stock_take_group_field_settings_pkey primary key (material_group_id, field_key),
  constraint stock_take_group_field_settings_field_key_check check (
    field_key in (
      'item_name',
      'item_code',
      'unit',
      'thickness_mm',
      'width_mm',
      'length_mm',
      'grade',
      'treatment',
      'counted_quantity',
      'stock_location_id',
      'notes'
    )
  )
);

create trigger stock_take_group_field_settings_set_updated_at
before update on public.stock_take_group_field_settings
for each row
execute function public.set_current_timestamp_updated_at();

alter table public.stock_take_group_field_settings enable row level security;

create policy "stock_take_group_field_settings_select_approved"
on public.stock_take_group_field_settings
for select
to authenticated
using (public.is_current_user_approved());

create policy "stock_take_group_field_settings_insert_operational"
on public.stock_take_group_field_settings
for insert
to authenticated
with check (public.is_current_user_admin_or_supervisor());

create policy "stock_take_group_field_settings_update_operational"
on public.stock_take_group_field_settings
for update
to authenticated
using (public.is_current_user_admin_or_supervisor())
with check (public.is_current_user_admin_or_supervisor());

create policy "stock_take_group_field_settings_delete_operational"
on public.stock_take_group_field_settings
for delete
to authenticated
using (public.is_current_user_admin_or_supervisor());

insert into public.stock_take_group_field_settings (
  material_group_id,
  field_key,
  is_enabled,
  is_required
)
select
  mg.id,
  field_key,
  is_enabled,
  is_required
from public.material_groups mg
cross join (
  values
    ('item_name', true, false),
    ('item_code', true, false),
    ('unit', true, false),
    ('thickness_mm', true, false),
    ('width_mm', true, false),
    ('length_mm', true, false),
    ('grade', true, false),
    ('treatment', true, false),
    ('counted_quantity', true, true),
    ('stock_location_id', true, false),
    ('notes', true, false)
) as defaults(field_key, is_enabled, is_required)
where mg.key = 'timber'
on conflict (material_group_id, field_key) do update
set
  is_enabled = excluded.is_enabled,
  is_required = excluded.is_required;

update public.inventory_items ii
set material_group_id = null
where material_group_id in (
  select id
  from public.material_groups
  where key = 'other'
);

delete from public.material_groups where key = 'other';
