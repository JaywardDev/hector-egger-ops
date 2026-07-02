import { NextResponse } from "next/server";
import { requireProtectedAccess } from "@/src/lib/auth/guards";
import { isAdminOrSupervisor, isOperator } from "@/src/lib/permissions/roles";
import { isQaChecklistEditable } from "@/src/lib/qa/capture";
import { createServiceRoleSupabaseClient } from "@/src/lib/supabase/service-role";

type EvidenceRow = { checklist_id: string; storage_path: string; content_type: string | null };

const loadEvidence = async (evidenceId: string): Promise<EvidenceRow | null> => {
  const supabase = createServiceRoleSupabaseClient();
  const response = await supabase.request(
    `/rest/v1/qa_evidence?id=eq.${evidenceId}&select=checklist_id,storage_path,content_type&limit=1`,
    { cache: "no-store" },
  );
  if (!response.ok) return null;
  const [row] = (await response.json()) as EvidenceRow[];
  return row ?? null;
};

// Streams an evidence photo. Auth-gated to approved users; reads from the
// private qa-evidence bucket via the service role (same pattern as avatars).
export async function GET(_request: Request, { params }: { params: Promise<{ evidenceId: string }> }) {
  const { profile } = await requireProtectedAccess("/api/qa/evidence");
  if (!profile) return new NextResponse(null, { status: 401 });

  const { evidenceId } = await params;
  if (!/^[0-9a-fA-F-]{36}$/.test(evidenceId)) return new NextResponse(null, { status: 400 });

  const evidence = await loadEvidence(evidenceId);
  if (!evidence) return new NextResponse(null, { status: 404 });

  const supabase = createServiceRoleSupabaseClient();
  const objectResponse = await supabase.request(`/storage/v1/object/qa-evidence/${evidence.storage_path}`, {
    cache: "no-store",
  });
  if (!objectResponse.ok) return new NextResponse(null, { status: 404 });

  const body = await objectResponse.arrayBuffer();
  return new NextResponse(body, {
    headers: {
      "Content-Type": evidence.content_type ?? objectResponse.headers.get("content-type") ?? "image/jpeg",
      // Evidence is immutable once uploaded, so a longer private cache is safe.
      "Cache-Control": "private, max-age=3600",
    },
  });
}

// Removes an evidence photo (capture roles, only while the checklist is editable).
export async function DELETE(_request: Request, { params }: { params: Promise<{ evidenceId: string }> }) {
  const context = await requireProtectedAccess("/api/qa/evidence");
  if (!context.profile) return NextResponse.json({ ok: false }, { status: 401 });
  if (!isAdminOrSupervisor(context) && !isOperator(context)) {
    return NextResponse.json({ ok: false, message: "Capture access required." }, { status: 403 });
  }

  const { evidenceId } = await params;
  if (!/^[0-9a-fA-F-]{36}$/.test(evidenceId)) return NextResponse.json({ ok: false }, { status: 400 });

  const evidence = await loadEvidence(evidenceId);
  if (!evidence) return NextResponse.json({ ok: false }, { status: 404 });
  if (!(await isQaChecklistEditable(evidence.checklist_id))) {
    return NextResponse.json({ ok: false, message: "This checklist is signed off; evidence is locked." }, { status: 409 });
  }

  const supabase = createServiceRoleSupabaseClient();
  await supabase.request(`/storage/v1/object/qa-evidence/${evidence.storage_path}`, { method: "DELETE" }).catch(() => undefined);
  const deleteResponse = await supabase.request(`/rest/v1/qa_evidence?id=eq.${evidenceId}`, {
    method: "DELETE",
    headers: { Prefer: "return=minimal" },
  });
  if (!deleteResponse.ok) return NextResponse.json({ ok: false, message: "Could not remove the photo." }, { status: 502 });

  return NextResponse.json({ ok: true });
}
