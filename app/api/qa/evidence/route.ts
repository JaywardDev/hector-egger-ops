import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { requireProtectedAccess } from "@/src/lib/auth/guards";
import { isAdminOrSupervisor, isOperator } from "@/src/lib/permissions/roles";
import { insertQaEvidence, isQaChecklistEditable } from "@/src/lib/qa/capture";
import { createServiceRoleSupabaseClient } from "@/src/lib/supabase/service-role";

const MAX_BYTES = 6_000_000; // ~6 MB (client compresses first; this is the hard cap)
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

// Evidence photo upload. The compressed image is sent as the raw request body
// (same pattern as the avatar upload); checklist/step context rides in query
// params. Bytes go to the private qa-evidence bucket; a qa_evidence row records
// the path + attribution.
export async function POST(request: Request) {
  const context = await requireProtectedAccess("/api/qa/evidence");
  if (!context.profile) return NextResponse.json({ ok: false, message: "Profile required." }, { status: 401 });
  if (!isAdminOrSupervisor(context) && !isOperator(context)) {
    return NextResponse.json({ ok: false, message: "Capture access required." }, { status: 403 });
  }

  const url = new URL(request.url);
  const checklistId = url.searchParams.get("checklistId") ?? "";
  const stepId = url.searchParams.get("stepId");
  const caption = (url.searchParams.get("caption") ?? "").slice(0, 200) || null;
  if (!/^[0-9a-fA-F-]{36}$/.test(checklistId)) {
    return NextResponse.json({ ok: false, message: "A valid checklistId is required." }, { status: 400 });
  }

  if (!(await isQaChecklistEditable(checklistId))) {
    return NextResponse.json({ ok: false, message: "This checklist is signed off and can no longer be edited." }, { status: 409 });
  }

  const contentType = request.headers.get("content-type")?.split(";")[0]?.trim() ?? "";
  if (!ALLOWED_TYPES.has(contentType)) {
    return NextResponse.json({ ok: false, message: "Upload a JPEG, PNG, or WebP image." }, { status: 415 });
  }

  const bytes = new Uint8Array(await request.arrayBuffer());
  if (bytes.byteLength === 0) {
    return NextResponse.json({ ok: false, message: "No image was received." }, { status: 400 });
  }
  if (bytes.byteLength > MAX_BYTES) {
    return NextResponse.json({ ok: false, message: "Image is too large (max 6 MB)." }, { status: 413 });
  }

  const extension = contentType === "image/png" ? "png" : contentType === "image/webp" ? "webp" : "jpg";
  const objectPath = `${checklistId}/${randomUUID()}.${extension}`;
  const supabase = createServiceRoleSupabaseClient();

  const uploadResponse = await supabase.request(`/storage/v1/object/qa-evidence/${objectPath}`, {
    method: "POST",
    headers: { "Content-Type": contentType },
    body: bytes,
  });
  if (!uploadResponse.ok) {
    return NextResponse.json({ ok: false, message: "Could not store the photo." }, { status: 502 });
  }

  try {
    const record = await insertQaEvidence({
      checklistId,
      sourceStepId: stepId,
      storagePath: objectPath,
      caption,
      contentType,
      byteSize: bytes.byteLength,
      actorProfileId: context.profile.id,
    });
    return NextResponse.json({
      ok: true,
      evidence: {
        id: record.id,
        caption: record.caption ?? "Photo",
        added_by: context.profile.full_name ?? context.profile.email,
        added_at: new Date(record.created_at).toLocaleDateString("en-NZ", { day: "2-digit", month: "short", year: "numeric" }),
      },
    });
  } catch (error) {
    // Roll back the orphaned blob so storage does not accumulate unlinked files.
    await supabase.request(`/storage/v1/object/qa-evidence/${objectPath}`, { method: "DELETE" }).catch(() => undefined);
    const message = error instanceof Error ? error.message : "Could not record the photo.";
    return NextResponse.json({ ok: false, message }, { status: 502 });
  }
}
