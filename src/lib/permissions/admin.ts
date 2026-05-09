import type { PermissionAuthContext } from "@/src/lib/permissions/roles";
import { isAdmin } from "@/src/lib/permissions/roles";

export const canAccessAdmin = (authContext: PermissionAuthContext | null | undefined) =>
  isAdmin(authContext);

export const canManageUsers = (authContext: PermissionAuthContext | null | undefined) =>
  canAccessAdmin(authContext);
