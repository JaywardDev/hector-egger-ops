import "server-only";

import type { AuthSession } from "@/src/lib/auth/session";

export type AccountAccessState =
  | "unauthenticated"
  | "pending_approval"
  | "approved"
  | "disabled_or_rejected";

/**
 * Scaffold resolver for Phase 1.
 * TODO: Replace this with profiles/roles/account-status table lookups.
 */
export const resolveAccountAccessState = (
  session: AuthSession | null,
): AccountAccessState => {
  if (!session) {
    return "unauthenticated";
  }

  const email = session.user.email?.toLowerCase() ?? "";

  if (email.includes("disabled") || email.includes("rejected")) {
    return "disabled_or_rejected";
  }

  if (email.endsWith("@hectoregger.com")) {
    return "approved";
  }

  return "pending_approval";
};
