create table public.stock_areas (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  is_active boolean not null default true,
  created_by_profile_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint stock_areas_name_not_blank check (btrim(name) <> '')
);

create unique index stock_areas_name_lower_unique_idx
on public.stock_areas (lower(btrim(name)));

create index stock_areas_active_name_idx
on public.stock_areas (is_active desc, name asc);

create table public.timber_materials (
  id uuid primary key default gen_random_uuid(),
  height text not null,
  width text not null,
  length text not null,
  grade text not null,
  treatment text not null,
  name text generated always as (
    height || 'x' || width || ' ' || grade || ' ' || treatment || ' ' || length
  ) stored,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint timber_materials_height_not_blank check (btrim(height) <> ''),
  constraint timber_materials_width_not_blank check (btrim(width) <> ''),
  constraint timber_materials_length_not_blank check (btrim(length) <> ''),
  constraint timber_materials_grade_not_blank check (btrim(grade) <> ''),
  constraint timber_materials_treatment_not_blank check (btrim(treatment) <> '')
);

create unique index timber_materials_spec_unique_idx
on public.timber_materials (
  lower(btrim(height)),
  lower(btrim(width)),
  lower(btrim(length)),
  lower(btrim(grade)),
  lower(btrim(treatment))
);

create unique index timber_materials_name_lower_unique_idx
on public.timber_materials (lower(btrim(name)));

create index timber_materials_active_name_idx
on public.timber_materials (is_active desc, name asc);

create table public.timber_stock_rows (
  id uuid primary key default gen_random_uuid(),
  area_id uuid not null references public.stock_areas (id) on delete restrict,
  timber_material_id uuid not null references public.timber_materials (id) on delete restrict,
  bay text not null default '',
  level text not null default '',
  quantity numeric(12,3) not null default 0,
  updated_by_profile_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint timber_stock_rows_quantity_non_negative check (quantity >= 0),
  constraint timber_stock_rows_bay_normalized check (bay = btrim(bay)),
  constraint timber_stock_rows_level_normalized check (level = btrim(level))
);

create unique index timber_stock_rows_area_material_position_unique_idx
on public.timber_stock_rows (area_id, timber_material_id, bay, level);

create index timber_stock_rows_area_idx
on public.timber_stock_rows (area_id);

create index timber_stock_rows_material_idx
on public.timber_stock_rows (timber_material_id);

create trigger stock_areas_set_updated_at
before update on public.stock_areas
for each row
execute function public.set_current_timestamp_updated_at();

create trigger timber_materials_set_updated_at
before update on public.timber_materials
for each row
execute function public.set_current_timestamp_updated_at();

create trigger timber_stock_rows_set_updated_at
before update on public.timber_stock_rows
for each row
execute function public.set_current_timestamp_updated_at();

alter table public.stock_areas enable row level security;
alter table public.timber_materials enable row level security;
alter table public.timber_stock_rows enable row level security;

create policy "stock_areas_select_approved"
on public.stock_areas
for select
to authenticated
using (public.is_current_user_approved());

create policy "stock_areas_insert_operational"
on public.stock_areas
for insert
to authenticated
with check (
  public.is_current_user_approved()
  and exists (
    select 1
    from public.user_roles ur
    join public.profiles p on p.id = ur.profile_id
    where p.auth_user_id = auth.uid()
      and p.account_status = 'approved'
      and ur.role in ('admin', 'supervisor', 'operator')
  )
);

create policy "stock_areas_update_operational"
on public.stock_areas
for update
to authenticated
using (public.is_current_user_admin_or_supervisor())
with check (public.is_current_user_admin_or_supervisor());

create policy "timber_materials_select_approved"
on public.timber_materials
for select
to authenticated
using (public.is_current_user_approved());

create policy "timber_materials_insert_operational"
on public.timber_materials
for insert
to authenticated
with check (
  public.is_current_user_approved()
  and exists (
    select 1
    from public.user_roles ur
    join public.profiles p on p.id = ur.profile_id
    where p.auth_user_id = auth.uid()
      and p.account_status = 'approved'
      and ur.role in ('admin', 'supervisor', 'operator')
  )
);

create policy "timber_materials_update_admin_or_supervisor"
on public.timber_materials
for update
to authenticated
using (public.is_current_user_admin_or_supervisor())
with check (public.is_current_user_admin_or_supervisor());

create policy "timber_stock_rows_select_approved"
on public.timber_stock_rows
for select
to authenticated
using (public.is_current_user_approved());

create policy "timber_stock_rows_insert_operational"
on public.timber_stock_rows
for insert
to authenticated
with check (
  public.is_current_user_approved()
  and exists (
    select 1
    from public.user_roles ur
    join public.profiles p on p.id = ur.profile_id
    where p.auth_user_id = auth.uid()
      and p.account_status = 'approved'
      and ur.role in ('admin', 'supervisor', 'operator')
  )
);

create policy "timber_stock_rows_update_operational"
on public.timber_stock_rows
for update
to authenticated
using (
  public.is_current_user_approved()
  and exists (
    select 1
    from public.user_roles ur
    join public.profiles p on p.id = ur.profile_id
    where p.auth_user_id = auth.uid()
      and p.account_status = 'approved'
      and ur.role in ('admin', 'supervisor', 'operator')
  )
)
with check (
  public.is_current_user_approved()
  and exists (
    select 1
    from public.user_roles ur
    join public.profiles p on p.id = ur.profile_id
    where p.auth_user_id = auth.uid()
      and p.account_status = 'approved'
      and ur.role in ('admin', 'supervisor', 'operator')
  )
);
