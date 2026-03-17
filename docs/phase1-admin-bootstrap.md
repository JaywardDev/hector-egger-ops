# Phase 1 admin bootstrap and mutation path

## Manual bootstrap for the first admin

For Phase 1, bootstrap the first admin directly in Supabase SQL (outside the app UI):

```sql
-- Replace with the real email of the first admin.
-- This resolves the canonical UUID from auth.users instead of using a placeholder.
with bootstrap_user as (
  select id, email
  from auth.users
  where email = 'admin@example.com'
  order by created_at asc
  limit 1
)
insert into public.profiles (
  auth_user_id,
  email,
  full_name,
  account_status,
  onboarding_source,
  approved_at
)
select
  bu.id,
  bu.email,
  'Initial Admin',
  'approved',
  'admin_provisioned',
  timezone('utc', now())
from bootstrap_user bu
on conflict (auth_user_id)
do update set
  email = excluded.email,
  full_name = excluded.full_name,
  account_status = 'approved',
  onboarding_source = 'admin_provisioned',
  approved_at = timezone('utc', now()),
  disabled_at = null;

insert into public.user_roles (profile_id, role)
select p.id, 'admin'::public.app_role
from public.profiles p
join auth.users u on u.id = p.auth_user_id
where u.email = 'admin@example.com'
on conflict (profile_id, role) do nothing;
```

## Intended Phase 1 admin mutation path (no UI yet)

Use server-side admin actions that verify:

1. caller is authenticated,
2. caller profile status is `approved`,
3. caller has role `admin`.

Then perform mutations with service-role credentials:

- `approveUser` updates profile to `account_status = approved` and sets `approved_at`.
- `disableUser` updates profile to `account_status = disabled` and sets `disabled_at`.
- `assignRole` upserts role rows into `public.user_roles`.

This is scaffolded in `src/lib/admin/user-approvals.ts` for wiring to the thin approval UI next.
