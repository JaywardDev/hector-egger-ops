import {
  approvePendingUserAction,
  disableApprovedUserAction,
  disablePendingUserAction,
  reactivateUserAction,
  updateApprovedUserRoleAction,
  updateUserStaffGroupAction,
} from "@/app/(protected)/admin/actions";
import { PendingSubmitButton } from "@/src/components/ui/pending-button";
import { Card } from "@/src/components/ui/card";
import { Badge } from "@/src/components/ui/badge";
import { Avatar } from "@/src/components/ui/avatar";
import { ConfirmActionForm } from "@/app/(protected)/admin/_components/confirm-action-form";
import type { AdminUserRecord } from "@/src/lib/admin/user-approvals";
import {
  RoleSelect,
  StaffGroupSelect,
  UserDetails,
  UserHeader,
  hasCompletedApprovalProfile,
  displayStaffGroup,
} from "@/app/(protected)/admin/_components/user-admin-shared";
import { formatRoleList } from "@/src/lib/auth/role-labels";

function UserIdentity({ user }: { user: AdminUserRecord }) {
  const name = user.full_name ?? "Unnamed user";

  return (
    <div className="flex items-center gap-3">
      <Avatar profileId={user.id} name={name} hasAvatar={Boolean(user.avatar_path)} size={40} />
      <UserHeader user={user} />
    </div>
  );
}

function AccountStatusBadge({ user }: { user: AdminUserRecord }) {
  const isDisabled = user.account_status === "disabled";
  return (
    <Badge variant={isDisabled ? "warning" : "success"} className="capitalize">
      {user.account_status}
    </Badge>
  );
}

function ManageUserShell({
  user,
  children,
}: {
  user: AdminUserRecord;
  children: import("react").ReactNode;
}) {
  return (
    <Card className="rounded-xl border-zinc-200 p-4 shadow-sm">
      <div className="grid gap-4 lg:grid-cols-[minmax(280px,2fr)_minmax(140px,1fr)_minmax(170px,1fr)_auto_auto] lg:items-center">
        <UserIdentity user={user} />

        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-zinc-500">Role</p>
          <p className="text-sm text-zinc-900">{formatRoleList(user.roles)}</p>
        </div>

        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-zinc-500">Staff group</p>
          <p className="text-sm text-zinc-900">{displayStaffGroup(user.staff_group)}</p>
        </div>

        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-zinc-500">Status</p>
          <div className="mt-1">
            <AccountStatusBadge user={user} />
          </div>
        </div>

        <div className="flex flex-wrap justify-start gap-2 lg:justify-end">{children}</div>
      </div>
    </Card>
  );
}

export function PendingUserCard({ user }: { user: AdminUserRecord }) {
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

        <ConfirmActionForm
          action={disablePendingUserAction}
          profileId={user.id}
          submitLabel="Disable"
          pendingLabel="Disabling…"
          variant="danger"
          danger
          confirmTitle="Disable this pending user?"
          confirmDescription={`This rejects ${user.full_name ?? user.email}'s access request. They will not be able to sign in until an admin reactivates the account.`}
          confirmLabel="Disable user"
        />
      </div>
    </Card>
  );
}

export function ApprovedUserCard({ user }: { user: AdminUserRecord }) {
  return (
    <ManageUserShell user={user}>
      <details className="relative">
        <summary className="cursor-pointer list-none rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs font-medium text-zinc-700 shadow-sm hover:bg-zinc-50">Manage</summary>
        <div className="absolute right-0 z-10 mt-2 w-[18rem] rounded-lg border border-zinc-200 bg-white p-3 shadow-lg">
          <div className="space-y-3">
            <form action={updateApprovedUserRoleAction} className="space-y-2">
              <input type="hidden" name="profileId" value={user.id} />
              <RoleSelect user={user} idPrefix="manage" />
              <PendingSubmitButton type="submit" variant="secondary" size="sm" pendingLabel="Updating role…">Update role</PendingSubmitButton>
            </form>

            <form action={updateUserStaffGroupAction} className="space-y-2">
              <input type="hidden" name="profileId" value={user.id} />
              <StaffGroupSelect user={user} idPrefix="manage" />
              <PendingSubmitButton type="submit" variant="secondary" size="sm" pendingLabel="Updating group…">Update group</PendingSubmitButton>
            </form>

            <ConfirmActionForm
              action={disableApprovedUserAction}
              profileId={user.id}
              submitLabel="Disable"
              pendingLabel="Disabling…"
              variant="danger"
              size="sm"
              danger
              confirmTitle="Disable this user?"
              confirmDescription={`${user.full_name ?? user.email} will immediately lose access to the app until an admin reactivates the account.`}
              confirmLabel="Disable user"
            />
          </div>
        </div>
      </details>
    </ManageUserShell>
  );
}

export function DisabledUserCard({ user }: { user: AdminUserRecord }) {
  return (
    <ManageUserShell user={user}>
      <details className="relative">
        <summary className="cursor-pointer list-none rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs font-medium text-zinc-700 shadow-sm hover:bg-zinc-50">Manage</summary>
        <div className="absolute right-0 z-10 mt-2 w-[18rem] rounded-lg border border-zinc-200 bg-white p-3 shadow-lg">
          <div className="space-y-3">
            <form action={updateUserStaffGroupAction} className="space-y-2">
              <input type="hidden" name="profileId" value={user.id} />
              <StaffGroupSelect user={user} idPrefix="disabled" />
              <PendingSubmitButton type="submit" variant="secondary" size="sm" pendingLabel="Updating group…">Update group</PendingSubmitButton>
            </form>

            <ConfirmActionForm
              action={reactivateUserAction}
              profileId={user.id}
              submitLabel="Reactivate"
              pendingLabel="Reactivating…"
              variant="secondary"
              size="sm"
              confirmTitle="Reactivate this user?"
              confirmDescription={`${user.full_name ?? user.email} will regain access to the app with their previous role and staff group.`}
              confirmLabel="Reactivate user"
            />
          </div>
        </div>
      </details>
    </ManageUserShell>
  );
}
