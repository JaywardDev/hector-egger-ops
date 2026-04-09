import type { HTMLAttributes } from "react";
import { cn } from "@/src/lib/utils";

type FormFieldProps = HTMLAttributes<HTMLDivElement>;

export function FormField({ className, ...props }: FormFieldProps) {
  return <div className={cn("space-y-1", className)} {...props} />;
}

export function FormHelperText({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-xs text-zinc-600", className)} {...props} />;
}

export function FormErrorText({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-xs text-red-700", className)} {...props} />;
}
