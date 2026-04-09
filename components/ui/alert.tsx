import type { HTMLAttributes } from "react";
import { cn } from "@/src/lib/utils";

type AlertVariant = "success" | "error" | "warning" | "info";

type AlertProps = HTMLAttributes<HTMLDivElement> & {
  variant?: AlertVariant;
};

const variantClasses: Record<AlertVariant, string> = {
  success: "border-emerald-200 bg-emerald-50 text-emerald-800",
  error: "border-red-200 bg-red-50 text-red-700",
  warning: "border-amber-200 bg-amber-50 text-amber-800",
  info: "border-sky-200 bg-sky-50 text-sky-800",
};

export function Alert({ className, variant = "info", ...props }: AlertProps) {
  return (
    <div
      className={cn("rounded-md border px-3 py-2 text-sm", variantClasses[variant], className)}
      role="status"
      {...props}
    />
  );
}
