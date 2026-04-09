import type { HTMLAttributes } from "react";
import { cn } from "@/src/lib/utils";

type PageHeaderProps = HTMLAttributes<HTMLDivElement> & {
  title: string;
  description?: string;
};

export function PageHeader({ className, title, description, children, ...props }: PageHeaderProps) {
  return (
    <div className={cn("space-y-1", className)} {...props}>
      <h2 className="text-base font-semibold text-zinc-900">{title}</h2>
      {description ? <p className="text-zinc-600">{description}</p> : null}
      {children}
    </div>
  );
}
