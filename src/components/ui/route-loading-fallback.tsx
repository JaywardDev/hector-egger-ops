import { Loader2 } from "lucide-react";

type RouteLoadingFallbackProps = {
  message?: string;
};

export function RouteLoadingFallback({ message = "Loading…" }: RouteLoadingFallbackProps) {
  return (
    <div className="flex min-h-full items-center justify-center bg-zinc-50 px-6 py-16">
      <div role="status" aria-live="polite" className="mx-auto flex max-w-xs flex-col items-center gap-3 text-center">
        <span className="flex size-10 items-center justify-center rounded-full border border-zinc-200 bg-zinc-50 text-zinc-600">
          <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
        </span>
        <p className="text-sm font-medium text-zinc-700">{message}</p>
        <span className="sr-only">Please wait while this page is prepared.</span>
      </div>
    </div>
  );
}
