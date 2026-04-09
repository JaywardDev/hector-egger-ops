"use client";

import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { Card } from "@/src/components/ui/card";

type BottomSheetProps = {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
};

export function BottomSheet({
  open,
  title,
  description,
  onClose,
  children,
}: BottomSheetProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    panelRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-3 sm:hidden">
      <button
        type="button"
        aria-label="Close editor"
        className="absolute inset-0 bg-zinc-900/40"
        onClick={onClose}
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className="relative z-10 w-full"
      >
        <Card className="max-h-[85vh] overflow-y-auto rounded-t-xl border border-zinc-200 p-4">
          <div className="space-y-1 pb-3">
            <h2 className="text-base font-semibold text-zinc-900">{title}</h2>
            {description ? <p className="text-sm text-zinc-600">{description}</p> : null}
          </div>

          {children}
        </Card>
      </div>
    </div>
  );
}
