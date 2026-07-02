import type { SelectHTMLAttributes } from "react";
import { cn } from "@/src/lib/utils";

type SelectProps = SelectHTMLAttributes<HTMLSelectElement>;

export function Select({ className, ...props }: SelectProps) {
  return (
    <select
      className={cn(
        // 16px text on mobile keeps iOS Safari from zooming the page on focus;
        // the taller padding keeps touch targets near the 44px minimum.
        "w-full rounded-md border border-zinc-300 bg-white px-2 py-2 text-base text-zinc-900 outline-none ring-0 focus:border-zinc-400 sm:py-1.5 sm:text-sm",
        className,
      )}
      {...props}
    />
  );
}
