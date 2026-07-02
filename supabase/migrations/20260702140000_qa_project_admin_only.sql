-- Tighten QA project + section management to admin-only (the manager owns the
-- project structure). Supervisors and operators still create/fill checklists
-- (qa_can_capture) and read (qa_can_read); only the template/config helpers
-- change here. Matches the current CONQA-based operating model — easy to loosen
-- later if the team decides supervisors may set up projects too.

create or replace function public.qa_can_manage_structure()
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_current_user_admin();
$$;

grant execute on function public.qa_can_manage_structure() to authenticated;

-- qa_project: admin-only writes (was admin/supervisor via qa_can_configure).
drop policy if exists "qa_project_insert" on public.qa_project;
drop policy if exists "qa_project_update" on public.qa_project;
drop policy if exists "qa_project_delete" on public.qa_project;
create policy "qa_project_insert" on public.qa_project for insert to authenticated with check (public.qa_can_manage_structure());
create policy "qa_project_update" on public.qa_project for update to authenticated using (public.qa_can_manage_structure()) with check (public.qa_can_manage_structure());
create policy "qa_project_delete" on public.qa_project for delete to authenticated using (public.qa_can_manage_structure());

-- qa_section: admin-only writes.
drop policy if exists "qa_section_insert" on public.qa_section;
drop policy if exists "qa_section_update" on public.qa_section;
drop policy if exists "qa_section_delete" on public.qa_section;
create policy "qa_section_insert" on public.qa_section for insert to authenticated with check (public.qa_can_manage_structure());
create policy "qa_section_update" on public.qa_section for update to authenticated using (public.qa_can_manage_structure()) with check (public.qa_can_manage_structure());
create policy "qa_section_delete" on public.qa_section for delete to authenticated using (public.qa_can_manage_structure());
