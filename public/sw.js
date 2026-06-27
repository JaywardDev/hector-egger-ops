// Bump CACHE_VERSION to invalidate old caches on the next activation.
const CACHE_VERSION = "he-ops-v1";
const PRECACHE = `${CACHE_VERSION}-precache`;
const RUNTIME = `${CACHE_VERSION}-runtime`;

// Minimal app-shell assets needed to render the offline fallback.
const PRECACHE_URLS = ["/offline", "/icons/app-icon.svg", "/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(PRECACHE)
      // Individual failures (e.g. manifest path differences) must not abort install.
      .then((cache) => Promise.allSettled(PRECACHE_URLS.map((url) => cache.add(url))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== PRECACHE && key !== RUNTIME)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Only handle GET; let writes (server actions, POST/PATCH/DELETE) hit the network untouched.
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Hashed, immutable build assets: cache-first (stale-while-revalidate).
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const network = fetch(request)
          .then((response) => {
            if (response.ok) {
              const copy = response.clone();
              caches.open(RUNTIME).then((cache) => cache.put(request, copy));
            }
            return response;
          })
          .catch(() => cached);
        return cached ?? network;
      }),
    );
    return;
  }

  // Page navigations: network-first, fall back to the offline page when offline.
  // We intentionally do NOT cache navigation responses — they are auth-gated and
  // per-user, so caching HTML risks serving stale or another user's content.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match("/offline").then((offline) => offline ?? Response.error()),
      ),
    );
  }
});

// --- Background Sync: replay the offline timesheet outbox ---
// Mirrors src/lib/offline/timesheet-sync.ts so queued saves drain even when the
// app is not open. The server's client_mutation_id unique index makes it safe
// for this and the in-app flush to run concurrently.
const OFFLINE_DB_NAME = "he-ops-offline";
const OFFLINE_DB_VERSION = 2;
const OUTBOX_STORE = "timesheet-outbox";
const DRAFTS_STORE = "timesheet-drafts";
const OUTBOX_SYNC_TAG = "timesheet-outbox";
const TIMESHEET_ENTRIES_ENDPOINT = "/api/timesheet/entries";

function openOfflineDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(OFFLINE_DB_NAME, OFFLINE_DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      for (const store of [DRAFTS_STORE, OUTBOX_STORE]) {
        if (!db.objectStoreNames.contains(store)) db.createObjectStore(store);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function idbRequest(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function idbTxDone(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

async function flushTimesheetOutbox() {
  const db = await openOfflineDb();
  const items = await idbRequest(db.transaction(OUTBOX_STORE, "readonly").objectStore(OUTBOX_STORE).getAll());
  let retryNeeded = false;

  for (const item of items) {
    if (item.status === "failed") continue;

    let response;
    try {
      response = await fetch(TIMESHEET_ENTRIES_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entry: item.payload, clientMutationId: item.clientMutationId }),
      });
    } catch {
      // Network failure — stop and let the sync event retry later.
      retryNeeded = true;
      break;
    }

    if (response.ok) {
      const tx = db.transaction([OUTBOX_STORE, DRAFTS_STORE], "readwrite");
      tx.objectStore(OUTBOX_STORE).delete(item.clientMutationId);
      tx.objectStore(DRAFTS_STORE).delete(`${item.profileId}:${item.workDate}`);
      await idbTxDone(tx);
    } else if (response.status >= 500) {
      retryNeeded = true;
      break;
    } else {
      let message = "Sync was rejected.";
      try {
        const body = await response.json();
        if (body && body.message) message = body.message;
      } catch {
        // keep default
      }
      const failed = { ...item, status: "failed", attempts: (item.attempts || 0) + 1, lastError: message };
      const tx = db.transaction(OUTBOX_STORE, "readwrite");
      tx.objectStore(OUTBOX_STORE).put(failed, item.clientMutationId);
      await idbTxDone(tx);
    }
  }

  // Throwing keeps the Background Sync registration alive so the browser retries.
  if (retryNeeded) throw new Error("Timesheet outbox flush incomplete.");
}

self.addEventListener("sync", (event) => {
  if (event.tag === OUTBOX_SYNC_TAG) {
    event.waitUntil(flushTimesheetOutbox());
  }
});

self.addEventListener("push", (event) => {
  const data = event.data?.json() ?? {};
  event.waitUntil(
    self.registration.showNotification(data.title ?? "HE Ops", {
      body: data.body ?? "",
      icon: "/icons/app-icon.svg",
      badge: "/icons/app-icon.svg",
      tag: data.tag ?? "timesheet-reminder",
      data: { url: data.url ?? "/timesheet" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? "/timesheet";
  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url.includes(url) && "focus" in client) {
            return client.focus();
          }
        }
        return clients.openWindow(url);
      }),
  );
});
