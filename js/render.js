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

export const TW = 96;
export const TH = 48;

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
    x: (wx - cam.x) * cam.zoom + w / 2,
    y: (wy - cam.y) * cam.zoom + h / 2,
  };
}

export function drawMap(ctx, state, view) {
  const { cam, w, h, time, playerId, path, selectedId } = view;
  ctx.clearRect(0, 0, w, h);
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, "#1a0d12");
  sky.addColorStop(1, "#070304");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

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

  const pathSet = new Set((path || []).map((t) => t.x + "," + t.y));
  for (const [x, y] of cells) {
    const i = y * state.map.w + x;
    const seen = remembered(state, playerId, x, y);
    const c = tileCenter(x, y);
    const s = toScreen(c.x, c.y, cam, w, h);
    const dw = TW * cam.zoom, dh = TH * cam.zoom;
    if (!seen) {
      drawDiamond(ctx, s.x, s.y, dw, dh, "rgba(6,3,5,.94)");
      continue;
    }
    const type = state.map.terrain[i];
    const gsrc = groundSrc(type, x, y);
    primeArt(gsrc);
    const gimg = painted(gsrc);
    ctx.save();
    ctx.translate(s.x, s.y);
    if (!drawGround(ctx, gimg, dw, dh, type, time, x, y)) {
      const sprite = tileCanvas(type, (x * 3 + y * 5) % 3);
      ctx.drawImage(sprite, -dw / 2 - 0.6, -dh / 2 - 0.6, dw + 1.2, dh + 1.2);
    }
    const flags = state.map.flags[i];
    if (flags & FLAG_ROAD && type !== T_WATER && type !== T_MOUNTAIN) {
      primeArt("art/tiles/road.jpg");
      const road = painted("art/tiles/road.jpg");
      if (road) {
        ctx.save();
        ctx.globalAlpha = 0.92;
        drawGround(ctx, road, dw * 0.78, dh * 0.42, T_DIRT, time, x, y);
        ctx.restore();
      } else paintRoad(ctx, dw, dh);
    }
    if (flags & FLAG_RIVER) drawRiver(ctx, dw, dh, time, flags & FLAG_FORD);
    if (type === T_WATER && !gimg) paintWaterShine(ctx, dw, dh, time, x, y);
    if (pathSet.has(x + "," + y)) {
      ctx.globalAlpha = 0.45;
      drawDiamond(ctx, 0, 0, dw * 0.78, dh * 0.78, "rgba(231,197,106,.9)");
      ctx.globalAlpha = 1;
    }
    ctx.restore();
    const vis = inVision(state, playerId, x, y);
    if ((type === T_FOREST || type === T_HILL) && vis) drawForestSprite(ctx, s.x, s.y, cam.zoom, time, x, y, type);
    if (type === T_MOUNTAIN && vis) drawPeak(ctx, s.x, s.y, cam.zoom, time, x);
    if (!vis) {
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.globalAlpha = 0.55;
      drawDiamond(ctx, 0, 0, dw, dh, "rgba(8,4,10,.85)");
      ctx.restore();
    }
  }

  const props = [];
  for (const [x, y] of cells) {
    if (!inVision(state, playerId, x, y)) continue;
    const town = townAt(state, x, y);
    const obj = objectAt(state, x, y);
    const hero = heroAt(state, x, y);
    if (town) props.push({ k: x + y + 0.2, draw: () => drawTown(ctx, state, town, cam, w, h, time) });
    if (obj) props.push({ k: x + y + 0.3, draw: () => drawObject(ctx, state, obj, cam, w, h, time) });
    if (hero) props.push({ k: x + y + 0.6, draw: () => drawHero(ctx, state, hero, cam, w, h, time, hero.id === selectedId) });
  }
  props.sort((a, b) => a.k - b.k);
  for (const p of props) p.draw();

  drawClouds(ctx, w, h, time);
  const vg = ctx.createRadialGradient(w / 2, h / 2, h * 0.2, w / 2, h / 2, h * 0.72);
  vg.addColorStop(0, "rgba(0,0,0,0)");
  vg.addColorStop(1, "rgba(0,0,0,.28)");
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, w, h);
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
  const s = toScreen(c.x, c.y - 4, cam, w, h);
  const fac = FACTIONS[town.faction];
  const src = SPR.castle[town.faction] || fac.castle;
  primeArt(src);
  const img = painted(src);
  const bh = 78 * cam.zoom;
  ctx.save();
  ctx.translate(s.x, s.y);
  ctx.fillStyle = "rgba(0,0,0,.35)";
  ctx.beginPath();
  ctx.ellipse(0, 10 * cam.zoom, 26 * cam.zoom, 8 * cam.zoom, 0, 0, Math.PI * 2);
  ctx.fill();
  if (img) drawFigure(ctx, img, 0, 8 * cam.zoom, bh, time, { seed: town.id, bob: 0.6, sway: 0.012 });
  else {
    ctx.fillStyle = fac.color;
    ctx.fillRect(-30 * cam.zoom, -bh, 60 * cam.zoom, bh);
  }
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
  const s = toScreen(c.x, c.y - 4, cam, w, h);
  const z = cam.zoom;
  ctx.save();
  ctx.translate(s.x, s.y);
  if (obj.type === "monster" && obj.guard) {
    const src = bodySrc(obj.guard.cr);
    primeArt(src);
    const img = painted(src) || painted(bodySrc(String(obj.guard.cr).replace(/_u$/, "")));
    if (!painted(bodySrc(String(obj.guard.cr).replace(/_u$/, "")))) primeArt(bodySrc(String(obj.guard.cr).replace(/_u$/, "")));
    if (img) drawFigure(ctx, img, 0, 10 * z, 46 * z, performance.now(), { seed: obj.id, sway: 0.04 });
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
    if (img) drawFigure(ctx, img, 0, 10 * z, 40 * z, performance.now(), { seed: obj.id, bob: 0, sway: 0 });
    else drawMine(ctx, z, obj.res, "#888");
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
  const s = toScreen(c.x, c.y - 6, cam, w, h);
  const z = cam.zoom;
  const src = rideSrc(hero.rosterId);
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
  if (img && painted(src)) drawFigure(ctx, img, 0, 12 * z, 62 * z, time, { seed: hero.id, bob: 2.2, sway: 0.03 });
  else drawToken(ctx, img, 0, -16 * z, 16 * z, fac.color, "");
  ctx.fillStyle = state.players[hero.player].color;
  ctx.beginPath(); ctx.arc(16 * z, -40 * z, 4 * z, 0, Math.PI * 2); ctx.fill();
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
  const size = 22;
  const fieldW = size * Math.sqrt(3) * (BCOLS - 1 + 0.5) + size * 2;
  const fieldH = size * 1.5 * (BROWS - 1) + size * 2;
  const fit = Math.min((w - 8) / fieldW, (h - 8) / fieldH);
  return { x: fieldW / 2, y: fieldH / 2, zoom: fit, size };
}

