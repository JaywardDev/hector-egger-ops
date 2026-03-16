import "server-only";

import { cookies } from "next/headers";

export const ACCESS_TOKEN_COOKIE = "heo_access_token";
export const REFRESH_TOKEN_COOKIE = "heo_refresh_token";

export type AuthUser = {
  id: string;
  email: string | null;
};

export type AuthSession = {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: number | null;
  user: AuthUser;
};

type JwtPayload = {
  sub?: string;
  email?: string;
  exp?: number;
};

const decodeJwtPayload = (token: string): JwtPayload | null => {
  const parts = token.split(".");

  if (parts.length < 2) {
    return null;
  }

  try {
    const payload = Buffer.from(parts[1], "base64url").toString("utf8");
    return JSON.parse(payload) as JwtPayload;
  } catch {
    return null;
  }
};

export const buildSessionFromAccessToken = (
  accessToken: string,
  refreshToken: string | null,
): AuthSession | null => {
  const payload = decodeJwtPayload(accessToken);

  if (!payload?.sub) {
    return null;
  }

  return {
    accessToken,
    refreshToken,
    expiresAt: payload.exp ?? null,
    user: {
      id: payload.sub,
      email: payload.email ?? null,
    },
  };
};

export const getSessionFromCookies = async (): Promise<AuthSession | null> => {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(ACCESS_TOKEN_COOKIE)?.value;

  if (!accessToken) {
    return null;
  }

  const session = buildSessionFromAccessToken(
    accessToken,
    cookieStore.get(REFRESH_TOKEN_COOKIE)?.value ?? null,
  );

  if (!session) {
    return null;
  }

  if (session.expiresAt && session.expiresAt <= Math.floor(Date.now() / 1000)) {
    return null;
  }

  return session;
};
