import { AppSidebar } from "@/components/navigation/app-sidebar";
import type { AccountAccessState } from "@/src/lib/auth/access-state";
import type { AuthSession } from "@/src/lib/auth/session";

type AppShellProps = {
  children: React.ReactNode;
  session: AuthSession | null;
  accessState: AccountAccessState;
};

export function AppShell({ children, session, accessState }: AppShellProps) {
  return (
    <div className="flex min-h-screen bg-zinc-50 text-zinc-900">
      <AppSidebar />
      <div className="flex min-h-screen flex-1 flex-col">
        <header className="flex h-16 items-center justify-between border-b border-zinc-200 bg-white px-6">
          <div>
            <p className="text-xs uppercase tracking-wide text-zinc-500">Hector Egger Ops</p>
            <h1 className="text-sm font-semibold">Operations Platform</h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-sm text-zinc-600">
              <p>{session?.user.email ?? "No active user"}</p>
              <p className="text-xs text-zinc-500">{accessState}</p>
            </div>
            <form action="/auth/sign-out" method="post">
              <button
                type="submit"
                className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700"
              >
                Sign out
              </button>
            </form>
          </div>
        </header>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
