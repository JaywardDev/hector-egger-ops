import type { HTMLAttributes } from "react";
import { cn } from "@/src/lib/utils";

type PageContainerProps = HTMLAttributes<HTMLElement>;

export function PageContainer({ className, ...props }: PageContainerProps) {
  return <section className={cn("space-y-4 text-sm text-zinc-700", className)} {...props} />;
}
