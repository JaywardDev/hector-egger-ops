"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Button } from "@/src/components/ui/button";
import { cn } from "@/src/lib/utils";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

type AppQrCodeCardProps = {
  className?: string;
  qrSize?: number;
  showInstallHelp?: boolean;
  targetPath?: string;
};

type AppQrCodeModalTriggerProps = {
  className?: string;
  defaultOpen?: boolean;
  showInstallHelp?: boolean;
  targetPath?: string;
};

const signInPath = "/sign-in?install=1";

const isBeforeInstallPromptEvent = (event: Event): event is BeforeInstallPromptEvent =>
  "prompt" in event && typeof event.prompt === "function" && "userChoice" in event;

export function AppQrCodeModalTrigger({
  className,
  defaultOpen = false,
  showInstallHelp = true,
  targetPath = signInPath,
}: AppQrCodeModalTriggerProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const dialogRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  const closeModal = useCallback(() => {
    setIsOpen(false);
    window.requestAnimationFrame(() => {
      triggerRef.current?.focus();
    });
  }, []);

  useEffect(() => {
    setIsOpen(defaultOpen);
  }, [defaultOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    dialogRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeModal();
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [closeModal, isOpen]);

  return (
    <div className={cn("text-center", className)}>
      <button
        ref={triggerRef}
        type="button"
        className="group inline-flex items-center justify-center rounded-sm text-sm font-medium text-zinc-600 underline-offset-4 transition-colors hover:text-zinc-950 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--he-yellow)]"
        onClick={() => setIsOpen(true)}
      >
        <span className="transition-colors group-hover:text-amber-700">Open app on another device</span>
      </button>

      {isOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
          <button
            type="button"
            aria-label="Close app QR code dialog"
            className="absolute inset-0 bg-zinc-950/45 backdrop-blur-[2px]"
            onClick={closeModal}
          />

          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={descriptionId}
            tabIndex={-1}
            className="relative z-10 w-full max-w-sm rounded-3xl border border-white/80 bg-white p-4 text-left shadow-2xl shadow-zinc-950/25 outline-none sm:max-w-md sm:p-5"
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-700">Open the app</p>
                <h2 id={titleId} className="mt-1 text-lg font-semibold text-zinc-950">
                  Sign in on another device
                </h2>
                <p id={descriptionId} className="mt-1 text-sm leading-6 text-zinc-600">
                  Scan the QR code to open the Hector Egger sign-in page on your phone, tablet, or another device.
                </p>
              </div>
              <button
                type="button"
                aria-label="Close app QR code dialog"
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xl leading-none text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--he-yellow)]"
                onClick={closeModal}
              >
                ×
              </button>
            </div>

            <AppQrCodeCard
              className="border-0 p-0 shadow-none"
              qrSize={184}
              showInstallHelp={showInstallHelp}
              targetPath={targetPath}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

export const AppQrCodeDisclosure = AppQrCodeModalTrigger;

export function AppQrCodeCard({
  className,
  qrSize = 116,
  showInstallHelp = false,
  targetPath = signInPath,
}: AppQrCodeCardProps) {
  const titleId = useId();
  const [appUrl, setAppUrl] = useState(targetPath);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installOutcome, setInstallOutcome] = useState<"accepted" | "dismissed" | null>(null);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setAppUrl(new URL(targetPath, window.location.origin).toString());
    });

    return () => window.cancelAnimationFrame(frame);
  }, [targetPath]);

  useEffect(() => {
    if (!showInstallHelp) {
      return;
    }

    const handleBeforeInstallPrompt = (event: Event) => {
      if (!isBeforeInstallPromptEvent(event)) {
        return;
      }

      event.preventDefault();
      setInstallPrompt(event);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, [showInstallHelp]);

  const displayUrl = useMemo(() => appUrl.replace(/^https?:\/\//, ""), [appUrl]);

  const handleInstallClick = async () => {
    if (!installPrompt) {
      return;
    }

    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    setInstallOutcome(choice.outcome);
    setInstallPrompt(null);
  };

  const showInstallPrompt = showInstallHelp && Boolean(installPrompt || installOutcome);

  return (
    <section
      className={cn(
        "rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm shadow-zinc-950/5 sm:p-4",
        className,
      )}
      aria-labelledby={titleId}
    >
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="rounded-3xl border border-zinc-200 bg-white p-3 shadow-inner shadow-zinc-950/5">
          <QRCodeSVG
            value={appUrl}
            size={qrSize}
            marginSize={1}
            level="M"
            bgColor="#ffffff"
            fgColor="#27272a"
            aria-label="QR code for the Hector Egger Operations Platform sign-in page"
          />
        </div>

        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500">Sign-in link</p>
          <h3 id={titleId} className="mt-1 text-base font-semibold text-zinc-950">
            Scan to open the sign-in page
          </h3>
          <p className="mt-2 text-sm leading-6 text-zinc-600">
            Scanning opens the app sign-in page for this site. It does not install the app automatically.
          </p>
          <p className="mt-3 break-all rounded-md bg-zinc-50 px-2.5 py-2 text-xs text-zinc-500">{displayUrl}</p>
        </div>
      </div>

      {showInstallPrompt ? (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-sm text-zinc-700">
          <p className="font-medium text-zinc-950">Optional app install</p>
          {installPrompt ? (
            <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="leading-6">This browser has made an install prompt available. You can keep using the sign-in page without installing.</p>
              <Button type="button" variant="brand" size="sm" className="shrink-0" onClick={handleInstallClick}>
                Install app
              </Button>
            </div>
          ) : null}
          {installOutcome === "dismissed" ? (
            <p className="mt-2 text-xs text-zinc-600">Install was dismissed. You can keep using the app in the browser.</p>
          ) : null}
          {installOutcome === "accepted" ? (
            <p className="mt-2 text-xs text-zinc-600">Install accepted. Follow any remaining browser instructions.</p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
