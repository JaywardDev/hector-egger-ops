import "server-only";

import { createServiceRoleSupabaseClient } from "@/src/lib/supabase/service-role";
import type { AppRole, ProfileRecord } from "@/src/lib/auth/profile-access";
import type { AuthSession } from "@/src/lib/auth/session";
import { getCurrentAccountStatus, getCurrentUserRoles } from "@/src/lib/auth/profile-access";

type AdminMutationActor = {
  session: AuthSession;
};

export type PendingUserRecord = Pick<
  ProfileRecord,
  "id" | "email" | "full_name" | "account_status" | "created_at"
>;

const assertAdminMutationAccess = async ({ session }: AdminMutationActor) => {
  const [accountStatus, roles] = await Promise.all([
    getCurrentAccountStatus(session),
    getCurrentUserRoles(session),
  ]);

  if (accountStatus !== "approved" || !roles.includes("admin")) {
    throw new Error("Admin privileges are required for this action");
  }
};

export const listPendingUsers = async ({ session }: AdminMutationActor): Promise<PendingUserRecord[]> => {
  await assertAdminMutationAccess({ session });

  const supabase = createServiceRoleSupabaseClient();
  const response = await supabase.request(
    "/rest/v1/profiles?select=id,email,full_name,account_status,created_at&account_status=eq.pending&order=created_at.asc",
    {
      cache: "no-store",
    },
  );

  if (!response.ok) {
    throw new Error("Failed to load pending users");
  }

  return (await response.json()) as PendingUserRecord[];
};

export const approveUser = async ({ session, profileId }: AdminMutationActor & { profileId: string }) => {
  await assertAdminMutationAccess({ session });

  const supabase = createServiceRoleSupabaseClient();
  const response = await supabase.request(`/rest/v1/profiles?id=eq.${profileId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({
      account_status: "approved",
      approved_at: new Date().toISOString(),
      disabled_at: null,
    }),
  });

  if (!response.ok) {
    throw new Error("Failed to approve user profile");
  }
};

export const disableUser = async ({ session, profileId }: AdminMutationActor & { profileId: string }) => {
  await assertAdminMutationAccess({ session });

  const supabase = createServiceRoleSupabaseClient();
  const response = await supabase.request(`/rest/v1/profiles?id=eq.${profileId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({
      account_status: "disabled",
      disabled_at: new Date().toISOString(),
    }),
  });

  if (!response.ok) {
    throw new Error("Failed to disable user profile");
  }
};

export const assignRole = async (
  { session, profileId, role }: AdminMutationActor & { profileId: string; role: AppRole },
) => {
  await assertAdminMutationAccess({ session });

  const supabase = createServiceRoleSupabaseClient();
  const response = await supabase.request("/rest/v1/user_roles", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify({
      profile_id: profileId,
      role,
      created_by_auth_user_id: session.user.id,
    }),
  });

  if (!response.ok) {
    throw new Error("Failed to assign role");
  }
};
