import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/src/lib/utils";

type ButtonVariant = "default" | "primary" | "brand" | "secondary" | "danger" | "destructive" | "ghost" | "quiet";
type ButtonSize = "sm" | "md" | "lg";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

const primaryClassName =
  "border-[var(--he-black)] bg-[var(--he-black)] text-white shadow-sm hover:bg-[var(--he-charcoal)] hover:border-[var(--he-charcoal)]";
const secondaryClassName = "border border-zinc-300 bg-white text-zinc-900 shadow-sm hover:bg-zinc-50";
const destructiveClassName = "border-red-300 bg-white text-red-700 hover:bg-red-50 hover:border-red-400";
const quietClassName = "border-transparent bg-transparent text-zinc-700 hover:bg-zinc-100 hover:text-zinc-950";

const variantClassNames: Record<ButtonVariant, string> = {
  default: "border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-100",
  primary: primaryClassName,
  brand: primaryClassName,
  secondary: secondaryClassName,
  danger: destructiveClassName,
  destructive: destructiveClassName,
  ghost: quietClassName,
  quiet: quietClassName,
};

const sizeClassNames: Record<ButtonSize, string> = {
  sm: "px-2 py-1 text-xs",
  md: "px-3 py-1.5 text-sm",
  lg: "px-4 py-3 text-sm",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = "default", size = "md", type = "button", ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        "inline-flex items-center justify-center rounded-md border font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--he-yellow)] disabled:cursor-not-allowed disabled:opacity-50",
        variantClassNames[variant],
        sizeClassNames[size],
        className,
      )}
      {...props}
    />
  );
});
