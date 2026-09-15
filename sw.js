const CACHE_NAME = "dnevnik-v18-cloud-sync";
const scopePath = new URL(self.registration.scope).pathname;
const BASE_PATH = scopePath.endsWith("/") ? scopePath.slice(0, -1) : scopePath;
const APP_SHELL = [
  `${BASE_PATH}/`,
  `${BASE_PATH}/manifest.json`,
  `${BASE_PATH}/icon.svg`,
  `${BASE_PATH}/icon-192.png`,
  `${BASE_PATH}/icon-512.png`,
  `${BASE_PATH}/apple-touch-icon.png`
];

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(APP_SHELL.map((url) => new Request(new URL(url, self.registration.scope), { cache: "reload" })));
    const shell = await cache.match(APP_SHELL[0]);
    const html = await shell.text();
    const assets = [...html.matchAll(/(?:src|href)="([^"]+)"/g)]
      .map(match => new URL(match[1], self.registration.scope))
      .filter(url => url.origin === self.location.origin && url.pathname.startsWith(BASE_PATH + "/_next/static/") && /\.(js|css)$/.test(url.pathname));
    await cache.addAll([...new Set(assets.map(url => url.href))].map(url => new Request(url, { cache: "reload" })));
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith("dnevnik-") && key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== self.location.origin || url.pathname.includes("/api/")) return;
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.put(`${BASE_PATH}/`, copy)));
          }
          return response;
        })
        .catch(async () => (await caches.match(`${BASE_PATH}/`)) || new Response("Нет сети. Подключитесь к интернету и откройте ежедневник снова.", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } }))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const network = fetch(event.request).then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return response;
      }).catch(() => cached);
      return cached || network;
    })
  );
});
