import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/src/lib/utils";

type PageHeaderProps = {
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
};

export function PageHeader({ title, description, actions, className }: PageHeaderProps) {
  return (
    <header className={cn("flex flex-wrap items-start justify-between gap-3", className)}>
      <div className="space-y-1">
        <h1 className="text-base font-semibold text-zinc-900">{title}</h1>
        {description ? <p className="text-sm text-zinc-600">{description}</p> : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </header>
  );
}

type SectionHeaderProps = HTMLAttributes<HTMLDivElement> & {
  title: string;
  description?: string;
  actions?: ReactNode;
};

export function SectionHeader({ title, description, actions, className, ...props }: SectionHeaderProps) {
  return (
    <div className={cn("flex flex-wrap items-start justify-between gap-3", className)} {...props}>
      <div className="space-y-1">
        <h2 className="font-medium text-zinc-900">{title}</h2>
        {description ? <p className="text-sm text-zinc-600">{description}</p> : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}
