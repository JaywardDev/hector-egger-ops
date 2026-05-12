import "server-only";

import { createServiceRoleSupabaseClient } from "@/src/lib/supabase/service-role";

type EnsurePendingProfileInput = {
  authUserId: string;
  email: string;
  fullName?: string | null;
  firstName?: string | null;
  middleName?: string | null;
  lastName?: string | null;
};

const trimNullable = (value: string | null | undefined) => {
  const trimmedValue = value?.trim() ?? "";
  return trimmedValue || null;
};

const deriveNameParts = (fullName: string | null) => {
  const nameParts = fullName?.split(/\s+/).filter(Boolean) ?? [];

  if (nameParts.length === 0) {
    return {
      firstName: null,
      middleName: null,
      lastName: null,
    };
  }

  return {
    firstName: nameParts[0] ?? null,
    middleName: nameParts.length > 2 ? nameParts.slice(1, -1).join(" ") : null,
    lastName: nameParts[nameParts.length - 1] ?? null,
  };
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
  firstName,
  middleName,
  lastName,
}: EnsurePendingProfileInput): Promise<boolean> => {
  const supabase = createServiceRoleSupabaseClient();
  const normalizedStructuredNameParts = [firstName, middleName, lastName]
    .map((namePart) => trimNullable(namePart))
    .filter((namePart): namePart is string => Boolean(namePart));
  const normalizedFullName = trimNullable(fullName) ?? (
    normalizedStructuredNameParts.length > 0 ? normalizedStructuredNameParts.join(" ") : null
  );
  const derivedNameParts = deriveNameParts(normalizedFullName);
  const normalizedFirstName = trimNullable(firstName) ?? derivedNameParts.firstName;
  const normalizedMiddleName = trimNullable(middleName) ?? derivedNameParts.middleName;
  const normalizedLastName = trimNullable(lastName) ?? derivedNameParts.lastName;

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
      first_name: normalizedFirstName,
      middle_name: normalizedMiddleName,
      last_name: normalizedLastName,
      full_name: normalizedFullName,
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
