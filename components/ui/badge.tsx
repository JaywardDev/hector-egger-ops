import type { HTMLAttributes } from "react";
import { cn } from "@/src/lib/utils";

type BadgeVariant = "neutral" | "success" | "warning" | "danger" | "info";

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  variant?: BadgeVariant;
};

const variantClasses: Record<BadgeVariant, string> = {
  neutral: "border-zinc-300 bg-zinc-100 text-zinc-700",
  success: "border-emerald-300 bg-emerald-100 text-emerald-800",
  warning: "border-amber-300 bg-amber-100 text-amber-800",
  danger: "border-red-300 bg-red-100 text-red-800",
  info: "border-sky-300 bg-sky-100 text-sky-800",
};

export function Badge({ className, variant = "neutral", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
        variantClasses[variant],
        className,
      )}
      {...props}
    />
  );
}
