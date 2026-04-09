import { forwardRef, type SelectHTMLAttributes } from "react";
import { cn } from "@/src/lib/utils";

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  invalid?: boolean;
};

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { className, invalid = false, ...props },
  ref,
) {
  return (
    <select
      ref={ref}
      className={cn(
        "w-full rounded-md border bg-white px-3 py-2 text-sm text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-500",
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
