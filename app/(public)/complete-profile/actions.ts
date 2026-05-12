"use server";

import { nowUtcIso } from "@/src/lib/dateTime";
import { redirect } from "next/navigation";
import { getCurrentProfile, isProfileComplete } from "@/src/lib/auth/profile-access";
import { getSessionFromCookies } from "@/src/lib/auth/session";
import { createServiceRoleSupabaseClient } from "@/src/lib/supabase/service-role";

const toCompleteProfileError = (message: string): never =>
  redirect(`/complete-profile?error=${encodeURIComponent(message)}`);

const trimNullable = (value: string | null | undefined) => {
  const trimmedValue = value?.trim() ?? "";
  return trimmedValue || null;
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
    redirect(existingProfile.account_status === "approved" ? "/timesheet" : "/pending");
  }

  const firstName = String(formData.get("firstName") ?? "").trim();
  const middleName = String(formData.get("middleName") ?? "").trim();
  const lastName = String(formData.get("lastName") ?? "").trim();
  const email = session.user.email?.trim() ?? existingProfile?.email?.trim() ?? "";
  const fullName = [firstName, middleName, lastName].filter(Boolean).join(" ");

  if (!firstName || !lastName || !email) {
    toCompleteProfileError("First name and last name are required to complete your profile.");
  }

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
    account_status: existingProfile?.account_status ?? "pending",
    onboarding_source: existingProfile?.onboarding_source ?? "self_registration",
  };

  const response = existingProfile
    ? await supabase.request(`/rest/v1/profiles?id=eq.${existingProfile.id}`, {
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

  redirect("/pending");
}
