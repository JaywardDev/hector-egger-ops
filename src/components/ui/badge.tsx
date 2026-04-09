import type { HTMLAttributes } from "react";
import { cn } from "@/src/lib/utils";

type BadgeVariant = "neutral" | "info" | "warning" | "accent" | "success";

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  variant?: BadgeVariant;
};

const variantClassNames: Record<BadgeVariant, string> = {
  neutral: "bg-zinc-100 text-zinc-700",
  info: "bg-blue-100 text-blue-800",
  warning: "bg-amber-100 text-amber-800",
  accent: "bg-violet-100 text-violet-800",
  success: "bg-emerald-100 text-emerald-800",
};

export function Badge({ className, variant = "neutral", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex rounded-md px-2 py-1 text-xs font-medium",
        variantClassNames[variant],
        className,
      )}
      {...props}
    />
  );
}
