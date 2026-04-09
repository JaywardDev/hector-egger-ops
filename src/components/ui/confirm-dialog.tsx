"use client";

import { useEffect, useRef } from "react";
import { Stack } from "@/src/components/layout/stack";
import { Button } from "@/src/components/ui/button";
import { Card } from "@/src/components/ui/card";

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  danger = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const confirmButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    confirmButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onCancel();
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onCancel]);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close confirmation dialog"
        className="absolute inset-0 bg-zinc-900/40"
        onClick={onCancel}
      />
      <Card
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative z-10 w-full max-w-md p-4"
      >
        <Stack gap="md">
          <Stack gap="sm">
            <h2 className="text-base font-semibold text-zinc-900">{title}</h2>
            <p className="text-sm text-zinc-700">{description}</p>
          </Stack>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={onCancel}>
              {cancelLabel}
            </Button>
            <Button
              ref={confirmButtonRef}
              type="button"
              variant={danger ? "danger" : "default"}
              onClick={onConfirm}
            >
              {confirmLabel}
            </Button>
          </div>
        </Stack>
      </Card>
    </div>
  );
}
