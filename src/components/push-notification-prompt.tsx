"use client";

import { useCallback, useEffect, useState } from "react";

type SubscriptionState = "unknown" | "unsupported" | "denied" | "subscribed" | "unsubscribed";

export function PushNotificationPrompt() {
  const [state, setState] = useState<SubscriptionState>("unknown");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setState("unsupported");
      return;
    }
    if (Notification.permission === "denied") {
      setState("denied");
      return;
    }
    navigator.serviceWorker.ready.then((reg) => {
      reg.pushManager.getSubscription().then((sub) => {
        setState(sub ? "subscribed" : "unsubscribed");
      });
    });
  }, []);

  const subscribe = useCallback(async () => {
    setLoading(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState("denied");
        return;
      }
      const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!publicKey) throw new Error("VAPID public key not configured.");
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
      const json = sub.toJSON();
      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }),
      });
      setState("subscribed");
    } catch {
      // silently ignore — user can retry
    } finally {
      setLoading(false);
    }
  }, []);

  const unsubscribe = useCallback(async () => {
    setLoading(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push/subscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setState("unsubscribed");
    } catch {
      // silently ignore
    } finally {
      setLoading(false);
    }
  }, []);

  if (state === "unknown" || state === "unsupported" || state === "denied") return null;

  if (state === "subscribed") {
    return (
      <div className="flex items-center justify-between rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400">
        <span>Push reminders are enabled.</span>
        <button
          onClick={unsubscribe}
          disabled={loading}
          className="ml-4 text-xs text-zinc-500 underline underline-offset-2 hover:text-zinc-700 disabled:opacity-50 dark:hover:text-zinc-300"
        >
          {loading ? "Turning off…" : "Turn off"}
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm dark:border-blue-800 dark:bg-blue-950">
      <span className="text-blue-800 dark:text-blue-200">
        Get push notifications when you have missing timesheet entries.
      </span>
      <button
        onClick={subscribe}
        disabled={loading}
        className="ml-4 shrink-0 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {loading ? "Enabling…" : "Enable"}
      </button>
    </div>
  );
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replaceAll("-", "+").replaceAll("_", "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}
