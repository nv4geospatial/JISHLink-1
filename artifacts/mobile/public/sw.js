// JISHLink Service Worker — minimal offline shell caching
const CACHE = "jishlink-v3";
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
  // For navigation requests, serve from cache first for instant load,
  // fallback to network if cache miss
  if (e.request.mode === "navigate") {
    e.respondWith(
      caches.match("/mobile/index.html").then((cached) => {
        // Return cached immediately for speed; update in background
        if (cached) {
          e.waitUntil(
            fetch(e.request)
              .then((response) => {
                if (response && response.status === 200) {
                  return caches.open(CACHE).then((cache) => cache.put("/mobile/index.html", response.clone()));
                }
              })
              .catch(() => {})
          );
          return cached;
        }
        // No cache: fetch from network
        return fetch(e.request).catch(() => caches.match("/mobile/index.html"));
      })
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
