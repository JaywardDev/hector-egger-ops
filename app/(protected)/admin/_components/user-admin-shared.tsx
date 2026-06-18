import type { ReactNode } from "react";
import { Alert } from "@/src/components/ui/alert";
import { Badge } from "@/src/components/ui/badge";
import { Card } from "@/src/components/ui/card";
import { FormField } from "@/src/components/ui/form-field";
import { Label } from "@/src/components/ui/label";
import { Select } from "@/src/components/ui/select";
import {
  ADMIN_ROLE_OPTIONS,
  ADMIN_STAFF_GROUP_OPTIONS,
  type AdminUserRecord,
} from "@/src/lib/admin/user-approvals";
import { isProfileComplete, type AppRole, type StaffGroup } from "@/src/lib/auth/profile-access";
import { formatRoleLabel, formatRoleList } from "@/src/lib/auth/role-labels";
import { formatNzDateTime } from "@/src/lib/dateTime";

const staffGroupLabels: Record<StaffGroup, string> = {
  factory: "Factory",
  site: "Site",
  office: "Office",
};

const formatDate = (date: string | null) => formatNzDateTime(date);

export const displayStaffGroup = (staffGroup: StaffGroup | null) =>
  staffGroup ? staffGroupLabels[staffGroup] : "Unassigned staff group";

export const hasCompletedApprovalProfile = (user: AdminUserRecord) =>
  Boolean(user.profile_completed_at && isProfileComplete(user));

const displayProfileCompletion = (user: AdminUserRecord) =>
  hasCompletedApprovalProfile(user) ? "Complete" : "Incomplete";

export function AdminPageStatusMessage({ searchParams }: { searchParams: { success?: string; error?: string } }) {
  return (
    <>
      {searchParams.success ? <Alert variant="success">{searchParams.success}</Alert> : null}
      {searchParams.error ? <Alert variant="error">{searchParams.error}</Alert> : null}
    </>
  );
}

export function StaffGroupSelect({ user, idPrefix, required = false }: { user: AdminUserRecord; idPrefix: string; required?: boolean }) {
  return (
    <FormField>
      <Label htmlFor={`${idPrefix}-staff-group-${user.id}`}>Staff group</Label>
      <Select id={`${idPrefix}-staff-group-${user.id}`} name="staffGroup" defaultValue={user.staff_group ?? ""} className="w-auto min-w-36" required={required}>
        <option value="">{required ? "Select staff group" : "Unassigned"}</option>
        {ADMIN_STAFF_GROUP_OPTIONS.map((staffGroup) => (
          <option key={staffGroup} value={staffGroup}>{staffGroupLabels[staffGroup]}</option>
        ))}
      </Select>
    </FormField>
  );
}

export function RoleSelect({ user, idPrefix, defaultRole = "operator", required = false }: { user: AdminUserRecord; idPrefix: string; defaultRole?: AppRole | ""; required?: boolean }) {
  const selectedRole = user.roles.find((role) => (ADMIN_ROLE_OPTIONS as readonly AppRole[]).includes(role)) ?? defaultRole;

  return (
    <FormField>
      <Label htmlFor={`${idPrefix}-role-${user.id}`}>Role</Label>
      <Select id={`${idPrefix}-role-${user.id}`} name="role" defaultValue={selectedRole} className="w-auto min-w-36" required={required}>
        {required ? <option value="">Select role</option> : null}
        {ADMIN_ROLE_OPTIONS.map((role) => (
          <option key={role} value={role}>{formatRoleLabel(role)}</option>
        ))}
      </Select>
    </FormField>
  );
}

export function UserDetails({ user }: { user: AdminUserRecord }) {
  return (
    <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
      <div>
        <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">Status</dt>
        <dd><Badge>{user.account_status}</Badge></dd>
      </div>
      <div>
        <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">Profile</dt>
        <dd><Badge variant={hasCompletedApprovalProfile(user) ? "success" : "warning"}>{displayProfileCompletion(user)}</Badge></dd>
      </div>
      <div>
        <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">Roles</dt>
        <dd className="text-zinc-800">{formatRoleList(user.roles)}</dd>
      </div>
      <div>
        <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">Staff group</dt>
        <dd className="text-zinc-800">{displayStaffGroup(user.staff_group)}</dd>
      </div>
      <div>
        <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">Created</dt>
        <dd className="text-zinc-800">{formatDate(user.created_at)}</dd>
      </div>
      <div>
        <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">Approved</dt>
        <dd className="text-zinc-800">{formatDate(user.approved_at)}</dd>
      </div>
      <div>
        <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">Disabled</dt>
        <dd className="text-zinc-800">{formatDate(user.disabled_at)}</dd>
      </div>
    </dl>
  );
}

export function UserHeader({ user }: { user: AdminUserRecord }) {
  return (
    <div>
      <p className="font-medium text-zinc-900">{user.full_name ?? "Unnamed user"}</p>
      <p className="text-zinc-600">{user.email}</p>
    </div>
  );
}

export function UserSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-xs font-semibold uppercase tracking-[0.1em] text-zinc-500">{title}</h2>
      {children}
    </section>
  );
}

export function EmptyUserSectionCard({ message }: { message: string }) {
  return <Card>{message}</Card>;
}
