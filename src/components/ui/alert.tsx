import type { HTMLAttributes } from "react";
import { cn } from "@/src/lib/utils";

type AlertVariant = "success" | "error" | "info";

type AlertProps = HTMLAttributes<HTMLParagraphElement> & {
  variant?: AlertVariant;
};

const variantClassNames: Record<AlertVariant, string> = {
  success: "border-emerald-200 bg-emerald-50 text-emerald-800",
  error: "border-red-200 bg-red-50 text-red-700",
  info: "border-zinc-200 bg-zinc-50 text-zinc-700",
};

export function Alert({ className, variant = "info", ...props }: AlertProps) {
  return (
    <p
      className={cn(
        "rounded-md border px-3 py-2 text-sm",
        variantClassNames[variant],
        className,
      )}
      {...props}
    />
  );
}
