"use client";

import { ErrorFallback } from "@/src/components/ui/error-fallback";

export default function QaError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErrorFallback error={error} reset={reset} message="Could not load QA data." />;
}
