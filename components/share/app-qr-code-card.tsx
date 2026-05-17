"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Button } from "@/src/components/ui/button";
import { cn } from "@/src/lib/utils";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

type AppQrCodeCardProps = {
  className?: string;
  showInstallHelp?: boolean;
  targetPath?: string;
};

type AppQrCodeDisclosureProps = {
  className?: string;
  defaultOpen?: boolean;
  showInstallHelp?: boolean;
  targetPath?: string;
};

const signInPath = "/sign-in?install=1";

const isBeforeInstallPromptEvent = (event: Event): event is BeforeInstallPromptEvent =>
  "prompt" in event && typeof event.prompt === "function" && "userChoice" in event;

export function AppQrCodeDisclosure({
  className,
  defaultOpen = false,
  showInstallHelp = true,
  targetPath = signInPath,
}: AppQrCodeDisclosureProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const panelId = useId();

  return (
    <div className={cn("space-y-3", className)}>
      <button
        type="button"
        className="mx-auto inline-flex w-full items-center justify-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700 shadow-sm shadow-zinc-950/5 transition-colors hover:border-[var(--he-yellow)] hover:bg-[var(--he-yellow)]/10 hover:text-zinc-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--he-yellow)] sm:w-auto"
        aria-expanded={isOpen}
        aria-controls={panelId}
        onClick={() => setIsOpen((current) => !current)}
      >
        <span className="h-1.5 w-1.5 rounded-full bg-[var(--he-yellow)]" aria-hidden="true" />
        Open or install app
        <svg
          aria-hidden="true"
          className={cn("h-4 w-4 text-zinc-500 transition-transform", isOpen ? "rotate-180" : "rotate-0")}
          viewBox="0 0 20 20"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="M5 7.5L10 12.5L15 7.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {isOpen ? (
        <div id={panelId}>
          <AppQrCodeCard showInstallHelp={showInstallHelp} targetPath={targetPath} />
        </div>
      ) : null}
    </div>
  );
}

export function AppQrCodeCard({
  className,
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

  return (
    <section
      className={cn(
        "rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm shadow-zinc-950/5 sm:p-4",
        className,
      )}
      aria-labelledby={titleId}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="mx-auto rounded-2xl border border-zinc-200 bg-white p-2 shadow-inner shadow-zinc-950/5 sm:mx-0 sm:p-3">
          <QRCodeSVG
            value={appUrl}
            size={116}
            marginSize={1}
            level="M"
            bgColor="#ffffff"
            fgColor="#27272a"
            aria-label="QR code for the Hector Egger Operations Platform sign-in page"
          />
        </div>

        <div className="min-w-0 flex-1 text-center sm:text-left">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500">Open the app</p>
          <h3 id={titleId} className="mt-1 text-base font-semibold text-zinc-950">
            Scan to sign in on your device
          </h3>
          <p className="mt-2 text-sm leading-6 text-zinc-600">
            Scan this QR code to open the app. If your browser supports installation, you may see an Install button after opening it.
          </p>
          <p className="mt-2 hidden break-all rounded-md bg-zinc-50 px-2.5 py-2 text-xs text-zinc-500 sm:block">{displayUrl}</p>
        </div>
      </div>

      {showInstallHelp ? (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-sm text-zinc-700">
          <p className="font-medium text-zinc-950">Installation options</p>
          {installPrompt ? (
            <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="leading-6">This browser has made an app install prompt available. Use it only if you want to add the app to this device.</p>
              <Button type="button" variant="brand" size="sm" className="shrink-0" onClick={handleInstallClick}>
                Install app
              </Button>
            </div>
          ) : (
            <p className="mt-2 leading-6">
              If your browser does not show an install prompt, continue in the browser or use the browser menu when available. On iPhone or iPad, open Safari, tap <span className="font-medium">Share</span>, then <span className="font-medium">Add to Home Screen</span>.
            </p>
          )}
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
