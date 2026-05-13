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
    <div className="relative z-10 aspect-square w-full overflow-hidden">
      <Image
        src="/brand/he-operations-logo.svg"
        alt="Hector Egger Operations Platform"
        fill
        className="object-contain"
      />
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
    <div className="relative z-10 aspect-square w-full overflow-hidden">
      <Image
        src="/brand/he-footer-signature.svg"
        alt=""
        fill
        className="object-cover opacity-90"
      />
    </div>
  );
}
