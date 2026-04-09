"use client";

import { deleteEmptyDraftStockTakeSessionAction } from "@/app/(protected)/stock-take/actions";
import { Button } from "@/src/components/ui/button";

type DeleteEmptyDraftFormProps = {
  sessionId: string;
};

export function DeleteEmptyDraftForm({ sessionId }: DeleteEmptyDraftFormProps) {
  return (
    <form
      action={deleteEmptyDraftStockTakeSessionAction}
      onSubmit={(event) => {
        if (
          !window.confirm(
            "Delete this empty draft session? This action cannot be undone.",
          )
        ) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="sessionId" value={sessionId} />
      <Button type="submit" variant="danger">
        Delete empty draft
      </Button>
    </form>
  );
}
