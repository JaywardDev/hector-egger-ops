import type { ReactNode } from "react";
import {
  approvePendingUserAction,
  disableUserAction,
  reactivateUserAction,
  updateApprovedUserRoleAction,
  updateUserStaffGroupAction,
} from "@/app/(protected)/admin/actions";
import { PageContainer } from "@/src/components/layout/page-container";
import { PageHeader } from "@/src/components/layout/page-header";
import { Stack } from "@/src/components/layout/stack";
import { Alert } from "@/src/components/ui/alert";
import { Badge } from "@/src/components/ui/badge";
import { Button } from "@/src/components/ui/button";
import { Card } from "@/src/components/ui/card";
import { FormField } from "@/src/components/ui/form-field";
import { Label } from "@/src/components/ui/label";
import { Select } from "@/src/components/ui/select";
import {
  ADMIN_ROLE_OPTIONS,
  ADMIN_STAFF_GROUP_OPTIONS,
  type AdminUserRecord,
  listApprovedUsers,
  listDisabledUsers,
  listPendingUsers,
} from "@/src/lib/admin/user-approvals";
import { isProfileComplete, type AppRole, type StaffGroup } from "@/src/lib/auth/profile-access";
import { requireAdminAccess } from "@/src/lib/auth/guards";

type AdminPageProps = {
  searchParams: Promise<{
    success?: string;
    error?: string;
  }>;
};

const staffGroupLabels: Record<StaffGroup, string> = {
  factory: "Factory",
  site: "Site",
  office: "Office",
};

const roleLabels: Record<AppRole, string> = {
  operator: "operator",
  supervisor: "supervisor",
  admin: "admin",
};

const formatDate = (date: string | null) => date ? new Date(date).toLocaleString() : "—";

const displayStaffGroup = (staffGroup: StaffGroup | null) =>
  staffGroup ? staffGroupLabels[staffGroup] : "Unassigned";

const displayRoles = (roles: AppRole[]) =>
  roles.length > 0 ? roles.map((role) => roleLabels[role]).join(", ") : "No role";

const displayProfileCompletion = (user: AdminUserRecord) =>
  isProfileComplete(user) ? "Complete" : "Incomplete";

function StaffGroupSelect({ user, idPrefix }: { user: AdminUserRecord; idPrefix: string }) {
  return (
    <FormField>
      <Label htmlFor={`${idPrefix}-staff-group-${user.id}`}>Staff group</Label>
      <Select id={`${idPrefix}-staff-group-${user.id}`} name="staffGroup" defaultValue={user.staff_group ?? ""} className="w-auto min-w-36">
        <option value="">Unassigned</option>
        {ADMIN_STAFF_GROUP_OPTIONS.map((staffGroup) => (
          <option key={staffGroup} value={staffGroup}>{staffGroupLabels[staffGroup]}</option>
        ))}
      </Select>
    </FormField>
  );
}

function RoleSelect({ user, idPrefix, defaultRole = "operator" }: { user: AdminUserRecord; idPrefix: string; defaultRole?: AppRole }) {
  const selectedRole = user.roles.find((role) => ADMIN_ROLE_OPTIONS.includes(role)) ?? defaultRole;

  return (
    <FormField>
      <Label htmlFor={`${idPrefix}-role-${user.id}`}>Role</Label>
      <Select id={`${idPrefix}-role-${user.id}`} name="role" defaultValue={selectedRole} className="w-auto min-w-36">
        {ADMIN_ROLE_OPTIONS.map((role) => (
          <option key={role} value={role}>{roleLabels[role]}</option>
        ))}
      </Select>
    </FormField>
  );
}

