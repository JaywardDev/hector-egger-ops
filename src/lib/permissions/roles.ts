import type { AccountStatus, AppRole } from "@/src/lib/auth/profile-access";

export type PermissionAuthContext = {
  accountStatus?: AccountStatus;
  accessState?: "unauthenticated" | "incomplete_profile" | "pending_approval" | "approved" | "disabled";
  roles?: AppRole[];
  profile?: {
    account_status?: AccountStatus;
  } | null;
};

const getRoles = (authContext: PermissionAuthContext | null | undefined) =>
  authContext?.roles ?? [];

const getAccountStatus = (authContext: PermissionAuthContext | null | undefined) =>
  authContext?.accountStatus ?? authContext?.profile?.account_status;

export const isAdmin = (authContext: PermissionAuthContext | null | undefined) =>
  getRoles(authContext).includes("admin");

export const isSupervisor = (authContext: PermissionAuthContext | null | undefined) =>
  getRoles(authContext).includes("supervisor");

export const isOperator = (authContext: PermissionAuthContext | null | undefined) =>
  getRoles(authContext).includes("operator");

export const isApprovedUser = (authContext: PermissionAuthContext | null | undefined) =>
  authContext?.accessState === "approved" || getAccountStatus(authContext) === "approved";

export const isAdminOrSupervisor = (authContext: PermissionAuthContext | null | undefined) =>
  isAdmin(authContext) || isSupervisor(authContext);
