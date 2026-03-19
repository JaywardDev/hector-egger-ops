alter table public.stock_locations
  alter column code drop not null;

drop index if exists public.stock_locations_code_unique_idx;

create unique index stock_locations_code_unique_idx
on public.stock_locations (code)
where code is not null;
