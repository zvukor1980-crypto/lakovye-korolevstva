/** Изометрия карты и гексагональный бой. */

import { CREATURES, FACTIONS, portraitFor } from "./data.js";
import { BCOLS, BROWS, hexDist, hexNeighbors } from "./combat.js";
import {
  FLAG_FORD, FLAG_RIVER, FLAG_ROAD, T_DIRT, T_FOREST, T_GRASS, T_HILL, T_LAVA,
  T_MOUNTAIN, T_SAND, T_SNOW, T_SWAMP, T_WATER,
} from "./data.js";
import { effective, heroAt, inVision, objectAt, remembered, townAt } from "./engine.js";
import {
  SPR, bodySrc, drawClouds, drawFigure, drawGround, drawRiver, groundSrc, imageSync as painted, preloadWorld, prime as primeArt, rideSrc, torch,
} from "./visual.js";

export const TW = 64;
export const TH = 32;

const images = new Map();
export function preload(src) {
  if (!src) return Promise.resolve(null);
  if (images.has(src)) return images.get(src);
  const p = new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
  images.set(src, p);
  return p;
}
export function imageSync(src) {
  const v = images.get(src);
  if (v && typeof v.then !== "function") return v;
  return null;
}
function prime(src) {
  if (!src || images.has(src)) return;
  const img = new Image();
  const p = new Promise((resolve) => {
    img.onload = () => { images.set(src, img); resolve(img); };
    img.onerror = () => { images.set(src, null); resolve(null); };
  });
  images.set(src, p);
  img.src = src;
}

const tileCache = new Map();
function diamond(ctx, w, h) {
  ctx.beginPath();
  ctx.moveTo(w / 2, 0);
  ctx.lineTo(w, h / 2);
  ctx.lineTo(w / 2, h);
  ctx.lineTo(0, h / 2);
  ctx.closePath();
}
function tileCanvas(type, variant) {
  const key = type + ":" + variant;
  if (tileCache.has(key)) return tileCache.get(key);
  const c = document.createElement("canvas");
  c.width = TW;
  c.height = TH;
  const g = c.getContext("2d");
  const pal = {
    [T_GRASS]: ["#8fd18a", "#2f8f45", "#174d28"],
    [T_DIRT]: ["#e4c48a", "#a67a42", "#5c3d22"],
    [T_SAND]: ["#ffe3a8", "#e2b15a", "#8a6a32"],
    [T_SNOW]: ["#ffffff", "#d5e4f2", "#8aa4be"],
    [T_SWAMP]: ["#9bbf78", "#3d6a40", "#1b3324"],
    [T_LAVA]: ["#ffb15a", "#c2411a", "#3a100c"],
    [T_HILL]: ["#b7d98a", "#5d8a3e", "#2c4a24"],
    [T_FOREST]: ["#6eae62", "#245c34", "#102818"],
    [T_WATER]: ["#b7f4ff", "#1e88b5", "#0a3c58"],
    [T_MOUNTAIN]: ["#f4f7fb", "#8b97a8", "#3d4654"],
  }[type] || ["#ccc", "#888", "#333"];
  const rng = mulberry(type * 97 + variant * 13);
  g.save();
  diamond(g, TW, TH);
  g.clip();
  g.fillStyle = pal[1];
  g.fillRect(0, 0, TW, TH);
  const grd = g.createRadialGradient(TW * 0.35, TH * 0.28, 4, TW / 2, TH / 2, TW * 0.7);
  grd.addColorStop(0, pal[0]);
  grd.addColorStop(1, "rgba(0,0,0,0)");
  g.globalAlpha = 0.55;
  g.fillStyle = grd;
  g.fillRect(0, 0, TW, TH);
  g.globalAlpha = 1;
  for (let i = 0; i < 28; i++) {
    g.globalAlpha = 0.08 + rng() * 0.12;
    g.fillStyle = rng() > 0.45 ? "#fff" : "#02140a";
    g.beginPath();
    g.ellipse(8 + rng() * (TW - 16), 6 + rng() * (TH - 12), 1 + rng() * 2.2, 0.6, rng(), 0, Math.PI * 2);
    g.fill();
  }
  g.globalAlpha = 1;
  if (type === T_GRASS || type === T_FOREST || type === T_HILL) {
    for (let i = 0; i < 7; i++) {
      const x = 16 + rng() * (TW - 32);
      const y = 12 + rng() * (TH - 20);
      g.strokeStyle = rng() > 0.5 ? "rgba(236, 252, 203, .55)" : "rgba(20, 70, 30, .45)";
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(x, y);
      g.quadraticCurveTo(x + 2, y - 4, x + (rng() - 0.5) * 4, y - 6);
      g.stroke();
    }
  }
  if (type === T_WATER) {
    g.strokeStyle = "rgba(255,255,255,.35)";
    g.beginPath();
    g.moveTo(18, TH * 0.45);
    g.bezierCurveTo(36, TH * 0.3, 58, TH * 0.62, 78, TH * 0.42);
    g.stroke();
  }
  if (type === T_LAVA) {
    g.strokeStyle = "rgba(255, 220, 120, .8)";
    g.beginPath();
    g.moveTo(22, 18); g.lineTo(40, 26); g.lineTo(58, 16); g.lineTo(70, 24);
    g.stroke();
  }
  // мягкая тень кромки, без клетчатой обводки
  const shade = g.createLinearGradient(0, TH * 0.55, 0, TH);
  shade.addColorStop(0, "rgba(0,0,0,0)");
  shade.addColorStop(1, "rgba(0,0,0,.28)");
  g.fillStyle = shade;
  g.fillRect(0, 0, TW, TH);
  g.restore();
  tileCache.set(key, c);
  return c;
}
function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function tileCenter(x, y) {
  return { x: (x - y) * (TW / 2), y: (x + y) * (TH / 2) };
}
export function screenToTile(sx, sy, cam, w, h) {
  const wx = (sx - w / 2) / cam.zoom + cam.x;
  const wy = (sy - h / 2) / cam.zoom + cam.y;
  const fx = (wx / (TW / 2) + wy / (TH / 2)) / 2;
  const fy = (wy / (TH / 2) - wx / (TW / 2)) / 2;
  let best = null, bd = 1e9;
  for (let y = Math.floor(fy) - 1; y <= Math.floor(fy) + 1; y++) {
    for (let x = Math.floor(fx) - 1; x <= Math.floor(fx) + 1; x++) {
      const c = tileCenter(x, y);
      const dx = Math.abs(wx - c.x) / (TW / 2);
      const dy = Math.abs(wy - c.y) / (TH / 2);
      const d = dx + dy;
      if (d <= 1 && d < bd) { bd = d; best = { x, y }; }
    }
  }
  return best;
}

