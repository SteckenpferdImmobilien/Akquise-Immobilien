/* Each release keeps its HTML and assets together. Personal data stays in IndexedDB. */
const BUILD =
  "__AKQUISE_BUILD__" === "__" + "AKQUISE_BUILD__"
    ? "2026.10.22-update-1"
    : "__AKQUISE_BUILD__";
const CACHE = "akquise-phone-" + BUILD;
const FILES = [
  "./",
  "./phone.html",
  "./index.html",
  "./app.js",
  "./workspace.js",
  "./streets.js",
  "./updates.js",
  "./model.js",
  "./style.css",
  "./phone.webmanifest",
  "./icon.svg",
  "./brand/steckenpferd-logo.png",
  "./brand/steckenpferd-icon.png",
  "./vendor/leaflet/leaflet.js",
  "./vendor/leaflet/leaflet.css",
];
const scope = new URL("./", self.location.href);
const versioned = (path) => {
  const u = new URL(path, scope);
  u.searchParams.set("build", BUILD);
  return u.href;
};
self.addEventListener("install", (e) =>
  e.waitUntil(
    caches
      .open(CACHE)
      .then((cache) =>
        cache.addAll(
          FILES.map(
            (path) => new Request(versioned(path), { cache: "reload" }),
          ),
        ),
      ),
  ),
);
self.addEventListener("message", (e) => {
  if (e.data?.type === "ACTIVATE_UPDATE") e.waitUntil(self.skipWaiting());
  if (e.data?.type === "GET_VERSION") e.ports[0]?.postMessage({ build: BUILD });
});
self.addEventListener("activate", (e) =>
  e.waitUntil(
    (async () => {
      await self.clients.claim();
      // Only app shell caches are retired; IndexedDB/localStorage and user exports are untouched.
      for (const key of await caches.keys())
        if (key.startsWith("akquise-phone-") && key !== CACHE)
          await caches.delete(key);
    })(),
  ),
);
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (
    e.request.method !== "GET" ||
    url.origin !== scope.origin ||
    url.pathname.includes("/api/")
  )
    return;
  const relative = "./" + url.pathname.slice(scope.pathname.length);
  if (!url.pathname.startsWith(scope.pathname) || !FILES.includes(relative))
    return;
  e.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      const cached = await cache.match(e.request, { ignoreSearch: true });
      if (cached) return cached;
      // Do not put a partial/mixed release into an already installed shell cache.
      return fetch(e.request, { cache: "no-store" });
    })(),
  );
});
