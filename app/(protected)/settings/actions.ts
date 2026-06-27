"use server";

import { revalidatePath } from "next/cache";
import { requireProtectedAccess } from "@/src/lib/auth/guards";
import { createServiceRoleSupabaseClient } from "@/src/lib/supabase/service-role";

export type UpdateProfileNameResult =
  | { ok: true; message: string }
  | { ok: false; message: string };

export async function updateProfileNameAction(input: {
  firstName: string;
  middleName: string;
  lastName: string;
}): Promise<UpdateProfileNameResult> {
  const { profile } = await requireProtectedAccess("/settings");
  if (!profile) return { ok: false, message: "Authenticated profile is required." };

  const firstName = input.firstName.trim();
  const middleName = input.middleName.trim();
  const lastName = input.lastName.trim();
  if (!firstName || !lastName) {
    return { ok: false, message: "First and last name are required." };
  }

  const fullName = [firstName, middleName, lastName].filter(Boolean).join(" ");

  const supabase = createServiceRoleSupabaseClient();
  const response = await supabase.request(`/rest/v1/profiles?id=eq.${profile.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify({
      first_name: firstName,
      middle_name: middleName || null,
      last_name: lastName,
      full_name: fullName,
    }),
  });

  if (!response.ok) return { ok: false, message: "Could not update your name. Please try again." };

  revalidatePath("/settings");
  revalidatePath("/timesheet");
  return { ok: true, message: "Display name updated." };
}
