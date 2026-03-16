import "server-only";

import { redirect } from "next/navigation";
import { resolveAccountAccessState } from "@/src/lib/auth/access-state";
import { getSessionFromCookies } from "@/src/lib/auth/session";

export const getAuthContext = async () => {
  const session = await getSessionFromCookies();
  const accessState = resolveAccountAccessState(session);

  return {
    session,
    accessState,
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

  if (context.accessState === "disabled_or_rejected") {
    redirect("/pending?status=disabled");
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
