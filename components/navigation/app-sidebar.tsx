"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { APP_NAV_ITEMS } from "@/lib/navigation";
import { cn } from "@/src/lib/utils";

type AppSidebarProps = {
  className?: string;
  onNavigate?: () => void;
};

export function AppSidebar({ className, onNavigate }: AppSidebarProps) {
  const pathname = usePathname();

  return (
    <aside className={cn("border-zinc-200 bg-white", className)}>
      <nav aria-label="Primary" className="space-y-1 p-4">
        {APP_NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href;

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
      </nav>
    </aside>
  );
}
