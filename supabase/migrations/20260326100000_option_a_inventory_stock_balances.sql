create table public.inventory_stock_balances (
  inventory_item_id uuid not null references public.inventory_items (id) on delete restrict,
  stock_location_id uuid references public.stock_locations (id) on delete restrict,
  quantity numeric not null check (quantity >= 0),
  source_stock_take_session_id uuid not null references public.stock_take_sessions (id) on delete restrict,
  last_finalized_at timestamptz not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create unique index inventory_stock_balances_item_location_unique_idx
  on public.inventory_stock_balances (inventory_item_id, stock_location_id)
  where stock_location_id is not null;

create unique index inventory_stock_balances_item_null_location_unique_idx
  on public.inventory_stock_balances (inventory_item_id)
  where stock_location_id is null;

create index inventory_stock_balances_location_item_idx
  on public.inventory_stock_balances (stock_location_id, inventory_item_id);

create index inventory_stock_balances_item_idx
  on public.inventory_stock_balances (inventory_item_id);

create index inventory_stock_balances_source_session_idx
  on public.inventory_stock_balances (source_stock_take_session_id);

create trigger inventory_stock_balances_set_updated_at
before update on public.inventory_stock_balances
for each row
execute function public.set_current_timestamp_updated_at();

alter table public.inventory_stock_balances enable row level security;

create policy "inventory_stock_balances_select_approved"
on public.inventory_stock_balances
for select
to authenticated
using (public.is_current_user_approved());

create policy "inventory_stock_balances_insert_operational"
on public.inventory_stock_balances
for insert
to authenticated
with check (public.is_current_user_admin_or_supervisor());

create policy "inventory_stock_balances_update_operational"
on public.inventory_stock_balances
for update
to authenticated
using (public.is_current_user_admin_or_supervisor())
with check (public.is_current_user_admin_or_supervisor());

create policy "inventory_stock_balances_delete_operational"
on public.inventory_stock_balances
for delete
to authenticated
using (public.is_current_user_admin_or_supervisor());

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
      'stock_take_entry_updated',
      'stock_take_session_closed_balances_replaced'
    )
  );

create or replace function public.close_reviewed_stock_take_session(
  p_session_id uuid,
  p_actor_auth_user_id uuid,
  p_closed_at timestamptz default timezone('utc', now())
)
returns public.stock_take_sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.stock_take_sessions%rowtype;
  v_affected_location_ids uuid[];
  v_affects_null_scope boolean;
begin
  select *
  into v_session
  from public.stock_take_sessions
  where id = p_session_id
  for update;

  if not found then
    raise exception 'Stock take session not found';
  end if;

  if v_session.status <> 'reviewed' then
    raise exception 'Stock take session must be reviewed before it can be closed';
  end if;

  create temporary table tmp_stock_take_balance_totals (
    inventory_item_id uuid not null,
    resolved_stock_location_id uuid,
    total_quantity numeric not null
  ) on commit drop;

  insert into tmp_stock_take_balance_totals (inventory_item_id, resolved_stock_location_id, total_quantity)
  select
    ste.inventory_item_id,
    coalesce(ste.stock_location_id, v_session.stock_location_id) as resolved_stock_location_id,
    sum(ste.counted_quantity)::numeric as total_quantity
  from public.stock_take_entries ste
  where ste.stock_take_session_id = p_session_id
  group by ste.inventory_item_id, coalesce(ste.stock_location_id, v_session.stock_location_id);

  select coalesce(
    array_agg(distinct resolved_stock_location_id)
      filter (where resolved_stock_location_id is not null),
    '{}'::uuid[]
  )
  into v_affected_location_ids
  from tmp_stock_take_balance_totals;

  select exists (
    select 1
    from tmp_stock_take_balance_totals
    where resolved_stock_location_id is null
  )
  into v_affects_null_scope;

  delete from public.inventory_stock_balances isb
  where (
    isb.stock_location_id is not null
    and isb.stock_location_id = any(v_affected_location_ids)
  )
  or (
    v_affects_null_scope
    and isb.stock_location_id is null
  );

  insert into public.inventory_stock_balances (
    inventory_item_id,
    stock_location_id,
    quantity,
    source_stock_take_session_id,
    last_finalized_at
  )
  select
    inventory_item_id,
    resolved_stock_location_id,
    total_quantity,
    p_session_id,
    p_closed_at
  from tmp_stock_take_balance_totals;

  update public.stock_take_sessions
  set
    status = 'closed',
    closed_at = p_closed_at
  where id = p_session_id
  returning * into v_session;

  insert into public.stock_admin_events (
    event_type,
    entity_type,
    entity_id,
    actor_auth_user_id,
    payload
  )
  values (
    'stock_take_session_closed_balances_replaced',
    'stock_take_session',
    p_session_id,
    p_actor_auth_user_id,
    jsonb_build_object(
      'session_id', p_session_id,
      'finalized_at', p_closed_at,
      'affected_locations', v_affected_location_ids,
      'includes_null_location_scope', v_affects_null_scope,
      'aggregated_row_count', (select count(*) from tmp_stock_take_balance_totals)
    )
  );

  return v_session;
end;
$$;

grant execute on function public.close_reviewed_stock_take_session(uuid, uuid, timestamptz)
  to authenticated;
