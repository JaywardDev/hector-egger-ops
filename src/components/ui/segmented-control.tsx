"use client";

import type { ReactNode } from "react";
import { cn } from "@/src/lib/utils";

type SegmentedControlOption<Value extends string> = {
  label: ReactNode;
  value: Value;
  disabled?: boolean;
};

type SegmentedControlProps<Value extends string> = {
  options: readonly SegmentedControlOption<Value>[];
  value: Value;
  onChange: (value: Value) => void;
  "aria-label": string;
  className?: string;
};

export function SegmentedControl<Value extends string>({
  options,
  value,
  onChange,
  "aria-label": ariaLabel,
  className,
}: SegmentedControlProps<Value>) {
  return (
    <div
      aria-label={ariaLabel}
      className={cn("inline-flex rounded-full bg-zinc-100 p-1 ring-1 ring-zinc-200/70", className)}
      role="tablist"
    >
      {options.map((option) => {
        const isSelected = value === option.value;

        return (
          <button
            key={option.value}
            aria-selected={isSelected}
            className={cn(
              "rounded-full px-4 py-2 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--he-yellow)] disabled:cursor-not-allowed disabled:opacity-50",
              isSelected
                ? "bg-white text-zinc-950 shadow-sm ring-1 ring-zinc-950/5"
                : "text-zinc-600 hover:bg-white/60 hover:text-zinc-950",
            )}
            disabled={option.disabled}
            onClick={() => onChange(option.value)}
            role="tab"
            type="button"
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
