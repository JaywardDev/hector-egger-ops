import "server-only";

import type { AuthSession } from "@/src/lib/auth/session";
import { createServerSupabaseClient } from "@/src/lib/supabase/server";
import { createServiceRoleSupabaseClient } from "@/src/lib/supabase/service-role";
import type { QaChecklistDetail, QaCheckStep } from "@/src/lib/qa/types";

// Data layer for QA sections + checklists: creating sections (admin), starting a
// checklist from a template version (capture, via the atomic RPC), and reading a
// checklist for the detail page. Reads use the session client (RLS applies);
// writes use the service role and are gated in the actions.

const authHeaders = (session: AuthSession) => ({ Authorization: `Bearer ${session.accessToken}` });
const readJson = async <T>(response: Response): Promise<T[]> => (response.ok ? ((await response.json()) as T[]) : []);

const formatDate = (iso: string | null): string => {
  if (!iso) return "—";
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleDateString("en-NZ", { day: "2-digit", month: "short", year: "numeric" });
};

// ---- Sections --------------------------------------------------------------

export const createQaSection = async ({
  projectId,
  name,
}: {
  projectId: string;
  name: string;
}): Promise<void> => {
  const supabase = createServiceRoleSupabaseClient();
  const response = await supabase.request("/rest/v1/qa_section", {
    method: "POST",
    headers: { "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify({ project_id: projectId, name: name.trim() }),
  });
  if (!response.ok) {
    const detail = (await response.text().catch(() => "")).slice(0, 300);
    throw new Error(`Could not add the section${detail ? ` — ${detail}` : ` (status ${response.status})`}`);
  }
};

// ---- Template choices (for the start-checklist picker) ----------------------

export type QaTemplateChoice = { versionId: string; label: string };

export const listQaTemplateChoices = async (session: AuthSession): Promise<QaTemplateChoice[]> => {
  const supabase = createServerSupabaseClient();
  const headers = authHeaders(session);
  const [templates, versions] = await Promise.all([
    readJson<{ id: string; name: string }>(
      await supabase.request("/rest/v1/qa_template?select=id,name&is_archived=eq.false&order=name.asc", {
        cache: "no-store",
        headers,
      }),
    ),
    readJson<{ template_id: string; id: string; version: number }>(
      await supabase.request("/rest/v1/qa_template_version?select=template_id,id,version&order=version.desc", {
        cache: "no-store",
        headers,
      }),
    ),
  ]);

  // versions are ordered version desc, so the first seen per template is latest.
  const latest = new Map<string, { id: string; version: number }>();
  for (const version of versions) {
    if (!latest.has(version.template_id)) latest.set(version.template_id, { id: version.id, version: version.version });
  }

  return templates
    .map((template) => {
      const version = latest.get(template.id);
      return version ? { versionId: version.id, label: `${template.name} (v${version.version})` } : null;
    })
    .filter((choice): choice is QaTemplateChoice => choice !== null);
};

// ---- Start a checklist -----------------------------------------------------

export const startQaChecklist = async ({
  actorProfileId,
  projectId,
  sectionId,
  templateVersionId,
  code,
}: {
  actorProfileId: string;
  projectId: string;
  sectionId: string | null;
  templateVersionId: string;
  code: string;
}): Promise<string> => {
  const supabase = createServiceRoleSupabaseClient();
  const response = await supabase.request("/rest/v1/rpc/create_qa_checklist_from_version", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      p_project_id: projectId,
      p_section_id: sectionId,
      p_template_version_id: templateVersionId,
      p_code: code,
      p_created_by_profile_id: actorProfileId,
    }),
  });
  if (!response.ok) {
    const detail = (await response.text().catch(() => "")).slice(0, 300);
    throw new Error(`Could not start the checklist${detail ? ` — ${detail}` : ` (status ${response.status})`}`);
  }
  return (await response.json()) as string;
};

// ---- Checklist detail (read) ----------------------------------------------

type SnapshotItem = {
  id: string;
  type: "select" | "text" | "date" | "note" | "heading" | "signoff";
  label: string;
  options?: string[];
};
type SnapshotStep = { id: string; title: string; checkpoint?: boolean; items: SnapshotItem[] };
type Snapshot = { steps?: SnapshotStep[] };

type RawChecklistRow = {
  id: string;
  project_id: string;
  section_id: string | null;
  template_version_id: string;
  fields_snapshot: Snapshot;
  code: string;
  title: string;
  status: QaChecklistDetail["status"];
  updated_at: string;
};

