import type { PermissionAuthContext } from "@/src/lib/permissions/roles";
import { isAdmin, isAdminOrSupervisor, isApprovedUser, isOperator } from "@/src/lib/permissions/roles";

export const canViewOwnTimesheets = (authContext: PermissionAuthContext | null | undefined) =>
  isApprovedUser(authContext);

export const canEditOwnTimesheets = (authContext: PermissionAuthContext | null | undefined) =>
  isApprovedUser(authContext) && (isOperator(authContext) || isAdminOrSupervisor(authContext));

export const canAccessTimesheetApprovals = (authContext: PermissionAuthContext | null | undefined) =>
  isApprovedUser(authContext) && isAdminOrSupervisor(authContext);

export const canApproveTimesheets = (authContext: PermissionAuthContext | null | undefined) =>
  canAccessTimesheetApprovals(authContext);

export const canExportTimesheets = (authContext: PermissionAuthContext | null | undefined) =>
  isApprovedUser(authContext) && isAdmin(authContext);
