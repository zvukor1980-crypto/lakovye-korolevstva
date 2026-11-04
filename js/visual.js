/** Нарисованные тайлы, спрайты и живая анимация фигур. */

import {
  portraitFor, FLAG_RIVER, T_DIRT, T_FOREST, T_GRASS, T_HILL, T_LAVA, T_MOUNTAIN, T_SAND, T_SNOW, T_SWAMP, T_WATER,
} from "./data.js";

const images = new Map();

export function prime(src) {
  if (!src || images.has(src)) return;
  const img = new Image();
  const p = new Promise((resolve) => {
    img.onload = () => { images.set(src, img); resolve(img); };
    img.onerror = () => { images.set(src, null); resolve(null); };
  });
  images.set(src, p);
  img.src = src;
}

export function imageSync(src) {
  const v = images.get(src);
  if (v && typeof v.then !== "function") return v;
  return null;
}

const GROUND = {
  [T_GRASS]: ["art/tiles/atlas-grass.jpg"],
  [T_FOREST]: ["art/tiles/atlas-grass.jpg"],
  [T_HILL]: ["art/tiles/atlas-grass.jpg"],
  [T_DIRT]: ["art/tiles/atlas-dirt.jpg"],
  [T_SAND]: ["art/tiles/atlas-dirt.jpg"],
  [T_SNOW]: ["art/tiles/atlas-snow.jpg"],
  [T_SWAMP]: ["art/tiles/atlas-grass.jpg"],
  [T_WATER]: ["art/tiles/atlas-water.jpg"],
  [T_MOUNTAIN]: ["art/tiles/atlas-snow.jpg"],
  [T_LAVA]: ["art/tiles/atlas-dirt.jpg"],
};

export function groundSrc(type, x, y) {
  const list = GROUND[type] || GROUND[T_GRASS];
  return list[(Math.abs(x * 3 + y * 5) >>> 0) % list.length];
}

export const SPR = {
  tree: "art/sprites/tree.webp",
  mountain: "art/sprites/mountain.webp",
  chest: "art/sprites/chest.webp",
  gold: "art/sprites/gold.webp",
  mine: "art/sprites/mine.webp",
  shrine: "art/sprites/shrine.webp",
  tavern: "art/sprites/tavern.webp",
  mage: "art/sprites/mage.webp",
  castle: {
    scarlet: "art/sprites/castle-scarlet.webp",
    emerald: "art/sprites/castle-emerald.webp",
    onyx: "art/sprites/castle-onyx.webp",
  },
  battle: {
    grass: "art/battle/sun.jpg",
    forest: "art/battle/sun.jpg",
    sand: "art/battle/sun.jpg",
    snow: "art/battle/snow.jpg",
    swamp: "art/battle/sun.jpg",
    lava: "art/battle/sun.jpg",
  },
  town: {
    scarlet: "art/towns/scarlet.jpg",
    emerald: "art/towns/emerald.jpg",
    onyx: "art/towns/onyx.jpg",
  },
};

export function bodySrc(id) {
  return portraitFor(id);
}
export function rideSrc(id) {
  return `art/ride/${id}.webp`;
}

export function preloadWorld() {
  for (const list of Object.values(GROUND)) for (const s of list) prime(s);
  for (const s of [SPR.tree, SPR.mountain, SPR.chest, SPR.gold, SPR.mine, SPR.shrine, SPR.tavern, SPR.mage]) prime(s);
  for (const s of Object.values(SPR.castle)) prime(s);
  for (const s of Object.values(SPR.battle)) prime(s);
  for (const s of Object.values(SPR.town)) prime(s);
}

export function diamondPath(ctx, dw, dh) {
  ctx.beginPath();
  ctx.moveTo(0, -dh / 2);
  ctx.lineTo(dw / 2, 0);
  ctx.lineTo(0, dh / 2);
  ctx.lineTo(-dw / 2, 0);
  ctx.closePath();
}

function blitWrap(ctx, img, sx, sy, sw, sh, dx, dy, dw, dh) {
  const tw = img.width;
  const th = img.height;
  sx = ((sx % tw) + tw) % tw;
  sy = ((sy % th) + th) % th;
  const w1 = Math.min(sw, tw - sx);
  const h1 = Math.min(sh, th - sy);
  const sx2 = w1 / sw;
  const sy2 = h1 / sh;
  ctx.drawImage(img, sx, sy, w1, h1, dx, dy, dw * sx2, dh * sy2);
  if (w1 < sw) ctx.drawImage(img, 0, sy, sw - w1, h1, dx + dw * sx2, dy, dw * (1 - sx2), dh * sy2);
  if (h1 < sh) ctx.drawImage(img, sx, 0, w1, sh - h1, dx, dy + dh * sy2, dw * sx2, dh * (1 - sy2));
  if (w1 < sw && h1 < sh) ctx.drawImage(img, 0, 0, sw - w1, sh - h1, dx + dw * sx2, dy + dh * sy2, dw * (1 - sx2), dh * (1 - sy2));
}