export const getQaChecklistDetail = async (
  session: AuthSession,
  checklistId: string,
): Promise<QaChecklistDetail | null> => {
  const supabase = createServerSupabaseClient();
  const headers = authHeaders(session);

  const checklist = (
    await readJson<RawChecklistRow>(
      await supabase.request(
        `/rest/v1/qa_checklist?id=eq.${checklistId}&select=id,project_id,section_id,template_version_id,fields_snapshot,code,title,status,updated_at&limit=1`,
        { cache: "no-store", headers },
      ),
    )
  )[0];
  if (!checklist) return null;

  const [projectRows, sectionRows, versionRows, itemRows, evidenceRows, signoffRows] = await Promise.all([
    readJson<{ source_project_ref: string | null; name: string; lot_code: string | null }>(
      await supabase.request(
        `/rest/v1/qa_project?id=eq.${checklist.project_id}&select=source_project_ref,name,lot_code&limit=1`,
        { cache: "no-store", headers },
      ),
    ),
    checklist.section_id
      ? readJson<{ name: string }>(
          await supabase.request(`/rest/v1/qa_section?id=eq.${checklist.section_id}&select=name&limit=1`, {
            cache: "no-store",
            headers,
          }),
        )
      : Promise.resolve([]),
    readJson<{ version: number }>(
      await supabase.request(
        `/rest/v1/qa_template_version?id=eq.${checklist.template_version_id}&select=version&limit=1`,
        { cache: "no-store", headers },
      ),
    ),
    readJson<{ id: string; source_item_id: string; selected_value: string | null }>(
      await supabase.request(
        `/rest/v1/qa_check_item?checklist_id=eq.${checklist.id}&select=id,source_item_id,selected_value`,
        { cache: "no-store", headers },
      ),
    ),
    readJson<{ id: string; source_step_id: string | null; caption: string | null; added_by_profile_id: string | null; created_at: string }>(
      await supabase.request(
        `/rest/v1/qa_evidence?checklist_id=eq.${checklist.id}&select=id,source_step_id,caption,added_by_profile_id,created_at&order=created_at.asc`,
        { cache: "no-store", headers },
      ),
    ),
    readJson<{ id: string; label: string; kind: "signoff" | "hold" | "witness"; status: "pending" | "signed" | "returned"; signed_by_profile_id: string | null; signed_at: string | null }>(
      await supabase.request(
        `/rest/v1/qa_signoff?checklist_id=eq.${checklist.id}&select=id,label,kind,status,signed_by_profile_id,signed_at&order=created_at.asc`,
        { cache: "no-store", headers },
      ),
    ),
  ]);

  const project = projectRows[0];
  const rowBySourceId = new Map(itemRows.map((row) => [row.source_item_id, row]));

  // Resolve actor names for evidence attribution + sign-offs in one query.
  const profileIds = [
    ...new Set(
      [
        ...evidenceRows.map((row) => row.added_by_profile_id),
        ...signoffRows.map((row) => row.signed_by_profile_id),
      ].filter((id): id is string => Boolean(id)),
    ),
  ];
  const profileRows = profileIds.length
    ? await readJson<{ id: string; full_name: string | null; email: string }>(
        await supabase.request(
          `/rest/v1/profiles?id=in.(${profileIds.join(",")})&select=id,full_name,email`,
          { cache: "no-store", headers },
        ),
      )
    : [];
  const profileName = new Map(profileRows.map((row) => [row.id, row.full_name ?? row.email]));

  let passCount = 0;
  let failCount = 0;
  for (const row of itemRows) {
    if (row.selected_value === "Yes") passCount += 1;
    else if (row.selected_value === "No") failCount += 1;
  }

  const evidenceByStep = new Map<string, typeof evidenceRows>();
  for (const row of evidenceRows) {
    const key = row.source_step_id ?? "";
    const list = evidenceByStep.get(key) ?? [];
    list.push(row);
    evidenceByStep.set(key, list);
  }

  const steps: QaCheckStep[] = (checklist.fields_snapshot.steps ?? []).map((step) => ({
    id: step.id,
    title: step.title,
    checkpoint: step.checkpoint ?? false,
    items: step.items.map((item) => {
      const row = rowBySourceId.get(item.id);
      return {
        id: item.id,
        type: item.type,
        label: item.label,
        options: item.options,
        selected_value: row?.selected_value ?? null,
        record_id: row?.id,
      };
    }),
    evidence: (evidenceByStep.get(step.id) ?? []).map((row) => ({
      id: row.id,
      caption: row.caption ?? "Photo",
      added_by: row.added_by_profile_id ? profileName.get(row.added_by_profile_id) ?? "—" : "—",
      added_at: formatDate(row.created_at),
    })),
  }));

  return {
    id: checklist.id,
    code: checklist.code,
    title: checklist.title,
    section_id: checklist.section_id,
    status: checklist.status,
    pass_count: passCount,
    fail_count: failCount,
    template_version: versionRows[0] ? `v${versionRows[0].version}` : "—",
    updated_at: formatDate(checklist.updated_at),
    project_id: checklist.project_id,
    project_ref: project?.source_project_ref ?? "—",
    project_name: project?.name ?? "—",
    lot_code: project?.lot_code ?? null,
    section_name: sectionRows[0]?.name ?? null,
    steps,
    hold_points: signoffRows.map((row) => ({
      id: row.id,
      label: row.label,
      kind: row.kind === "witness" ? ("witness" as const) : ("hold" as const),
      status:
        row.status === "signed"
          ? ("signed_off" as const)
          : row.status === "returned"
            ? ("in_progress" as const)
            : ("awaiting_signoff" as const),
      signed_by: row.signed_by_profile_id ? profileName.get(row.signed_by_profile_id) : undefined,
      signed_at: row.signed_at ? formatDate(row.signed_at) : undefined,
    })),
  };
};
