import Link from "next/link";
import type { LucideIcon } from "@/components/icons/lucide-react";
import { cn } from "@/src/lib/utils";

type AdminToolCardProps = {
  href: string;
  title: string;
  description: string;
  icon: LucideIcon;
  /** Optional short tag rendered as an eyebrow, e.g. "Import". */
  tag?: string;
};

export function AdminToolCard({ href, title, description, icon: Icon, tag }: AdminToolCardProps) {
  return (
    <Link
      href={href}
      className={cn(
        "group relative flex gap-3 overflow-hidden rounded-lg border border-zinc-200 bg-white p-4 transition-colors",
        "hover:border-zinc-300 hover:bg-zinc-50",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--he-yellow)]",
      )}
    >
      <span
        aria-hidden="true"
        className="absolute left-0 top-0 h-full w-1 -translate-x-full bg-[var(--he-yellow)] transition-transform duration-200 ease-out group-hover:translate-x-0"
      />

      <span
        aria-hidden="true"
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-[var(--he-yellow)]/15 text-[var(--he-charcoal)] transition-colors group-hover:bg-[var(--he-yellow)]/30"
      >
        <Icon className="h-5 w-5" />
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex items-start justify-between gap-2">
          <span className="min-w-0">
            {tag ? (
              <span className="block text-[11px] font-semibold uppercase tracking-wide text-[var(--he-muted)]">
                {tag}
              </span>
            ) : null}
            <span className="block font-semibold text-zinc-900">{title}</span>
          </span>
          <span
            aria-hidden="true"
            className="shrink-0 text-zinc-300 transition-all duration-200 ease-out group-hover:translate-x-0.5 group-hover:text-[var(--he-charcoal)]"
          >
            →
          </span>
        </span>
        <span className="mt-1 block text-sm text-zinc-600">{description}</span>
      </span>
    </Link>
  );
}

type AdminToolSectionProps = {
  title: string;
  children: React.ReactNode;
};

export function AdminToolSection({ title, children }: AdminToolSectionProps) {
  return (
    <section className="space-y-2.5">
      <h2 className="px-0.5 text-xs font-semibold uppercase tracking-wide text-[var(--he-muted)]">{title}</h2>
      <div className="grid gap-3 sm:grid-cols-2">{children}</div>
    </section>
  );
}
