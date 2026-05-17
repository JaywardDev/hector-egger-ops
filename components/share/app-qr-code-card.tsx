"use client";

import { useEffect, useMemo, useState } from "react";
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
};

const signInPath = "/sign-in?install=1";

export function AppQrCodeCard({ className, showInstallHelp = false }: AppQrCodeCardProps) {
  const [appUrl, setAppUrl] = useState(signInPath);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installOutcome, setInstallOutcome] = useState<"accepted" | "dismissed" | null>(null);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setAppUrl(`${window.location.origin}${signInPath}`);
    });

    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!showInstallHelp) {
      return;
    }

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
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
        "rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm shadow-zinc-950/5",
        className,
      )}
      aria-labelledby="app-qr-code-title"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="mx-auto rounded-2xl border border-zinc-200 bg-white p-3 shadow-inner shadow-zinc-950/5 sm:mx-0">
          <QRCodeSVG
            value={appUrl}
            size={132}
            marginSize={1}
            level="M"
            bgColor="#ffffff"
            fgColor="#27272a"
            aria-label="QR code for the Hector Egger Operations Platform sign-in page"
          />
        </div>

        <div className="min-w-0 flex-1 text-center sm:text-left">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500">Open the app</p>
          <h3 id="app-qr-code-title" className="mt-1 text-base font-semibold text-zinc-950">
            Scan to sign in on your device
          </h3>
          <p className="mt-2 text-sm leading-6 text-zinc-600">
            The code opens the secure sign-in page for this environment. Install is optional and always requires your confirmation.
          </p>
          <p className="mt-2 break-all rounded-md bg-zinc-50 px-2.5 py-2 text-xs text-zinc-500">{displayUrl}</p>
        </div>
      </div>

      {showInstallHelp ? (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-sm text-zinc-700">
          <p className="font-medium text-zinc-950">Install this app after sign-in</p>
          {installPrompt ? (
            <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="leading-6">This browser supports an app install prompt. Tap install when you are ready.</p>
              <Button type="button" variant="brand" size="sm" className="shrink-0" onClick={handleInstallClick}>
                Install app
              </Button>
            </div>
          ) : (
            <p className="mt-2 leading-6">
              If no install button appears, use your browser menu: Chrome or Edge can show <span className="font-medium">Install app</span>. On iPhone or iPad, open Safari and choose <span className="font-medium">Share</span> then <span className="font-medium">Add to Home Screen</span>.
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
