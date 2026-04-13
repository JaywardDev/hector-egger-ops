alter table public.stock_take_entries
  add column if not exists bay text,
  add column if not exists level text;

alter table public.stock_take_group_field_settings
  drop constraint if exists stock_take_group_field_settings_field_key_check;

alter table public.stock_take_group_field_settings
  add constraint stock_take_group_field_settings_field_key_check check (
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
      'bay',
      'level',
      'notes'
    )
  );

insert into public.stock_take_group_field_settings (
  material_group_id,
  field_key,
  is_enabled,
  is_required
)
select
  mg.id,
  defaults.field_key,
  defaults.is_enabled,
  defaults.is_required
from public.material_groups mg
cross join (
  values
    ('bay', true, false),
    ('level', true, false)
) as defaults(field_key, is_enabled, is_required)
where mg.key = 'timber'
on conflict (material_group_id, field_key) do update
set
  is_enabled = excluded.is_enabled,
  is_required = excluded.is_required;
