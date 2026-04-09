"use client";

import { useRef, useState } from "react";
import { deleteEmptyDraftStockTakeSessionAction } from "@/app/(protected)/stock-take/actions";
import { Button } from "@/src/components/ui/button";
import { ConfirmDialog } from "@/src/components/ui/confirm-dialog";

type DeleteEmptyDraftFormProps = {
  sessionId: string;
};

export function DeleteEmptyDraftForm({ sessionId }: DeleteEmptyDraftFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isConfirmed, setIsConfirmed] = useState(false);

  return (
    <>
      <form
        ref={formRef}
        action={deleteEmptyDraftStockTakeSessionAction}
        onSubmit={(event) => {
          if (!isConfirmed) {
            event.preventDefault();
            setIsDialogOpen(true);
            return;
          }

          setIsConfirmed(false);
        }}
      >
        <input type="hidden" name="sessionId" value={sessionId} />
        <Button type="submit" variant="danger">
          Delete empty draft
        </Button>
      </form>

      <ConfirmDialog
        open={isDialogOpen}
        title="Delete empty draft session?"
        description="This action cannot be undone."
        confirmLabel="Delete empty draft"
        cancelLabel="Cancel"
        danger
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
