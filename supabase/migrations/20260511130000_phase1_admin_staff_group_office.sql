alter table public.profiles
drop constraint if exists profiles_staff_group_check;

alter table public.profiles
add constraint profiles_staff_group_check
check (staff_group in ('factory', 'site', 'office') or staff_group is null);
