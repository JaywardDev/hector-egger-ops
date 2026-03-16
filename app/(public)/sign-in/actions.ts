"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { resolveAccountAccessState } from "@/src/lib/auth/access-state";
import {
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
  buildSessionFromAccessToken,
} from "@/src/lib/auth/session";
import { createServerSupabaseClient } from "@/src/lib/supabase/server";

type SignInResponse = {
  access_token?: string;
  refresh_token?: string;
};

const toSignInError = (message: string) =>
  redirect(`/sign-in?error=${encodeURIComponent(message)}`);

export async function signInAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "").trim();

  if (!email || !password) {
    toSignInError("Email and password are required.");
  }

  const supabase = createServerSupabaseClient();
  const response = await supabase.request("/auth/v1/token?grant_type=password", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email,
      password,
    }),
  });

  if (!response.ok) {
    toSignInError("Sign-in failed. Check credentials and try again.");
  }

  const payload = (await response.json()) as SignInResponse;

  if (!payload.access_token) {
    toSignInError("Sign-in failed. Missing access token from Supabase.");
  }

  const session = buildSessionFromAccessToken(
    payload.access_token,
    payload.refresh_token ?? null,
  );

  if (!session) {
    toSignInError("Sign-in failed. Session payload could not be parsed.");
  }

  const cookieStore = await cookies();
  const nowInSeconds = Math.floor(Date.now() / 1000);
  const ttl = session.expiresAt ? Math.max(session.expiresAt - nowInSeconds, 1) : 60 * 60;

  cookieStore.set(ACCESS_TOKEN_COOKIE, payload.access_token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ttl,
  });

  if (payload.refresh_token) {
    cookieStore.set(REFRESH_TOKEN_COOKIE, payload.refresh_token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
  }

  const accessState = resolveAccountAccessState(session);

  if (accessState === "approved") {
    redirect("/dashboard");
  }

  redirect("/pending");
}
