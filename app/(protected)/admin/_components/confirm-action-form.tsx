"use client";

import { useRef, useState, type ComponentProps } from "react";
import { PendingSubmitButton } from "@/src/components/ui/pending-button";
import { ConfirmDialog } from "@/src/components/ui/confirm-dialog";

type ConfirmActionFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  profileId: string;
  submitLabel: string;
  pendingLabel: string;
  confirmTitle: string;
  confirmDescription: string;
  confirmLabel: string;
  variant?: ComponentProps<typeof PendingSubmitButton>["variant"];
  size?: ComponentProps<typeof PendingSubmitButton>["size"];
  danger?: boolean;
};

export function ConfirmActionForm({
  action,
  profileId,
  submitLabel,
  pendingLabel,
  confirmTitle,
  confirmDescription,
  confirmLabel,
  variant,
  size,
  danger = false,
}: ConfirmActionFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isConfirmed, setIsConfirmed] = useState(false);

  return (
    <>
      <form
        ref={formRef}
        action={action}
        onSubmit={(event) => {
          if (!isConfirmed) {
            event.preventDefault();
            setIsDialogOpen(true);
            return;
          }

          setIsConfirmed(false);
        }}
      >
        <input type="hidden" name="profileId" value={profileId} />
        <PendingSubmitButton type="submit" variant={variant} size={size} pendingLabel={pendingLabel}>
          {submitLabel}
        </PendingSubmitButton>
      </form>

      <ConfirmDialog
        open={isDialogOpen}
        title={confirmTitle}
        description={confirmDescription}
        confirmLabel={confirmLabel}
        cancelLabel="Cancel"
        danger={danger}
        onCancel={() => {
          setIsDialogOpen(false);
        }}
        onConfirm={() => {
          setIsDialogOpen(false);
          setIsConfirmed(true);
          formRef.current?.requestSubmit();
        }}
      />
    </>
  );
}
