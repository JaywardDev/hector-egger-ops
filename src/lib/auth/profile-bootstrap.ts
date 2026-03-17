import "server-only";

import { createServiceRoleSupabaseClient } from "@/src/lib/supabase/service-role";

type EnsurePendingProfileInput = {
  authUserId: string;
  email: string;
  fullName?: string | null;
};

const readSupabaseErrorMessage = async (response: Response) => {
  try {
    const body = (await response.json()) as { msg?: string; message?: string; error_description?: string };
    return body.error_description ?? body.message ?? body.msg ?? "";
  } catch {
    return "";
  }
};

const isDuplicateConflict = (status: number, message: string) =>
  status === 409 || message.includes("duplicate") || message.includes("already exists");

export const ensurePendingProfile = async ({
  authUserId,
  email,
  fullName,
}: EnsurePendingProfileInput): Promise<boolean> => {
  const supabase = createServiceRoleSupabaseClient();

  const existingProfileResponse = await supabase.request(
    `/rest/v1/profiles?select=id&auth_user_id=eq.${authUserId}&limit=1`,
    {
      cache: "no-store",
    },
  );

  if (existingProfileResponse.ok) {
    const existingProfiles = (await existingProfileResponse.json()) as Array<{ id: string }>;

    if (existingProfiles.length > 0) {
      return true;
    }
  }

  const profileInsertResponse = await supabase.request("/rest/v1/profiles", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({
      auth_user_id: authUserId,
      email,
      full_name: fullName ?? null,
      account_status: "pending",
      onboarding_source: "self_registration",
    }),
  });

  if (profileInsertResponse.ok) {
    return true;
  }

  const errorMessage = (await readSupabaseErrorMessage(profileInsertResponse)).toLowerCase();
  return isDuplicateConflict(profileInsertResponse.status, errorMessage);
};
