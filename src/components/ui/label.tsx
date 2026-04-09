import type { LabelHTMLAttributes } from "react";
import { cn } from "@/src/lib/utils";

type LabelProps = LabelHTMLAttributes<HTMLLabelElement>;

export function Label({ className, ...props }: LabelProps) {
  return (
    <label
      className={cn(
        "text-xs font-medium uppercase tracking-wide text-zinc-500",
        className,
      )}
      {...props}
    />
  );
}
