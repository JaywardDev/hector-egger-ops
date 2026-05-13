"use client";

import type { ComponentProps, ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { Button } from "@/src/components/ui/button";
import { cn } from "@/src/lib/utils";

const spinnerClassName = "h-4 w-4 animate-spin";

type BasePendingButtonProps = Omit<ComponentProps<typeof Button>, "children"> & {
  children: ReactNode;
  pendingLabel?: ReactNode;
  showSpinner?: boolean;
};

type PendingActionButtonProps = BasePendingButtonProps & {
  isPending?: boolean;
  pending?: boolean;
};

function PendingButtonContent({
  children,
  pendingLabel,
  showSpinner = true,
  pending,
}: {
  children: ReactNode;
  pendingLabel?: ReactNode;
  showSpinner?: boolean;
  pending: boolean;
}) {
  return (
    <>
      {showSpinner && pending ? <Loader2 aria-hidden="true" className={spinnerClassName} /> : null}
      {pending && pendingLabel ? pendingLabel : children}
    </>
  );
}

export function PendingSubmitButton({
  children,
  pendingLabel,
  showSpinner = true,
  disabled,
  className,
  ...props
}: BasePendingButtonProps) {
  const { pending } = useFormStatus();

  return (
    <Button disabled={disabled || pending} className={cn("gap-2", className)} {...props}>
      <PendingButtonContent pending={pending} pendingLabel={pendingLabel} showSpinner={showSpinner}>
        {children}
      </PendingButtonContent>
    </Button>
  );
}

export function PendingActionButton({
  children,
  pendingLabel,
  showSpinner = true,
  disabled,
  isPending = false,
  pending = false,
  className,
  ...props
}: PendingActionButtonProps) {
  const isButtonPending = isPending || pending;

  return (
    <Button disabled={disabled || isButtonPending} className={cn("gap-2", className)} {...props}>
      <PendingButtonContent pending={isButtonPending} pendingLabel={pendingLabel} showSpinner={showSpinner}>
        {children}
      </PendingButtonContent>
    </Button>
  );
}
