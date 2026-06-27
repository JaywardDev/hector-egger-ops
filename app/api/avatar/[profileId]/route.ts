import { NextResponse } from "next/server";
import { requireProtectedAccess } from "@/src/lib/auth/guards";
import { createServiceRoleSupabaseClient } from "@/src/lib/supabase/service-role";

// Streams a user's avatar image. Auth-gated to approved users (avatars are
// visible across the app), reading from the private "avatars" bucket via the
// service role so the bucket never needs to be public.
export async function GET(_request: Request, { params }: { params: Promise<{ profileId: string }> }) {
  const { profile } = await requireProtectedAccess("/api/avatar");
  if (!profile) return new NextResponse(null, { status: 401 });

  const { profileId } = await params;
  if (!/^[0-9a-fA-F-]{36}$/.test(profileId)) return new NextResponse(null, { status: 400 });

  const supabase = createServiceRoleSupabaseClient();
  const profileResponse = await supabase.request(
    `/rest/v1/profiles?select=avatar_path&id=eq.${profileId}&limit=1`,
    { cache: "no-store" },
  );
  if (!profileResponse.ok) return new NextResponse(null, { status: 502 });
  const [row] = (await profileResponse.json()) as { avatar_path: string | null }[];
  if (!row?.avatar_path) return new NextResponse(null, { status: 404 });

  const objectResponse = await supabase.request(`/storage/v1/object/avatars/${row.avatar_path}`, {
    cache: "no-store",
  });
  if (!objectResponse.ok) return new NextResponse(null, { status: 404 });

  const body = await objectResponse.arrayBuffer();
  return new NextResponse(body, {
    headers: {
      "Content-Type": objectResponse.headers.get("content-type") ?? "image/png",
      // Private (per-user auth) but cacheable briefly to keep lists snappy.
      "Cache-Control": "private, max-age=60",
    },
  });
}
