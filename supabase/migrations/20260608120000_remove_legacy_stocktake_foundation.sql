-- Forward-only reset of the legacy stock-take/inventory foundation.
-- The application keeps /stock-take as a placeholder only; these objects belonged
-- to the old session, location, material setup, stock balance, and history model.
-- Shared auth helper functions such as is_current_user_approved() and
-- is_current_user_admin_or_supervisor() are intentionally retained because
-- non-stock modules (timesheets/production) depend on them.

drop function if exists public.delete_empty_draft_stock_take_session(uuid, uuid);
drop function if exists public.close_reviewed_stock_take_session(uuid, uuid, timestamptz);

drop table if exists public.inventory_stock_balances cascade;
drop table if exists public.stock_take_group_field_settings cascade;
drop table if exists public.stock_take_entries cascade;
drop table if exists public.stock_take_sessions cascade;
drop table if exists public.inventory_item_timber_specs cascade;
drop table if exists public.inventory_items cascade;
drop table if exists public.material_groups cascade;
drop table if exists public.stock_locations cascade;
drop table if exists public.stock_admin_events cascade;
