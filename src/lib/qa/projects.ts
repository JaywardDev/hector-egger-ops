import "server-only";

import type { AuthSession } from "@/src/lib/auth/session";
import { createServerSupabaseClient } from "@/src/lib/supabase/server";
import { createServiceRoleSupabaseClient } from "@/src/lib/supabase/service-role";
import type {
  QaChecklistSummary,
  QaProjectDetail,
  QaProjectSummary,
  QaSection,
} from "@/src/lib/qa/types";

// Live data layer for QA projects (replaces the preview accessors for the list
// and project-detail pages). Reads use the session client so RLS applies;
// createQaProject uses the service role and is gated by requireAdminAccess in
// the action, matching the platform's write pattern.

const authHeaders = (session: AuthSession) => ({ Authorization: `Bearer ${session.accessToken}` });
const readJson = async <T>(response: Response): Promise<T[]> => (response.ok ? ((await response.json()) as T[]) : []);

const formatDate = (iso: string | null): string => {
  if (!iso) return "—";
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleDateString("en-NZ", { day: "2-digit", month: "short", year: "numeric" });
};

type RawProject = {
  id: string;
  source_project_ref: string | null;
  name: string;
  lot_code: string | null;
  status: QaProjectSummary["status"];
  updated_at: string;
};
type RawChecklist = {
  id: string;
  project_id: string;
  code: string;
  title: string;
  section_id: string | null;
  status: QaChecklistSummary["status"];
  template_version_id: string;
  updated_at: string;
};

export const listQaProjects = async (session: AuthSession): Promise<QaProjectSummary[]> => {
  const supabase = createServerSupabaseClient();
  const headers = authHeaders(session);

  const [projectResponse, checklistResponse, signoffResponse] = await Promise.all([
    supabase.request(
      "/rest/v1/qa_project?select=id,source_project_ref,name,lot_code,status,updated_at&order=updated_at.desc",
      { cache: "no-store", headers },
    ),
    supabase.request("/rest/v1/qa_checklist?select=id,project_id", { cache: "no-store", headers }),
    supabase.request("/rest/v1/qa_signoff?select=checklist_id&status=eq.pending", { cache: "no-store", headers }),
  ]);

  const projects = await readJson<RawProject>(projectResponse);
  const checklists = await readJson<{ id: string; project_id: string }>(checklistResponse);
  const signoffs = await readJson<{ checklist_id: string }>(signoffResponse);

  const checklistProject = new Map(checklists.map((row) => [row.id, row.project_id]));
  const checklistCount = new Map<string, number>();
  for (const row of checklists) checklistCount.set(row.project_id, (checklistCount.get(row.project_id) ?? 0) + 1);
  const holdOpen = new Map<string, number>();
  for (const row of signoffs) {
    const projectId = checklistProject.get(row.checklist_id);
    if (projectId) holdOpen.set(projectId, (holdOpen.get(projectId) ?? 0) + 1);
  }

  return projects.map((project) => ({
    id: project.id,
    project_ref: project.source_project_ref ?? "—",
    name: project.name,
    lot_code: project.lot_code,
    status: project.status,
    checklist_count: checklistCount.get(project.id) ?? 0,
    hold_points_open: holdOpen.get(project.id) ?? 0,
    updated_at: formatDate(project.updated_at),
  }));
};

export const getQaProjectDetail = async (
  session: AuthSession,
  projectId: string,
): Promise<QaProjectDetail | null> => {
  const supabase = createServerSupabaseClient();
  const headers = authHeaders(session);

  const [projectResponse, sectionResponse, checklistResponse] = await Promise.all([
    supabase.request(
      `/rest/v1/qa_project?id=eq.${projectId}&select=id,source_project_ref,name,lot_code,status,updated_at&limit=1`,
      { cache: "no-store", headers },
    ),
    supabase.request(
      `/rest/v1/qa_section?project_id=eq.${projectId}&select=id,name,sort_order,source_path&order=sort_order.asc`,
      { cache: "no-store", headers },
    ),
    supabase.request(
      `/rest/v1/qa_checklist?project_id=eq.${projectId}&select=id,project_id,code,title,section_id,status,template_version_id,updated_at&order=created_at.asc`,
      { cache: "no-store", headers },
    ),
  ]);

  const project = (await readJson<RawProject>(projectResponse))[0];
  if (!project) return null;

  const sections: QaSection[] = (await readJson<{ id: string; name: string; sort_order: number; source_path: string[] | null }>(sectionResponse)).map(
    (row) => ({ id: row.id, name: row.name, source_path: row.source_path ?? [] }),
  );

  const rawChecklists = await readJson<RawChecklist>(checklistResponse);
  const versionIds = [...new Set(rawChecklists.map((row) => row.template_version_id))];
  const versions = versionIds.length
    ? await readJson<{ id: string; version: number }>(
        await supabase.request(
          `/rest/v1/qa_template_version?id=in.(${versionIds.join(",")})&select=id,version`,
          { cache: "no-store", headers },
        ),
      )
    : [];
  const versionLabel = new Map(versions.map((row) => [row.id, `v${row.version}`]));

  const checklists: QaChecklistSummary[] = rawChecklists.map((row) => ({
    id: row.id,
    code: row.code,
    title: row.title,
    section_id: row.section_id,
    status: row.status,
    // pass/fail rollups arrive with the capture phase; no answers exist yet.
    pass_count: 0,
    fail_count: 0,
    template_version: versionLabel.get(row.template_version_id) ?? "—",
    updated_at: formatDate(row.updated_at),
  }));

  const openHoldPoints = rawChecklists.length
    ? (
        await readJson<{ checklist_id: string }>(
          await supabase.request(
            `/rest/v1/qa_signoff?checklist_id=in.(${rawChecklists.map((c) => c.id).join(",")})&status=eq.pending&select=checklist_id`,
            { cache: "no-store", headers },
          ),
        )
      ).length
    : 0;

  return {
    id: project.id,
    project_ref: project.source_project_ref ?? "—",
    name: project.name,
    lot_code: project.lot_code,
    status: project.status,
    checklist_count: rawChecklists.length,
    hold_points_open: openHoldPoints,
    updated_at: formatDate(project.updated_at),
    sections,
    checklists,
  };
};

export type CreateQaProjectInput = { ref: string; name: string; lot: string };

export const createQaProject = async ({
  actorProfileId,
  input,
}: {
  actorProfileId: string;
  input: CreateQaProjectInput;
}): Promise<{ id: string }> => {
  const supabase = createServiceRoleSupabaseClient();
  const response = await supabase.request("/rest/v1/qa_project", {
    method: "POST",
    headers: { "Content-Type": "application/json", Prefer: "return=representation" },
    body: JSON.stringify({
      source_project_ref: input.ref.trim() || null,
      name: input.name.trim(),
      lot_code: input.lot.trim() || null,
      created_by_profile_id: actorProfileId,
    }),
  });
  if (!response.ok) {
    const detail = (await response.text().catch(() => "")).slice(0, 300);
    throw new Error(`Could not create the QA project${detail ? ` — ${detail}` : ` (status ${response.status})`}`);
  }
  const [row] = (await response.json()) as { id: string }[];
  if (!row?.id) throw new Error("QA project was created but no id was returned.");
  return row;
};
