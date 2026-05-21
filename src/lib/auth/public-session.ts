import "server-only";

import { cookies } from "next/headers";
import { cache } from "react";
import { ACCESS_TOKEN_COOKIE } from "@/src/lib/auth/session";

const decodeBase64Url = (value: string): string | null => {
  try {
    const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
    const padLength = (4 - (normalized.length % 4)) % 4;
    const padded = normalized.padEnd(normalized.length + padLength, "=");

    return Buffer.from(padded, "base64").toString("utf8");
  } catch {
    return null;
  }
};

export const hasClearlyValidAccessToken = (accessToken: string | null | undefined): boolean => {
  if (!accessToken) {
    return false;
  }

  const segments = accessToken.split(".");

  if (segments.length < 2) {
    return false;
  }

  const payload = decodeBase64Url(segments[1]);

  if (!payload) {
    return false;
  }

  try {
    const parsed = JSON.parse(payload) as { exp?: unknown };

    if (typeof parsed.exp !== "number" || !Number.isFinite(parsed.exp)) {
      return false;
    }

    const nowInSeconds = Math.floor(Date.now() / 1000);

    return parsed.exp > nowInSeconds;
  } catch {
    return false;
  }
};

export const hasActiveSessionCookie = cache(async (): Promise<boolean> => {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(ACCESS_TOKEN_COOKIE)?.value;

  return hasClearlyValidAccessToken(accessToken);
});
