import "server-only";

import { createServiceRoleSupabaseClient } from "@/src/lib/supabase/service-role";
import { parseQaChecklistTemplate, type QaTemplateParseResult } from "@/src/lib/qa/c-base-import";

// Phase 1a apply layer (server side). Turns a parsed checklist template into a
// versioned qa_template_version row via the apply_qa_template_import RPC. The
// pure parser lives in c-base-import.ts and stays test-clean; the DB-touching
// bits (server-only + service role) live here, mirroring how timesheets splits
// parseWorksheet from applyCBaseImport.
//
// Admin access is gated by the caller (the import route/action) before these
// run — the RPC is service_role-only and trusts p_actor_profile_id, exactly as
// apply_c_base_timesheet_lookup_import does.

export type QaTemplateImportAction = "inserted" | "unchanged" | "version_conflict" | "replaced";

/**
 * Apply mode. "skip" is append-only: a changed template at an existing version
 * is refused (version_conflict). "replace" overwrites that version's definition
 * in place — used to heal a version whose parse output legitimately changed
 * (e.g. after a parser upgrade). Started checklists are unaffected: they run off
 * their own frozen fields_snapshot.
 */
export type QaTemplateImportMode = "skip" | "replace";

export type QaTemplateApplyResult = {
  action: QaTemplateImportAction;
  templateId: string;
  versionId: string;
};

export type QaTemplatePrepareOutcome = {
  filename: string;
  parse: QaTemplateParseResult;
  /** What an apply would do now — "invalid" when the parse has fatal errors. */
  action: QaTemplateImportAction | "invalid";
};

type ExistingVersionRow = { version: number; source_row_hash: string };

const loadExistingVersions = async (sourceId: string): Promise<ExistingVersionRow[]> => {
  const supabase = createServiceRoleSupabaseClient();
  const response = await supabase.request(
    `/rest/v1/qa_template_version?source_id=eq.${encodeURIComponent(sourceId)}&select=version,source_row_hash`,
    { cache: "no-store" },
  );
  if (!response.ok) throw new Error("Failed to load existing QA template versions.");
  return (await response.json()) as ExistingVersionRow[];
};

/** Dry-run: parse the file and report what an apply would do, without writing. */
export const prepareQaTemplateImport = async (
  filename: string,
  buffer: Buffer,
): Promise<QaTemplatePrepareOutcome> => {
  const parse = parseQaChecklistTemplate(buffer);
  if (parse.errors.length > 0 || !parse.fields || !parse.sourceRowHash) {
    return { filename, parse, action: "invalid" };
  }

  const existing = await loadExistingVersions(parse.fields.source_id);
  const sameVersion = existing.find((row) => row.version === parse.fields!.version);
  const action: QaTemplateImportAction = !sameVersion
    ? "inserted"
    : sameVersion.source_row_hash === parse.sourceRowHash
      ? "unchanged"
      : "version_conflict";

  return { filename, parse, action };
};;

/** Apply one parsed template. Throws on validation errors (fail loudly). */
export const applyQaTemplateImport = async ({
  actorProfileId,
  filename,
  buffer,
  mode = "skip",
}: {
  actorProfileId: string;
  filename: string;
  buffer: Buffer;
  mode?: QaTemplateImportMode;
}): Promise<QaTemplateApplyResult> => {
  const parse = parseQaChecklistTemplate(buffer);
  if (parse.errors.length > 0 || !parse.fields || !parse.sourceRowHash) {
    throw new Error("Cannot apply QA template while validation errors exist.");
  }

  const fields = parse.fields;
  const supabase = createServiceRoleSupabaseClient();
  const response = await supabase.request("/rest/v1/rpc/apply_qa_template_import", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      p_actor_profile_id: actorProfileId,
      p_filename: filename,
      p_source_id: fields.source_id,
      p_name: fields.name,
      p_version: fields.version,
      p_fields_json: fields,
      p_raw_rows: parse.raw,
      p_source_row_hash: parse.sourceRowHash,
      p_mode: mode,
    }),
  });
  if (!response.ok) throw new Error("Failed to apply QA template import.");
  return (await response.json()) as QaTemplateApplyResult;
};
