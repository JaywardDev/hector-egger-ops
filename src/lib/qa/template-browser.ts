import "server-only";

import type { AuthSession } from "@/src/lib/auth/session";
import { createServerSupabaseClient } from "@/src/lib/supabase/server";

// Read-only admin browser for imported QA checklist templates. Uses the session
// client so RLS applies (admins pass qa_can_read); mirrors the timesheet lookups
// browser data layer.

export type QaTemplateVersionRow = {
  version: number;
  imported_at: string | null;
  source_row_hash: string;
};

export type QaTemplateBrowserRow = {
  id: string;
  source_id: string;
  name: string;
  created_at: string;
  updated_at: string;
  version_count: number;
  latest_version: number | null;
  last_imported_at: string | null;
  versions: QaTemplateVersionRow[];
};

export type QaTemplateImportHistoryRow = {
  id: string;
  filename: string;
  source_id: string;
  version: number | null;
  action: string;
  created_at: string;
};

export type QaTemplateBrowserFilters = { search: string };

export type QaTemplateBrowserResult = {
  templates: QaTemplateBrowserRow[];
  history: QaTemplateImportHistoryRow[];
};

type RawTemplate = { id: string; source_id: string; name: string; created_at: string; updated_at: string };
type RawVersion = { template_id: string; version: number; imported_at: string | null; source_row_hash: string };

export const sanitizeTemplateFilters = (
  params: Record<string, string | string[] | undefined>,
): QaTemplateBrowserFilters => ({
  search: typeof params.q === "string" ? params.q.trim() : "",
});

const authHeaders = (session: AuthSession) => ({ Authorization: `Bearer ${session.accessToken}` });

const readJson = async <T>(response: Response): Promise<T[]> => (response.ok ? ((await response.json()) as T[]) : []);

export const listQaTemplatesForAdmin = async (
  session: AuthSession,
  filters: QaTemplateBrowserFilters,
): Promise<QaTemplateBrowserResult> => {
  const supabase = createServerSupabaseClient();
  const headers = authHeaders(session);

  const templateParams = new URLSearchParams();
  templateParams.set("select", "id,source_id,name,created_at,updated_at");
  templateParams.set("order", "name.asc");
  if (filters.search) {
    const like = `*${filters.search}*`;
    templateParams.set("or", `(name.ilike.${like},source_id.ilike.${like})`);
  }

  const [templateResponse, versionResponse, historyResponse] = await Promise.all([
    supabase.request(`/rest/v1/qa_template?${templateParams.toString()}`, { cache: "no-store", headers }),
    supabase.request(
      "/rest/v1/qa_template_version?select=template_id,version,imported_at,source_row_hash&order=version.desc",
      { cache: "no-store", headers },
    ),
    supabase.request(
      "/rest/v1/qa_template_import_history?select=id,filename,source_id,version,action,created_at&order=created_at.desc&limit=20",
      { cache: "no-store", headers },
    ),
  ]);

  const rawTemplates = await readJson<RawTemplate>(templateResponse);
  const rawVersions = await readJson<RawVersion>(versionResponse);
  const history = await readJson<QaTemplateImportHistoryRow>(historyResponse);

  const versionsByTemplate = new Map<string, QaTemplateVersionRow[]>();
  for (const version of rawVersions) {
    const list = versionsByTemplate.get(version.template_id) ?? [];
    list.push({ version: version.version, imported_at: version.imported_at, source_row_hash: version.source_row_hash });
    versionsByTemplate.set(version.template_id, list);
  }

  const templates: QaTemplateBrowserRow[] = rawTemplates.map((template) => {
    const versions = versionsByTemplate.get(template.id) ?? [];
    return {
      ...template,
      versions,
      version_count: versions.length,
      latest_version: versions[0]?.version ?? null,
      last_imported_at: versions[0]?.imported_at ?? null,
    };
  });

  return { templates, history };
};
