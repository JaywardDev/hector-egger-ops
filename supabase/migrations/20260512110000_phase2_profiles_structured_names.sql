alter table public.profiles
  add column if not exists first_name text,
  add column if not exists middle_name text,
  add column if not exists last_name text;

with parsed_names as (
  select
    id,
    regexp_split_to_array(btrim(full_name), '[[:space:]]+') as name_parts
  from public.profiles
  where full_name is not null
    and btrim(full_name) <> ''
)
update public.profiles as profiles
set
  first_name = coalesce(profiles.first_name, parsed_names.name_parts[1]),
  middle_name = coalesce(
    profiles.middle_name,
    case
      when array_length(parsed_names.name_parts, 1) > 2 then
        array_to_string(parsed_names.name_parts[2:(array_length(parsed_names.name_parts, 1) - 1)], ' ')
      else null
    end
  ),
  last_name = coalesce(
    profiles.last_name,
    parsed_names.name_parts[array_length(parsed_names.name_parts, 1)]
  )
from parsed_names
where profiles.id = parsed_names.id;
