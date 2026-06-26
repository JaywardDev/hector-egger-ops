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
