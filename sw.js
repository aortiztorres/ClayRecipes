const CACHE = "clayrecipes-v2";
const ASSETS = [
  "/ClayRecipes/",
  "/ClayRecipes/index.html",
  "/ClayRecipes/app.js",
  "/ClayRecipes/manifest.json",
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
  // No interceptar peticiones a Firebase
  if (
    e.request.url.includes("firestore.googleapis.com") ||
    e.request.url.includes("firebase") ||
    e.request.url.includes("gstatic.com")
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
