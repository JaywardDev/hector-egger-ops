"use client";

import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { cn } from "@/src/lib/utils";

type PendingOverlayProps = {
  pending?: boolean;
  message?: string;
  description?: string;
  className?: string;
};

export function FullScreenPendingOverlay({
  pending,
  message = "Working on it…",
  description = "Please wait while we securely process your request.",
  className,
}: PendingOverlayProps) {
  const formStatus = useFormStatus();
  const isPending = pending ?? formStatus.pending;

  if (!isPending) {
    return null;
  }

  return (
    <div
      className={cn(
        "fixed inset-0 z-[100] flex items-center justify-center bg-zinc-950/35 px-4 backdrop-blur-sm",
        className,
      )}
      aria-live="polite"
      aria-busy="true"
    >
      <div
        role="status"
        className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-6 text-center shadow-2xl shadow-zinc-950/20"
      >
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-amber-100 text-amber-700 ring-8 ring-amber-50">
          <Loader2 aria-hidden="true" className="h-5 w-5 animate-spin" />
        </div>
        <p className="mt-4 text-base font-semibold text-zinc-950">{message}</p>
        <p className="mt-2 text-sm leading-6 text-zinc-600">{description}</p>
      </div>
    </div>
  );
}

export function PanelPendingOverlay({
  pending,
  message = "Updating…",
  description = "Please wait while this panel refreshes.",
  className,
}: PendingOverlayProps) {
  const formStatus = useFormStatus();
  const isPending = pending ?? formStatus.pending;

  if (!isPending) {
    return null;
  }

  return (
    <div
      className={cn(
        "absolute inset-0 z-20 flex items-center justify-center rounded-lg bg-white/75 px-4 backdrop-blur-sm",
        className,
      )}
      aria-live="polite"
      aria-busy="true"
    >
      <div role="status" className="flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-800 shadow-lg">
        <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin text-amber-700" />
        <span>{message}</span>
        <span className="sr-only">{description}</span>
      </div>
    </div>
  );
}
