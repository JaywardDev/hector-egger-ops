"use client";

import { useState } from "react";
import { cn } from "@/src/lib/utils";

const initialsFromName = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "U";

export function Avatar({
  profileId,
  name,
  hasAvatar,
  size = 40,
  cacheBust,
  className,
}: {
  profileId: string;
  name: string;
  hasAvatar: boolean;
  size?: number;
  // Bump to force the image to reload after an upload/remove.
  cacheBust?: string | number;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const showImage = hasAvatar && !failed;
  const dimension = { width: size, height: size };

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-[var(--he-yellow)]/60 bg-[var(--he-yellow)]/20 text-xs font-semibold text-zinc-900",
        className,
      )}
      style={dimension}
      aria-label={name}
    >
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`/api/avatar/${profileId}${cacheBust ? `?v=${cacheBust}` : ""}`}
          alt={name}
          width={size}
          height={size}
          className="h-full w-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <span aria-hidden="true">{initialsFromName(name)}</span>
      )}
    </span>
  );
}
