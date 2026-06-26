"use client";

import { ErrorFallback } from "@/src/components/ui/error-fallback";

export default function StockTakeError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErrorFallback error={error} reset={reset} message="Could not load stock take." />;
}
