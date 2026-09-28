/* Il "postino" di EON (29/09/2026): riceve i promemoria degli impegni e li
   mostra come notifica, anche ad app chiusa. Non tocca nient'altro (nessuna
   cache, nessuna richiesta intercettata). */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("push", (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (x) { d = { title: "EON", body: e.data ? e.data.text() : "" }; }
  e.waitUntil(self.registration.showNotification(d.title || "EON", {
    body: d.body || "", icon: "/icone/eon-192.png", badge: "/icone/eon-192.png", tag: d.tag || undefined,
    data: { url: d.url || "/index.html" },
  }));
});
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || "/index.html";
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((finestre) => {
    for (const f of finestre) if ("focus" in f) return f.focus();
    return self.clients.openWindow(url);
  }));
});