function toScreen(wx, wy, cam, w, h) {
  return {
    x: Math.round((wx - cam.x) * cam.zoom + w / 2),
    y: Math.round((wy - cam.y) * cam.zoom + h / 2),
  };
}

const TILE_INK = {
  [T_GRASS]: ["#3f8a34", "#2f6d28", "#67a84a"],
  [T_FOREST]: ["#2f7a30", "#1f5c22", "#4e9a3c"],
  [T_HILL]: ["#6a8a3a", "#4d6a28", "#8aaa52"],
  [T_DIRT]: ["#a78448", "#8a6840", "#c4a060"],
  [T_SAND]: ["#d2b56a", "#c4a25a", "#e6d090"],
  [T_SNOW]: ["#e7eef2", "#d5dee6", "#f7fbfd"],
  [T_SWAMP]: ["#3d6840", "#2a4a30", "#5a7848"],
  [T_WATER]: ["#2f78b0", "#1d5e90", "#7ec8ea"],
  [T_MOUNTAIN]: ["#8b9098", "#5c636c", "#c5ccd4"],
  [T_LAVA]: ["#8a3018", "#5a180c", "#e07030"],
};

function paintIso(ctx, type, dw, dh, x, y) {
  const cols = TILE_INK[type] || TILE_INK[T_GRASS];
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(0, -(dh + 6) / 2);
  ctx.lineTo((dw + 6) / 2, 0);
  ctx.lineTo(0, (dh + 6) / 2);
  ctx.lineTo(-(dw + 6) / 2, 0);
  ctx.closePath();
  ctx.clip();
  ctx.fillStyle = cols[0];
  ctx.fillRect(-dw - 4, -dh - 4, dw * 2 + 8, dh * 2 + 8);
  ctx.restore();
}

export function clampCamera(cam, state, viewW, viewH) {
  if (!state || !state.map) return;
  const z = Math.max(0.8, Math.min(cam.zoom, 2));
  cam.zoom = z;
  const halfW = viewW / 2 / z;
  const halfH = viewH / 2 / z;
  const pts = [
    tileCenter(0, 0),
    tileCenter(state.map.w - 1, 0),
    tileCenter(0, state.map.h - 1),
    tileCenter(state.map.w - 1, state.map.h - 1),
  ];
  const minX = Math.min(...pts.map((p) => p.x)) - TW;
  const maxX = Math.max(...pts.map((p) => p.x)) + TW;
  const minY = Math.min(...pts.map((p) => p.y)) - TH;
  const maxY = Math.max(...pts.map((p) => p.y)) + TH;
  if (maxX - minX <= halfW * 2) cam.x = (minX + maxX) / 2;
  else cam.x = Math.min(maxX - halfW, Math.max(minX + halfW, cam.x));
  if (maxY - minY <= halfH * 2) cam.y = (minY + maxY) / 2;
  else cam.y = Math.min(maxY - halfH, Math.max(minY + halfH, cam.y));
}

const PAINT = {
  [T_GRASS]: "art/tiles/paint-grass.jpg",
  [T_FOREST]: "art/tiles/paint-grass.jpg",
  [T_HILL]: "art/tiles/paint-grass.jpg",
  [T_DIRT]: "art/tiles/paint-dirt.jpg",
  [T_SAND]: "art/tiles/paint-sand.jpg",
  [T_SNOW]: "art/tiles/paint-snow.jpg",
  [T_SWAMP]: "art/tiles/paint-grass.jpg",
  [T_WATER]: "art/tiles/paint-water.jpg",
  [T_MOUNTAIN]: "art/tiles/paint-rock.jpg",
  [T_LAVA]: "art/tiles/paint-dirt.jpg",
};
let terrainBake = null;

function stampWrap(g, img, dx, dy, size, ox, oy) {
  const tw = img.naturalWidth || img.width;
  const th = img.naturalHeight || img.height;
  if (!tw || !th) return;
  const sx0 = ((ox % tw) + tw) % tw;
  const sy0 = ((oy % th) + th) % th;
  const w1 = Math.min(size, tw - sx0);
  const h1 = Math.min(size, th - sy0);
  g.drawImage(img, sx0, sy0, w1, h1, dx, dy, w1, h1);
  if (w1 < size) g.drawImage(img, 0, sy0, size - w1, h1, dx + w1, dy, size - w1, h1);
  if (h1 < size) g.drawImage(img, sx0, 0, w1, size - h1, dx, dy + h1, w1, size - h1);
  if (w1 < size && h1 < size) g.drawImage(img, 0, 0, size - w1, size - h1, dx + w1, dy + h1, size - w1, size - h1);
}

function ensureTerrain(state) {
  const S = 48;
  for (const src of new Set(Object.values(PAINT))) primeArt(src);
  primeArt("art/sprites/pine.webp");
  primeArt("art/sprites/windmill.webp");
  const ready = painted(PAINT[T_GRASS]) ? 1 : 0;
  const key = `${state.scenarioId}|${state.map.w}x${state.map.h}|${state.rngState}|${ready}`;
  if (terrainBake && terrainBake.key === key) return terrainBake;
  const mw = state.map.w, mh = state.map.h;
  const canvas = document.createElement("canvas");
  canvas.width = mw * S;
  canvas.height = mh * S;
  const g = canvas.getContext("2d");
  g.imageSmoothingEnabled = true;
  const grassImg = painted(PAINT[T_GRASS]);
  if (grassImg) {
    const pat = g.createPattern(grassImg, "repeat");
    if (pat) { g.fillStyle = pat; g.fillRect(0, 0, canvas.width, canvas.height); }
  }
  for (let y = 0; y < mh; y++) {
    for (let x = 0; x < mw; x++) {
      const i = y * mw + x;
      const type = state.map.terrain[i];
      const flags = state.map.flags[i];
      const road = (flags & FLAG_ROAD) && type !== T_WATER && type !== T_MOUNTAIN && type !== T_LAVA;
      const use = road ? T_DIRT : type;
      if (use !== T_GRASS && use !== T_FOREST && use !== T_HILL && use !== T_SWAMP) {
        const img = painted(PAINT[use] || PAINT[T_GRASS]);
        if (img) stampWrap(g, img, x * S, y * S, S + 1, x * S, y * S);
        else { g.fillStyle = type === T_WATER ? "#2a6ea8" : "#b08958"; g.fillRect(x * S, y * S, S + 1, S + 1); }
      }
      if (flags & FLAG_RIVER) {
        g.fillStyle = flags & FLAG_FORD ? "rgba(196,228,244,.8)" : "rgba(36,112,176,.92)";
        g.fillRect(x * S + 16, y * S, 16, S);
      }
    }
  }
  terrainBake = { key, canvas, S };
  return terrainBake;
}

