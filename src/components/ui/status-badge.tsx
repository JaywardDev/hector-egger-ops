import type { ReactNode } from "react";
import { Badge, type BadgeVariant } from "@/src/components/ui/badge";
import { cn } from "@/src/lib/utils";

export type StatusBadgeTone = "neutral" | "brand" | "attention" | "info" | "success" | "warning" | "danger" | "outline";

export type StatusBadgeConfig = {
  label: ReactNode;
  tone?: StatusBadgeTone;
};

type StatusBadgeProps = {
  children?: ReactNode;
  label?: ReactNode;
  tone?: StatusBadgeTone;
  config?: StatusBadgeConfig;
  className?: string;
};

const toneToBadgeVariant: Record<StatusBadgeTone, BadgeVariant> = {
  neutral: "neutral",
  brand: "brand",
  attention: "attention",
  info: "info",
  success: "success",
  warning: "warning",
  danger: "danger",
  outline: "outline",
};

export function StatusBadge({ children, label, tone = "neutral", config, className }: StatusBadgeProps) {
  const resolvedTone = config?.tone ?? tone;
  const content = config?.label ?? label ?? children;

  return (
    <Badge className={cn("whitespace-nowrap", className)} variant={toneToBadgeVariant[resolvedTone]}>
      {content}
    </Badge>
  );
}
