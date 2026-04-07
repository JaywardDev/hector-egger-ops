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
      'stock_take_session_deleted',
      'stock_take_entry_created',
      'stock_take_entry_updated',
      'stock_take_session_closed_balances_replaced'
    )
  );

create or replace function public.delete_empty_draft_stock_take_session(
  p_session_id uuid,
  p_actor_auth_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.stock_take_sessions%rowtype;
  v_has_entries boolean;
  v_has_balances boolean;
begin
  select *
  into v_session
  from public.stock_take_sessions
  where id = p_session_id
  for update;

  if not found then
    raise exception 'Stock take session not found';
  end if;

  if v_session.status <> 'draft' then
    raise exception 'Only draft sessions can be deleted';
  end if;

  select exists (
    select 1
    from public.stock_take_entries ste
    where ste.stock_take_session_id = p_session_id
  )
  into v_has_entries;

  if v_has_entries then
    raise exception 'Only empty draft sessions can be deleted';
  end if;

  select exists (
    select 1
    from public.inventory_stock_balances isb
    where isb.source_stock_take_session_id = p_session_id
  )
  into v_has_balances;

  if v_has_balances then
    raise exception 'Cannot delete this draft session because inventory balances reference it';
  end if;

  delete from public.stock_take_sessions
  where id = p_session_id;

  insert into public.stock_admin_events (
    event_type,
    entity_type,
    entity_id,
    actor_auth_user_id,
    payload
  )
  values (
    'stock_take_session_deleted',
    'stock_take_session',
    p_session_id,
    p_actor_auth_user_id,
    jsonb_build_object(
      'session_id', p_session_id,
      'deleted_status', v_session.status,
      'deleted_at', timezone('utc', now())
    )
  );
end;
$$;

grant execute on function public.delete_empty_draft_stock_take_session(uuid, uuid)
  to authenticated;
