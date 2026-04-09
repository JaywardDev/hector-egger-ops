import type { HTMLAttributes } from "react";
import { cn } from "@/src/lib/utils";

export function PageContainer({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return <section className={cn("mx-auto w-full max-w-5xl space-y-4", className)} {...props} />;
}

export function Stack({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("space-y-4", className)} {...props} />;
}
