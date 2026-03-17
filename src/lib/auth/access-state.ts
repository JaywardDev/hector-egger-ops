import "server-only";

import { getCurrentAccountStatus } from "@/src/lib/auth/profile-access";
import type { AuthSession } from "@/src/lib/auth/session";

export type AccountAccessState = "unauthenticated" | "pending_approval" | "approved" | "disabled";

export const resolveAccountAccessState = async (
  session: AuthSession | null,
): Promise<AccountAccessState> => {
  if (!session) {
    return "unauthenticated";
  }

  const accountStatus = await getCurrentAccountStatus(session);

  if (accountStatus === "approved") {
    return "approved";
  }

  if (accountStatus === "disabled") {
    return "disabled";
  }

  return "pending_approval";
};
