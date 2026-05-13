"use client";

import type { ReactNode } from "react";
import { FullScreenDialog } from "@/src/components/ui/full-screen-dialog";

export function DailyTimesheetSheet({
  open,
  title,
  subtitle,
  eyebrow,
  description,
  metadata,
  statusSlot,
  actionSlot,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  subtitle?: ReactNode;
  eyebrow?: ReactNode;
  description?: ReactNode;
  metadata?: ReactNode;
  statusSlot?: ReactNode;
  actionSlot?: ReactNode;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <FullScreenDialog
      open={open}
      title={title}
      subtitle={subtitle}
      eyebrow={eyebrow}
      description={description}
      metadata={metadata}
      statusSlot={statusSlot}
      actionSlot={actionSlot}
      onClose={onClose}
      contentClassName="sm:max-w-5xl"
    >
      {children}
    </FullScreenDialog>
  );
}
