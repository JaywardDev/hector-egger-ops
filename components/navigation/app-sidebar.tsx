"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ResolvedAppNavSection } from "@/lib/navigation";
import { cn } from "@/src/lib/utils";

type AppSidebarProps = {
  className?: string;
  navigationSections: ResolvedAppNavSection[];
  onNavigate?: () => void;
};

export function AppSidebar({ className, navigationSections, onNavigate }: AppSidebarProps) {
  const pathname = usePathname();

  return (
    <aside className={cn("border-zinc-200 bg-white", className)}>
      <nav aria-label="Primary" className="space-y-5 p-4">
        {navigationSections.map((section) => (
          <div key={section.label} className="space-y-1">
            {section.label !== "Main" ? (
              <p className="px-3 text-xs font-semibold uppercase tracking-wide text-zinc-400">
                {section.label}
              </p>
            ) : null}
            {section.items.map((item) => {
              const isActive = !item.disabled && pathname === item.href;

              if (item.disabled) {
                return (
                  <button
                    key={item.href}
                    type="button"
                    disabled
                    aria-disabled="true"
                    title={`${item.label} is locked for your role`}
                    className="flex w-full cursor-not-allowed items-center justify-between rounded-md px-3 py-2 text-left text-sm font-medium text-zinc-400"
                  >
                    <span>{item.label}</span>
                    {item.locked ? <span aria-hidden="true">🔒</span> : null}
                  </button>
                );
              }

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onNavigate}
                  className={cn(
                    "block rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-zinc-900 text-white"
                      : "text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900",
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
    </aside>
  );
}
