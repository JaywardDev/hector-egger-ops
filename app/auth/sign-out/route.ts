import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  ACCESS_TOKEN_COOKIE,
  clearSessionCookies,
} from "@/src/lib/auth/session";
import { getSupabasePublicEnv } from "@/src/lib/supabase/env";

const signOutFromSupabase = async (accessToken: string | undefined) => {
  if (!accessToken) {
    return;
  }

  const { url, anonKey } = getSupabasePublicEnv();

  await fetch(`${url.replace(/\/$/, "")}/auth/v1/logout`, {
    method: "POST",
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
  });
};

const buildRedirectResponse = async (request: Request) => {
  const cookieStore = await cookies();
  await signOutFromSupabase(cookieStore.get(ACCESS_TOKEN_COOKIE)?.value);

  const response = NextResponse.redirect(new URL("/sign-in", request.url));
  clearSessionCookies(response.cookies);

  return response;
};

export async function GET(request: Request) {
  return buildRedirectResponse(request);
}

export async function POST(request: Request) {
  return buildRedirectResponse(request);
}
