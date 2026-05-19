import Link from "next/link";
import { PageContainer } from "@/src/components/layout/page-container";
import { PageHeader } from "@/src/components/layout/page-header";
import { Stack } from "@/src/components/layout/stack";
import { Card } from "@/src/components/ui/card";
import { listApprovedUsers, listDisabledUsers, listPendingUsers } from "@/src/lib/admin/user-approvals";
import { requireAdminAccess } from "@/src/lib/auth/guards";

export default async function AdminUsersPage() {
  const { session } = await requireAdminAccess();
  const [pendingUsers, approvedUsers, disabledUsers] = await Promise.all([
    listPendingUsers({ session }),
    listApprovedUsers({ session }),
    listDisabledUsers({ session }),
  ]);

  return (
    <PageContainer>
      <PageHeader
        title="User management"
        description="Manage onboarding approvals, role/staff group allocation, and lifecycle status for user accounts."
      />

      <Stack>
        <Card>
          <h2 className="text-lg font-semibold text-zinc-950">Pending users</h2>
          <p className="mt-1 text-sm text-zinc-600">Approve onboarding requests, assign role and staff group, or disable pending users.</p>
          <p className="mt-3 text-sm text-zinc-700">{pendingUsers.length} pending</p>
          <Link className="mt-3 inline-flex rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-900 shadow-sm hover:bg-zinc-50" href="/admin/users/pending">
            Open pending workflow
          </Link>
        </Card>

        <Card>
          <h2 className="text-lg font-semibold text-zinc-950">Manage approved and disabled users</h2>
          <p className="mt-1 text-sm text-zinc-600">Update roles or staff groups, disable approved users, and reactivate disabled users.</p>
          <p className="mt-3 text-sm text-zinc-700">{approvedUsers.length} approved · {disabledUsers.length} disabled</p>
          <Link className="mt-3 inline-flex rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-900 shadow-sm hover:bg-zinc-50" href="/admin/users/manage">
            Open user lifecycle management
          </Link>
        </Card>
      </Stack>
    </PageContainer>
  );
}
