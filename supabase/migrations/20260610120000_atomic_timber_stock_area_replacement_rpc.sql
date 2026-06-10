create or replace function public.replace_timber_stock_rows_for_area(
  p_area_id uuid,
  p_rows jsonb
)
returns setof public.timber_stock_rows
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor_profile_id uuid;
  v_row jsonb;
  v_timber_material_id uuid;
  v_bay text;
  v_level text;
  v_quantity numeric;
begin
  select p.id
  into v_actor_profile_id
  from public.profiles p
  where p.auth_user_id = auth.uid()
    and p.account_status = 'approved'
  limit 1;

  if v_actor_profile_id is null then
    raise exception 'Approved account access is required for timber stock.';
  end if;

  if not exists (
    select 1
    from public.user_roles ur
    where ur.profile_id = v_actor_profile_id
      and ur.role in ('admin', 'supervisor', 'operator')
  ) then
    raise exception 'Operator, supervisor, or admin access is required to update timber stock.';
  end if;

  if not exists (
    select 1
    from public.stock_areas sa
    where sa.id = p_area_id
      and sa.is_active = true
  ) then
    raise exception 'Selected stock area was not found or is inactive.';
  end if;

  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then
    raise exception 'Rows payload must be an array.';
  end if;

  delete from public.timber_stock_rows
  where area_id = p_area_id;

  for v_row in select * from jsonb_array_elements(p_rows)
  loop
    if nullif(btrim(coalesce(v_row->>'timberMaterialId', '')), '') is null then
      raise exception 'Timber material is required.';
    end if;

    if not (v_row ? 'quantity') or nullif(btrim(coalesce(v_row->>'quantity', '')), '') is null then
      raise exception 'Quantity must be a number.';
    end if;

    v_timber_material_id := (v_row->>'timberMaterialId')::uuid;
    v_bay := btrim(coalesce(v_row->>'bay', ''));
    v_level := btrim(coalesce(v_row->>'level', ''));
    v_quantity := (v_row->>'quantity')::numeric;

    if v_quantity < 0 then
      raise exception 'Quantity cannot be negative.';
    end if;

    if not exists (
      select 1
      from public.timber_materials tm
      where tm.id = v_timber_material_id
        and tm.is_active = true
    ) then
      raise exception 'Timber material was not found or is inactive.';
    end if;

    insert into public.timber_stock_rows (
      area_id,
      timber_material_id,
      bay,
      level,
      quantity,
      updated_by_profile_id
    ) values (
      p_area_id,
      v_timber_material_id,
      v_bay,
      v_level,
      v_quantity,
      v_actor_profile_id
    );
  end loop;

  return query
  select tsr.*
  from public.timber_stock_rows tsr
  where tsr.area_id = p_area_id
  order by tsr.bay asc, tsr.level asc, tsr.created_at asc;
end;
$$;

revoke all on function public.replace_timber_stock_rows_for_area(uuid, jsonb) from public;
grant execute on function public.replace_timber_stock_rows_for_area(uuid, jsonb) to authenticated;
