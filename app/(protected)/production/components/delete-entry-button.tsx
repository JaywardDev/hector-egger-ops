"use client";

import { useState, useTransition } from "react";
import { Button } from "@/src/components/ui/button";
import { ConfirmDialog } from "@/src/components/ui/confirm-dialog";
import { deleteProductionEntryAction } from "@/app/(protected)/production/actions";

// Guards the destructive delete behind a confirmation dialog (matches how the
// rest of the app handles irreversible actions) instead of a bare submit button.
export function DeleteEntryButton({ entryId }: { entryId: string }) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  return (
    <>
      <Button type="button" variant="danger" disabled={isPending} onClick={() => setOpen(true)}>
        {isPending ? "Deleting…" : "Delete entry"}
      </Button>
      <ConfirmDialog
        open={open}
        title="Delete this entry?"
        description="This permanently removes the production entry. This cannot be undone."
        confirmLabel="Delete entry"
        cancelLabel="Cancel"
        danger
        onCancel={() => setOpen(false)}
        onConfirm={() => {
          setOpen(false);
          // The server action redirects on success; run it in a transition so the
          // button shows a pending state until navigation occurs.
          startTransition(() => {
            void deleteProductionEntryAction(entryId);
          });
        }}
      />
    </>
  );
}
