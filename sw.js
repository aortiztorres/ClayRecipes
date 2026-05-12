const CACHE = "clayrecipes-v3";
const ASSETS = [
  "/ClayRecipes/",
  "/ClayRecipes/index.html",
  "/ClayRecipes/app.js",
  "/ClayRecipes/i18n.js",
  "/ClayRecipes/manifest.json",
  "/ClayRecipes/icon-192.png",
  "/ClayRecipes/icon-512.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  // No interceptar peticiones a Firebase ni a Google
  if (
    e.request.url.includes("firestore.googleapis.com") ||
    e.request.url.includes("firebase") ||
    e.request.url.includes("gstatic.com") ||
    e.request.url.includes("googleapis.com") ||
    e.request.url.includes("fonts.google")
  ) return;

  e.respondWith(
    fetch(e.request)
      .then((r) => {
        const clone = r.clone();
        caches.open(CACHE).then((c) => c.put(e.request, clone));
        return r;
      })
      .catch(() => caches.match(e.request))
  );
});
