const CACHE_NAME = "houra-v2-shell-v3";
const APP_SHELL = ["/", "/dashboard", "/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      caches.keys().then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))),
      ),
      self.clients.claim(),
    ]),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);

  // Only manage same-origin requests. Avoid caching third-party scripts (e.g. Clerk).
  if (url.origin !== self.location.origin) {
    return;
  }

  // Navigations: network-first with app-shell fallback.
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(url.pathname, copy));
          return response;
        })
        .catch(() => caches.match(event.request).then((cached) => cached || caches.match("/dashboard"))),
    );
    return;
  }

  // Static assets: cache-first, but never fall back to HTML.
  if (
    url.pathname.startsWith("/_next/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname === "/favicon.ico" ||
    url.pathname === "/manifest.webmanifest"
  ) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          return response;
        });
      }),
    );
    return;
  }

  // Everything else: network-first with cache fallback.
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request)),
  );
});
