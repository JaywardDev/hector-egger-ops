import { NextResponse } from "next/server";
import { requireProtectedAccess } from "@/src/lib/auth/guards";
import { createServiceRoleSupabaseClient } from "@/src/lib/supabase/service-role";

export async function POST(request: Request) {
  const { profile } = await requireProtectedAccess("/api/push/subscribe");
  if (!profile) return NextResponse.json({ error: "Profile required." }, { status: 401 });

  const body = await request.json() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
  const { endpoint, keys } = body;
  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return NextResponse.json({ error: "Invalid subscription object." }, { status: 400 });
  }

  const supabase = createServiceRoleSupabaseClient();
  const response = await supabase.request(
    "/rest/v1/push_subscriptions?on_conflict=profile_id,endpoint",
    {
      method: "POST",
      headers: { "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({ profile_id: profile.id, endpoint, p256dh: keys.p256dh, auth: keys.auth }),
    },
  );

  if (!response.ok) return NextResponse.json({ error: "Could not save subscription." }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const { profile } = await requireProtectedAccess("/api/push/subscribe");
  if (!profile) return NextResponse.json({ error: "Profile required." }, { status: 401 });

  const body = await request.json() as { endpoint?: string };
  if (!body.endpoint) return NextResponse.json({ error: "Endpoint required." }, { status: 400 });

  const supabase = createServiceRoleSupabaseClient();
  await supabase.request(
    `/rest/v1/push_subscriptions?profile_id=eq.${profile.id}&endpoint=eq.${encodeURIComponent(body.endpoint)}`,
    { method: "DELETE" },
  );

  return NextResponse.json({ ok: true });
}
