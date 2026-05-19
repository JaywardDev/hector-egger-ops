import { ApprovedUserCard, DisabledUserCard } from "@/app/(protected)/admin/_components/user-admin-cards";
import { AdminPageStatusMessage, EmptyUserSectionCard, UserSection } from "@/app/(protected)/admin/_components/user-admin-shared";
import { PageContainer } from "@/src/components/layout/page-container";
import { PageHeader } from "@/src/components/layout/page-header";
import { Stack } from "@/src/components/layout/stack";
import { listApprovedUsers, listDisabledUsers } from "@/src/lib/admin/user-approvals";
import { requireAdminAccess } from "@/src/lib/auth/guards";

type AdminManageUsersPageProps = {
  searchParams: Promise<{
    success?: string;
    error?: string;
  }>;
};

export default async function AdminManageUsersPage({ searchParams }: AdminManageUsersPageProps) {
  const { session } = await requireAdminAccess();
  const [approvedUsers, disabledUsers, params] = await Promise.all([
    listApprovedUsers({ session }),
    listDisabledUsers({ session }),
    searchParams,
  ]);

  return (
    <PageContainer>
      <PageHeader
        title="Manage users"
        description="Update roles and staff groups, disable approved users, and reactivate disabled users."
      />

      <AdminPageStatusMessage searchParams={params} />

      <Stack>
        <UserSection title="Approved users">
          {approvedUsers.length === 0 ? <EmptyUserSectionCard message="No approved users." /> : (
            <Stack>
              {approvedUsers.map((user) => <ApprovedUserCard key={user.id} user={user} />)}
            </Stack>
          )}
        </UserSection>

        <UserSection title="Disabled users">
          {disabledUsers.length === 0 ? <EmptyUserSectionCard message="No disabled users." /> : (
            <Stack>
              {disabledUsers.map((user) => <DisabledUserCard key={user.id} user={user} />)}
            </Stack>
          )}
        </UserSection>
      </Stack>
    </PageContainer>
  );
}
