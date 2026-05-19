"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  ADMIN_ROLE_OPTIONS,
  ADMIN_STAFF_GROUP_OPTIONS,
  approveUser,
  disableUser,
  reactivateUser,
  setUserRole,
  updateProfileStaffGroup,
} from "@/src/lib/admin/user-approvals";
import type { AppRole, StaffGroup } from "@/src/lib/auth/profile-access";
import { formatRoleLabel } from "@/src/lib/auth/role-labels";
import { requireAdminAccess } from "@/src/lib/auth/guards";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const ADMIN_USER_PENDING_PATH = "/admin/users/pending";
const ADMIN_USER_MANAGE_PATH = "/admin/users/manage";

const toAdminMessage = (path: string, message: string, type: "success" | "error") =>
  redirect(`${path}?${type}=${encodeURIComponent(message)}`);

const getProfileId = (formData: FormData, path: string) => {
  const profileId = String(formData.get("profileId") ?? "").trim();

  if (!uuidPattern.test(profileId)) {
    toAdminMessage(path, "Invalid profile id.", "error");
  }

  return profileId;
};

const getRole = (formData: FormData, path: string, message = "Invalid role selected.") => {
  const role = String(formData.get("role") ?? "").trim() as AppRole;

  if (!ADMIN_ROLE_OPTIONS.includes(role)) {
    toAdminMessage(path, message, "error");
  }

  return role;
};

const getStaffGroup = (formData: FormData, path: string) => {
  const staffGroupValue = String(formData.get("staffGroup") ?? "").trim();
  const staffGroup = staffGroupValue === "" ? null : staffGroupValue as StaffGroup;

  if (staffGroup !== null && !ADMIN_STAFF_GROUP_OPTIONS.includes(staffGroup)) {
    toAdminMessage(path, "Invalid staff group selected.", "error");
  }

  return staffGroup;
};

const getApprovalStaffGroup = (formData: FormData, path: string) => {
  const staffGroup = getStaffGroup(formData, path);

  if (staffGroup === null) {
    toAdminMessage(path, "Select a staff group before approving this user.", "error");
  }

  return staffGroup;
};

const getAdminSession = async (path: string) => {
  const { session } = await requireAdminAccess();

  if (!session) {
    toAdminMessage(path, "Authentication required.", "error");
  }

  return session;
};

export async function approvePendingUserAction(formData: FormData) {
  const profileId = getProfileId(formData, ADMIN_USER_PENDING_PATH);
  const role = getRole(formData, ADMIN_USER_PENDING_PATH, "Select a role before approving this user.");
  const staffGroup = getApprovalStaffGroup(formData, ADMIN_USER_PENDING_PATH);
  const session = await getAdminSession(ADMIN_USER_PENDING_PATH);

  try {
    await approveUser({ session, profileId, role, staffGroup });
  } catch (error) {
    toAdminMessage(ADMIN_USER_PENDING_PATH, error instanceof Error ? error.message : "Could not approve user.", "error");
  }

  revalidatePath(ADMIN_USER_PENDING_PATH);
  revalidatePath("/admin/users");
  toAdminMessage(ADMIN_USER_PENDING_PATH, `User approved as ${formatRoleLabel(role)}.`, "success");
}

export async function updateApprovedUserRoleAction(formData: FormData) {
  const profileId = getProfileId(formData, ADMIN_USER_MANAGE_PATH);
  const role = getRole(formData, ADMIN_USER_MANAGE_PATH);
  const session = await getAdminSession(ADMIN_USER_MANAGE_PATH);

  try {
    await setUserRole({ session, profileId, role });
  } catch (error) {
    toAdminMessage(ADMIN_USER_MANAGE_PATH, error instanceof Error ? error.message : "Could not update role.", "error");
  }

  revalidatePath(ADMIN_USER_MANAGE_PATH);
  revalidatePath("/admin/users");
  toAdminMessage(ADMIN_USER_MANAGE_PATH, `User role updated to ${formatRoleLabel(role)}.`, "success");
}

export async function updateUserStaffGroupAction(formData: FormData) {
  const profileId = getProfileId(formData, ADMIN_USER_MANAGE_PATH);
  const staffGroup = getStaffGroup(formData, ADMIN_USER_MANAGE_PATH);
  const session = await getAdminSession(ADMIN_USER_MANAGE_PATH);

  try {
    await updateProfileStaffGroup({ session, profileId, staffGroup });
  } catch (error) {
    toAdminMessage(ADMIN_USER_MANAGE_PATH, error instanceof Error ? error.message : "Could not update staff group.", "error");
  }

  revalidatePath(ADMIN_USER_MANAGE_PATH);
  revalidatePath("/admin/users");
  toAdminMessage(ADMIN_USER_MANAGE_PATH, "User staff group updated.", "success");
}

export async function disablePendingUserAction(formData: FormData) {
  const profileId = getProfileId(formData, ADMIN_USER_PENDING_PATH);
  const session = await getAdminSession(ADMIN_USER_PENDING_PATH);

  try {
    await disableUser({ session, profileId });
  } catch (error) {
    toAdminMessage(ADMIN_USER_PENDING_PATH, error instanceof Error ? error.message : "Could not disable user.", "error");
  }

  revalidatePath(ADMIN_USER_PENDING_PATH);
  revalidatePath("/admin/users");
  toAdminMessage(ADMIN_USER_PENDING_PATH, "User disabled.", "success");
}

export async function disableApprovedUserAction(formData: FormData) {
  const profileId = getProfileId(formData, ADMIN_USER_MANAGE_PATH);
  const session = await getAdminSession(ADMIN_USER_MANAGE_PATH);

  try {
    await disableUser({ session, profileId });
  } catch (error) {
    toAdminMessage(ADMIN_USER_MANAGE_PATH, error instanceof Error ? error.message : "Could not disable user.", "error");
  }

  revalidatePath(ADMIN_USER_MANAGE_PATH);
  revalidatePath("/admin/users");
  toAdminMessage(ADMIN_USER_MANAGE_PATH, "User disabled.", "success");
}

export async function reactivateUserAction(formData: FormData) {
  const profileId = getProfileId(formData, ADMIN_USER_MANAGE_PATH);
  const session = await getAdminSession(ADMIN_USER_MANAGE_PATH);

  try {
    await reactivateUser({ session, profileId });
  } catch (error) {
    toAdminMessage(ADMIN_USER_MANAGE_PATH, error instanceof Error ? error.message : "Could not reactivate user.", "error");
  }

  revalidatePath(ADMIN_USER_MANAGE_PATH);
  revalidatePath("/admin/users");
  toAdminMessage(ADMIN_USER_MANAGE_PATH, "User reactivated.", "success");
}
