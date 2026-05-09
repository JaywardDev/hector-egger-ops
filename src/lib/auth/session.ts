import "server-only";

import { cookies } from "next/headers";
import { cache } from "react";
import {
  ACCESS_TOKEN_COOKIE,
  PERSISTENT_SESSION_MAX_AGE_SECONDS,
  REFRESH_TOKEN_COOKIE,
  sessionCookieOptions,
} from "@/src/lib/auth/cookies";
import { getSupabasePublicEnv } from "@/src/lib/supabase/env";
import { withServerTiming } from "@/src/lib/server-timing";


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


export const setSessionCookies = async (
  cookieStore: CookieStore,
  payload: AuthPayload,
) => {
  if (!payload.access_token) {
    throw new Error("Missing access token in auth payload");
  }

  const accessTokenMaxAge =
    typeof payload.expires_in === "number" && payload.expires_in > 0
      ? Math.max(payload.expires_in, PERSISTENT_SESSION_MAX_AGE_SECONDS)
      : PERSISTENT_SESSION_MAX_AGE_SECONDS;

  cookieStore.set(ACCESS_TOKEN_COOKIE, payload.access_token, {
    ...sessionCookieOptions,
    maxAge: accessTokenMaxAge,
  });

  if (payload.refresh_token) {
    cookieStore.set(REFRESH_TOKEN_COOKIE, payload.refresh_token, {
      ...sessionCookieOptions,
      maxAge: PERSISTENT_SESSION_MAX_AGE_SECONDS,
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
  route?: string,
): Promise<SupabaseUserResponse | null> =>
  withServerTiming({
    name: "fetchSupabaseUser",
    route,
    operation: async () => {
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
    },
  });

const refreshSupabaseSession = async (
  refreshToken: string,
  route?: string,
): Promise<AuthPayload | null> =>
  withServerTiming({
    name: "refreshSupabaseSession",
    route,
    operation: async () => {
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
    },
  });

const refreshSessionFromCookies = async (
  cookieStore: CookieStore,
  refreshToken: string,
  route?: string,
): Promise<AuthSession | null> => {
  const payload = await refreshSupabaseSession(refreshToken, route);

  if (!payload?.access_token) {
    clearSessionCookies(cookieStore);
    return null;
  }

  const effectiveRefreshToken = payload.refresh_token ?? refreshToken;
  await setSessionCookies(cookieStore, {
    ...payload,
    refresh_token: effectiveRefreshToken,
  });

  const user = payload.user?.id
    ? payload.user
    : await fetchSupabaseUser(payload.access_token, route);

  if (!user) {
    clearSessionCookies(cookieStore);
    return null;
  }

  return toAuthSession(payload.access_token, effectiveRefreshToken, user);
};

export const getSessionFromCookies = cache(
  async (route?: string): Promise<AuthSession | null> =>
    withServerTiming({
      name: "getSessionFromCookies",
      route,
      operation: async () => {
        const cookieStore = await cookies();
        const accessToken = cookieStore.get(ACCESS_TOKEN_COOKIE)?.value ?? null;
        const refreshToken = cookieStore.get(REFRESH_TOKEN_COOKIE)?.value ?? null;

        if (!accessToken && !refreshToken) {
          return null;
        }

        if (accessToken) {
          const user = await fetchSupabaseUser(accessToken, route);

          if (user) {
            return toAuthSession(accessToken, refreshToken, user);
          }
        }

        if (!refreshToken) {
          clearSessionCookies(cookieStore);
          return null;
        }

        return refreshSessionFromCookies(cookieStore, refreshToken, route);
      },
    }),
);

export { ACCESS_TOKEN_COOKIE, PERSISTENT_SESSION_MAX_AGE_SECONDS, REFRESH_TOKEN_COOKIE } from "@/src/lib/auth/cookies";
