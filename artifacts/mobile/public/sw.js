// JISHLink Service Worker — minimal offline shell caching
const CACHE = "jishlink-v1";
const SHELL = ["/mobile/", "/mobile/index.html"];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  // For navigation requests, serve shell from cache (SPA fallback)
  if (e.request.mode === "navigate") {
    e.respondWith(
      fetch(e.request).catch(() => caches.match("/mobile/index.html"))
    );
    return;
  }
  // For API requests (any request going to a different domain than this app itself), always go network
  const requestUrl = new URL(e.request.url);
  if (requestUrl.origin !== self.location.origin) {
    e.respondWith(fetch(e.request));
    return;
  }
  // Cache-first for static assets
  e.respondWith(
    caches.match(e.request).then((cached) => cached ?? fetch(e.request))
  );
});
