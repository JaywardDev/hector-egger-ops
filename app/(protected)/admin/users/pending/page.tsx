import { PendingUserCard } from "@/app/(protected)/admin/_components/user-admin-cards";
import { AdminPageStatusMessage, EmptyUserSectionCard, UserSection } from "@/app/(protected)/admin/_components/user-admin-shared";
import { PageContainer } from "@/src/components/layout/page-container";
import { PageHeader } from "@/src/components/layout/page-header";
import { Stack } from "@/src/components/layout/stack";
import { listPendingUsers } from "@/src/lib/admin/user-approvals";
import { requireAdminAccess } from "@/src/lib/auth/guards";

type AdminPendingUsersPageProps = {
  searchParams: Promise<{
    success?: string;
    error?: string;
  }>;
};

export default async function AdminPendingUsersPage({ searchParams }: AdminPendingUsersPageProps) {
  const { session } = await requireAdminAccess();
  const [pendingUsers, params] = await Promise.all([
    listPendingUsers({ session }),
    searchParams,
  ]);

  return (
    <PageContainer>
      <PageHeader
        title="Pending user approvals"
        description="Approve pending access requests, assign role and staff group, or disable pending users."
      />

      <AdminPageStatusMessage searchParams={params} />

      <UserSection title="Pending users">
        {pendingUsers.length === 0 ? <EmptyUserSectionCard message="No pending users." /> : (
          <Stack>
            {pendingUsers.map((user) => <PendingUserCard key={user.id} user={user} />)}
          </Stack>
        )}
      </UserSection>
    </PageContainer>
  );
}
