import type { SelectHTMLAttributes } from "react";
import { cn } from "@/src/lib/utils";

type SelectProps = SelectHTMLAttributes<HTMLSelectElement>;

export function Select({ className, ...props }: SelectProps) {
  return (
    <select
      className={cn(
        "w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-900 outline-none ring-0 focus:border-zinc-400",
        className,
      )}
      {...props}
    />
  );
}