export function drawGround(ctx, img, dw, dh, type, time, x, y) {
  if (!img) return false;
  ctx.save();
  diamondPath(ctx, dw + 2, dh + 2);
  ctx.clip();
  const span = 72;
  const drift = type === T_WATER ? time / 40 : 0;
  const sx = x * span;
  const sy = y * span * 0.55 + drift;
  blitWrap(ctx, img, sx, sy, span, Math.max(16, span * 0.55), -dw / 2, -dh / 2, dw, dh);
  if (type === T_LAVA) {
    ctx.globalCompositeOperation = "multiply";
    ctx.fillStyle = "rgba(180, 40, 10, .55)";
    ctx.fillRect(-dw, -dh, dw * 2, dh * 2);
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = 0.35 + Math.sin(time / 180 + x) * 0.15;
    ctx.fillStyle = "#ffb020";
    ctx.fillRect(-dw * 0.2, -dh * 0.1, dw * 0.25, 2);
  }
  if (type === T_WATER || (type !== T_MOUNTAIN && false)) {
    /* вода отдельно */
  }
  if (type === T_WATER) {
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = 0.35;
    const ox = ((time / 18 + x * 12) % (dw + 20)) - dw / 2;
    ctx.fillStyle = "#e7fbff";
    ctx.fillRect(ox, -dh / 2, dw * 0.12, dh);
    ctx.globalAlpha = 0.2;
    ctx.fillRect(ox - dw * 0.4, -dh * 0.2, dw * 0.08, dh);
  }
  ctx.restore();
  return true;
}

export function drawRiver(ctx, dw, dh, time, ford) {
  ctx.save();
  diamondPath(ctx, dw, dh);
  ctx.clip();
  const ox = Math.sin(time / 280) * 3;
  const g = ctx.createLinearGradient(-dw / 2, 0, dw / 2, 0);
  g.addColorStop(0, "rgba(14, 80, 120, 0)");
  g.addColorStop(0.45, ford ? "rgba(186, 230, 253, .55)" : "rgba(56, 189, 248, .82)");
  g.addColorStop(1, "rgba(14, 80, 120, 0)");
  ctx.fillStyle = g;
  ctx.fillRect(-dw / 2, -dh * 0.18 + ox * 0.2, dw, dh * 0.28);
  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = 0.45;
  ctx.fillStyle = "#f8fdff";
  ctx.fillRect(((time / 12) % dw) - dw / 2, -dh * 0.08, 8, 2);
  ctx.restore();
}

/** Фигура с дыханием, покачиванием, бликом, рывком и вспышкой. Ноги — точка опоры. */
export function drawFigure(ctx, img, x, y, height, time, opt = {}) {
  if (!img) return;
  const w = height * (img.width / img.height);
  const seed = opt.seed || 0;
  const breathe = 1 + Math.sin(time / 420 + seed) * 0.018;
  const sway = Math.sin(time / 700 + seed) * (opt.sway ?? 0.03);
  let bob = Math.sin(time / 260 + seed) * (opt.bob ?? 1.5);
  const fx = opt.fx;
  let age = 0;
  if (fx) age = (performance.now() - fx.t0) / 700;
  let dx = 0;
  let alpha = 1;
  let bright = 1;
  let rot = sway;
  if (fx && fx.kind === "attack" && age < 1) {
    const k = Math.sin(Math.min(1, age) * Math.PI);
    dx = (fx.dir || 1) * k * height * 0.28;
  }
  if (fx && fx.kind === "hit" && age < 1) {
    dx = (fx.dir || 1) * (1 - age) * height * 0.12;
    bright = 1.7;
  }
  if (fx && fx.kind === "die") {
    alpha = Math.max(0, 1 - age);
    rot += age * 0.4;
    bob -= age * height * 0.2;
  }
  ctx.save();
  ctx.translate(x + dx, y + bob);
  ctx.rotate(rot);
  ctx.scale(opt.flip ? -breathe : breathe, breathe);
  ctx.globalAlpha = alpha;
  if (bright > 1.05) ctx.filter = `brightness(${bright})`;
  ctx.drawImage(img, -w / 2, -height, w, height);
  ctx.filter = "none";
  ctx.restore();
}

export function drawClouds(ctx, w, h, time) {
  ctx.save();
  for (let i = 0; i < 3; i++) {
    const x = ((time / 80 + i * 180) % (w + 160)) - 80;
    const y = 18 + i * 22;
    ctx.globalAlpha = 0.14;
    ctx.fillStyle = "#f4efe4";
    ctx.beginPath();
    ctx.ellipse(x, y, 36, 12, 0, 0, Math.PI * 2);
    ctx.ellipse(x + 22, y + 2, 24, 10, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

export function torch(ctx, x, y, time) {
  const f = 0.7 + Math.sin(time / 70) * 0.3;
  const g = ctx.createRadialGradient(x, y, 0, x, y, 10 * f);
  g.addColorStop(0, "rgba(255, 220, 120, .95)");
  g.addColorStop(1, "rgba(255, 80, 0, 0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, 10 * f, 0, Math.PI * 2);
  ctx.fill();
}
