"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { Button } from "@/src/components/ui/button";
import { cn } from "@/src/lib/utils";

type FullScreenDialogProps = {
  open: boolean;
  title: string;
  subtitle?: ReactNode;
  eyebrow?: ReactNode;
  description?: ReactNode;
  metadata?: ReactNode;
  statusSlot?: ReactNode;
  actionSlot?: ReactNode;
  closeLabel?: string;
  onClose: () => void;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
};

export function FullScreenDialog({
  open,
  title,
  subtitle,
  eyebrow,
  description,
  metadata,
  statusSlot,
  actionSlot,
  closeLabel = "Close",
  onClose,
  children,
  className,
  contentClassName,
}: FullScreenDialogProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  const wasOpenRef = useRef(false);
  const titleId = useId();
  const descriptionId = useId();
  const hasDescription = Boolean(subtitle || description || metadata);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCloseRef.current();
    };

    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKey);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    const wasOpen = wasOpenRef.current;
    wasOpenRef.current = open;

    if (!open || wasOpen) return;

    const panel = panelRef.current;
    if (!panel || panel.contains(document.activeElement)) return;

    panel.focus();
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-white">
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={hasDescription ? descriptionId : undefined}
        tabIndex={-1}
        className={cn("flex h-dvh min-w-0 flex-col overflow-hidden outline-none", className)}
      >
        <header className="relative shrink-0 border-b border-zinc-200/80 bg-white/95 shadow-[0_1px_0_rgba(24,24,27,0.03)] backdrop-blur">
          <span aria-hidden="true" className="absolute inset-x-0 top-0 h-0.5 bg-[var(--he-yellow)]" />
          <div className="mx-auto flex w-full max-w-6xl items-start justify-between gap-3 px-4 py-3 sm:px-6 sm:py-4 lg:items-center">
            <div className="min-w-0 space-y-1 sm:space-y-2">
              {eyebrow ? <p className="hidden text-xs font-semibold uppercase tracking-[0.2em] text-[var(--he-muted)] sm:block">{eyebrow}</p> : null}
              <div className="flex flex-wrap items-center gap-2">
                <h2 id={titleId} className="text-lg font-semibold tracking-tight text-zinc-950 sm:text-2xl">
                  {title}
                </h2>
                {statusSlot ? <div className="shrink-0">{statusSlot}</div> : null}
              </div>
              {hasDescription ? (
                <div id={descriptionId} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-zinc-500">
                  {subtitle ? <span className="font-medium text-zinc-700">{subtitle}</span> : null}
                  {description ? <span>{description}</span> : null}
                  {metadata ? <span className="text-zinc-500">{metadata}</span> : null}
                </div>
              ) : null}
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              {actionSlot}
              <Button type="button" variant="secondary" onClick={onClose} className="min-h-10">
                {closeLabel}
              </Button>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto overflow-x-hidden bg-[linear-gradient(180deg,#fff_0%,#fbfaf7_100%)]">
          <div className={cn("mx-auto w-full max-w-6xl px-0 py-0 sm:px-6 sm:py-6", contentClassName)}>{children}</div>
        </main>
      </div>
    </div>
  );
}
