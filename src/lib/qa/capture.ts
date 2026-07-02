import "server-only";

import { createServiceRoleSupabaseClient } from "@/src/lib/supabase/service-role";

// Server-side write helpers for the capture loop (1b answers, 1c evidence rows,
// 1d sign-off). All go through the service role and are gated in the calling
// action/route; the RPCs re-validate at the DB (options, signed-off lock).

const rpc = async (path: string, payload: Record<string, unknown>, failureMessage: string) => {
  const supabase = createServiceRoleSupabaseClient();
  const response = await supabase.request(`/rest/v1/rpc/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const detail = (await response.text().catch(() => "")).slice(0, 300);
    throw new Error(`${failureMessage}${detail ? ` — ${detail}` : ` (status ${response.status})`}`);
  }
  return (await response.json()) as { checklist_status: string };
};

export const answerQaCheckItem = async ({
  checkItemId,
  value,
  actorProfileId,
}: {
  checkItemId: string;
  value: string | null;
  actorProfileId: string;
}) =>
  rpc(
    "answer_qa_check_item",
    { p_check_item_id: checkItemId, p_value: value, p_actor_profile_id: actorProfileId },
    "Could not save the answer",
  );

export const signOffQaChecklist = async ({
  signoffId,
  actorProfileId,
  comment,
}: {
  signoffId: string;
  actorProfileId: string;
  comment?: string;
}) =>
  rpc(
    "sign_off_qa_checklist",
    { p_signoff_id: signoffId, p_actor_profile_id: actorProfileId, p_comment: comment ?? null },
    "Could not sign off",
  );

export type QaEvidenceRecord = {
  id: string;
  checklist_id: string;
  source_step_id: string | null;
  storage_path: string;
  caption: string | null;
  created_at: string;
};

export const insertQaEvidence = async ({
  checklistId,
  sourceStepId,
  storagePath,
  caption,
  contentType,
  byteSize,
  actorProfileId,
}: {
  checklistId: string;
  sourceStepId: string | null;
  storagePath: string;
  caption: string | null;
  contentType: string;
  byteSize: number;
  actorProfileId: string;
}): Promise<QaEvidenceRecord> => {
  const supabase = createServiceRoleSupabaseClient();
  const response = await supabase.request("/rest/v1/qa_evidence", {
    method: "POST",
    headers: { "Content-Type": "application/json", Prefer: "return=representation" },
    body: JSON.stringify({
      checklist_id: checklistId,
      source_step_id: sourceStepId,
      storage_path: storagePath,
      caption,
      content_type: contentType,
      byte_size: byteSize,
      added_by_profile_id: actorProfileId,
    }),
  });
  if (!response.ok) {
    const detail = (await response.text().catch(() => "")).slice(0, 300);
    throw new Error(`Could not record the photo${detail ? ` — ${detail}` : ""}`);
  }
  const [row] = (await response.json()) as QaEvidenceRecord[];
  return row;
};

/** True when the checklist exists and is not signed off (i.e. still editable). */
export const isQaChecklistEditable = async (checklistId: string): Promise<boolean> => {
  const supabase = createServiceRoleSupabaseClient();
  const response = await supabase.request(
    `/rest/v1/qa_checklist?id=eq.${checklistId}&select=status&limit=1`,
    { cache: "no-store" },
  );
  if (!response.ok) return false;
  const [row] = (await response.json()) as { status: string }[];
  return Boolean(row && row.status !== "signed_off");
};
