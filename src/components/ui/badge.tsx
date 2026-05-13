import type { HTMLAttributes } from "react";
import { cn } from "@/src/lib/utils";

export type BadgeVariant =
  | "neutral"
  | "muted"
  | "outline"
  | "brand"
  | "attention"
  | "info"
  | "warning"
  | "accent"
  | "success"
  | "danger";

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  variant?: BadgeVariant;
};

const variantClassNames: Record<BadgeVariant, string> = {
  neutral: "bg-zinc-100 text-zinc-700 ring-1 ring-zinc-200/70",
  muted: "bg-white text-zinc-600 ring-1 ring-zinc-200",
  outline: "bg-white text-zinc-800 ring-1 ring-zinc-300",
  brand: "bg-[var(--he-charcoal)] text-white ring-1 ring-[var(--he-charcoal)]",
  attention: "bg-[var(--he-yellow)]/20 text-zinc-950 ring-1 ring-[var(--he-yellow)]/60",
  info: "bg-slate-100 text-slate-800 ring-1 ring-slate-200",
  warning: "bg-amber-100 text-amber-900 ring-1 ring-amber-200",
  accent: "bg-[var(--he-yellow)]/20 text-zinc-950 ring-1 ring-[var(--he-yellow)]/60",
  success: "bg-green-100 text-green-800 ring-1 ring-green-200",
  danger: "bg-red-100 text-red-800 ring-1 ring-red-200",
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
