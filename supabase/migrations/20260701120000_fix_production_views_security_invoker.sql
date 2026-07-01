-- Supabase Security Advisor flags views that run as SECURITY DEFINER because
-- they bypass the querying user's RLS policies. These production reporting
-- views should evaluate with the invoker's permissions instead.
alter view public.production_entries_with_metrics set (security_invoker = true);
alter view public.production_project_file_summaries set (security_invoker = true);
alter view public.production_project_summaries set (security_invoker = true);
alter view public.production_operator_summaries set (security_invoker = true);
