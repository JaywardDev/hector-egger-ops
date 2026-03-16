import { AppSidebar } from "@/components/navigation/app-sidebar";

type AppShellProps = {
  children: React.ReactNode;
};

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="flex min-h-screen bg-zinc-50 text-zinc-900">
      <AppSidebar />
      <div className="flex min-h-screen flex-1 flex-col">
        <header className="flex h-16 items-center justify-between border-b border-zinc-200 bg-white px-6">
          <div>
            <p className="text-xs uppercase tracking-wide text-zinc-500">Hector Egger Ops</p>
            <h1 className="text-sm font-semibold">Operations Platform</h1>
          </div>
          <div className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-sm text-zinc-600">
            User/session placeholder
          </div>
        </header>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