let shroudA = null;
let shroudB = null;
function drawShroud(ctx, cells, state, playerId, S, dpr, kx, ky, ox, oy, w, h, base) {
  const W = Math.max(1, Math.round(w * dpr));
  const H = Math.max(1, Math.round(h * dpr));
  if (!shroudA) {
    shroudA = document.createElement("canvas");
    shroudB = document.createElement("canvas");
  }
  if (shroudA.width !== W || shroudA.height !== H) {
    shroudA.width = shroudB.width = W;
    shroudA.height = shroudB.height = H;
  }
  const g = shroudA.getContext("2d");
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.clearRect(0, 0, W, H);
  g.setTransform(dpr * kx, dpr * ky, -dpr * kx, dpr * ky, dpr * ox, dpr * oy);
  g.fillStyle = "rgba(8,20,10,0.94)";
  for (const [x, y] of cells) {
    if (!remembered(state, playerId, x, y)) g.fillRect(x * S, y * S, S, S);
  }
  const b = shroudB.getContext("2d");
  b.setTransform(1, 0, 0, 1, 0, 0);
  b.clearRect(0, 0, W, H);
  b.filter = "blur(12px)";
  b.drawImage(shroudA, 0, 0);
  b.filter = "none";
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(shroudB, 0, 0);
  ctx.setTransform(base);
}

function drawPine(ctx, sx, sy, zoom, seed) {
  const img = painted("art/sprites/pine.webp");
  const h = (34 + (Math.abs(seed) % 14)) * zoom;
  if (img) {
    drawFigure(ctx, img, sx, sy + 4 * zoom, h, 0, { seed, bob: 0, sway: 0.02 });
    return;
  }
  ctx.save();
  ctx.translate(sx, sy);
  ctx.fillStyle = "#1e4e28";
  ctx.beginPath();
  ctx.moveTo(0, -h); ctx.lineTo(h * 0.38, 0); ctx.lineTo(-h * 0.38, 0); ctx.closePath();
  ctx.fill();
  ctx.restore();
}

export function drawMap(ctx, state, view) {
  const { cam, w, h, time, playerId, path, selectedId } = view;
  const base = ctx.getTransform();
  const dpr = base.a || 1;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "#3f7a34";
  ctx.fillRect(0, 0, w, h);
  const bake = ensureTerrain(state);
  const S = bake.S;
  const kx = (TW / 2) / S * cam.zoom;
  const ky = (TH / 2) / S * cam.zoom;
  const ox = w / 2 - cam.x * cam.zoom;
  const oy = h / 2 - cam.y * cam.zoom - (TH / 2) * cam.zoom;
  const paintIso = () => ctx.setTransform(dpr * kx, dpr * ky, -dpr * kx, dpr * ky, dpr * ox, dpr * oy);
  paintIso();
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(bake.canvas, 0, 0);
  ctx.setTransform(base);

  const margin = 3;
  const corners = [
    screenToTile(0, 0, cam, w, h),
    screenToTile(w, 0, cam, w, h),
    screenToTile(0, h, cam, w, h),
    screenToTile(w, h, cam, w, h),
  ].filter(Boolean);
  let minX = 0, maxX = state.map.w - 1, minY = 0, maxY = state.map.h - 1;
  if (corners.length) {
    minX = Math.max(0, Math.min(...corners.map((c) => c.x)) - margin);
    maxX = Math.min(state.map.w - 1, Math.max(...corners.map((c) => c.x)) + margin);
    minY = Math.max(0, Math.min(...corners.map((c) => c.y)) - margin);
    maxY = Math.min(state.map.h - 1, Math.max(...corners.map((c) => c.y)) + margin);
  }
  const cells = [];
  for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) cells.push([x, y]);
  cells.sort((a, b) => (a[0] + a[1]) - (b[0] + b[1]) || a[0] - b[0]);

  const pathSteps = Array.isArray(path) ? path : (path && path.full) || [];
  drawShroud(ctx, cells, state, playerId, S, dpr, kx, ky, ox, oy, w, h, base);

  for (const [x, y] of cells) {
    if (!remembered(state, playerId, x, y)) continue;
    const i = y * state.map.w + x;
    const type = state.map.terrain[i];
    const c = tileCenter(x, y);
    const s = toScreen(c.x, c.y, cam, w, h);
    const hsh = Math.imul(x, 73856093) ^ Math.imul(y, 19349663);
    if (type === T_FOREST || type === T_HILL) {
      const ox = ((hsh & 15) - 7) * cam.zoom;
      drawPine(ctx, s.x + ox, s.y, cam.zoom, hsh);
      if ((hsh & 1) === 0) drawPine(ctx, s.x - ox * 0.6, s.y + 3 * cam.zoom, cam.zoom * 0.86, hsh >> 3);
    } else if (type === T_MOUNTAIN) {
      drawPeak(ctx, s.x, s.y, cam.zoom, time, x);
    } else if (type === T_GRASS && (hsh & 7) === 0) {
      drawPine(ctx, s.x + ((hsh >> 4) & 7) - 3, s.y, cam.zoom * 0.7, hsh);
    }
  }
  drawRoute(ctx, pathSteps, view);

  const props = [];
  for (const [x, y] of cells) {
    if (!remembered(state, playerId, x, y)) continue;
    const see = inVision(state, playerId, x, y);
    const town = townAt(state, x, y);
    const obj = objectAt(state, x, y);
    const hero = heroAt(state, x, y);
    if (town) props.push({ k: x + y + 0.2, draw: () => drawTown(ctx, state, town, cam, w, h, time) });
    if (obj) props.push({ k: x + y + 0.3, draw: () => drawObject(ctx, state, obj, cam, w, h, time) });
    if (hero && (see || hero.player === playerId)) props.push({ k: x + y + 0.6, draw: () => drawHero(ctx, state, hero, cam, w, h, time, hero.id === selectedId) });
  }
  props.sort((a, b) => a.k - b.k);
  for (const p of props) p.draw();

  drawInsetMap(ctx, state, playerId, w, h);
}

