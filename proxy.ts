import { NextResponse, type NextRequest } from "next/server";
import {
  ACCESS_TOKEN_COOKIE,
  PERSISTENT_SESSION_MAX_AGE_SECONDS,
  REFRESH_TOKEN_COOKIE,
  sessionCookieOptions,
} from "@/src/lib/auth/cookies";
import { getSupabasePublicEnv } from "@/src/lib/supabase/env";

type AuthPayload = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
};

const refreshSupabaseSession = async (refreshToken: string): Promise<AuthPayload | null> => {
  const { url, anonKey } = getSupabasePublicEnv();
  const response = await fetch(`${url.replace(/\/$/, "")}/auth/v1/token?grant_type=refresh_token`, {
    method: "POST",
    headers: {
      apikey: anonKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ refresh_token: refreshToken }),
    cache: "no-store",
  });

  if (!response.ok) {
    return null;
  }

  return (await response.json()) as AuthPayload;
};

const fetchSupabaseUser = async (accessToken: string) => {
  const { url, anonKey } = getSupabasePublicEnv();
  const response = await fetch(`${url.replace(/\/$/, "")}/auth/v1/user`, {
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
  });

  return response.ok;
};

const setRequestCookie = (request: NextRequest, name: string, value: string) => {
  request.cookies.set(name, value);
};

const setResponseCookie = (response: NextResponse, name: string, value: string, maxAge: number) => {
  response.cookies.set(name, value, {
    ...sessionCookieOptions,
    maxAge,
  });
};

const clearAuthCookies = (request: NextRequest, response: NextResponse) => {
  request.cookies.delete(ACCESS_TOKEN_COOKIE);
  request.cookies.delete(REFRESH_TOKEN_COOKIE);
  response.cookies.delete(ACCESS_TOKEN_COOKIE);
  response.cookies.delete(REFRESH_TOKEN_COOKIE);
};

export async function proxy(request: NextRequest) {
  const accessToken = request.cookies.get(ACCESS_TOKEN_COOKIE)?.value;
  const refreshToken = request.cookies.get(REFRESH_TOKEN_COOKIE)?.value;

  if (!refreshToken || (accessToken && await fetchSupabaseUser(accessToken))) {
    return NextResponse.next();
  }

  const payload = await refreshSupabaseSession(refreshToken);

  if (!payload?.access_token) {
    const response = NextResponse.next({ request });
    clearAuthCookies(request, response);
    return response;
  }

  const effectiveRefreshToken = payload.refresh_token ?? refreshToken;
  const accessTokenMaxAge =
    typeof payload.expires_in === "number" && payload.expires_in > 0
      ? Math.max(payload.expires_in, PERSISTENT_SESSION_MAX_AGE_SECONDS)
      : PERSISTENT_SESSION_MAX_AGE_SECONDS;

  setRequestCookie(request, ACCESS_TOKEN_COOKIE, payload.access_token);
  setRequestCookie(request, REFRESH_TOKEN_COOKIE, effectiveRefreshToken);

  const response = NextResponse.next({ request });
  setResponseCookie(response, ACCESS_TOKEN_COOKIE, payload.access_token, accessTokenMaxAge);
  setResponseCookie(response, REFRESH_TOKEN_COOKIE, effectiveRefreshToken, PERSISTENT_SESSION_MAX_AGE_SECONDS);

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
