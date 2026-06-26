create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default timezone('utc', now()),
  constraint push_subscriptions_endpoint_not_blank check (btrim(endpoint) <> '')
);

create unique index push_subscriptions_profile_endpoint_unique_idx
on public.push_subscriptions (profile_id, endpoint);

create index push_subscriptions_profile_idx
on public.push_subscriptions (profile_id);

alter table public.push_subscriptions enable row level security;

create policy "push_subscriptions_select_own"
on public.push_subscriptions
for select to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = push_subscriptions.profile_id
      and p.auth_user_id = auth.uid()
  )
);

create policy "push_subscriptions_insert_own"
on public.push_subscriptions
for insert to authenticated
with check (
  exists (
    select 1 from public.profiles p
    where p.id = push_subscriptions.profile_id
      and p.auth_user_id = auth.uid()
      and p.account_status = 'approved'
  )
);

create policy "push_subscriptions_delete_own"
on public.push_subscriptions
for delete to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = push_subscriptions.profile_id
      and p.auth_user_id = auth.uid()
  )
);
