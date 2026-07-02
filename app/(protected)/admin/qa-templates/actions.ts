"use server";

import { revalidatePath } from "next/cache";
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

export type QaTemplateActionResult = { ok: boolean; message?: string };

// Archive / unarchive a template. Admin-only (the manager owns templates).
// Archiving keeps the template + its checklists intact but removes it from the
// "start a checklist" picker.
export async function setQaTemplateArchivedAction(
  templateId: string,
  archived: boolean,
): Promise<QaTemplateActionResult> {
  try {
    const { profile } = await requireAdminAccess();
    if (!profile) return { ok: false, message: "Admin profile required." };
    if (!/^[0-9a-fA-F-]{36}$/.test(templateId)) return { ok: false, message: "Invalid template." };

    const supabase = createServiceRoleSupabaseClient();
    const response = await supabase.request(`/rest/v1/qa_template?id=eq.${templateId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({
        is_archived: archived,
        archived_at: archived ? new Date().toISOString() : null,
        archived_by_profile_id: archived ? profile.id : null,
      }),
    });
    if (!response.ok) {
      const detail = (await response.text().catch(() => "")).slice(0, 200);
      return { ok: false, message: `Could not update the template${detail ? ` — ${detail}` : ""}` };
    }

    revalidatePath("/admin/qa-templates");
    return { ok: true };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Could not update the template." };
  }
}
