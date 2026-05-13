import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/src/lib/utils";

type PageHeaderProps = HTMLAttributes<HTMLDivElement> & {
  title: string;
  eyebrow?: ReactNode;
  description?: ReactNode;
  metadata?: ReactNode;
  actions?: ReactNode;
  accent?: boolean;
};

export function PageHeader({
  className,
  title,
  eyebrow,
  description,
  metadata,
  actions,
  accent = false,
  children,
  ...props
}: PageHeaderProps) {
  return (
    <div className={cn("relative", accent ? "pl-4" : null, className)} {...props}>
      {accent ? <span aria-hidden="true" className="absolute left-0 top-1 h-10 w-1 rounded-full bg-[var(--he-yellow)]" /> : null}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          {eyebrow ? <p className="text-xs font-semibold uppercase tracking-wide text-[var(--he-muted)]">{eyebrow}</p> : null}
          <h2 className="text-base font-semibold text-zinc-900">{title}</h2>
          {description ? <p className="text-zinc-600">{description}</p> : null}
          {metadata ? <div className="text-sm text-zinc-500">{metadata}</div> : null}
          {children}
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">{actions}</div> : null}
      </div>
    </div>
  );
}
