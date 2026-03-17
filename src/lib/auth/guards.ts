import "server-only";

import { redirect } from "next/navigation";
import { resolveAccountAccessState } from "@/src/lib/auth/access-state";
import { getCurrentProfile, getCurrentUserRoles } from "@/src/lib/auth/profile-access";
import { getSessionFromCookies } from "@/src/lib/auth/session";

export const getAuthContext = async () => {
  const session = await getSessionFromCookies();
  const [accessState, profile, roles] = await Promise.all([
    resolveAccountAccessState(session),
    getCurrentProfile(session),
    getCurrentUserRoles(session),
  ]);

  return {
    session,
    accessState,
    profile,
    roles,
  };
};

export const requireProtectedAccess = async () => {
  const context = await getAuthContext();

  if (context.accessState === "unauthenticated") {
    redirect("/sign-in");
  }

  if (context.accessState === "pending_approval") {
    redirect("/pending");
  }

  if (context.accessState === "disabled") {
    redirect("/pending?status=disabled");
  }

  return context;
};

export const requireAdminAccess = async () => {
  const context = await requireProtectedAccess();

  if (!context.roles.includes("admin")) {
    redirect("/dashboard");
  }

  return context;
};

export const requirePendingAccess = async () => {
  const context = await getAuthContext();

  if (context.accessState === "unauthenticated") {
    redirect("/sign-in");
  }

  if (context.accessState === "approved") {
    redirect("/dashboard");
  }

  return context;
};
