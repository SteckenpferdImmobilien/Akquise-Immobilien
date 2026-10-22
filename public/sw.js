const CACHE = "akquise-phone-v4-streets";
const FILES = [
  "./phone.html",
  "./app.js",
  "./workspace.js",
  "./streets.js",
  "./model.js",
  "./style.css",
  "./phone.webmanifest",
  "./icon.svg",
  "./brand/steckenpferd-logo.png",
  "./brand/steckenpferd-icon.png",
  "./vendor/leaflet/leaflet.js",
  "./vendor/leaflet/leaflet.css",
];
self.addEventListener("install", (e) =>
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES))),
);
self.addEventListener("activate", (e) =>
  e.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k.startsWith("akquise-phone-") && k !== CACHE)
            .map((k) => caches.delete(k)),
        ),
      ),
  ),
);
self.addEventListener("fetch", (e) => {
  const u = new URL(e.request.url);
  if (
    e.request.method !== "GET" ||
    u.origin !== self.location.origin ||
    u.pathname.includes("/api/")
  )
    return;
  e.respondWith(
    fetch(e.request)
      .then((r) => {
        if (r.ok) {
          const copy = r.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
        }
        return r;
      })
      .catch(() => caches.match(e.request)),
  );
});
