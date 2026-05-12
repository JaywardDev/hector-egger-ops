-- Atomically approve a completed pending user with a required role and staff group.

create or replace function public.approve_pending_user_atomic(
  p_target_profile_id uuid,
  p_role text,
  p_staff_group text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_profile_id uuid;
  v_target public.profiles%rowtype;
begin
  select p.id
  into v_actor_profile_id
  from public.profiles p
  join public.user_roles ur on ur.profile_id = p.id
  where p.auth_user_id = auth.uid()
    and p.account_status = 'approved'
    and ur.role = 'admin'
  limit 1;

  if v_actor_profile_id is null then
    raise exception 'Admin privileges are required for this action';
  end if;

  if nullif(btrim(coalesce(p_role, '')), '') is null
    or p_role not in ('operator', 'supervisor', 'admin')
  then
    raise exception 'Select a role before approving this user.';
  end if;

  if nullif(btrim(coalesce(p_staff_group, '')), '') is null
    or p_staff_group not in ('factory', 'site', 'office')
  then
    raise exception 'Select a staff group before approving this user.';
  end if;

  select *
  into v_target
  from public.profiles
  where id = p_target_profile_id
  for update;

  if not found then
    raise exception 'User profile not found';
  end if;

  if v_target.profile_completed_at is null
    or nullif(btrim(coalesce(v_target.first_name, '')), '') is null
    or nullif(btrim(coalesce(v_target.last_name, '')), '') is null
    or nullif(btrim(coalesce(v_target.email, '')), '') is null
  then
    raise exception 'User profile is incomplete. Ask the user to complete their profile before approval.';
  end if;

  update public.profiles
  set account_status = 'approved',
      approved_at = timezone('utc', now()),
      disabled_at = null,
      staff_group = p_staff_group
  where id = p_target_profile_id
  returning * into v_target;

  insert into public.user_roles (profile_id, role, created_by_auth_user_id)
  values (p_target_profile_id, p_role::public.app_role, auth.uid())
  on conflict (profile_id, role) do update
  set created_by_auth_user_id = excluded.created_by_auth_user_id;

  delete from public.user_roles
  where profile_id = p_target_profile_id
    and role <> p_role::public.app_role;

  return jsonb_build_object(
    'id', v_target.id,
    'email', v_target.email,
    'account_status', v_target.account_status,
    'approved_at', v_target.approved_at,
    'staff_group', v_target.staff_group,
    'role', p_role
  );
end;
$$;

grant execute on function public.approve_pending_user_atomic(uuid, text, text) to authenticated;
