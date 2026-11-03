const VERSION = "lk-1.1.0";
const PRECACHE = [
  "./",
  "./art/battle/meadow.jpg",
  "./art/battle/snow.jpg",
  "./art/bodies/e_bow.webp",
  "./art/bodies/e_bow_u.webp",
  "./art/bodies/e_dew.webp",
  "./art/bodies/e_dew_u.webp",
  "./art/bodies/e_serpent.webp",
  "./art/bodies/e_serpent_u.webp",
  "./art/bodies/e_titan.webp",
  "./art/bodies/e_titan_u.webp",
  "./art/bodies/e_tree.webp",
  "./art/bodies/e_tree_u.webp",
  "./art/bodies/e_uni.webp",
  "./art/bodies/e_uni_u.webp",
  "./art/bodies/e_witch.webp",
  "./art/bodies/e_witch_u.webp",
  "./art/bodies/n_bandit.webp",
  "./art/bodies/n_nomad.webp",
  "./art/bodies/o_bone.webp",
  "./art/bodies/o_bone_u.webp",
  "./art/bodies/o_dragon.webp",
  "./art/bodies/o_dragon_u.webp",
  "./art/bodies/o_knight.webp",
  "./art/bodies/o_knight_u.webp",
  "./art/bodies/o_shade.webp",
  "./art/bodies/o_shade_u.webp",
  "./art/bodies/o_spark.webp",
  "./art/bodies/o_spark_u.webp",
  "./art/bodies/o_vamp.webp",
  "./art/bodies/o_vamp_u.webp",
  "./art/bodies/o_wraith.webp",
  "./art/bodies/o_wraith_u.webp",
  "./art/bodies/s_champ.webp",
  "./art/bodies/s_champ_u.webp",
  "./art/bodies/s_dragon.webp",
  "./art/bodies/s_dragon_u.webp",
  "./art/bodies/s_griff.webp",
  "./art/bodies/s_griff_u.webp",
  "./art/bodies/s_knight.webp",
  "./art/bodies/s_knight_u.webp",
  "./art/bodies/s_page.webp",
  "./art/bodies/s_page_u.webp",
  "./art/bodies/s_shield.webp",
  "./art/bodies/s_shield_u.webp",
  "./art/bodies/s_xbow.webp",
  "./art/bodies/s_xbow_u.webp",
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
  "./art/ride/aelwin.webp",
  "./art/ride/brienne.webp",
  "./art/ride/cassia.webp",
  "./art/ride/ilera.webp",
  "./art/ride/lilith.webp",
  "./art/ride/lorena.webp",
  "./art/ride/mirana.webp",
  "./art/ride/morvana.webp",
  "./art/ride/noxira.webp",
  "./art/ride/serafina.webp",
  "./art/ride/silva.webp",
  "./art/ride/umbra.webp",
  "./art/sprites/castle-emerald.webp",
  "./art/sprites/castle-onyx.webp",
  "./art/sprites/castle-scarlet.webp",
  "./art/sprites/chest.webp",
  "./art/sprites/gold.webp",
  "./art/sprites/mage.webp",
  "./art/sprites/mine.webp",
  "./art/sprites/mountain.webp",
  "./art/sprites/shrine.webp",
  "./art/sprites/tavern.webp",
  "./art/sprites/tree.webp",
  "./art/tiles/grass.jpg",
  "./art/tiles/grass2.jpg",
  "./art/tiles/road.jpg",
  "./art/tiles/rock.jpg",
  "./art/tiles/sand.jpg",
  "./art/tiles/snow.jpg",
  "./art/tiles/swamp.jpg",
  "./art/tiles/water.jpg",
  "./art/towns/emerald.jpg",
  "./art/towns/onyx.jpg",
  "./art/towns/scarlet.jpg",
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
  "./js/music.js",
  "./js/render.js",
  "./js/save.js",
  "./js/ui.js",
  "./js/util.js",
  "./js/visual.js",
  "./manifest.webmanifest",
  "./version.json"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(VERSION).then((cache) => cache.addAll(PRECACHE).catch(() => cache.addAll(["./", "./index.html", "./js/main.js", "./css/game.css", "./version.json"]))));
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
