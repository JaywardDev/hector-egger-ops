import Link from "next/link";
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
import { PendingSubmitButton } from "@/src/components/ui/pending-button";
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
import { formatRoleLabel, formatRoleList } from "@/src/lib/auth/role-labels";
import { requireAdminAccess } from "@/src/lib/auth/guards";
import { formatNzDateTime } from "@/src/lib/dateTime";

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

const formatDate = (date: string | null) => formatNzDateTime(date);

const displayStaffGroup = (staffGroup: StaffGroup | null) =>
  staffGroup ? staffGroupLabels[staffGroup] : "Unassigned staff group";

const hasCompletedApprovalProfile = (user: AdminUserRecord) =>
  Boolean(user.profile_completed_at && isProfileComplete(user));

const displayProfileCompletion = (user: AdminUserRecord) =>
  hasCompletedApprovalProfile(user) ? "Complete" : "Incomplete";

function StaffGroupSelect({ user, idPrefix, required = false }: { user: AdminUserRecord; idPrefix: string; required?: boolean }) {
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

function RoleSelect({ user, idPrefix, defaultRole = "operator", required = false }: { user: AdminUserRecord; idPrefix: string; defaultRole?: AppRole | ""; required?: boolean }) {
  const selectedRole = user.roles.find((role) => ADMIN_ROLE_OPTIONS.includes(role)) ?? defaultRole;

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

function UserDetails({ user }: { user: AdminUserRecord }) {
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

function UserHeader({ user }: { user: AdminUserRecord }) {
  return (
    <div>
      <p className="font-medium text-zinc-900">{user.full_name ?? "Unnamed user"}</p>
      <p className="text-zinc-600">{user.email}</p>
    </div>
  );
}

function PendingUserCard({ user }: { user: AdminUserRecord }) {
  const approvalProfileComplete = hasCompletedApprovalProfile(user);

  return (
    <Card>
      <UserHeader user={user} />
      <UserDetails user={user} />

      {!approvalProfileComplete ? (
        <p className="mt-3 text-sm font-medium text-amber-700">Profile incomplete — user must finish onboarding first.</p>
      ) : null}
      {!user.staff_group ? (
        <p className="mt-3 text-sm font-medium text-amber-700">Select a staff group before approving this user.</p>
      ) : null}

      <div className="mt-4 flex flex-wrap items-end gap-2">
        <form action={approvePendingUserAction} className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="profileId" value={user.id} />
          <RoleSelect user={user} idPrefix="approve" defaultRole="" required />
          <StaffGroupSelect user={user} idPrefix="approve" required />
          <PendingSubmitButton type="submit" disabled={!approvalProfileComplete} pendingLabel="Approving…">Approve</PendingSubmitButton>
        </form>

        <form action={disableUserAction}>
          <input type="hidden" name="profileId" value={user.id} />
          <PendingSubmitButton type="submit" variant="danger" pendingLabel="Disabling…">Disable</PendingSubmitButton>
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
          <PendingSubmitButton type="submit" variant="secondary" pendingLabel="Updating role…">Update role</PendingSubmitButton>
        </form>

        <form action={updateUserStaffGroupAction} className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="profileId" value={user.id} />
          <StaffGroupSelect user={user} idPrefix="manage" />
          <PendingSubmitButton type="submit" variant="secondary" pendingLabel="Updating group…">Update group</PendingSubmitButton>
        </form>

        <form action={disableUserAction}>
          <input type="hidden" name="profileId" value={user.id} />
          <PendingSubmitButton type="submit" variant="danger" pendingLabel="Disabling…">Disable</PendingSubmitButton>
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
          <PendingSubmitButton type="submit" variant="secondary" pendingLabel="Updating group…">Update group</PendingSubmitButton>
        </form>

        <form action={reactivateUserAction}>
          <input type="hidden" name="profileId" value={user.id} />
          <PendingSubmitButton type="submit" variant="secondary" pendingLabel="Reactivating…">Reactivate</PendingSubmitButton>
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

      <Card>
        <h2 className="text-lg font-semibold text-zinc-950">Timesheet lookup imports</h2>
        <p className="mt-1 text-sm text-zinc-600">Validate and sync C Base BuildingsExport and CostcodesExport snapshots for timesheet projects and tasks.</p>
        <Link className="mt-3 inline-flex rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-900 shadow-sm hover:bg-zinc-50" href="/admin/timesheet-lookups/import">
          Open C Base import
        </Link>
      </Card>

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
