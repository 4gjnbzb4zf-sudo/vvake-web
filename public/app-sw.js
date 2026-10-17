/*
 * VVake on the web: the app shell's service worker (registered by src/components/webapp/WebApp.tsx with the scope
 * /<lang>/app/), so the home-screen app opens offline and a workout in IndexedDB can be resumed without a network.
 *
 * - The app page itself: network first (always the newest build), the cached copy when offline.
 * - Next's hashed files (/_next/static/), the VVaker pictures, the icons and the map's worker: cache first (their
 *   names change with their content).
 * - Never cached: the VVake API and the map tiles (other origins: the page's own code handles offline for those),
 *   and anything that isn't a GET.
 */
const VERSION = "vvake-app-v1";
const SHELL = VERSION + "-shell";
const STATIC = VERSION + "-static";

self.addEventListener("install", (event) => {
  const page = new URL(self.registration.scope).pathname;
  event.waitUntil(
    caches
      .open(SHELL)
      .then((c) => c.addAll([page]))
      .catch(() => undefined)
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("vvake-app-") && !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

const STATIC_PATHS = ["/_next/static/", "/personas/", "/app-icons/", "/maplibre/"];

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(SHELL).then((c) => c.put(url.pathname, copy));
          }
          return res;
        })
        .catch(() =>
          caches.match(url.pathname, { cacheName: SHELL }).then((r) => r || caches.match(new URL(self.registration.scope).pathname)),
        ),
    );
    return;
  }

  if (STATIC_PATHS.some((p) => url.pathname.startsWith(p))) {
    event.respondWith(
      caches.open(STATIC).then((c) =>
        c.match(req).then(
          (hit) =>
            hit ||
            fetch(req).then((res) => {
              if (res.ok) c.put(req, res.clone());
              return res;
            }),
        ),
      ),
    );
  }
});
