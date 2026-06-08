create or replace function public.is_current_user_approved()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.auth_user_id = auth.uid()
      and p.account_status = 'approved'
  );
$$;

grant execute on function public.is_current_user_approved() to authenticated;

create or replace function public.is_current_user_admin_or_supervisor()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    join public.user_roles ur on ur.profile_id = p.id
    where p.auth_user_id = auth.uid()
      and p.account_status = 'approved'
      and ur.role in ('admin', 'supervisor')
  );
$$;

grant execute on function public.is_current_user_admin_or_supervisor() to authenticated;
