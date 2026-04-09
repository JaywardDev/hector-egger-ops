"use client";

import { useEffect, useState } from "react";
import { AppSidebar } from "@/components/navigation/app-sidebar";
import type { AccountAccessState } from "@/src/lib/auth/access-state";
import type { AuthSession } from "@/src/lib/auth/session";

type AppShellProps = {
  children: React.ReactNode;
  session: AuthSession | null;
  accessState: AccountAccessState;
};

export function AppShell({ children, session, accessState }: AppShellProps) {
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  useEffect(() => {
    if (!isMobileNavOpen) {
      return;
    }

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isMobileNavOpen]);

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 md:flex">
      <AppSidebar className="hidden w-64 shrink-0 border-r md:block" />

      <div className="flex min-h-screen flex-1 flex-col">
        <header className="flex h-16 items-center justify-between border-b border-zinc-200 bg-white px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsMobileNavOpen(true)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-zinc-300 text-zinc-700 md:hidden"
              aria-label="Open navigation menu"
              aria-expanded={isMobileNavOpen}
              aria-controls="mobile-navigation"
            >
              <span aria-hidden="true" className="text-lg leading-none">
                ☰
              </span>
            </button>
            <div>
              <p className="text-xs uppercase tracking-wide text-zinc-500">Hector Egger Ops</p>
              <h1 className="text-sm font-semibold">Operations Platform</h1>
            </div>
          </div>

          <div className="hidden items-center gap-3 md:flex">
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

        <main className="flex-1 p-4 sm:p-6">{children}</main>
      </div>

      {isMobileNavOpen ? (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true" aria-labelledby="mobile-nav-title">
          <button
            type="button"
            className="absolute inset-0 bg-zinc-950/45"
            aria-label="Close navigation menu"
            onClick={() => setIsMobileNavOpen(false)}
          />
          <div
            id="mobile-navigation"
            className="relative z-10 flex h-full w-80 max-w-[85vw] flex-col border-r border-zinc-200 bg-white"
          >
            <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
              <h2 id="mobile-nav-title" className="text-sm font-semibold text-zinc-900">
                Navigation
              </h2>
              <button
                type="button"
                onClick={() => setIsMobileNavOpen(false)}
                className="rounded-md border border-zinc-300 px-2 py-1 text-sm text-zinc-700"
                aria-label="Close navigation menu"
              >
                Close
              </button>
            </div>

            <AppSidebar className="flex-1 overflow-y-auto" onNavigate={() => setIsMobileNavOpen(false)} />

            <div className="space-y-3 border-t border-zinc-200 p-4">
              <div className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-600">
                <p className="break-all">{session?.user.email ?? "No active user"}</p>
                <p className="text-xs text-zinc-500">{accessState}</p>
              </div>
              <form action="/auth/sign-out" method="post">
                <button
                  type="submit"
                  className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700"
                >
                  Sign out
                </button>
              </form>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
