"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { LogOut, Settings } from "@/components/icons/lucide-react";
import { AppSidebar } from "@/components/navigation/app-sidebar";
import { Avatar } from "@/src/components/ui/avatar";
import { cn } from "@/src/lib/utils";
import { getNavigationSections } from "@/lib/navigation";
import type { AccountAccessState } from "@/src/lib/auth/access-state";
import type { ProfileRecord } from "@/src/lib/auth/profile-access";
import type { AuthSession } from "@/src/lib/auth/session";
import type { AppRole } from "@/src/lib/auth/profile-access";

type AppShellProps = {
  children: React.ReactNode;
  session: AuthSession | null;
  profile?: ProfileRecord | null;
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

  // Show an attention badge on the avatar when the account needs follow-up:
  // an incomplete profile / pending approval / disabled state, or an approved
  // non-admin still waiting on an admin to assign their staff group.
  const isPrivileged = roles.includes("admin") || roles.includes("initial-admin");
  const accountNeedsAttention =
    accessState !== "approved" || (!isPrivileged && !profile?.staff_group);

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

          <div className="hidden items-center gap-2 md:flex">
            <AccountMenu profile={profile} session={session} signOutAction={signOutAction} needsAttention={accountNeedsAttention} />
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

            <div className="shrink-0 border-t border-zinc-200 p-4">
              <AccountMenu profile={profile} session={session} signOutAction={signOutAction} needsAttention={accountNeedsAttention} openUp />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function AvatarWithBadge({
  profile,
  name,
  size,
  needsAttention,
  badgeSize,
}: {
  profile: ProfileRecord;
  name: string;
  size: number;
  needsAttention: boolean;
  badgeSize: number;
}) {
  return (
    <span className="relative inline-flex shrink-0">
      <Avatar profileId={profile.id} name={name} hasAvatar={Boolean(profile.avatar_path)} size={size} />
      {needsAttention ? (
        <span
          className="absolute -right-0.5 -top-0.5 inline-flex items-center justify-center rounded-full bg-red-500 font-bold leading-none text-white ring-2 ring-white"
          style={{ width: badgeSize, height: badgeSize, fontSize: Math.round(badgeSize * 0.7) }}
          aria-hidden="true"
        >
          !
        </span>
      ) : null}
    </span>
  );
}

function AccountMenu({
  profile,
  session,
  signOutAction,
  needsAttention = false,
  openUp = false,
}: {
  profile?: ProfileRecord | null;
  session: AuthSession | null;
  signOutAction: string | null;
  needsAttention?: boolean;
  openUp?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const firstName = profile?.first_name?.trim() ?? "";
  const lastName = profile?.last_name?.trim() ?? "";
  const shortName = firstName && lastName ? `${firstName} ${lastName.charAt(0)}.` : "";
  const fullName = profile?.full_name?.trim() || session?.user.email?.trim() || "Account";
  const displayName = shortName || fullName;
  const email = session?.user.email?.trim() ?? profile?.email?.trim() ?? "";

  const menuItemClass =
    "flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm text-zinc-700 transition-colors hover:bg-zinc-100 hover:text-zinc-900";

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="inline-flex min-w-0 items-center gap-2 rounded-md px-1.5 py-1 text-sm text-zinc-700 transition-colors hover:bg-zinc-100 hover:text-zinc-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--he-yellow)]"
      >
        {profile ? (
          <AvatarWithBadge profile={profile} name={fullName} size={28} needsAttention={needsAttention} badgeSize={14} />
        ) : null}
        <span className="max-w-40 truncate">{displayName}</span>
        <span aria-hidden="true" className="text-xs text-zinc-400">▾</span>
      </button>

      {open ? (
        <div
          role="menu"
          className={cn(
            "absolute right-0 z-50 w-60 rounded-lg border border-zinc-200 bg-white p-1 shadow-lg",
            openUp ? "bottom-full mb-2" : "top-full mt-2",
          )}
        >
          <div className="flex items-center gap-2 px-2 py-2">
            {profile ? (
              <AvatarWithBadge profile={profile} name={fullName} size={36} needsAttention={needsAttention} badgeSize={16} />
            ) : null}
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-zinc-900">{fullName}</p>
              {email ? <p className="truncate text-xs text-zinc-500">{email}</p> : null}
            </div>
          </div>

          {needsAttention ? (
            <p className="px-2 pb-1 text-xs text-red-600">Your account needs attention. Open profile &amp; settings to review.</p>
          ) : null}

          <div className="my-1 h-px bg-zinc-100" />

          <Link href="/settings" role="menuitem" className={menuItemClass} onClick={() => setOpen(false)}>
            <Settings aria-hidden="true" className="h-4 w-4" />
            Profile &amp; settings
          </Link>

          {signOutAction ? (
            <form action={signOutAction} method="post">
              <button type="submit" role="menuitem" className={menuItemClass}>
                <LogOut aria-hidden="true" className="h-4 w-4" />
                Sign out
              </button>
            </form>
          ) : (
            <button type="button" role="menuitem" disabled className={cn(menuItemClass, "opacity-50")}>
              <LogOut aria-hidden="true" className="h-4 w-4" />
              Sign out
            </button>
          )}
        </div>
      ) : null}
    </div>
  );
}
