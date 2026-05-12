import "server-only";

import { getCurrentProfile, getCurrentAccountStatus, isProfileComplete } from "@/src/lib/auth/profile-access";
import type { AuthSession } from "@/src/lib/auth/session";

export type AccountAccessState = "unauthenticated" | "incomplete_profile" | "pending_approval" | "approved" | "disabled";

export const resolveAccountAccessState = async (
  session: AuthSession | null,
): Promise<AccountAccessState> => {
  if (!session) {
    return "unauthenticated";
  }

  const profile = await getCurrentProfile(session);
  const accountStatus = await getCurrentAccountStatus(session, profile);

  if (accountStatus === "disabled") {
    return "disabled";
  }

  if (!isProfileComplete(profile)) {
    return "incomplete_profile";
  }

  if (accountStatus === "approved") {
    return "approved";
  }

  return "pending_approval";
};
