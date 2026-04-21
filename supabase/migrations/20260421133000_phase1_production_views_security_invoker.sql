alter view public.production_entries_with_metrics set (security_invoker = true);
alter view public.production_project_summaries set (security_invoker = true);
alter view public.production_operator_summaries set (security_invoker = true);
