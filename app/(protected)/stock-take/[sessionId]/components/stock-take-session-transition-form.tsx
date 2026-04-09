import { Button } from "@/src/components/ui/button";

type StockTakeSessionTransitionFormProps = {
  sessionId: string;
  hasUnsavedChanges: boolean;
  nextTransition: {
    action: string;
    buttonLabel: string;
  };
  transitionAction: (formData: FormData) => void;
  onUnsavedBlocked: () => void;
};

export function StockTakeSessionTransitionForm({
  sessionId,
  hasUnsavedChanges,
  nextTransition,
  transitionAction,
  onUnsavedBlocked,
}: StockTakeSessionTransitionFormProps) {
  return (
    <form
      action={transitionAction}
      onSubmit={(event) => {
        if (!hasUnsavedChanges) {
          return;
        }
        event.preventDefault();
        onUnsavedBlocked();
      }}
    >
      <input type="hidden" name="sessionId" value={sessionId} />
      <input type="hidden" name="transitionAction" value={nextTransition.action} />
      <Button type="submit">{nextTransition.buttonLabel}</Button>
    </form>
  );
}
