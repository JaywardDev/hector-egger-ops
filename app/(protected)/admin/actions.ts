"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { approveUser, assignRole, disableUser } from "@/src/lib/admin/user-approvals";
import type { AppRole } from "@/src/lib/auth/profile-access";
import { requireAdminAccess } from "@/src/lib/auth/guards";

const ALLOWED_ROLES: AppRole[] = ["operator", "supervisor", "admin"];

const toAdminMessage = (message: string, type: "success" | "error") =>
  redirect(`/admin?${type}=${encodeURIComponent(message)}`);

export async function approvePendingUserAction(formData: FormData) {
  const profileId = String(formData.get("profileId") ?? "").trim();
  const role = String(formData.get("role") ?? "").trim() as AppRole;

  if (!profileId) {
    toAdminMessage("Missing profile id.", "error");
  }

  if (!ALLOWED_ROLES.includes(role)) {
    toAdminMessage("Invalid role selected.", "error");
  }

  const { session } = await requireAdminAccess();

  if (!session) {
    toAdminMessage("Authentication required.", "error");
  }

  try {
    await approveUser({ session, profileId });
    await assignRole({ session, profileId, role });
  } catch {
    toAdminMessage("Could not approve user.", "error");
  }

  revalidatePath("/admin");
  toAdminMessage(`User approved as ${role}.`, "success");
}

export async function disablePendingUserAction(formData: FormData) {
  const profileId = String(formData.get("profileId") ?? "").trim();

  if (!profileId) {
    toAdminMessage("Missing profile id.", "error");
  }

  const { session } = await requireAdminAccess();

  if (!session) {
    toAdminMessage("Authentication required.", "error");
  }

  try {
    await disableUser({ session, profileId });
  } catch {
    toAdminMessage("Could not disable user.", "error");
  }

  revalidatePath("/admin");
  toAdminMessage("User disabled.", "success");
}
