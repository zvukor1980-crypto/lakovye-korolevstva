const VERSION = "lk-1.0.0";
const PRECACHE = [
  "./",
  "./art/castle-emerald.jpg",
  "./art/castle-onyx.jpg",
  "./art/castle-scarlet.jpg",
  "./art/heroes/aelwin.jpg",
  "./art/heroes/ilera.jpg",
  "./art/heroes/lilith.jpg",
  "./art/heroes/mirana.jpg",
  "./art/heroes/noxira.jpg",
  "./art/heroes/serafina.jpg",
  "./art/menu-bg.jpg",
  "./art/units/e-bow.jpg",
  "./art/units/e-dew.jpg",
  "./art/units/e-serpent.jpg",
  "./art/units/e-titan.jpg",
  "./art/units/e-tree.jpg",
  "./art/units/e-uni.jpg",
  "./art/units/e-witch.jpg",
  "./art/units/o-bone.jpg",
  "./art/units/o-dragon.jpg",
  "./art/units/o-knight.jpg",
  "./art/units/o-shade.jpg",
  "./art/units/o-spark.jpg",
  "./art/units/o-vamp.jpg",
  "./art/units/o-wraith.jpg",
  "./art/units/s-champ.jpg",
  "./art/units/s-dragon.jpg",
  "./art/units/s-griff.jpg",
  "./art/units/s-knight.jpg",
  "./art/units/s-page.jpg",
  "./art/units/s-shield.jpg",
  "./art/units/s-xbow.jpg",
  "./css/game.css",
  "./fonts/cormorant-garamond-cyrillic-600-normal.woff2",
  "./fonts/cormorant-garamond-cyrillic-700-normal.woff2",
  "./fonts/manrope-cyrillic-400-normal.woff2",
  "./fonts/manrope-cyrillic-600-normal.woff2",
  "./fonts/manrope-cyrillic-700-normal.woff2",
  "./icons/apple-touch-icon.png",
  "./icons/favicon-32.png",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png",
  "./js/combat.js",
  "./js/data.js",
  "./js/engine.js",
  "./js/main.js",
  "./js/render.js",
  "./js/save.js",
  "./js/ui.js",
  "./js/util.js",
  "./manifest.webmanifest",
  "./version.json"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(VERSION).then((cache) => cache.addAll(PRECACHE)));
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  if (url.pathname.endsWith("/version.json")) {
    event.respondWith(fetch(req, { cache: "no-store" }).catch(() => caches.match(req)));
    return;
  }
  event.respondWith((async () => {
    const cache = await caches.open(VERSION);
    const cached = await cache.match(req);
    const fetchPromise = fetch(req).then((res) => {
      if (res && res.ok) cache.put(req, res.clone());
      return res;
    }).catch(() => cached);
    return cached || fetchPromise;
  })());
});
