"use server";

import { nowUtcIso } from "@/src/lib/dateTime";
import { redirect } from "next/navigation";
import { getCurrentProfile, isProfileComplete, type ProfileRecord } from "@/src/lib/auth/profile-access";
import { getSessionFromCookies } from "@/src/lib/auth/session";
import { createServiceRoleSupabaseClient } from "@/src/lib/supabase/service-role";

const toCompleteProfileError = (message: string): never =>
  redirect(`/complete-profile?error=${encodeURIComponent(message)}`);

const trimNullable = (value: string | null | undefined) => {
  const trimmedValue = value?.trim() ?? "";
  return trimmedValue || null;
};

// Route the user onward based on the account status after completion.
const redirectForStatus = (status: ProfileRecord["account_status"]): never => {
  if (status === "approved") redirect("/timesheet");
  if (status === "disabled") redirect("/pending?status=disabled");
  redirect("/pending");
};

type ClaimableProfile = Pick<ProfileRecord, "id" | "auth_user_id" | "account_status">;

// Find a profile by verified email that isn't yet linked to this auth user.
// Used to claim pre-provisioned rows (e.g. accounts created out-of-band) instead
// of inserting a duplicate, which would collide with the unique-email index.
const findProfileByEmail = async (email: string): Promise<ClaimableProfile | null> => {
  const supabase = createServiceRoleSupabaseClient();
  const response = await supabase.request(
    `/rest/v1/profiles?select=id,auth_user_id,account_status&email=ilike.${encodeURIComponent(email)}&limit=1`,
    { cache: "no-store" },
  );
  if (!response.ok) return null;
  const [row] = (await response.json()) as ClaimableProfile[];
  return row ?? null;
};

export async function completeProfileAction(formData: FormData) {
  const session = await getSessionFromCookies();

  if (!session) {
    redirect("/sign-in");
  }

  const existingProfile = await getCurrentProfile(session);

  if (existingProfile?.account_status === "disabled") {
    redirect("/pending?status=disabled");
  }

  if (existingProfile && isProfileComplete(existingProfile)) {
    redirectForStatus(existingProfile.account_status);
  }

  const firstName = String(formData.get("firstName") ?? "").trim();
  const middleName = String(formData.get("middleName") ?? "").trim();
  const lastName = String(formData.get("lastName") ?? "").trim();
  const email = session.user.email?.trim() ?? existingProfile?.email?.trim() ?? "";
  const fullName = [firstName, middleName, lastName].filter(Boolean).join(" ");

  if (!firstName || !lastName || !email) {
    toCompleteProfileError("First name and last name are required to complete your profile.");
  }

  // If there's no profile linked to this auth user, an existing row may have been
  // pre-provisioned for this email (e.g. an initial admin created out-of-band).
  // Claim it rather than inserting a duplicate.
  const emailMatch = existingProfile ? null : await findProfileByEmail(email);
  if (emailMatch && emailMatch.auth_user_id && emailMatch.auth_user_id !== session.user.id) {
    toCompleteProfileError(
      "An account with this email already exists and is linked to another sign-in. Please contact an admin.",
    );
  }

  const targetProfile = existingProfile ?? emailMatch;

  const supabase = createServiceRoleSupabaseClient();
  const profileCompletedAt = nowUtcIso();
  const body = {
    auth_user_id: session.user.id,
    email,
    first_name: firstName,
    middle_name: trimNullable(middleName),
    last_name: lastName,
    full_name: fullName,
    profile_completed_at: profileCompletedAt,
    account_status: targetProfile?.account_status ?? "pending",
    onboarding_source: existingProfile?.onboarding_source ?? "self_registration",
  };

  const response = targetProfile
    ? await supabase.request(`/rest/v1/profiles?id=eq.${targetProfile.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify(body),
      })
    : await supabase.request("/rest/v1/profiles", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify(body),
      });

  if (!response.ok) {
    toCompleteProfileError("Could not complete profile. Please try again.");
  }

  redirectForStatus((targetProfile?.account_status ?? "pending") as ProfileRecord["account_status"]);
}
