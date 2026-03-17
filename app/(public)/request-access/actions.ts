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

type SupabaseErrorBody = {
  msg?: string;
  message?: string;
  error_description?: string;
};

const readSignUpFailureDetails = async (response: Response) => {
  const responseBody = await response.text();
  const safeResponseBody = responseBody.length > 1000 ? `${responseBody.slice(0, 1000)}…` : responseBody;

  try {
    const parsedBody = JSON.parse(responseBody) as SupabaseErrorBody;

    return {
      errorMessage: (parsedBody.error_description ?? parsedBody.message ?? parsedBody.msg ?? "").toLowerCase(),
      safeResponseBody,
    };
  } catch {
    return {
      errorMessage: "",
      safeResponseBody,
    };
  }
};

const isExplicitDuplicateSignUpError = (responseStatus: number, signUpError: string) =>
  responseStatus === 409
  || signUpError.includes("already")
  || signUpError.includes("exists")
  || signUpError.includes("registered")
  || signUpError.includes("duplicate");

const mapKnownSignUpFailureMessage = (responseStatus: number, signUpError: string) => {
  if (responseStatus === 429 || signUpError.includes("rate limit")) {
    return "Too many signup attempts. Please wait a moment and try again.";
  }

  if (signUpError.includes("password") && (signUpError.includes("weak") || signUpError.includes("at least"))) {
    return "Password does not meet requirements. Please use a stronger password.";
  }

  if (signUpError.includes("email") && (signUpError.includes("invalid") || signUpError.includes("not valid"))) {
    return "Please enter a valid email address.";
  }

  return "Could not create account. Please try again.";
};

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
    const { errorMessage, safeResponseBody } = await readSignUpFailureDetails(signUpResponse);

    console.error("Request-access signup failed upstream", {
      status: signUpResponse.status,
      body: safeResponseBody,
    });

    if (isExplicitDuplicateSignUpError(signUpResponse.status, errorMessage)) {
      toRequestAccessError("An account with this email already exists. Please sign in instead.");
    }

    toRequestAccessError(mapKnownSignUpFailureMessage(signUpResponse.status, errorMessage));
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
