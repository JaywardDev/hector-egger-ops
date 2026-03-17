# Phase 1 admin bootstrap and mutation path

## Manual bootstrap for the first admin

For Phase 1, bootstrap the first admin directly in Supabase SQL (outside the app UI):

```sql
-- Replace with the real auth.users id and email.
insert into public.profiles (
  auth_user_id,
  email,
  full_name,
  account_status,
  onboarding_source,
  approved_at
)
values (
  '00000000-0000-0000-0000-000000000000',
  'admin@example.com',
  'Initial Admin',
  'approved',
  'admin_provisioned',
  timezone('utc', now())
)
on conflict (auth_user_id)
do update set
  account_status = 'approved',
  onboarding_source = 'admin_provisioned',
  approved_at = timezone('utc', now()),
  disabled_at = null;

insert into public.user_roles (profile_id, role)
select p.id, 'admin'::public.app_role
from public.profiles p
where p.auth_user_id = '00000000-0000-0000-0000-000000000000'
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
