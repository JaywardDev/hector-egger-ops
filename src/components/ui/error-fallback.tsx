"use client";

type ErrorFallbackProps = {
  error: Error & { digest?: string };
  reset: () => void;
  message?: string;
};

export function ErrorFallback({ error, reset, message = "Something went wrong." }: ErrorFallbackProps) {
  return (
    <div className="flex min-h-full items-center justify-center bg-zinc-50 px-6 py-16">
      <div className="mx-auto max-w-sm space-y-4 text-center">
        <p className="text-sm font-semibold uppercase tracking-wide text-zinc-400">Error</p>
        <h2 className="text-lg font-semibold text-zinc-900">{message}</h2>
        {error.digest ? (
          <p className="text-xs text-zinc-400">Reference: {error.digest}</p>
        ) : null}
        <button
          type="button"
          onClick={reset}
          className="inline-flex h-10 items-center justify-center rounded-md border border-zinc-300 bg-white px-4 text-sm font-medium text-zinc-900 shadow-sm transition-colors hover:bg-zinc-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--he-yellow)]"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
