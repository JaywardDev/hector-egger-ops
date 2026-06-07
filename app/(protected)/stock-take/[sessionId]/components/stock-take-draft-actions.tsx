import { Button } from "@/src/components/ui/button";

type StockTakeDraftActionsProps = {
  onSave: () => void;
  onReset: () => void;
  hasUnsavedChanges: boolean;
  isSaving: boolean;
  canEnterCounts: boolean;
  isEntryOpen: boolean;
};

export function StockTakeDraftActions({
  onSave,
  onReset,
  hasUnsavedChanges,
  isSaving,
  canEnterCounts,
  isEntryOpen,
}: StockTakeDraftActionsProps) {
  return (
    <div className="sticky top-0 z-10 -mx-3 -mt-3 flex flex-wrap items-center gap-2 border-b border-zinc-100 bg-white px-3 py-2">
      <Button
        onClick={onSave}
        variant="primary"
        disabled={!hasUnsavedChanges || isSaving || !canEnterCounts || !isEntryOpen}
        className="min-h-9"
      >
        {isSaving ? "Saving…" : "Save changes"}
      </Button>
      <Button
        onClick={onReset}
        variant="secondary"
        disabled={!hasUnsavedChanges}
        className="min-h-9"
      >
        Discard
      </Button>
      {hasUnsavedChanges ? (
        <span className="text-xs font-medium text-amber-700">● Unsaved changes</span>
      ) : (
        <span className="text-xs text-zinc-400">All saved</span>
      )}
    </div>
  );
}
