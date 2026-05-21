"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

import loadingAnimation from "@/public/animations/loading-animation.json";

type LottieComponent = typeof import("lottie-react").default;

export function RouteLoadingAnimation() {
  const [Lottie, setLottie] = useState<LottieComponent | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    import("lottie-react")
      .then((module) => {
        if (!cancelled) {
          setLottie(() => module.default);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setFailed(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <span className="relative flex size-10 items-center justify-center rounded-full border border-zinc-200 bg-zinc-50 text-zinc-600" aria-hidden="true">
      <Loader2 className="h-4 w-4 animate-spin" />
      {!failed && Lottie ? (
        <span className="absolute inset-0 flex items-center justify-center overflow-hidden rounded-full">
          <Lottie animationData={loadingAnimation} autoplay loop className="h-8 w-8" onError={() => setFailed(true)} />
        </span>
      ) : null}
    </span>
  );
}