function drawTuft(ctx, dw, dh, x, y, type) {
  const n = (x * 13 + y * 29) % 11;
  if (n > 2) return;
  ctx.save();
  ctx.translate((n - 1) * dw * 0.12, -dh * 0.05);
  if (n === 0) {
    ctx.fillStyle = type === T_DIRT ? "#6b5340" : "#3d6b45";
    ctx.beginPath();
    ctx.ellipse(0, 0, dw * 0.06, dh * 0.08, 0, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillStyle = n === 1 ? "#f2e2a0" : "#d7dde6";
    ctx.beginPath();
    ctx.arc(-dw * 0.08, dh * 0.02, Math.max(1.5, dw * 0.035), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawRoute(ctx, steps, view) {
  if (!steps || !steps.length) return;
  const { cam, w, h } = view;
  let left = view.moveLeft ?? 9999;
  const moveMax = view.moveMax || left || 1;
  let day = 1;
  ctx.save();
  for (let i = 0; i < steps.length; i++) {
    const t = steps[i];
    const cost = t.cost || 100;
    if (cost > left) { day += 1; left = moveMax; }
    const green = day === 1;
    left -= cost;
    const c = tileCenter(t.x, t.y);
    const s = toScreen(c.x, c.y, cam, w, h);
    let ang = -Math.PI / 2;
    const prev = i > 0 ? steps[i - 1] : null;
    if (prev) {
      const pc = tileCenter(prev.x, prev.y);
      const ps = toScreen(pc.x, pc.y, cam, w, h);
      ang = Math.atan2(s.y - ps.y, s.x - ps.x);
    }
    const z = Math.max(0.7, cam.zoom);
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(ang);
    ctx.fillStyle = green ? "#b6f25c" : "#ff5d4a";
    ctx.strokeStyle = "rgba(0,0,0,.7)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(9 * z, 0);
    ctx.lineTo(-7 * z, -6.5 * z);
    ctx.lineTo(-2 * z, 0);
    ctx.lineTo(-7 * z, 6.5 * z);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    const next = steps[i + 1];
    const endDay = !next || (next.cost || 100) > left;
    if (endDay) {
      ctx.font = `700 ${Math.round(12 * z)}px Manrope LK, sans-serif`;
      ctx.textAlign = "center";
      ctx.lineWidth = 3;
      ctx.strokeStyle = "#14080c";
      ctx.strokeText(String(day), s.x, s.y - 12 * z);
      ctx.fillStyle = green ? "#f3ffd4" : "#ffe0da";
      ctx.fillText(String(day), s.x, s.y - 12 * z);
    }
  }
  ctx.restore();
}

export function drawMinimap(canvas, state, playerId, cam, viewW, viewH) {
  const ctx = canvas.getContext("2d");
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const W = 86, H = 86;
  if (canvas.width !== Math.round(W * dpr)) {
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = "#050203";
  ctx.fillRect(0, 0, W, H);
  const mw = state.map.w, mh = state.map.h;
  const cols = ["#2f6b3a", "#8a7044", "#c2a15a", "#d5dde8", "#3d5a32", "#7a2e24", "#4d6a38", "#1c4d2a", "#1a4a6a", "#5c6570"];
  const tw = W / mw, th = H / mh;
  for (let y = 0; y < mh; y++) for (let x = 0; x < mw; x++) {
    if (!remembered(state, playerId, x, y)) continue;
    const t = state.map.terrain[y * mw + x];
    ctx.fillStyle = cols[t] || "#333";
    ctx.fillRect(x * tw, y * th, tw + 0.4, th + 0.4);
  }
  for (const t of state.towns) {
    if (!remembered(state, playerId, t.x, t.y)) continue;
    const owner = state.players.find((p) => p.id === t.owner);
    ctx.fillStyle = owner ? owner.color : "#e7c56a";
    ctx.fillRect(t.x * tw - 1, t.y * th - 1, 3, 3);
  }
  for (const h of state.heroes) {
    if (h.lost || !remembered(state, playerId, h.x, h.y)) continue;
    ctx.fillStyle = state.players[h.player].color;
    ctx.fillRect(h.x * tw - 1, h.y * th - 1, 3.5, 3.5);
  }
  if (cam && viewW) {
    const corners = [
      screenToTile(0, 0, cam, viewW, viewH),
      screenToTile(viewW, 0, cam, viewW, viewH),
      screenToTile(0, viewH, cam, viewW, viewH),
      screenToTile(viewW, viewH, cam, viewW, viewH),
    ].filter(Boolean);
    if (corners.length) {
      const minX = Math.min(...corners.map((c) => c.x));
      const maxX = Math.max(...corners.map((c) => c.x));
      const minY = Math.min(...corners.map((c) => c.y));
      const maxY = Math.max(...corners.map((c) => c.y));
      ctx.strokeStyle = "#e7c56a";
      ctx.lineWidth = 1;
      ctx.strokeRect(minX * tw, minY * th, (maxX - minX + 1) * tw, (maxY - minY + 1) * th);
    }
  }
}

function drawInsetMap(ctx, state, playerId, w, h) {
  const mw = state.map.w, mh = state.map.h;
  const W = 78, H = 64, x0 = w - W - 8, y0 = 8;
  ctx.save();
  ctx.fillStyle = "#1a120c";
  ctx.fillRect(x0 - 3, y0 - 3, W + 6, H + 6);
  ctx.strokeStyle = "#e6c878";
  ctx.lineWidth = 2;
  ctx.strokeRect(x0 - 3, y0 - 3, W + 6, H + 6);
  const cols = ["#3f8a34", "#a78448", "#d2b56a", "#e7eef2", "#3d6840", "#8a3018", "#6a8a3a", "#2f7a30", "#2f78b0", "#8b9098"];
  const tw = W / mw, th = H / mh;
  for (let y = 0; y < mh; y++) for (let x = 0; x < mw; x++) {
    if (!remembered(state, playerId, x, y)) continue;
    ctx.fillStyle = cols[state.map.terrain[y * mw + x]] || "#333";
    ctx.fillRect(x0 + x * tw, y0 + y * th, tw + 0.6, th + 0.6);
  }
  for (const t of state.towns) {
    if (!remembered(state, playerId, t.x, t.y)) continue;
    const owner = state.players.find((p) => p.id === t.owner);
    ctx.fillStyle = owner ? owner.color : "#e6c878";
    ctx.fillRect(x0 + t.x * tw - 1, y0 + t.y * th - 1, 3, 3);
  }
  for (const hr of state.heroes) {
    if (hr.lost || !remembered(state, playerId, hr.x, hr.y)) continue;
    ctx.fillStyle = state.players[hr.player].color;
    ctx.fillRect(x0 + hr.x * tw, y0 + hr.y * th, 2.5, 2.5);
  }
  ctx.restore();
}

function drawDiamond(ctx, x, y, dw, dh, fill) {
  ctx.beginPath();
  ctx.moveTo(x, y - dh / 2);
  ctx.lineTo(x + dw / 2, y);
  ctx.lineTo(x, y + dh / 2);
  ctx.lineTo(x - dw / 2, y);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}
function paintRoad(ctx, dw, dh) {
  ctx.strokeStyle = "rgba(92, 58, 32, .85)";
  ctx.lineWidth = Math.max(2, dw * 0.08);
  ctx.beginPath();
  ctx.moveTo(-dw * 0.22, 0);
  ctx.lineTo(dw * 0.22, 0);
  ctx.stroke();
  ctx.strokeStyle = "rgba(231, 197, 106, .55)";
  ctx.lineWidth = 1;
  ctx.stroke();
}
function paintRiver(ctx, dw, dh, time, ford) {
  ctx.strokeStyle = ford ? "rgba(186, 230, 253, .55)" : "rgba(56, 170, 214, .95)";
  ctx.lineWidth = ford ? 2 : Math.max(3, dw * 0.1);
  ctx.beginPath();
  const wob = Math.sin(time / 400) * 2;
  ctx.moveTo(-dw * 0.36, -dh * 0.05 + wob);
  ctx.quadraticCurveTo(0, dh * 0.08, dw * 0.36, -dh * 0.02);
  ctx.stroke();
}
function paintWaterShine(ctx, dw, dh, time, x, y) {
  ctx.save();
  diamond(ctx, dw, dh);
  ctx.clip();
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = "#e9fbff";
  const ox = ((time / 30 + x * 10) % dw) - dw / 2;
  ctx.fillRect(ox, -dh / 2, dw * 0.08, dh);
  ctx.restore();
}
function drawForestSprite(ctx, x, y, z, time, tx, ty, type) {
  primeArt(SPR.tree);
  const img = painted(SPR.tree);
  if (!img) { drawTrees(ctx, x, y, z, type, tx, ty); return; }
  const n = type === T_FOREST ? 2 : 1;
  for (let i = 0; i < n; i++) {
    const ox = (i === 0 ? -8 : 10) * z;
    const h = (type === T_FOREST ? 46 : 34) * z * (i ? 0.82 : 1);
    drawFigure(ctx, img, x + ox, y + 6 * z, h, time, { seed: tx * 9 + ty + i * 4, bob: 0.4, sway: 0.045 });
  }
}
function drawPeak(ctx, x, y, z, time, tx) {
  primeArt(SPR.mountain);
  const img = painted(SPR.mountain);
  if (!img) { drawMountain(ctx, x, y, z); return; }
  drawFigure(ctx, img, x, y + 8 * z, 58 * z, time + tx, { bob: 0, sway: 0.004, seed: tx });
}
function drawTrees(ctx, x, y, z, type, tx, ty) {
  const rng = mulberry(tx * 17 + ty * 31);
  const n = type === T_FOREST ? 4 : 2;
  for (let i = 0; i < n; i++) {
    const ox = (rng() - 0.5) * 30 * z;
    const oy = (rng() - 0.8) * 18 * z;
    const r = (9 + rng() * 6) * z;
    ctx.fillStyle = "#3a2414";
    ctx.fillRect(x + ox - 1.4 * z, y + oy + r * 0.2, 2.6 * z, r * 0.7);
    const g = ctx.createRadialGradient(x + ox - r * 0.28, y + oy - r * 0.35, r * 0.08, x + ox, y + oy, r);
    g.addColorStop(0, "#f4ffe0");
    g.addColorStop(0.28, type === T_FOREST ? "#3fbf62" : "#8fce63");
    g.addColorStop(0.7, type === T_FOREST ? "#146b34" : "#3d7a32");
    g.addColorStop(1, "#06210f");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(x + ox, y + oy, r * 0.92, r * 0.7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,.4)";
    ctx.beginPath();
    ctx.ellipse(x + ox - r * 0.28, y + oy - r * 0.22, r * 0.24, r * 0.12, -0.6, 0, Math.PI * 2);
    ctx.fill();
  }
}
function drawMountain(ctx, x, y, z) {
  ctx.save();
  ctx.translate(x, y - 10 * z);
  ctx.beginPath();
  ctx.moveTo(0, -22 * z);
  ctx.lineTo(16 * z, 6 * z);
  ctx.lineTo(0, 2 * z);
  ctx.lineTo(-14 * z, 8 * z);
  ctx.closePath();
  const g = ctx.createLinearGradient(-14 * z, -22 * z, 16 * z, 8 * z);
  g.addColorStop(0, "#f7fbff");
  g.addColorStop(0.4, "#9aa6b5");
  g.addColorStop(1, "#3c4654");
  ctx.fillStyle = g;
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,.85)";
  ctx.beginPath();
  ctx.moveTo(0, -22 * z);
  ctx.lineTo(6 * z, -8 * z);
  ctx.lineTo(-2 * z, -6 * z);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawTown(ctx, state, town, cam, w, h, time) {
  const c = tileCenter(town.x, town.y);
  const s = toScreen(c.x, c.y, cam, w, h);
  const fac = FACTIONS[town.faction];
  const src = SPR.castle[town.faction] || fac.castle;
  primeArt(src);
  const img = painted(src);
  const bh = 70 * cam.zoom;
  const owner = state.players.find((p) => p.id === town.owner);
  ctx.save();
  ctx.translate(s.x, s.y);
  ctx.fillStyle = "rgba(0,0,0,.35)";
  ctx.beginPath();
  ctx.ellipse(0, 10 * cam.zoom, 34 * cam.zoom, 10 * cam.zoom, 0, 0, Math.PI * 2);
  ctx.fill();
  if (img) drawFigure(ctx, img, 0, 8 * cam.zoom, bh, time, { seed: town.id, bob: 0.6, sway: 0.012 });
  else {
    ctx.fillStyle = fac.color;
    ctx.fillRect(-30 * cam.zoom, -bh, 60 * cam.zoom, bh);
  }
  drawPennant(ctx, 16 * cam.zoom, -bh * 0.72, cam.zoom, owner ? owner.color : fac.color);
  if (town.buildings && (town.buildings.fort || town.buildings.tavern)) torch(ctx, 18 * cam.zoom, -bh * 0.55, time);
  ctx.restore();
}

const OBJ_GLYPH = {
  resource: "✦", mine: "◆", monster: "⚔", artifact: "♛", shrine: "✝", chest: "▣",
  dwelling: "⌂", witch: "✧", stone: "▣", arena: "⚔", fountain: "≈", stables: "♞",
  mill: "❀", garden: "✿", tower: "🗼", campfire: "🔥", scholar: "📜", temple: "✝",
  tree: "🌳", monolith: "◈", key: "⚿", gate: "▣", grail: "♛", prison: "⛓", sign: "✎",
  university: "🎓",
};

function drawObject(ctx, state, obj, cam, w, h) {
  const c = tileCenter(obj.x, obj.y);
  const s = toScreen(c.x, c.y, cam, w, h);
  const z = cam.zoom;
  ctx.save();
  ctx.translate(s.x, s.y);
  if (obj.type === "monster" && obj.guard) {
    const src = bodySrc(obj.guard.cr);
    primeArt(src);
    const img = painted(src) || painted(bodySrc(String(obj.guard.cr).replace(/_u$/, "")));
    if (!painted(bodySrc(String(obj.guard.cr).replace(/_u$/, "")))) primeArt(bodySrc(String(obj.guard.cr).replace(/_u$/, "")));
    if (img) drawFigure(ctx, img, 0, 10 * z, 52 * z, performance.now(), { seed: obj.id, bob: 1.6, sway: 0.04 });
    else drawToken(ctx, null, 0, 0, 16 * z, "#c4374f", String(obj.guard.count));
    ctx.fillStyle = "#fff6d8";
    ctx.font = `700 ${11 * z}px Manrope LK, sans-serif`;
    ctx.textAlign = "center";
    ctx.strokeStyle = "#1a0c10";
    ctx.lineWidth = 3;
    ctx.strokeText(String(obj.guard.count), 0, 14 * z);
    ctx.fillText(String(obj.guard.count), 0, 14 * z);
  } else if (obj.type === "resource") {
    const src = obj.res === "gold" ? SPR.gold : SPR.gold;
    primeArt(src);
    const img = painted(src);
    if (img) {
      drawFigure(ctx, img, 0, 8 * z, 28 * z, performance.now(), { seed: obj.id, bob: 1.2, sway: 0.02 });
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = 0.35 + Math.sin(performance.now() / 280) * 0.15;
      ctx.fillStyle = "#ffe9a0";
      ctx.beginPath(); ctx.arc(0, -6 * z, 10 * z, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over";
    } else drawGem(ctx, z, obj.res);
  } else if (obj.type === "mine") {
    primeArt(SPR.mine);
    const img = painted(SPR.mine);
    if (img) drawFigure(ctx, img, 0, 10 * z, 44 * z, performance.now(), { seed: obj.id, bob: 0, sway: 0 });
    else drawMine(ctx, z, obj.res, "#888");
    const owner = obj.owner && state.players.find((p) => p.id === obj.owner);
    drawPennant(ctx, 12 * z, -24 * z, z, owner ? owner.color : "#9aa");
    torch(ctx, 8 * z, -18 * z, performance.now());
  } else if (obj.type === "artifact" || obj.type === "grail") {
    primeArt(SPR.gold);
    const img = painted(SPR.gold);
    if (img) drawFigure(ctx, img, 0, 8 * z, 26 * z, performance.now(), { seed: obj.id, bob: 1.4 });
    else drawToken(ctx, null, 0, 0, 13 * z, "#e7c56a", "♛");
  } else if (obj.type === "chest") {
    primeArt(SPR.chest);
    const img = painted(SPR.chest);
    if (img) drawFigure(ctx, img, 0, 8 * z, 30 * z, performance.now(), { seed: obj.id, bob: 0.8, sway: 0.02 });
    else { ctx.fillStyle = "#7a3b16"; ctx.fillRect(-8 * z, -8 * z, 16 * z, 12 * z); }
  } else if (obj.type === "shrine") {
    primeArt(SPR.shrine);
    const img = painted(SPR.shrine);
    if (img) drawFigure(ctx, img, 0, 8 * z, 36 * z, performance.now(), { seed: obj.id, bob: 0.5, sway: 0.02 });
    torch(ctx, 0, -22 * z, performance.now());
  } else if (obj.type === "dwelling") {
    primeArt(SPR.tavern);
    const img = painted(SPR.tavern);
    if (img) drawFigure(ctx, img, 0, 8 * z, 36 * z, performance.now(), { seed: obj.id, bob: 0.3, sway: 0.01 });
  } else if (obj.type === "mill") {
    primeArt("art/sprites/windmill.webp");
    const img = painted("art/sprites/windmill.webp");
    if (img) drawFigure(ctx, img, 0, 10 * z, 48 * z, performance.now(), { seed: obj.id, bob: 0, sway: 0 });
    else drawToken(ctx, null, 0, 0, 14 * z, "#c4a060", "❀");
  } else {
    ctx.fillStyle = "rgba(20,8,12,.8)";
    ctx.beginPath(); ctx.arc(0, 0, 11 * z, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#e7c56a";
    ctx.font = `${12 * z}px serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(OBJ_GLYPH[obj.type] || "•", 0, 1);
  }
  ctx.restore();
}
function drawGem(ctx, z, res) {
  const col = { gold: "#ffd76a", lacquer: "#e23b57", resin: "#c0843a", pigment: "#d946ef", amber: "#f59e0b", crystal: "#67e8f9", pearl: "#f8fafc" }[res] || "#fff";
  const g = ctx.createRadialGradient(-2 * z, -3 * z, 1, 0, 0, 8 * z);
  g.addColorStop(0, "#fff");
  g.addColorStop(0.4, col);
  g.addColorStop(1, "#1a0c10");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(0, -9 * z); ctx.lineTo(7 * z, 0); ctx.lineTo(0, 9 * z); ctx.lineTo(-7 * z, 0);
  ctx.closePath();
  ctx.fill();
}
function drawMine(ctx, z, res, flag) {
  ctx.fillStyle = "#4b5563";
  ctx.beginPath();
  ctx.moveTo(-12 * z, 6 * z); ctx.lineTo(0, -10 * z); ctx.lineTo(12 * z, 6 * z); ctx.closePath();
  ctx.fill();
  drawGem(ctx, z * 0.7, res);
  ctx.fillStyle = flag;
  ctx.fillRect(6 * z, -14 * z, 2 * z, 10 * z);
  ctx.beginPath(); ctx.moveTo(8 * z, -14 * z); ctx.lineTo(14 * z, -11 * z); ctx.lineTo(8 * z, -8 * z); ctx.fill();
}
function drawToken(ctx, img, x, y, r, ring, badge) {
  ctx.save();
  ctx.translate(x, y);
  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.closePath();
  ctx.save(); ctx.clip();
  if (img) ctx.drawImage(img, -r, -r, r * 2, r * 2);
  else { ctx.fillStyle = "#3a1020"; ctx.fillRect(-r, -r, r * 2, r * 2); }
  ctx.restore();
  ctx.lineWidth = Math.max(2, r * 0.12);
  ctx.strokeStyle = ring;
  ctx.stroke();
  if (badge) {
    ctx.font = `700 ${Math.max(9, r * 0.7)}px Manrope LK, sans-serif`;
    ctx.textAlign = "center";
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#1a0c10";
    ctx.strokeText(badge, 0, r + 2);
    ctx.fillStyle = "#fff6d8";
    ctx.fillText(badge, 0, r + 2);
  }
  ctx.restore();
}

function drawHero(ctx, state, hero, cam, w, h, time, selected) {
  const bob = Math.sin(time / 280 + hero.id) * 2 * cam.zoom;
  const c = tileCenter(hero.x, hero.y);
  const s = toScreen(c.x, c.y, cam, w, h);
  const z = cam.zoom;
  const src = hero.portrait || rideSrc(hero.rosterId);
  primeArt(src);
  primeArt(hero.portrait);
  const img = painted(src) || painted(hero.portrait);
  const fac = FACTIONS[hero.faction];
  ctx.save();
  ctx.translate(s.x, s.y);
  if (selected) {
    ctx.strokeStyle = "rgba(231,197,106,.9)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, 6 * z, 18 * z, 7 * z, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  if (img && painted(src)) drawFigure(ctx, img, 0, 2 * z, 48 * z, time, { seed: hero.id, bob: 1.2, sway: 0.02 });
  else drawToken(ctx, img, 0, -16 * z, 16 * z, fac.color, "");
  drawPennant(ctx, 18 * z, -46 * z, z, state.players[hero.player].color);
  ctx.restore();
}
function drawPennant(ctx, x, y, z, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = "#1a120c";
  ctx.fillRect(-1 * z, 0, 2 * z, 16 * z);
  ctx.fillStyle = color || "#e7c56a";
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(12 * z, 4 * z);
  ctx.lineTo(0, 8 * z);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}
function drawMount(ctx, z, phase) {
  ctx.save();
  ctx.translate(0, 8 * z);
  ctx.fillStyle = "rgba(0,0,0,.28)";
  ctx.beginPath(); ctx.ellipse(0, 8 * z, 16 * z, 4.5 * z, 0, 0, Math.PI * 2); ctx.fill();
  const body = ctx.createLinearGradient(0, -8 * z, 0, 10 * z);
  body.addColorStop(0, "#6b3a28");
  body.addColorStop(0.45, "#3a1d16");
  body.addColorStop(1, "#1a0c0a");
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.ellipse(-1 * z, 0, 15 * z, 7 * z, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#f2e2cf";
  ctx.beginPath();
  ctx.ellipse(-6 * z, -1 * z, 6 * z, 2.2 * z, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.ellipse(12 * z, -5 * z, 4.2 * z, 3.4 * z, 0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#1a0c0a";
  ctx.beginPath(); ctx.arc(14 * z, -6 * z, 1.1 * z, 0, Math.PI * 2); ctx.fill();
  const lift = Math.sin(phase) * 3.2 * z;
  ctx.strokeStyle = "#2a140f";
  ctx.lineWidth = 2.4 * z;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-9 * z, 4 * z); ctx.lineTo(-11 * z, 11 * z + lift);
  ctx.moveTo(-2 * z, 5 * z); ctx.lineTo(1 * z, 12 * z - lift);
  ctx.moveTo(5 * z, 5 * z); ctx.lineTo(7 * z, 12 * z + lift);
  ctx.moveTo(9 * z, 3 * z); ctx.lineTo(12 * z, 11 * z - lift);
  ctx.stroke();
  ctx.restore();
}

export function roundImage(ctx, img, x, y, w, h, r) {
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  ctx.clip();
  ctx.drawImage(img, x, y, w, h);
  ctx.restore();
}

/* ---------- бой ---------- */

export function battleCamera(w, h) {
  const size = 28;
  // Поле повёрнуто: ряды по ширине, колонны по высоте. Свои внизу, чужие сверху.
  const fieldW = size * Math.sqrt(3) * (BROWS - 1 + 0.5) + size * 2;
  const fieldH = size * 1.5 * (BCOLS - 1) + size * 3.2;
  const zoom = Math.min((w - 4) / fieldW, (h - 4) / fieldH);
  return {
    x: size * Math.sqrt(3) * (BROWS - 1) / 2,
    y: size * 1.5 * (BCOLS - 1) / 2,
    zoom: Math.max(0.42, zoom),
    size,
  };
}
export function focusHex(cam, c, r) {
  const p = hexPos(c, r, cam.size || 36);
  cam.x = p.x;
  cam.y = p.y;
}

function hexPos(c, r, size) {
  return {
    x: size * Math.sqrt(3) * (r + 0.5 * (c & 1)),
    y: size * 1.5 * (BCOLS - 1 - c),
  };
}
function battleScreen(c, r, view) {
  const { cam, w, h } = view;
  const p = hexPos(c, r, cam.size || 18);
  return {
    x: (p.x - cam.x) * cam.zoom + w / 2,
    y: (p.y - cam.y) * cam.zoom + h / 2,
  };
}
export function screenToHex(sx, sy, view) {
  const { cam, w, h } = view;
  let best = null, bd = 1e9;
  const reach = (cam.size || 18) * cam.zoom * 0.95;
  for (let r = 0; r < BROWS; r++) for (let c = 0; c < BCOLS; c++) {
    const p = battleScreen(c, r, view);
    const d = Math.hypot(p.x - sx, p.y - sy);
    if (d < reach && d < bd) { bd = d; best = { c, r }; }
  }
  return best;
}

function hexPath(ctx, x, y, size) {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = Math.PI / 180 * (60 * i - 30);
    const px = x + size * Math.cos(a);
    const py = y + size * Math.sin(a);
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

export function drawBattle(ctx, battle, view) {
  if (!battle) return;
  const { w, h, time, cam } = view;
  ctx.clearRect(0, 0, w, h);
  const bsrc = SPR.battle[battle.terrain] || SPR.battle.grass;
  primeArt(bsrc);
  const bimg = painted(bsrc);
  if (bimg) ctx.drawImage(bimg, 0, 0, w, h);
  else {
    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, "#1d4d32");
    bg.addColorStop(1, "#0e2418");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
  }
  drawClouds(ctx, w, h * 0.4, time);

  const size = (cam.size || 18) * cam.zoom;
  const reach = view.reach;
  const cur = view.currentUid;
  const showGrid = view.grid !== false;
  for (let r = 0; r < BROWS; r++) for (let c = 0; c < BCOLS; c++) {
    const p = battleScreen(c, r, view);
    const key = c + "," + r;
    const block = battle.obstacles[key];
    const hot = reach && reach.has(key);
    if (showGrid || hot || block) {
      hexPath(ctx, p.x, p.y, size * 0.96);
      let fill = showGrid ? ((r + c) % 2 === 0 ? "rgba(0,0,0,.12)" : "rgba(255,255,255,.07)") : "rgba(0,0,0,0)";
      if (block === "moat") fill = "rgba(20,70,90,.55)";
      if (hot) fill = "rgba(212, 168, 74, .34)";
      ctx.fillStyle = fill;
      ctx.fill();
      if (showGrid || hot) {
        ctx.strokeStyle = hot ? "rgba(232, 208, 138, .95)" : "rgba(212, 175, 90, .22)";
        ctx.lineWidth = hot ? 2 : 1;
        ctx.stroke();
      }
    }
    if (block === "rock") drawRock(ctx, p.x, p.y, size);
    if (block === "tree") drawBattleTree(ctx, p.x, p.y, size);
    if (block === "wall" || block === "gate") drawWall(ctx, p.x, p.y, size, block, battle.wallHp[key] || 0);
  }

  const stacks = battle.stacks.filter((s) => !s.dead || (view.fx && view.fx[s.uid] && view.fx[s.uid].kind === "die"));
  stacks.sort((a, b) => b.c - a.c || a.r - b.r);
  for (const s of stacks) {
    const pos = stackVisualPos(s, view);
    drawBattleUnit(ctx, battle, s, pos.x, pos.y, size, time, s.uid === cur);
  }
  for (const f of view.floaters || []) {
    ctx.globalAlpha = Math.max(0, 1 - f.age);
    ctx.fillStyle = f.color || "#fff";
    ctx.font = "700 14px Manrope LK, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(f.text, f.x, f.y - f.age * 24);
    ctx.globalAlpha = 1;
  }
  for (const p of view.particles || []) {
    ctx.globalAlpha = Math.max(0, p.life);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

function drawSideHero(ctx, hero, w, h, time, flip) {
  if (!hero) return;
  const src = hero.portrait || rideSrc(hero.rosterId);
  if (src) primeArt(src);
  if (hero.portrait) primeArt(hero.portrait);
  const img = (src && painted(src)) || (hero.portrait && painted(hero.portrait));
  const bh = Math.min(108, h * 0.26);
  const x = flip ? w - 24 : 24;
  const y = h * 0.3;
  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,.28)";
  ctx.beginPath();
  ctx.ellipse(x, y, 26, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  if (img) drawFigure(ctx, img, x, y, bh, time, { seed: hero.id || 3, bob: 1.1, sway: 0.02, flip });
  ctx.restore();
}

function stackVisualPos(stack, view) {
  const base = battleScreen(stack.c, stack.r, view);
  const mv = (view.moves || []).find((m) => m.uid === stack.uid);
  if (!mv) return base;
  const t = Math.min(1, mv.t);
  return { x: mv.x0 + (mv.x1 - mv.x0) * t, y: mv.y0 + (mv.y1 - mv.y0) * t };
}

function drawBattleUnit(ctx, battle, stack, x, y, size, time, active) {
  const cr = CREATURES[stack.cr];
  const src = bodySrc(stack.cr);
  primeArt(src);
  const base = String(stack.cr).replace(/_u$/, "");
  if (base !== stack.cr) primeArt(bodySrc(base));
  const img = painted(src) || painted(bodySrc(base));
  const h = size * 3.35;
  const fx = (typeof window !== "undefined" && window.LK && window.LK.fx && window.LK.fx[stack.uid]) || null;
  ctx.save();
  if (active) {
    ctx.shadowColor = "rgba(231,197,106,.85)";
    ctx.shadowBlur = 16;
  }
  ctx.fillStyle = "rgba(0,0,0,.35)";
  ctx.beginPath(); ctx.ellipse(x, y + size * 0.35, size * 0.55, size * 0.2, 0, 0, Math.PI * 2); ctx.fill();
  ctx.shadowBlur = 0;
  if (img) {
    drawFigure(ctx, img, x, y + size * 0.45, h, time, {
      seed: stack.uid, bob: 1.6, sway: 0.035,
      flip: stack.side === "right",
      fx: fx && { ...fx, dir: stack.side === "left" ? 1 : -1 },
    });
  } else {
    drawToken(ctx, null, x, y, size * 0.7, stack.side === "left" ? "#e7c56a" : "#d946ef", "");
  }
  const hpMax = cr.hp * stack.initCount;
  const hp = (stack.count - 1) * cr.hp + stack.topHp;
  const ratio = Math.max(0, Math.min(1, hp / Math.max(1, hpMax)));
  const barW = size * 1.35;
  const by = y + size * 0.42;
  ctx.fillStyle = "rgba(0,0,0,.55)";
  ctx.fillRect(x - barW / 2, by, barW, 4);
  ctx.fillStyle = ratio > 0.5 ? "#4ade80" : ratio > 0.25 ? "#fbbf24" : "#f87171";
  ctx.fillRect(x - barW / 2, by, barW * ratio, 4);
  const label = String(stack.count);
  ctx.font = `700 ${Math.max(13, size * 0.5)}px Manrope LK, sans-serif`;
  ctx.textAlign = "center";
  const tw = ctx.measureText(label).width;
  const bx = x - tw / 2 - 5;
  const bty = by - Math.max(16, size * 0.55);
  ctx.fillStyle = "rgba(12,6,8,.88)";
  ctx.strokeStyle = "rgba(231,197,106,.8)";
  ctx.lineWidth = 1;
  ctx.fillRect(bx, bty, tw + 10, Math.max(16, size * 0.48));
  ctx.strokeRect(bx, bty, tw + 10, Math.max(16, size * 0.48));
  ctx.fillStyle = "#fff8e8";
  ctx.fillText(label, x, bty + Math.max(13, size * 0.38));
  if (stack.defending) {
    ctx.fillStyle = "rgba(125, 211, 252, .95)";
    ctx.font = `${Math.max(10, size * 0.36)}px Manrope LK, sans-serif`;
    ctx.fillText("щит", x, y - h * 0.15);
  }
  ctx.restore();
}
const lunges = new Map();
export function setLunge(uid, ms) { lunges.set(uid, performance.now() + ms); }
function viewLunge() { return 0; }
function drawRock(ctx, x, y, size) {
  const g = ctx.createRadialGradient(x - 3, y - 4, 1, x, y, size * 0.55);
  g.addColorStop(0, "#d7dde6");
  g.addColorStop(1, "#3e4652");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(x, y, size * 0.42, size * 0.3, 0, 0, Math.PI * 2);
  ctx.fill();
}
function drawBattleTree(ctx, x, y, size) {
  ctx.fillStyle = "#5b3a22";
  ctx.fillRect(x - 2, y, 4, size * 0.3);
  const g = ctx.createRadialGradient(x - 3, y - 6, 1, x, y - 4, size * 0.45);
  g.addColorStop(0, "#d9f99d");
  g.addColorStop(1, "#166534");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y - size * 0.15, size * 0.38, 0, Math.PI * 2);
  ctx.fill();
}
function drawWall(ctx, x, y, size, kind, hp) {
  ctx.fillStyle = kind === "gate" ? "#7f1d1d" : "#6b6258";
  ctx.fillRect(x - size * 0.55, y - size * 0.45, size * 1.1, size * 0.9);
  ctx.strokeStyle = kind === "gate" ? "#e7c56a" : "#d6d3d1";
  ctx.strokeRect(x - size * 0.55, y - size * 0.45, size * 1.1, size * 0.9);
  if (kind === "gate") {
    ctx.strokeStyle = "#e7c56a";
    ctx.beginPath();
    ctx.moveTo(x - size * 0.3, y - size * 0.3);
    ctx.lineTo(x + size * 0.3, y + size * 0.3);
    ctx.moveTo(x + size * 0.3, y - size * 0.3);
    ctx.lineTo(x - size * 0.3, y + size * 0.3);
    ctx.stroke();
  }
  ctx.fillStyle = "#fff";
  ctx.font = "10px Manrope LK, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(String(Math.max(0, Math.ceil(hp))), x, y + 3);
}

export function preloadFactionArt() {
  preloadWorld();
}

export { hexDist, hexNeighbors, effective };
