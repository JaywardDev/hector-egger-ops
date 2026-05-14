"use client";

import { useEffect, useState } from "react";
import { AppSidebar } from "@/components/navigation/app-sidebar";
import { PendingSubmitButton } from "@/src/components/ui/pending-button";
import { FullScreenPendingOverlay } from "@/src/components/ui/pending-overlay";
import { getNavigationSections } from "@/lib/navigation";
import type { AccountAccessState } from "@/src/lib/auth/access-state";
import type { AuthSession } from "@/src/lib/auth/session";
import type { AppRole } from "@/src/lib/auth/profile-access";

type AppShellProps = {
  children: React.ReactNode;
  session: AuthSession | null;
  accessState: AccountAccessState;
  roles: AppRole[];
  signOutAction?: string | null;
};

export function AppShell({
  children,
  session,
  accessState,
  roles,
  signOutAction = "/auth/sign-out",
}: AppShellProps) {
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const navigationSections = getNavigationSections({ accessState, roles });

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
      <AppSidebar className="hidden w-64 shrink-0 border-r md:block" navigationSections={navigationSections} />

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
            <ShellSignOutControl signOutAction={signOutAction} />
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
            className="relative z-10 flex h-full w-80 max-w-[85vw] flex-col overflow-y-auto overscroll-contain border-r border-zinc-200 bg-white"
          >
            <div className="shrink-0 flex items-center justify-between border-b border-zinc-200 px-4 py-3">
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

            <AppSidebar
              className="min-h-0 shrink-0"
              layout="mobile"
              navigationSections={navigationSections}
              onNavigate={() => setIsMobileNavOpen(false)}
            />

            <div className="shrink-0 space-y-3 border-t border-zinc-200 p-4">
              <div className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-600">
                <p className="break-all">{session?.user.email ?? "No active user"}</p>
                <p className="text-xs text-zinc-500">{accessState}</p>
              </div>
              <ShellSignOutControl signOutAction={signOutAction} isMobile />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

type ShellSignOutControlProps = {
  isMobile?: boolean;
  signOutAction: string | null;
};

function ShellSignOutControl({ isMobile = false, signOutAction }: ShellSignOutControlProps) {
  const className = isMobile
    ? "w-full rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700"
    : "rounded-md border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700";

  if (!signOutAction) {
    return (
      <button type="button" disabled className={className}>
        Preview mode
      </button>
    );
  }

  return (
    <form action={signOutAction} method="post">
      <PendingSubmitButton type="submit" className={className} pendingLabel="Signing out…">
        Sign out
      </PendingSubmitButton>
      <FullScreenPendingOverlay
        message="Signing out…"
        description="Closing your secure session and returning you to sign in."
      />
    </form>
  );
}
