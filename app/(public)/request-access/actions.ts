"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
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

const toRequestAccessError = (message: string) =>
  redirect(`/request-access?error=${encodeURIComponent(message)}`);

const readSupabaseErrorMessage = async (response: Response) => {
  try {
    const body = (await response.json()) as { msg?: string; message?: string; error_description?: string };
    return body.error_description ?? body.message ?? body.msg ?? "";
  } catch {
    return "";
  }
};

const profileAlreadyExists = async (response: Response) => {
  const message = (await readSupabaseErrorMessage(response)).toLowerCase();
  return response.status === 409 || message.includes("duplicate") || message.includes("already exists");
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

    if (signUpError.includes("already") || signUpError.includes("exists") || signUpError.includes("registered")) {
      toRequestAccessError("An account with this email already exists. Please sign in instead.");
    }

    toRequestAccessError("Could not create account. Please try again.");
  }

  const signUpPayload = (await signUpResponse.json()) as SignUpResponse;

  if (!signUpPayload.access_token || !signUpPayload.user?.id) {
    toRequestAccessError("An account with this email may already exist. Please sign in instead.");
  }

  const profileInsertResponse = await supabase.request("/rest/v1/profiles", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Prefer: "return=minimal",
      Authorization: `Bearer ${signUpPayload.access_token}`,
    },
    body: JSON.stringify({
      auth_user_id: signUpPayload.user.id,
      email,
      full_name: fullName,
      account_status: "pending",
      onboarding_source: "self_registration",
    }),
  });

  if (!profileInsertResponse.ok && !(await profileAlreadyExists(profileInsertResponse))) {
    toRequestAccessError("Account created, but setup failed. Please sign in and contact support.");
  }

  const cookieStore = await cookies();
  await setSessionCookies(cookieStore, signUpPayload);

  redirect("/pending");
}
