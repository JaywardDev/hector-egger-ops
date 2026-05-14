"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ResolvedAppNavItem, ResolvedAppNavSection } from "@/lib/navigation";
import { cn } from "@/src/lib/utils";

type AppSidebarLayout = "desktop" | "mobile";

type AppSidebarProps = {
  className?: string;
  layout?: AppSidebarLayout;
  navigationSections: ResolvedAppNavSection[];
  onNavigate?: () => void;
};

export function AppSidebar({ className, layout = "desktop", navigationSections, onNavigate }: AppSidebarProps) {
  const pathname = usePathname();
  const isMobileLayout = layout === "mobile";

  return (
    <aside className={cn("border-zinc-200 bg-white text-zinc-900", isMobileLayout && "min-h-0", className)}>
      <div
        className={cn(
          "relative flex min-h-0 flex-col",
          isMobileLayout ? "overflow-visible" : "h-full overflow-hidden",
        )}
      >
        <SidebarBrandHeader layout={layout} />

        <nav
          aria-label="Primary"
          className={cn(
            "relative z-10 space-y-6 p-4",
            isMobileLayout ? "min-h-0 pt-2 -mt-4" : "flex-1 overflow-y-auto -mt-12",
          )}
        >
          {navigationSections.map((section) => (
            <SidebarNavSection key={section.label} section={section} pathname={pathname} onNavigate={onNavigate} />
          ))}
        </nav>

        <SidebarBrandFooter />
      </div>
    </aside>
  );
}

function SidebarBrandHeader({ layout }: { layout: AppSidebarLayout }) {
  return (
    <div className={cn("relative z-10 w-full overflow-hidden", layout === "mobile" ? "h-36 shrink-0" : "aspect-square")}>
      <Image
        src="/brand/he-operations-logo.svg"
        alt="Hector Egger Operations Platform"
        priority
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
  const Icon = item.icon;

  if (item.disabled) {
    return (
      <button
        type="button"
        disabled
        aria-disabled="true"
        title={`${item.label} is locked for your role`}
        className="flex min-h-10 w-full cursor-not-allowed items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm font-medium text-zinc-400"
      >
        <span className="flex items-center gap-3">
          <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
          <span>{item.label}</span>
        </span>
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
      <span className="relative flex items-center gap-3">
        <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
        <span>{item.label}</span>
      </span>
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
