import "server-only";

import type { AuthSession } from "@/src/lib/auth/session";
import {
  getCurrentAccountStatus,
  getCurrentUserRoles,
  type AppRole,
} from "@/src/lib/auth/profile-access";

export type ApprovedAccessContext = {
  accountStatus: "approved";
  roles: AppRole[];
};

export type ProductionActor = {
  session: AuthSession;
  accessContext?: ApprovedAccessContext;
  route?: string;
};

export const createSessionHeaders = (session: AuthSession) => ({
  Authorization: `Bearer ${session.accessToken}`,
});

const resolveActor = async ({ session, accessContext, route }: ProductionActor) => {
  const accountStatus =
    accessContext?.accountStatus ??
    (await getCurrentAccountStatus(session, undefined, route));
  const roles =
    accessContext?.roles ?? (await getCurrentUserRoles(session, undefined, route));

  return { accountStatus, roles };
};

export const assertProductionReadAccess = async (actor: ProductionActor) => {
  const { accountStatus } = await resolveActor(actor);
  if (accountStatus !== "approved") {
    throw new Error("Approved account access is required for production data");
  }
};

export const assertProductionProjectWriteAccess = async (actor: ProductionActor) => {
  const { accountStatus, roles } = await resolveActor(actor);
  if (
    accountStatus !== "approved" ||
    (!roles.includes("admin") && !roles.includes("supervisor"))
  ) {
    throw new Error("Supervisor or admin access is required for project writes");
  }
};

export const assertProductionReasonWriteAccess = async (actor: ProductionActor) => {
  const { accountStatus, roles } = await resolveActor(actor);
  if (
    accountStatus !== "approved" ||
    (!roles.includes("admin") && !roles.includes("supervisor"))
  ) {
    throw new Error("Supervisor or admin access is required for reason writes");
  }
};

export const assertProductionEntryWriteAccess = async (actor: ProductionActor) => {
  const { accountStatus, roles } = await resolveActor(actor);
  if (
    accountStatus !== "approved" ||
    !roles.some((role) => ["admin", "supervisor", "operator"].includes(role))
  ) {
    throw new Error(
      "Operator, supervisor, or admin access is required for entry writes",
    );
  }
};
