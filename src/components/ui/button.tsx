import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/src/lib/utils";

type ButtonVariant = "default" | "secondary" | "danger" | "ghost";
type ButtonSize = "sm" | "md";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

const variantClassNames: Record<ButtonVariant, string> = {
  default: "border-zinc-300 text-zinc-800 hover:bg-zinc-100",
  secondary: "border border-zinc-300 bg-white text-zinc-900 hover:bg-zinc-100",
  danger: "border-red-300 text-red-700 hover:bg-red-50",
  ghost: "border-transparent text-zinc-700 hover:bg-zinc-100",
};

const sizeClassNames: Record<ButtonSize, string> = {
  sm: "px-2 py-1 text-xs",
  md: "px-3 py-1.5 text-sm",
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
        "inline-flex items-center justify-center rounded-md border font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        variantClassNames[variant],
        sizeClassNames[size],
        className,
      )}
      {...props}
    />
  );
});
