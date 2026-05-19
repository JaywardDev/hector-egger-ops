import {
  ChartColumn,
  CircleCheck,
  Clock3,
  History,
  LayoutDashboard,
  List,
  MapPin,
  Settings,
  User,
  type LucideIcon,
} from "lucide-react";
import { canAccessAdmin } from "@/src/lib/permissions/admin";
import type { PermissionAuthContext } from "@/src/lib/permissions/roles";
import { isAdminOrSupervisor, isApprovedUser } from "@/src/lib/permissions/roles";
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
  { label: "User Admin", href: "/admin/users", permission: "admin", section: "main", icon: User },
  { label: "Pending Users", href: "/admin/users/pending", permission: "admin", section: "main", icon: User },
  { label: "Manage Users", href: "/admin/users/manage", permission: "admin", section: "main", icon: User },
  { label: "C Base Import", href: "/admin/timesheet-lookups/import", permission: "admin", section: "main", icon: User },
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
  {
    label: "Inventory",
    href: "/inventory",
    permission: "internalTools",
    section: "internal",
    internal: true,
    icon: List,
  },
  {
    label: "Locations",
    href: "/locations",
    permission: "internalTools",
    section: "internal",
    internal: true,
    icon: MapPin,
  },
  { label: "History", href: "/history", permission: "internalTools", section: "internal", internal: true, icon: History },
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
      return isApprovedUser(authContext) && isAdminOrSupervisor(authContext);
  }
};

const resolveItem = (item: AppNavItem, authContext: PermissionAuthContext): ResolvedAppNavItem => {
  const allowed = canAccessNavigationPermission(item.permission, authContext);

  return {
    ...item,
    disabled: !allowed,
    locked: !allowed,
  };
};

export const getNavigationSections = (authContext: PermissionAuthContext): ResolvedAppNavSection[] => {
  const mainItems = APP_NAV_ITEMS.filter((item) => item.section === "main").map((item) =>
    resolveItem(item, authContext),
  );
  const internalItems = APP_NAV_ITEMS.filter((item) => item.section === "internal")
    .map((item) => resolveItem(item, authContext))
    .filter((item) => !item.disabled);

  return [
    { label: "Main", items: mainItems },
    ...(internalItems.length > 0 ? [{ label: "Internal Tools", items: internalItems }] : []),
  ];
};
