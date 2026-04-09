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
    <div className="flex flex-wrap items-center gap-2">
      <Button
        onClick={onSave}
        disabled={!hasUnsavedChanges || isSaving || !canEnterCounts || !isEntryOpen}
      >
        {isSaving ? "Saving..." : "Save changes"}
      </Button>
      <Button onClick={onReset} disabled={!hasUnsavedChanges}>
        Reset
      </Button>
      {hasUnsavedChanges ? (
        <span className="text-xs text-amber-700">Unsaved changes</span>
      ) : null}
    </div>
  );
}
