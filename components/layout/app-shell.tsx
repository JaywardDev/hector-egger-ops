"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, LogOut } from "lucide-react";
import { AppSidebar } from "@/components/navigation/app-sidebar";
import { PendingSubmitButton } from "@/src/components/ui/pending-button";
import { FullScreenPendingOverlay } from "@/src/components/ui/pending-overlay";
import { getNavigationSections } from "@/lib/navigation";
import type { AccountAccessState } from "@/src/lib/auth/access-state";
import type { ProfileRecord } from "@/src/lib/auth/profile-access";
import type { AuthSession } from "@/src/lib/auth/session";
import type { AppRole } from "@/src/lib/auth/profile-access";

type AppShellProps = {
  children: React.ReactNode;
  session: AuthSession | null;
  profile: ProfileRecord | null;
  accessState: AccountAccessState;
  roles: AppRole[];
  signOutAction?: string | null;
};

export function AppShell({
  children,
  session,
  profile,
  accessState,
  roles,
  signOutAction = "/auth/sign-out",
}: AppShellProps) {
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [isMobileNavVisible, setIsMobileNavVisible] = useState(false);
  const closeTimerRef = useRef<number | null>(null);
  const openFrameRef = useRef<number | null>(null);
  const navigationSections = getNavigationSections({ accessState, roles });

  const openMobileNav = () => {
    if (openFrameRef.current !== null) {
      window.cancelAnimationFrame(openFrameRef.current);
      openFrameRef.current = null;
    }
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    setIsMobileNavOpen(false);
    setIsMobileNavVisible(true);
    openFrameRef.current = window.requestAnimationFrame(() => {
      setIsMobileNavOpen(true);
      openFrameRef.current = null;
    });
  };

  const closeMobileNav = () => {
    setIsMobileNavOpen(false);
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
    }
    closeTimerRef.current = window.setTimeout(() => {
      setIsMobileNavVisible(false);
      closeTimerRef.current = null;
    }, 200);
  };

  useEffect(() => {
    if (!isMobileNavVisible) {
      return;
    }

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isMobileNavVisible]);

  useEffect(() => {
    return () => {
      if (openFrameRef.current !== null) {
        window.cancelAnimationFrame(openFrameRef.current);
      }
      if (closeTimerRef.current !== null) {
        window.clearTimeout(closeTimerRef.current);
      }
    };
  }, []);

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 md:flex">
      <AppSidebar className="hidden w-64 shrink-0 border-r md:block" navigationSections={navigationSections} />

      <div className="flex min-h-screen flex-1 flex-col">
        <header className="flex h-16 items-center justify-between border-b border-zinc-200 bg-white px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={openMobileNav}
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
              <p className="text-xs uppercase tracking-wide text-zinc-500">Hector Egger NZ</p>
              <h1 className="text-sm font-semibold">Operations Platform</h1>
            </div>
          </div>

          <div className="hidden items-center gap-3 md:flex">
            <AccountDisplay profile={profile} session={session} />
            <ShellSignOutControl signOutAction={signOutAction} />
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6">{children}</main>
      </div>

      {isMobileNavVisible ? (
        <div
          className="fixed inset-0 z-50 md:hidden"
          role="dialog"
          aria-modal="true"
          aria-labelledby="mobile-nav-title"
        >
          <button
            type="button"
            className={`absolute inset-0 bg-zinc-950/45 transition-opacity duration-200 ease-out motion-reduce:transition-none ${
              isMobileNavOpen ? "opacity-100" : "opacity-0"
            }`}
            aria-label="Close navigation menu"
            onClick={closeMobileNav}
          />
          <div
            id="mobile-navigation"
            className={`relative z-10 flex h-full w-80 max-w-[85vw] flex-col overflow-y-auto overscroll-contain border-r border-zinc-200 bg-white transition-transform duration-200 ease-out motion-reduce:transition-none ${
              isMobileNavOpen ? "translate-x-0" : "-translate-x-full"
            }`}
          >
            <h2 className="sr-only" id="mobile-nav-title">
              Navigation
            </h2>

            <AppSidebar
              className="min-h-0 shrink-0"
              layout="mobile"
              navigationSections={navigationSections}
              onNavigate={closeMobileNav}
            />

            <div className="shrink-0 space-y-3 border-t border-zinc-200 p-4">
              <AccountDisplay profile={profile} session={session} />
              <ShellSignOutControl signOutAction={signOutAction} isMobile />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function AccountDisplay({ profile, session }: { profile: ProfileRecord | null; session: AuthSession | null }) {
  const fullName = [profile?.first_name, profile?.last_name].filter(Boolean).join(" ").trim();
  const displayName = fullName || profile?.full_name?.trim() || session?.user.email ?? "No active user";

  return (
    <div className="inline-flex items-center gap-2 text-sm text-zinc-600" aria-label={`Signed in as ${displayName}`}>
      <CheckCircle2 aria-hidden="true" className="h-4 w-4 text-zinc-400" />
      <p className="max-w-48 truncate">{displayName}</p>
    </div>
  );
}

type ShellSignOutControlProps = {
  isMobile?: boolean;
  signOutAction: string | null;
};

function ShellSignOutControl({ isMobile = false, signOutAction }: ShellSignOutControlProps) {
  const className = isMobile
    ? "inline-flex h-10 w-10 items-center justify-center rounded-md text-zinc-700 transition-colors hover:bg-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--he-yellow)]"
    : "inline-flex h-9 w-9 items-center justify-center rounded-md text-zinc-700 transition-colors hover:bg-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--he-yellow)]";

  if (!signOutAction) {
    return (
      <button type="button" disabled className={className} aria-label="Preview mode">
        <LogOut aria-hidden="true" className="h-4 w-4" />
      </button>
    );
  }

  return (
    <form action={signOutAction} method="post">
      <PendingSubmitButton type="submit" aria-label="Sign out" className={className} pendingLabel="Signing out…">
        <LogOut aria-hidden="true" className="h-4 w-4" />
      </PendingSubmitButton>
      <FullScreenPendingOverlay
        message="Signing out…"
        description="Closing your secure session and returning you to sign in."
      />
    </form>
  );
}
