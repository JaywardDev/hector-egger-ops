alter table public.timesheet_projects
  add column visible_to_staff_groups text[] not null default array['factory', 'site', 'office']::text[],
  add column source_system text not null default 'manual',
  add column source_row_hash text,
  add column last_seen_at timestamptz,
  add column inactive_reason text,
  add column inactive_at timestamptz,
  add constraint timesheet_projects_visible_to_staff_groups_allowed
    check (visible_to_staff_groups <@ array['factory', 'site', 'office']::text[]),
  add constraint timesheet_projects_active_visible_to_staff_groups_nonempty
    check (is_active = false or cardinality(visible_to_staff_groups) > 0),
  add constraint timesheet_projects_source_system_allowed
    check (source_system in ('manual', 'c_base'));

alter table public.timesheet_tasks
  add column visible_to_staff_groups text[] not null default array['factory', 'site', 'office']::text[],
  add column source_system text not null default 'manual',
  add column source_row_hash text,
  add column last_seen_at timestamptz,
  add column inactive_reason text,
  add column inactive_at timestamptz,
  add constraint timesheet_tasks_visible_to_staff_groups_allowed
    check (visible_to_staff_groups <@ array['factory', 'site', 'office']::text[]),
  add constraint timesheet_tasks_active_visible_to_staff_groups_nonempty
    check (is_active = false or cardinality(visible_to_staff_groups) > 0),
  add constraint timesheet_tasks_source_system_allowed
    check (source_system in ('manual', 'c_base'));
