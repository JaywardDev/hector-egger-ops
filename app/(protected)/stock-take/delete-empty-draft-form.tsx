"use client";

import { deleteEmptyDraftStockTakeSessionAction } from "@/app/(protected)/stock-take/actions";

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
      <button
        type="submit"
        className="inline-flex rounded-md border border-red-200 px-3 py-1.5 text-red-700 hover:bg-red-50"
      >
        Delete empty draft
      </button>
    </form>
  );
}