function UserDetails({ user }: { user: AdminUserRecord }) {
  return (
    <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
      <div>
        <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">Status</dt>
        <dd><Badge>{user.account_status}</Badge></dd>
      </div>
      <div>
        <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">Profile</dt>
        <dd><Badge variant={isProfileComplete(user) ? "success" : "warning"}>{displayProfileCompletion(user)}</Badge></dd>
      </div>
      <div>
        <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">Roles</dt>
        <dd className="text-zinc-800">{displayRoles(user.roles)}</dd>
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

function UserHeader({ user }: { user: AdminUserRecord }) {
  return (
    <div>
      <p className="font-medium text-zinc-900">{user.full_name ?? "Unnamed user"}</p>
      <p className="text-zinc-600">{user.email}</p>
    </div>
  );
}

function PendingUserCard({ user }: { user: AdminUserRecord }) {
  return (
    <Card>
      <UserHeader user={user} />
      <UserDetails user={user} />

      <div className="mt-4 flex flex-wrap items-end gap-2">
        <form action={approvePendingUserAction} className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="profileId" value={user.id} />
          <RoleSelect user={user} idPrefix="approve" />
          <StaffGroupSelect user={user} idPrefix="approve" />
          <Button type="submit">Approve</Button>
        </form>

        <form action={disableUserAction}>
          <input type="hidden" name="profileId" value={user.id} />
          <Button type="submit" variant="danger">Disable</Button>
        </form>
      </div>
    </Card>
  );
}

function ApprovedUserCard({ user }: { user: AdminUserRecord }) {
  return (
    <Card>
      <UserHeader user={user} />
      <UserDetails user={user} />

      <div className="mt-4 flex flex-wrap items-end gap-2">
        <form action={updateApprovedUserRoleAction} className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="profileId" value={user.id} />
          <RoleSelect user={user} idPrefix="manage" />
          <Button type="submit" variant="secondary">Update role</Button>
        </form>

        <form action={updateUserStaffGroupAction} className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="profileId" value={user.id} />
          <StaffGroupSelect user={user} idPrefix="manage" />
          <Button type="submit" variant="secondary">Update group</Button>
        </form>

        <form action={disableUserAction}>
          <input type="hidden" name="profileId" value={user.id} />
          <Button type="submit" variant="danger">Disable</Button>
        </form>
      </div>
    </Card>
  );
}

function DisabledUserCard({ user }: { user: AdminUserRecord }) {
  return (
    <Card>
      <UserHeader user={user} />
      <UserDetails user={user} />

      <div className="mt-4 flex flex-wrap items-end gap-2">
        <form action={updateUserStaffGroupAction} className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="profileId" value={user.id} />
          <StaffGroupSelect user={user} idPrefix="disabled" />
          <Button type="submit" variant="secondary">Update group</Button>
        </form>

        <form action={reactivateUserAction}>
          <input type="hidden" name="profileId" value={user.id} />
          <Button type="submit" variant="secondary">Reactivate</Button>
        </form>
      </div>
    </Card>
  );
}

function UserSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold text-zinc-950">{title}</h2>
      {children}
    </section>
  );
}

export default async function AdminPage({ searchParams }: AdminPageProps) {
  const { session } = await requireAdminAccess();
  const [pendingUsers, approvedUsers, disabledUsers, params] = await Promise.all([
    listPendingUsers({ session }),
    listApprovedUsers({ session }),
    listDisabledUsers({ session }),
    searchParams,
  ]);

  return (
    <PageContainer>
      <PageHeader
        title="User management"
        description="Approve pending access requests and manage approved user roles, staff groups, and account status."
      />

      {params.success ? <Alert variant="success">{params.success}</Alert> : null}
      {params.error ? <Alert variant="error">{params.error}</Alert> : null}

      <Stack>
        <UserSection title="Pending users">
          {pendingUsers.length === 0 ? <Card>No pending users.</Card> : (
            <Stack>
              {pendingUsers.map((user) => <PendingUserCard key={user.id} user={user} />)}
            </Stack>
          )}
        </UserSection>

        <UserSection title="Approved users">
          {approvedUsers.length === 0 ? <Card>No approved users.</Card> : (
            <Stack>
              {approvedUsers.map((user) => <ApprovedUserCard key={user.id} user={user} />)}
            </Stack>
          )}
        </UserSection>

        <UserSection title="Disabled users">
          {disabledUsers.length === 0 ? <Card>No disabled users.</Card> : (
            <Stack>
              {disabledUsers.map((user) => <DisabledUserCard key={user.id} user={user} />)}
            </Stack>
          )}
        </UserSection>
      </Stack>
    </PageContainer>
  );
}
