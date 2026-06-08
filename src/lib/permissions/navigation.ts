import {
  ChartColumn,
  CircleCheck,
  Clock3,
  LayoutDashboard,
  Settings,
  User,
  type LucideIcon,
} from "lucide-react";
import { canAccessAdmin } from "@/src/lib/permissions/admin";
import type { PermissionAuthContext } from "@/src/lib/permissions/roles";
import { isAdmin, isApprovedUser } from "@/src/lib/permissions/roles";
import { canAccessTimesheetApprovals, canViewOwnTimesheets } from "@/src/lib/permissions/timesheets";

export type AppNavPermission = "timesheet" | "timesheetApprovals" | "admin" | "internalTools";

export type AppNavSection = "main" | "internal";

export type AppNavItem = {
  label: string;
  href: string;
  permission: AppNavPermission;
  section: AppNavSection;
  internal?: boolean;
  icon: LucideIcon;
};

export type ResolvedAppNavItem = AppNavItem & {
  disabled: boolean;
  locked: boolean;
};

export type ResolvedAppNavSection = {
  label: string;
  items: ResolvedAppNavItem[];
};

export const APP_NAV_ITEMS: AppNavItem[] = [
  { label: "Timesheet", href: "/timesheet", permission: "timesheet", section: "main", icon: Clock3 },
  { label: "Approvals", href: "/approvals", permission: "timesheetApprovals", section: "main", icon: CircleCheck },
  { label: "Admin", href: "/admin", permission: "admin", section: "main", icon: User },
  {
    label: "Dashboard",
    href: "/dashboard",
    permission: "internalTools",
    section: "internal",
    internal: true,
    icon: LayoutDashboard,
  },
  {
    label: "Production",
    href: "/production",
    permission: "internalTools",
    section: "internal",
    internal: true,
    icon: Settings,
  },
  {
    label: "Stock Take",
    href: "/stock-take",
    permission: "internalTools",
    section: "internal",
    internal: true,
    icon: ChartColumn,
  },
];

export const canAccessNavigationPermission = (
  permission: AppNavPermission,
  authContext: PermissionAuthContext | null | undefined,
) => {
  switch (permission) {
    case "timesheet":
      return canViewOwnTimesheets(authContext);
    case "timesheetApprovals":
      return canAccessTimesheetApprovals(authContext);
    case "admin":
      return canAccessAdmin(authContext);
    case "internalTools":
      return isApprovedUser(authContext);
  }
};

const resolveItem = (item: AppNavItem, authContext: PermissionAuthContext): ResolvedAppNavItem => {
  const canView = canAccessNavigationPermission(item.permission, authContext);
  const isInternalItem = item.permission === "internalTools";
  const canUseInternalItem = !isInternalItem || isAdmin(authContext);
  const allowed = canView && canUseInternalItem;

  return {
    ...item,
    disabled: !allowed,
    locked: !allowed && !isInternalItem,
  };
};

export const getNavigationSections = (authContext: PermissionAuthContext): ResolvedAppNavSection[] => {
  const mainItems = APP_NAV_ITEMS.filter((item) => item.section === "main").map((item) =>
    resolveItem(item, authContext),
  );
  const internalItems = APP_NAV_ITEMS.filter((item) => item.section === "internal")
    .map((item) => resolveItem(item, authContext));

  return [
    { label: "Main", items: mainItems },
    ...(internalItems.length > 0 ? [{ label: "Internal Tools", items: internalItems }] : []),
  ];
};
