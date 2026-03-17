"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ensurePendingProfile } from "@/src/lib/auth/profile-bootstrap";
import { setSessionCookies } from "@/src/lib/auth/session";
import { createServerSupabaseClient } from "@/src/lib/supabase/server";

type SignUpResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  user?: {
    id?: string;
    email?: string | null;
  };
};

const toRequestAccessError = (message: string): never =>
  redirect(`/request-access?error=${encodeURIComponent(message)}`);

const readSupabaseErrorMessage = async (response: Response) => {
  try {
    const body = (await response.json()) as { msg?: string; message?: string; error_description?: string };
    return body.error_description ?? body.message ?? body.msg ?? "";
  } catch {
    return "";
  }
};

const isExplicitDuplicateSignUpError = (responseStatus: number, signUpError: string) =>
  responseStatus === 409
  || signUpError.includes("already")
  || signUpError.includes("exists")
  || signUpError.includes("registered")
  || signUpError.includes("duplicate");

const signInAfterSignup = async (email: string, password: string) => {
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
    return null;
  }

  return (await response.json()) as SignUpResponse;
};

export async function requestAccessAction(formData: FormData) {
  const fullName = String(formData.get("fullName") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "").trim();

  if (!fullName || !email || !password) {
    toRequestAccessError("Full name, email, and password are required.");
  }

  const supabase = createServerSupabaseClient();
  const signUpResponse = await supabase.request("/auth/v1/signup", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email,
      password,
      data: {
        full_name: fullName,
      },
    }),
  });

  if (!signUpResponse.ok) {
    const signUpError = (await readSupabaseErrorMessage(signUpResponse)).toLowerCase();

    if (isExplicitDuplicateSignUpError(signUpResponse.status, signUpError)) {
      toRequestAccessError("An account with this email already exists. Please sign in instead.");
    }

    toRequestAccessError("Could not create account. Please try again.");
  }

  const signUpPayload = (await signUpResponse.json()) as SignUpResponse;
  const authUserId = signUpPayload.user?.id;
  const validatedAuthUserId = typeof authUserId === "string" && authUserId.length > 0
    ? authUserId
    : toRequestAccessError("Account created, but setup failed. Please sign in and contact support.");

  const profileEnsured = await ensurePendingProfile({
    authUserId: validatedAuthUserId,
    email,
    fullName,
  });

  if (!profileEnsured) {
    toRequestAccessError("Account created, but setup failed. Please sign in and contact support.");
  }

  const sessionPayload = signUpPayload.access_token ? signUpPayload : await signInAfterSignup(email, password);

  if (!sessionPayload?.access_token) {
    redirect("/sign-in?error=Account%20created.%20Please%20sign%20in%20to%20continue.");
  }

  const cookieStore = await cookies();
  await setSessionCookies(cookieStore, sessionPayload);

  redirect("/pending");
}
