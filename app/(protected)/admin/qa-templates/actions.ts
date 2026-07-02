"use server";

import { requireAdminAccess } from "@/src/lib/auth/guards";
import { createServiceRoleSupabaseClient } from "@/src/lib/supabase/service-role";
import type { QaTemplateFields } from "@/src/lib/qa/c-base-import";

export type QaTemplateFieldsResult =
  | { ok: true; name: string; version: number; fields: QaTemplateFields }
  | { ok: false; message: string };

// Loads one template version's definition for the read-only viewer modal.
// Admin-gated; fetched on demand so the browser list stays light.
export async function getQaTemplateVersionFieldsAction(
  versionId: string,
): Promise<QaTemplateFieldsResult> {
  try {
    await requireAdminAccess();
    if (!/^[0-9a-fA-F-]{36}$/.test(versionId)) {
      return { ok: false, message: "Invalid template version." };
    }

    const supabase = createServiceRoleSupabaseClient();
    const response = await supabase.request(
      `/rest/v1/qa_template_version?id=eq.${versionId}&select=name,version,fields_json&limit=1`,
      { cache: "no-store" },
    );
    if (!response.ok) return { ok: false, message: "Could not load the template." };

    const [row] = (await response.json()) as { name: string; version: number; fields_json: QaTemplateFields }[];
    if (!row) return { ok: false, message: "Template version not found." };

    return { ok: true, name: row.name, version: row.version, fields: row.fields_json };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Could not load the template." };
  }
}
