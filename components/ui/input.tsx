import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "@/src/lib/utils";

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  invalid?: boolean;
};

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, invalid = false, ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      className={cn(
        "w-full rounded-md border bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-500",
        invalid
          ? "border-red-500 focus-visible:ring-red-500"
          : "border-zinc-300 focus-visible:ring-zinc-500",
        className,
      )}
      aria-invalid={invalid || undefined}
      {...props}
    />
  );
});
