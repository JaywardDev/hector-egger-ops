import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Offline · Hector Egger Operations",
};

// Static, dependency-light page the service worker can serve when a navigation
// fails because the device is offline.
export default function OfflinePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-2xl font-semibold text-zinc-950">You&rsquo;re offline</h1>
      <p className="max-w-sm text-sm text-zinc-600">
        This page isn&rsquo;t available without a connection. Reconnect and try again — any page you
        opened while online will load faster next time.
      </p>
      <Link
        href="/"
        className="rounded-md bg-zinc-950 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
      >
        Try again
      </Link>
    </main>
  );
}
