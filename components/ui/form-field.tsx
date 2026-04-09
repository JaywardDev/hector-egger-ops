import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/src/lib/utils";
import { Label } from "@/components/ui/label";

type FormFieldProps = {
  label: string;
  htmlFor?: string;
  helperText?: string;
  errorText?: string;
  children: ReactNode;
  className?: string;
};

export function FormField({
  label,
  htmlFor,
  helperText,
  errorText,
  children,
  className,
}: FormFieldProps) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {helperText ? <FormHelperText>{helperText}</FormHelperText> : null}
      {errorText ? <FormErrorText>{errorText}</FormErrorText> : null}
    </div>
  );
}

export function FormHelperText({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-xs text-zinc-500", className)} {...props} />;
}

export function FormErrorText({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-sm text-red-600", className)} role="alert" {...props} />;
}
