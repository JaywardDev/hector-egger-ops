import type { InputHTMLAttributes } from "react";
import { cn } from "@/src/lib/utils";

type InputProps = InputHTMLAttributes<HTMLInputElement>;

export function Input({ className, ...props }: InputProps) {
  return (
    <input
      className={cn(
        // 16px text on mobile keeps iOS Safari from zooming the page on focus;
        // the taller padding keeps touch targets near the 44px minimum.
        "w-full rounded-md border border-zinc-300 bg-white px-2 py-2 text-base text-zinc-900 outline-none ring-0 placeholder:text-zinc-400 focus:border-zinc-400 sm:py-1.5 sm:text-sm",
        className,
      )}
      {...props}
    />
  );
}