function hexPos(c, r, size) {
  return {
    x: size * Math.sqrt(3) * (c + 0.5 * (r & 1)),
    y: size * 1.5 * r,
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
  for (let r = 0; r < BROWS; r++) for (let c = 0; c < BCOLS; c++) {
    const p = battleScreen(c, r, view);
    hexPath(ctx, p.x, p.y, size * 0.96);
    const key = c + "," + r;
    const block = battle.obstacles[key];
    let fill = "rgba(255,255,255,.07)";
    if ((r + c) % 2 === 0) fill = "rgba(0,0,0,.12)";
    if (block === "moat") fill = "rgba(20,70,90,.55)";
    if (reach && reach.has(key)) fill = "rgba(231,197,106,.38)";
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,.08)";
    ctx.stroke();
    if (block === "rock") drawRock(ctx, p.x, p.y, size);
    if (block === "tree") drawBattleTree(ctx, p.x, p.y, size);
    if (block === "wall" || block === "gate") drawWall(ctx, p.x, p.y, size, block, battle.wallHp[key] || 0);
  }

  const stacks = battle.stacks.filter((s) => !s.dead || (view.fx && view.fx[s.uid] && view.fx[s.uid].kind === "die"));
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
  ctx.font = `700 ${Math.max(11, size * 0.48)}px Manrope LK, sans-serif`;
  ctx.textAlign = "center";
  ctx.lineWidth = 3;
  ctx.strokeStyle = "#14080c";
  ctx.strokeText(String(stack.count), x, by - 2);
  ctx.fillStyle = "#fff8e8";
  ctx.fillText(String(stack.count), x, by - 2);
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
