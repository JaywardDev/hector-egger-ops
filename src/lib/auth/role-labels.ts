import type { AppRole } from "@/src/lib/auth/profile-access";

export const roleDisplayLabels: Record<AppRole, string> = {
  operator: "Staff",
  supervisor: "supervisor",
  admin: "admin",
};

export const formatRoleLabel = (role: AppRole | string | null | undefined) => {
  if (!role) {
    return "";
  }

  return role in roleDisplayLabels ? roleDisplayLabels[role as AppRole] : role;
};

export const formatRoleList = (roles: readonly AppRole[]) =>
  roles.length > 0 ? roles.map(formatRoleLabel).join(", ") : "No role";

export const formatRoleDisjunction = (roles: readonly AppRole[]) => {
  const labels = roles.map(formatRoleLabel);

  if (labels.length <= 1) {
    return labels[0] ?? "";
  }

  if (labels.length === 2) {
    return `${labels[0]} or ${labels[1]}`;
  }

  return `${labels.slice(0, -1).join(", ")}, or ${labels[labels.length - 1]}`;
};
