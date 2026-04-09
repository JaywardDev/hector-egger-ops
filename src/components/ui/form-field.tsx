import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/src/lib/utils";
import { Label } from "@/src/components/ui/label";

type FormFieldProps = HTMLAttributes<HTMLDivElement> & {
  label?: string;
  htmlFor?: string;
  helperText?: string;
  errorText?: string;
  children?: ReactNode;
};

export function FormField({
  className,
  label,
  htmlFor,
  helperText,
  errorText,
  children,
  ...props
}: FormFieldProps) {
  return (
    <div className={cn("space-y-1", className)} {...props}>
      {label ? <Label htmlFor={htmlFor}>{label}</Label> : null}
      {children}
      {helperText ? <FormHelperText>{helperText}</FormHelperText> : null}
      {errorText ? <FormErrorText>{errorText}</FormErrorText> : null}
    </div>
  );
}

export function FormHelperText({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-xs text-zinc-600", className)} {...props} />;
}

export function FormErrorText({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-xs text-red-700", className)} {...props} />;
}
