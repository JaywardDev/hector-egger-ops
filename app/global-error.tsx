"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="antialiased">
        <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-6 py-16">
          <div className="mx-auto max-w-sm space-y-4 text-center">
            <p className="text-sm font-semibold uppercase tracking-wide text-zinc-400">
              Hector Egger Operations
            </p>
            <h1 className="text-lg font-semibold text-zinc-900">
              An unexpected error occurred.
            </h1>
            {error.digest ? (
              <p className="text-xs text-zinc-400">Reference: {error.digest}</p>
            ) : null}
            <button
              type="button"
              onClick={reset}
              className="inline-flex h-10 items-center justify-center rounded-md border border-zinc-300 bg-white px-4 text-sm font-medium text-zinc-900 shadow-sm transition-colors hover:bg-zinc-50"
            >
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
