import "server-only";

import { nowUtcIso } from "@/src/lib/dateTime";
import { createServiceRoleSupabaseClient } from "@/src/lib/supabase/service-role";
import type { AppRole, ProfileRecord, StaffGroup } from "@/src/lib/auth/profile-access";
import type { AuthSession } from "@/src/lib/auth/session";
import { getCurrentAccountStatus, getCurrentUserRoles } from "@/src/lib/auth/profile-access";
import { canManageUsers } from "@/src/lib/permissions/admin";

type AdminMutationActor = {
  session: AuthSession;
};

export const ADMIN_ROLE_OPTIONS = ["operator", "supervisor", "admin"] as const satisfies AppRole[];
export const ADMIN_STAFF_GROUP_OPTIONS = ["factory", "site", "office"] as const satisfies StaffGroup[];

export type AdminRoleOption = (typeof ADMIN_ROLE_OPTIONS)[number];
export type AdminStaffGroupOption = (typeof ADMIN_STAFF_GROUP_OPTIONS)[number];

export type AdminUserRecord = Pick<
  ProfileRecord,
  "id" | "email" | "first_name" | "middle_name" | "last_name" | "full_name" | "profile_completed_at" | "account_status" | "staff_group" | "created_at" | "approved_at" | "disabled_at"
> & {
  roles: AppRole[];
};

export type PendingUserRecord = AdminUserRecord;

const PROFILE_SELECT = "id,email,first_name,middle_name,last_name,full_name,profile_completed_at,account_status,staff_group,created_at,approved_at,disabled_at";
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const inList = (values: string[]) => values.map((value) => `"${value.replaceAll('"', '\\"')}"`).join(",");

const assertValidProfileId = (profileId: string) => {
  if (!uuidPattern.test(profileId)) {
    throw new Error("Invalid profile id");
  }
};

const assertValidRole = (role: AppRole) => {
  if (!ADMIN_ROLE_OPTIONS.includes(role)) {
    throw new Error("Invalid role");
  }
};

const assertRequiredApprovalRole = (role: AppRole) => {
  if (!ADMIN_ROLE_OPTIONS.includes(role)) {
    throw new Error("Select a role before approving this user.");
  }
};

const assertValidStaffGroup = (staffGroup: StaffGroup | null) => {
  if (staffGroup !== null && !ADMIN_STAFF_GROUP_OPTIONS.includes(staffGroup)) {
    throw new Error("Invalid staff group");
  }
};

const assertRequiredStaffGroup = (staffGroup: StaffGroup | null) => {
  if (staffGroup === null || !ADMIN_STAFF_GROUP_OPTIONS.includes(staffGroup)) {
    throw new Error("Select a staff group before approving this user.");
  }
};

const assertAdminMutationAccess = async ({ session }: AdminMutationActor) => {
  const [accountStatus, roles] = await Promise.all([
    getCurrentAccountStatus(session),
    getCurrentUserRoles(session),
  ]);

  if (!canManageUsers({ accountStatus, roles })) {
    throw new Error("Admin privileges are required for this action");
  }
};

const fetchRolesByProfileId = async (profileIds: string[]): Promise<Map<string, AppRole[]>> => {
  const rolesByProfileId = new Map<string, AppRole[]>();

  if (profileIds.length === 0) {
    return rolesByProfileId;
  }

  const supabase = createServiceRoleSupabaseClient();
  const response = await supabase.request(
    `/rest/v1/user_roles?select=profile_id,role&profile_id=in.(${inList(profileIds)})&order=created_at.asc`,
    { cache: "no-store" },
  );

  if (!response.ok) {
    throw new Error("Failed to load user roles");
  }

  const rows = (await response.json()) as { profile_id: string; role: AppRole }[];
  for (const row of rows) {
    rolesByProfileId.set(row.profile_id, [...(rolesByProfileId.get(row.profile_id) ?? []), row.role]);
  }

  return rolesByProfileId;
};

const withRoles = async (profiles: Omit<AdminUserRecord, "roles">[]): Promise<AdminUserRecord[]> => {
  const rolesByProfileId = await fetchRolesByProfileId(profiles.map((profile) => profile.id));
  return profiles.map((profile) => ({
    ...profile,
    roles: rolesByProfileId.get(profile.id) ?? [],
  }));
};

const listUsersByStatus = async (
  { session }: AdminMutationActor,
  status: ProfileRecord["account_status"],
): Promise<AdminUserRecord[]> => {
  await assertAdminMutationAccess({ session });

  const supabase = createServiceRoleSupabaseClient();
  const response = await supabase.request(
    `/rest/v1/profiles?select=${PROFILE_SELECT}&account_status=eq.${status}&order=created_at.asc`,
    { cache: "no-store" },
  );

  if (!response.ok) {
    throw new Error(`Failed to load ${status} users`);
  }

  return withRoles((await response.json()) as Omit<AdminUserRecord, "roles">[]);
};

const fetchAdminUser = async (profileId: string): Promise<AdminUserRecord> => {
  const supabase = createServiceRoleSupabaseClient();
  const response = await supabase.request(
    `/rest/v1/profiles?select=${PROFILE_SELECT}&id=eq.${profileId}&limit=1`,
    { cache: "no-store" },
  );

  if (!response.ok) {
    throw new Error("Failed to load user profile");
  }

  const profiles = (await response.json()) as Omit<AdminUserRecord, "roles">[];
  const profile = profiles[0];

  if (!profile) {
    throw new Error("User profile not found");
  }

  const [user] = await withRoles([profile]);
  return user;
};

