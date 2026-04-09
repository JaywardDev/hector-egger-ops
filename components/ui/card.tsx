import type { HTMLAttributes } from "react";
import { cn } from "@/src/lib/utils";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-md border border-zinc-200 bg-white p-3", className)} {...props} />;
}
