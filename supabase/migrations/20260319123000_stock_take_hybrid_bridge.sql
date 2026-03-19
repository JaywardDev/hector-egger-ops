alter table public.stock_take_sessions
  alter column stock_location_id drop not null;

alter table public.stock_take_entries
  add column stock_location_id uuid references public.stock_locations (id) on delete restrict;

create index stock_take_entries_stock_location_id_idx
  on public.stock_take_entries (stock_location_id);

alter table public.stock_take_entries
  drop constraint if exists stock_take_entries_session_inventory_item_unique;

create unique index stock_take_entries_session_inventory_item_null_location_unique_idx
  on public.stock_take_entries (stock_take_session_id, inventory_item_id)
  where stock_location_id is null;

create unique index stock_take_entries_session_inventory_item_location_unique_idx
  on public.stock_take_entries (stock_take_session_id, inventory_item_id, stock_location_id)
  where stock_location_id is not null;
