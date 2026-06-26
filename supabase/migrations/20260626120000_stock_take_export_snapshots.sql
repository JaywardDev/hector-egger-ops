create table public.stock_take_export_snapshots (
  id uuid primary key default gen_random_uuid(),
  exported_at timestamptz not null default timezone('utc', now()),
  exported_by_profile_id uuid references public.profiles (id) on delete set null,
  filename text not null,
  row_count integer
);

create index stock_take_export_snapshots_exported_at_idx
on public.stock_take_export_snapshots (exported_at desc);

alter table public.stock_take_export_snapshots enable row level security;

create policy "export_snapshots_select_admin_or_supervisor"
on public.stock_take_export_snapshots
for select to authenticated
using (public.is_current_user_admin_or_supervisor());

create policy "export_snapshots_insert_approved"
on public.stock_take_export_snapshots
for insert to authenticated
with check (public.is_current_user_approved());
