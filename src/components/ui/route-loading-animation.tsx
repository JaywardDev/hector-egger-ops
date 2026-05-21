"use client";

import { Loader2 } from "lucide-react";

export function RouteLoadingAnimation() {
  return (
    <span className="relative flex size-10 items-center justify-center rounded-full border border-zinc-200 bg-zinc-50 text-zinc-600" aria-hidden="true">
      <Loader2 className="h-4 w-4 animate-spin" />
    </span>
  );
}
