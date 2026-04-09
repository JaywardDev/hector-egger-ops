import type { HTMLAttributes } from "react";
import { cn } from "@/src/lib/utils";

type StackProps = HTMLAttributes<HTMLDivElement> & {
  gap?: "sm" | "md" | "lg";
};

const gapClassNames = {
  sm: "space-y-2",
  md: "space-y-3",
  lg: "space-y-4",
};

export function Stack({ className, gap = "md", ...props }: StackProps) {
  return <div className={cn(gapClassNames[gap], className)} {...props} />;
}
