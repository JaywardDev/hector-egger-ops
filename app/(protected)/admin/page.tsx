import { approvePendingUserAction, disablePendingUserAction } from "@/app/(protected)/admin/actions";
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
    <section className="space-y-4 text-sm text-zinc-700">
      <div>
        <h2 className="text-base font-semibold text-zinc-900">Pending user approvals</h2>
        <p className="text-zinc-600">Approve or disable pending access requests.</p>
      </div>

      {params.success ? (
        <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-800">{params.success}</p>
      ) : null}
      {params.error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-red-700">{params.error}</p>
      ) : null}

      {pendingUsers.length === 0 ? (
        <p className="rounded-md border border-zinc-200 bg-white px-3 py-3">No pending users.</p>
      ) : (
        <ul className="space-y-3">
          {pendingUsers.map((user) => (
            <li key={user.id} className="rounded-md border border-zinc-200 bg-white p-3">
              <div className="mb-3">
                <p className="font-medium text-zinc-900">{user.full_name ?? "Unnamed user"}</p>
                <p className="text-zinc-600">{user.email}</p>
                <p className="text-xs text-zinc-500">Requested: {new Date(user.created_at).toLocaleString()}</p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <form action={approvePendingUserAction} className="flex flex-wrap items-center gap-2">
                  <input type="hidden" name="profileId" value={user.id} />
                  <label htmlFor={`role-${user.id}`} className="text-xs text-zinc-600">
                    Role
                  </label>
                  <select
                    id={`role-${user.id}`}
                    name="role"
                    defaultValue="operator"
                    className="rounded-md border border-zinc-300 bg-white px-2 py-1"
                  >
                    <option value="operator">operator</option>
                    <option value="supervisor">supervisor</option>
                    <option value="admin">admin</option>
                  </select>
                  <button
                    type="submit"
                    className="rounded-md border border-zinc-300 px-3 py-1.5 text-zinc-800 hover:bg-zinc-100"
                  >
                    Approve
                  </button>
                </form>

                <form action={disablePendingUserAction}>
                  <input type="hidden" name="profileId" value={user.id} />
                  <button
                    type="submit"
                    className="rounded-md border border-zinc-300 px-3 py-1.5 text-zinc-800 hover:bg-zinc-100"
                  >
                    Disable
                  </button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
