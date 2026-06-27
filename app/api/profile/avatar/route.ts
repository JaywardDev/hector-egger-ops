import { NextResponse } from "next/server";
import { requireProtectedAccess } from "@/src/lib/auth/guards";
import { createServiceRoleSupabaseClient } from "@/src/lib/supabase/service-role";

const MAX_BYTES = 1_500_000; // ~1.5 MB
const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

// Self-serve avatar upload. The cropped image is sent as the raw request body.
export async function POST(request: Request) {
  const { profile } = await requireProtectedAccess("/api/profile/avatar");
  if (!profile) return NextResponse.json({ ok: false, message: "Authenticated profile is required." }, { status: 401 });

  const contentType = request.headers.get("content-type")?.split(";")[0]?.trim() ?? "";
  if (!ALLOWED_TYPES.has(contentType)) {
    return NextResponse.json({ ok: false, message: "Upload a PNG, JPEG, or WebP image." }, { status: 415 });
  }

  const bytes = new Uint8Array(await request.arrayBuffer());
  if (bytes.byteLength === 0) {
    return NextResponse.json({ ok: false, message: "No image was received." }, { status: 400 });
  }
  if (bytes.byteLength > MAX_BYTES) {
    return NextResponse.json({ ok: false, message: "Image is too large (max 1.5 MB)." }, { status: 413 });
  }

  const objectPath = profile.id; // one avatar per profile, overwritten on change
  const supabase = createServiceRoleSupabaseClient();

  const uploadResponse = await supabase.request(`/storage/v1/object/avatars/${objectPath}`, {
    method: "POST",
    headers: { "Content-Type": contentType, "x-upsert": "true" },
    body: bytes,
  });
  if (!uploadResponse.ok) {
    return NextResponse.json({ ok: false, message: "Could not store the image." }, { status: 502 });
  }

  const updateResponse = await supabase.request(`/rest/v1/profiles?id=eq.${profile.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify({ avatar_path: objectPath }),
  });
  if (!updateResponse.ok) {
    return NextResponse.json({ ok: false, message: "Could not update your profile." }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  const { profile } = await requireProtectedAccess("/api/profile/avatar");
  if (!profile) return NextResponse.json({ ok: false, message: "Authenticated profile is required." }, { status: 401 });

  const supabase = createServiceRoleSupabaseClient();

  if (profile.avatar_path) {
    await supabase.request(`/storage/v1/object/avatars/${profile.avatar_path}`, { method: "DELETE" });
  }
  const updateResponse = await supabase.request(`/rest/v1/profiles?id=eq.${profile.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify({ avatar_path: null }),
  });
  if (!updateResponse.ok) {
    return NextResponse.json({ ok: false, message: "Could not update your profile." }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
