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
import type { AdminUserRecord } from "@/src/lib/admin/user-approvals";
import {
  RoleSelect,
  StaffGroupSelect,
  UserDetails,
  UserHeader,
  hasCompletedApprovalProfile,
} from "@/app/(protected)/admin/_components/user-admin-shared";

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

        <form action={disablePendingUserAction}>
          <input type="hidden" name="profileId" value={user.id} />
          <PendingSubmitButton type="submit" variant="danger" pendingLabel="Disabling…">Disable</PendingSubmitButton>
        </form>
      </div>
    </Card>
  );
}

export function ApprovedUserCard({ user }: { user: AdminUserRecord }) {
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

        <form action={disableApprovedUserAction}>
          <input type="hidden" name="profileId" value={user.id} />
          <PendingSubmitButton type="submit" variant="danger" pendingLabel="Disabling…">Disable</PendingSubmitButton>
        </form>
      </div>
    </Card>
  );
}

export function DisabledUserCard({ user }: { user: AdminUserRecord }) {
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
