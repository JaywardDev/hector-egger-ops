import type { HTMLAttributes } from "react";
import { cn } from "@/src/lib/utils";

type SectionHeaderProps = HTMLAttributes<HTMLDivElement> & {
  title: string;
  description?: string;
};

export function SectionHeader({ className, title, description, ...props }: SectionHeaderProps) {
  return (
    <div className={cn("space-y-1", className)} {...props}>
      <h3 className="font-medium text-zinc-900">{title}</h3>
      {description ? <p className="text-zinc-600">{description}</p> : null}
    </div>
  );
}
