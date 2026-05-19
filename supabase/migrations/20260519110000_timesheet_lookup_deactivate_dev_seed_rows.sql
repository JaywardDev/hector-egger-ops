-- Deactivate legacy development lookup rows seeded before C Base import rollout.
-- Safety guard: only rows marked as manual are targeted so C Base-synced lookups are untouched.

update public.timesheet_projects
set
  is_active = false,
  inactive_reason = coalesce(inactive_reason, 'legacy_dev_seed'),
  inactive_at = coalesce(inactive_at, timezone('utc', now())),
  updated_at = timezone('utc', now())
where source_system = 'manual'
  and code in ('general', 'factory', 'site')
  and (
    code != 'general'
    or lower(label) in ('general / unassigned', 'general/unassigned')
  );

update public.timesheet_tasks
set
  is_active = false,
  inactive_reason = coalesce(inactive_reason, 'legacy_dev_seed'),
  inactive_at = coalesce(inactive_at, timezone('utc', now())),
  updated_at = timezone('utc', now())
where source_system = 'manual'
  and code in ('manufacturing', 'installation', 'cleanup', 'training')
  and lower(label) in ('manufacturing', 'installation', 'clean up', 'cleanup', 'training');
