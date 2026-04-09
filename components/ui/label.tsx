import type { LabelHTMLAttributes } from "react";
import { cn } from "@/src/lib/utils";

type LabelProps = LabelHTMLAttributes<HTMLLabelElement>;

export function Label({ className, ...props }: LabelProps) {
  return <label className={cn("text-sm font-medium text-zinc-700", className)} {...props} />;
}
