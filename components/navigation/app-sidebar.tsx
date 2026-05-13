"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ResolvedAppNavItem, ResolvedAppNavSection } from "@/lib/navigation";
import { cn } from "@/src/lib/utils";

type AppSidebarProps = {
  className?: string;
  navigationSections: ResolvedAppNavSection[];
  onNavigate?: () => void;
};

export function AppSidebar({ className, navigationSections, onNavigate }: AppSidebarProps) {
  const pathname = usePathname();

  return (
    <aside className={cn("border-zinc-200 bg-white text-zinc-900", className)}>
      <div className="relative flex h-full min-h-0 flex-col overflow-hidden">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-10 top-16 h-24 w-24 rotate-45 rounded-md bg-[var(--he-yellow)]/10"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -left-12 bottom-24 h-20 w-20 rotate-45 border border-[var(--he-yellow)]/25"
        />

        <SidebarBrandHeader />

        <nav aria-label="Primary" className="relative z-10 flex-1 space-y-6 overflow-y-auto p-4">
          {navigationSections.map((section) => (
            <SidebarNavSection key={section.label} section={section} pathname={pathname} onNavigate={onNavigate} />
          ))}
        </nav>

        <SidebarBrandFooter />
      </div>
    </aside>
  );
}

function SidebarBrandHeader() {
  return (
    <div className="relative z-10 border-b border-[var(--he-border)] bg-white/95 px-4 py-5">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-[var(--he-border)] bg-white shadow-sm">
          <Image
            src="/brand/he-operations-logo.svg"
            alt="Hector Egger Operations Platform"
            width={40}
            height={40}
            className="h-9 w-9 object-contain"
            priority
          />
        </div>
        <div className="min-w-0">
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-[var(--he-muted)]">
            Hector Egger
          </p>
          <p className="truncate text-sm font-semibold leading-5 text-[var(--he-charcoal)]">Operations Platform</p>
        </div>
      </div>
      <div className="mt-4 h-1 w-16 rounded-full bg-[var(--he-yellow)]" aria-hidden="true" />
    </div>
  );
}

type SidebarNavSectionProps = {
  section: ResolvedAppNavSection;
  pathname: string;
  onNavigate?: () => void;
};

function SidebarNavSection({ section, pathname, onNavigate }: SidebarNavSectionProps) {
  return (
    <div className="space-y-1.5">
      {section.label !== "Main" ? (
        <p className="px-3 text-xs font-semibold uppercase tracking-wide text-[var(--he-muted)]">{section.label}</p>
      ) : null}
      {section.items.map((item) => (
        <SidebarNavItem key={item.href} item={item} isActive={!item.disabled && pathname === item.href} onNavigate={onNavigate} />
      ))}
    </div>
  );
}

type SidebarNavItemProps = {
  item: ResolvedAppNavItem;
  isActive: boolean;
  onNavigate?: () => void;
};

function SidebarNavItem({ item, isActive, onNavigate }: SidebarNavItemProps) {
  if (item.disabled) {
    return (
      <button
        type="button"
        disabled
        aria-disabled="true"
        title={`${item.label} is locked for your role`}
        className="flex min-h-10 w-full cursor-not-allowed items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm font-medium text-zinc-400"
      >
        <span>{item.label}</span>
        {item.locked ? <span aria-hidden="true">🔒</span> : null}
      </button>
    );
  }

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={cn(
        "group relative block min-h-10 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--he-yellow)]",
        isActive
          ? "bg-[var(--he-charcoal)] text-white shadow-sm"
          : "text-zinc-700 hover:bg-zinc-100 hover:text-[var(--he-black)]",
      )}
      aria-current={isActive ? "page" : undefined}
    >
      <span
        aria-hidden="true"
        className={cn(
          "absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full transition-colors",
          isActive ? "bg-[var(--he-yellow)]" : "bg-transparent group-hover:bg-[var(--he-yellow)]/50",
        )}
      />
      <span className="relative">{item.label}</span>
    </Link>
  );
}

function SidebarBrandFooter() {
  return (
    <div className="relative z-10 mt-auto border-t border-[var(--he-border)] bg-white/95 p-4">
      <div className="rounded-xl border border-[var(--he-border)] bg-zinc-50/80 p-3">
        <div aria-hidden="true" className="flex justify-center">
          <Image
            src="/brand/he-footer-signature.svg"
            alt=""
            width={128}
            height={128}
            className="h-12 w-auto object-contain opacity-90"
          />
        </div>
        <p className="mt-2 text-center text-[0.68rem] font-medium uppercase tracking-[0.16em] text-[var(--he-muted)]">
          Built for operations
        </p>
      </div>
    </div>
  );
}
