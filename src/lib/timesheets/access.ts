import "server-only";

import type { AuthSession } from "@/src/lib/auth/session";
import { getCurrentAccountStatus, getCurrentUserRoles, type AppRole } from "@/src/lib/auth/profile-access";

export type TimesheetActor = {
  session: AuthSession;
  profileId: string;
  accessContext?: {
    accountStatus: "approved";
    roles: AppRole[];
  };
  route?: string;
};

export const createSessionHeaders = (session: AuthSession) => ({
  Authorization: `Bearer ${session.accessToken}`,
});

const resolveActor = async ({ session, accessContext, route }: Omit<TimesheetActor, "profileId">) => {
  const accountStatus = accessContext?.accountStatus ?? (await getCurrentAccountStatus(session, undefined, route));
  const roles = accessContext?.roles ?? (await getCurrentUserRoles(session, undefined, route));
  return { accountStatus, roles };
};

export const assertTimesheetReadAccess = async (actor: Omit<TimesheetActor, "profileId">) => {
  const { accountStatus } = await resolveActor(actor);
  if (accountStatus !== "approved") {
    throw new Error("Approved account access is required for timesheets");
  }
};

export const assertTimesheetWriteAccess = async (actor: Omit<TimesheetActor, "profileId">) => {
  const { accountStatus, roles } = await resolveActor(actor);
  if (accountStatus !== "approved" || !roles.some((role) => ["admin", "supervisor", "operator"].includes(role))) {
    throw new Error("Operator, supervisor, or admin access is required for timesheets");
  }
};

export const assertTimesheetApprovalAccess = async (actor: Omit<TimesheetActor, "profileId">) => {
  const { accountStatus, roles } = await resolveActor(actor);
  if (accountStatus !== "approved" || !roles.some((role) => ["admin", "supervisor"].includes(role))) {
    throw new Error("Supervisor or admin access is required for timesheet approvals");
  }
};

export const canEditApprovedTimesheets = (roles: AppRole[]) => roles.includes("admin") || roles.includes("supervisor");
