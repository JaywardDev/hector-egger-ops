import "server-only";

import { cookies } from "next/headers";
import { cache } from "react";
import { getSupabasePublicEnv } from "@/src/lib/supabase/env";

export const ACCESS_TOKEN_COOKIE = "heo_access_token";
export const REFRESH_TOKEN_COOKIE = "heo_refresh_token";

export type AuthUser = {
  id: string;
  email: string | null;
};

export type AuthSession = {
  accessToken: string;
  refreshToken: string | null;
  user: AuthUser;
};

type CookieStore = Awaited<ReturnType<typeof cookies>>;
type CookieDeleteStore = {
  delete: (name: string) => void;
};

type AuthPayload = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  user?: {
    id?: string;
    email?: string | null;
  };
};

type SupabaseUserResponse = {
  id?: string;
  email?: string | null;
};

const secureCookie = process.env.NODE_ENV === "production";

export const setSessionCookies = async (
  cookieStore: CookieStore,
  payload: AuthPayload,
) => {
  if (!payload.access_token) {
    throw new Error("Missing access token in auth payload");
  }

  const accessTokenMaxAge =
    typeof payload.expires_in === "number" && payload.expires_in > 0
      ? payload.expires_in
      : 60 * 60;

  cookieStore.set(ACCESS_TOKEN_COOKIE, payload.access_token, {
    httpOnly: true,
    sameSite: "lax",
    secure: secureCookie,
    path: "/",
    maxAge: accessTokenMaxAge,
  });

  if (payload.refresh_token) {
    cookieStore.set(REFRESH_TOKEN_COOKIE, payload.refresh_token, {
      httpOnly: true,
      sameSite: "lax",
      secure: secureCookie,
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
  }
};

export const clearSessionCookies = (cookieStore: CookieDeleteStore) => {
  cookieStore.delete(ACCESS_TOKEN_COOKIE);
  cookieStore.delete(REFRESH_TOKEN_COOKIE);
};

const toAuthSession = (
  accessToken: string,
  refreshToken: string | null,
  user: SupabaseUserResponse,
): AuthSession | null => {
  if (!user.id) {
    return null;
  }

  return {
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      email: user.email ?? null,
    },
  };
};

const fetchSupabaseUser = async (
  accessToken: string,
): Promise<SupabaseUserResponse | null> => {
  const { url, anonKey } = getSupabasePublicEnv();
  const response = await fetch(`${url.replace(/\/$/, "")}/auth/v1/user`, {
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    return null;
  }

  return (await response.json()) as SupabaseUserResponse;
};

export const getSessionFromCookies = cache(async (): Promise<AuthSession | null> => {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(ACCESS_TOKEN_COOKIE)?.value;

  if (!accessToken) {
    return null;
  }

  const refreshToken = cookieStore.get(REFRESH_TOKEN_COOKIE)?.value ?? null;
  const user = await fetchSupabaseUser(accessToken);

  if (!user) {
    return null;
  }

  return toAuthSession(accessToken, refreshToken, user);
});
