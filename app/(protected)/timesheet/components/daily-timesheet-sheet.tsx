"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { Button } from "@/src/components/ui/button";

export function DailyTimesheetSheet({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: ReactNode }) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    panelRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-white">
      <div ref={panelRef} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} className="flex h-dvh flex-col outline-none">
        <header className="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
          <h2 className="text-base font-semibold text-zinc-900">{title}</h2>
          <Button variant="ghost" onClick={onClose}>Close</Button>
        </header>
        <main className="flex-1 overflow-y-auto bg-zinc-50 p-4">{children}</main>
      </div>
    </div>
  );
}
