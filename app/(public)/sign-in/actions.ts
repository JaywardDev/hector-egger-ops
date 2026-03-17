"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { resolveAccountAccessState } from "@/src/lib/auth/access-state";
import { ensurePendingProfile } from "@/src/lib/auth/profile-bootstrap";
import { setSessionCookies, type AuthSession } from "@/src/lib/auth/session";
import { createServerSupabaseClient } from "@/src/lib/supabase/server";

type SignInResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  user?: {
    id?: string;
    email?: string | null;
  };
};

const toSignInError = (message: string) =>
  redirect(`/sign-in?error=${encodeURIComponent(message)}`);

const toSessionFromSignInResponse = (payload: SignInResponse): AuthSession | null => {
  if (!payload.access_token || !payload.user?.id) {
    return null;
  }

  return {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token ?? null,
    user: {
      id: payload.user.id,
      email: payload.user.email ?? null,
    },
  };
};

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
  const session = toSessionFromSignInResponse(payload);

  if (!session) {
    throw new Error("Invalid sign-in response payload");
  }

  const cookieStore = await cookies();
  await setSessionCookies(cookieStore, payload);

  await ensurePendingProfile({
    authUserId: session.user.id,
    email: session.user.email ?? email,
  });

  const accessState = await resolveAccountAccessState(session);

  if (accessState === "approved") {
    redirect("/dashboard");
  }

  redirect("/pending");
}
