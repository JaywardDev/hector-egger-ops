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
import { requireAdminAccess } from "@/src/lib/auth/guards";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const toAdminMessage = (message: string, type: "success" | "error") =>
  redirect(`/admin?${type}=${encodeURIComponent(message)}`);

const getProfileId = (formData: FormData) => {
  const profileId = String(formData.get("profileId") ?? "").trim();

  if (!uuidPattern.test(profileId)) {
    toAdminMessage("Invalid profile id.", "error");
  }

  return profileId;
};

const getRole = (formData: FormData, message = "Invalid role selected.") => {
  const role = String(formData.get("role") ?? "").trim() as AppRole;

  if (!ADMIN_ROLE_OPTIONS.includes(role)) {
    toAdminMessage(message, "error");
  }

  return role;
};

const getStaffGroup = (formData: FormData) => {
  const staffGroupValue = String(formData.get("staffGroup") ?? "").trim();
  const staffGroup = staffGroupValue === "" ? null : staffGroupValue as StaffGroup;

  if (staffGroup !== null && !ADMIN_STAFF_GROUP_OPTIONS.includes(staffGroup)) {
    toAdminMessage("Invalid staff group selected.", "error");
  }

  return staffGroup;
};

const getApprovalStaffGroup = (formData: FormData) => {
  const staffGroup = getStaffGroup(formData);

  if (staffGroup === null) {
    toAdminMessage("Select a staff group before approving this user.", "error");
  }

  return staffGroup;
};

const getAdminSession = async () => {
  const { session } = await requireAdminAccess();

  if (!session) {
    toAdminMessage("Authentication required.", "error");
  }

  return session;
};

export async function approvePendingUserAction(formData: FormData) {
  const profileId = getProfileId(formData);
  const role = getRole(formData, "Select a role before approving this user.");
  const staffGroup = getApprovalStaffGroup(formData);
  const session = await getAdminSession();

  try {
    await approveUser({ session, profileId, role, staffGroup });
  } catch (error) {
    toAdminMessage(error instanceof Error ? error.message : "Could not approve user.", "error");
  }

  revalidatePath("/admin");
  toAdminMessage(`User approved as ${role}.`, "success");
}

export async function updateApprovedUserRoleAction(formData: FormData) {
  const profileId = getProfileId(formData);
  const role = getRole(formData);
  const session = await getAdminSession();

  try {
    await setUserRole({ session, profileId, role });
  } catch (error) {
    toAdminMessage(error instanceof Error ? error.message : "Could not update role.", "error");
  }

  revalidatePath("/admin");
  toAdminMessage(`User role updated to ${role}.`, "success");
}

export async function updateUserStaffGroupAction(formData: FormData) {
  const profileId = getProfileId(formData);
  const staffGroup = getStaffGroup(formData);
  const session = await getAdminSession();

  try {
    await updateProfileStaffGroup({ session, profileId, staffGroup });
  } catch (error) {
    toAdminMessage(error instanceof Error ? error.message : "Could not update staff group.", "error");
  }

  revalidatePath("/admin");
  toAdminMessage("User staff group updated.", "success");
}

export async function disableUserAction(formData: FormData) {
  const profileId = getProfileId(formData);
  const session = await getAdminSession();

  try {
    await disableUser({ session, profileId });
  } catch (error) {
    toAdminMessage(error instanceof Error ? error.message : "Could not disable user.", "error");
  }

  revalidatePath("/admin");
  toAdminMessage("User disabled.", "success");
}

export async function reactivateUserAction(formData: FormData) {
  const profileId = getProfileId(formData);
  const session = await getAdminSession();

  try {
    await reactivateUser({ session, profileId });
  } catch (error) {
    toAdminMessage(error instanceof Error ? error.message : "Could not reactivate user.", "error");
  }

  revalidatePath("/admin");
  toAdminMessage("User reactivated.", "success");
}

export const disablePendingUserAction = disableUserAction;
