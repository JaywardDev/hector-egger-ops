export const ACCESS_TOKEN_COOKIE = "heo_access_token";
export const REFRESH_TOKEN_COOKIE = "heo_refresh_token";
export const PERSISTENT_SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 180;

export const secureCookie = process.env.NODE_ENV === "production";

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: secureCookie,
  path: "/",
};
