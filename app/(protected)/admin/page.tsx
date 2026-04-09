import { approvePendingUserAction, disablePendingUserAction } from "@/app/(protected)/admin/actions";
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
import { listPendingUsers } from "@/src/lib/admin/user-approvals";
import { requireAdminAccess } from "@/src/lib/auth/guards";

type AdminPageProps = {
  searchParams: Promise<{
    success?: string;
    error?: string;
  }>;
};

export default async function AdminPage({ searchParams }: AdminPageProps) {
  const { session } = await requireAdminAccess();
  const [pendingUsers, params] = await Promise.all([
    listPendingUsers({ session }),
    searchParams,
  ]);

  return (
    <PageContainer>
      <PageHeader
        title="Pending user approvals"
        description="Approve or disable pending access requests."
      />

      {params.success ? <Alert variant="success">{params.success}</Alert> : null}
      {params.error ? <Alert variant="error">{params.error}</Alert> : null}

      {pendingUsers.length === 0 ? (
        <Card>No pending users.</Card>
      ) : (
        <Stack>
          {pendingUsers.map((user) => (
            <Card key={user.id}>
              <div className="mb-3">
                <p className="font-medium text-zinc-900">{user.full_name ?? "Unnamed user"}</p>
                <p className="text-zinc-600">{user.email}</p>
                <div className="mt-1 flex items-center gap-2">
                  <span className="text-xs text-zinc-500">Requested:</span>
                  <Badge>{new Date(user.created_at).toLocaleString()}</Badge>
                </div>
              </div>

              <div className="flex flex-wrap items-end gap-2">
                <form action={approvePendingUserAction} className="flex flex-wrap items-end gap-2">
                  <input type="hidden" name="profileId" value={user.id} />
                  <FormField>
                    <Label htmlFor={`role-${user.id}`}>Role</Label>
                    <Select id={`role-${user.id}`} name="role" defaultValue="operator" className="w-auto min-w-36">
                      <option value="operator">operator</option>
                      <option value="supervisor">supervisor</option>
                      <option value="admin">admin</option>
                    </Select>
                  </FormField>
                  <Button type="submit">Approve</Button>
                </form>

                <form action={disablePendingUserAction}>
                  <input type="hidden" name="profileId" value={user.id} />
                  <Button type="submit" variant="danger">Disable</Button>
                </form>
              </div>
            </Card>
          ))}
        </Stack>
      )}
    </PageContainer>
  );
}