const countApprovedAdmins = async (): Promise<number> => {
  const supabase = createServiceRoleSupabaseClient();
  const response = await supabase.request(
    "/rest/v1/profiles?select=id,user_roles!inner(role)&account_status=eq.approved&user_roles.role=eq.admin",
    {
      cache: "no-store",
      headers: { Prefer: "count=exact" },
    },
  );

  if (!response.ok) {
    throw new Error("Failed to count approved admins");
  }

  const contentRange = response.headers.get("content-range");
  const countValue = contentRange?.split("/")[1];
  if (countValue && countValue !== "*") {
    return Number(countValue);
  }

  const rows = (await response.json()) as unknown[];
  return rows.length;
};

const assertNotLastApprovedAdmin = async (profileId: string) => {
  const user = await fetchAdminUser(profileId);

  if (user.account_status === "approved" && user.roles.includes("admin") && await countApprovedAdmins() <= 1) {
    throw new Error("Cannot remove or disable the last approved admin");
  }
};

export const listPendingUsers = async (actor: AdminMutationActor): Promise<PendingUserRecord[]> =>
  listUsersByStatus(actor, "pending");

export const listApprovedUsers = async (actor: AdminMutationActor): Promise<AdminUserRecord[]> =>
  listUsersByStatus(actor, "approved");

export const listDisabledUsers = async (actor: AdminMutationActor): Promise<AdminUserRecord[]> =>
  listUsersByStatus(actor, "disabled");

const readSupabaseErrorMessage = async (response: Response, fallback: string) => {
  try {
    const payload = await response.json() as { message?: string };
    return payload.message || fallback;
  } catch {
    return fallback;
  }
};

export const approveUser = async (
  { session, profileId, role, staffGroup }: AdminMutationActor & { profileId: string; role: AppRole; staffGroup: StaffGroup | null },
) => {
  await assertAdminMutationAccess({ session });
  assertValidProfileId(profileId);
  assertRequiredApprovalRole(role);
  assertRequiredStaffGroup(staffGroup);

  const supabase = createServerSupabaseClient();
  const response = await supabase.request("/rest/v1/rpc/approve_pending_user_atomic", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${session.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      account_status: "approved",
      approved_at: nowUtcIso(),
      disabled_at: null,
      staff_group: staffGroup,
    }),
  });

  if (!response.ok) {
    throw new Error(await readSupabaseErrorMessage(response, "Failed to approve user profile"));
  }
};

export const updateProfileStaffGroup = async ({ session, profileId, staffGroup }: AdminMutationActor & { profileId: string; staffGroup: StaffGroup | null }) => {
  await assertAdminMutationAccess({ session });
  assertValidProfileId(profileId);
  assertValidStaffGroup(staffGroup);

  const supabase = createServiceRoleSupabaseClient();
  const response = await supabase.request(`/rest/v1/profiles?id=eq.${profileId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({ staff_group: staffGroup }),
  });

  if (!response.ok) {
    throw new Error("Failed to update user staff group");
  }
};

export const disableUser = async ({ session, profileId }: AdminMutationActor & { profileId: string }) => {
  await assertAdminMutationAccess({ session });
  assertValidProfileId(profileId);
  await assertNotLastApprovedAdmin(profileId);

  const supabase = createServiceRoleSupabaseClient();
  const response = await supabase.request(`/rest/v1/profiles?id=eq.${profileId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({
      account_status: "disabled",
      disabled_at: nowUtcIso(),
    }),
  });

  if (!response.ok) {
    throw new Error("Failed to disable user profile");
  }
};

export const reactivateUser = async ({ session, profileId }: AdminMutationActor & { profileId: string }) => {
  await assertAdminMutationAccess({ session });
  assertValidProfileId(profileId);

  const user = await fetchAdminUser(profileId);
  const supabase = createServiceRoleSupabaseClient();
  const response = await supabase.request(`/rest/v1/profiles?id=eq.${profileId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({
      account_status: "approved",
      approved_at: user.approved_at ?? nowUtcIso(),
      disabled_at: null,
    }),
  });

  if (!response.ok) {
    throw new Error("Failed to reactivate user profile");
  }
};

export const setUserRole = async (
  { session, profileId, role }: AdminMutationActor & { profileId: string; role: AppRole },
) => {
  await assertAdminMutationAccess({ session });
  assertValidProfileId(profileId);
  assertValidRole(role);

  const currentUser = await fetchAdminUser(profileId);
  if (role !== "admin" && currentUser.roles.includes("admin")) {
    await assertNotLastApprovedAdmin(profileId);
  }

  const supabase = createServiceRoleSupabaseClient();
  const upsertResponse = await supabase.request("/rest/v1/user_roles", {
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

  if (!upsertResponse.ok) {
    throw new Error("Failed to assign role");
  }

  const otherRoles = ADMIN_ROLE_OPTIONS.filter((roleOption) => roleOption !== role);
  const deleteResponse = await supabase.request(
    `/rest/v1/user_roles?profile_id=eq.${profileId}&role=in.(${otherRoles.join(",")})`,
    {
      method: "DELETE",
      headers: { Prefer: "return=minimal" },
    },
  );

  if (!deleteResponse.ok) {
    throw new Error("Failed to replace existing roles");
  }
};

export const assignRole = setUserRole;
