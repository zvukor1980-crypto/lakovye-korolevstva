/** Изометрия карты и гексагональный бой. */

import { CREATURES, FACTIONS, portraitFor } from "./data.js";
import { BCOLS, BROWS, hexDist, hexNeighbors } from "./combat.js";
import {
  FLAG_FORD, FLAG_RIVER, FLAG_ROAD, T_DIRT, T_FOREST, T_GRASS, T_HILL, T_LAVA,
  T_MOUNTAIN, T_SAND, T_SNOW, T_SWAMP, T_WATER,
} from "./data.js";
import { effective, heroAt, inVision, objectAt, remembered, townAt } from "./engine.js";

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
    const sprite = tileCanvas(type, (x * 3 + y * 5) % 3);
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.drawImage(sprite, -dw / 2 - 0.6, -dh / 2 - 0.6, dw + 1.2, dh + 1.2);
    const flags = state.map.flags[i];
    if (flags & FLAG_ROAD) paintRoad(ctx, dw, dh);
    if (flags & FLAG_RIVER) paintRiver(ctx, dw, dh, time, flags & FLAG_FORD);
    if (type === T_WATER) paintWaterShine(ctx, dw, dh, time, x, y);
    if (pathSet.has(x + "," + y)) {
      ctx.globalAlpha = 0.45;
      drawDiamond(ctx, 0, 0, dw * 0.78, dh * 0.78, "rgba(231,197,106,.9)");
      ctx.globalAlpha = 1;
    }
    ctx.restore();
    const vis = inVision(state, playerId, x, y);
    if ((type === T_FOREST || type === T_HILL) && vis) drawTrees(ctx, s.x, s.y, cam.zoom, type, x, y);
    if (type === T_MOUNTAIN && vis) drawMountain(ctx, s.x, s.y, cam.zoom, x, y);
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
  const s = toScreen(c.x, c.y - 8, cam, w, h);
  const fac = FACTIONS[town.faction];
  const img = imageSync(fac.castle);
  prime(fac.castle);
  const bw = 92 * cam.zoom, bh = 58 * cam.zoom;
  ctx.save();
  ctx.translate(s.x, s.y);
  ctx.fillStyle = "rgba(0,0,0,.35)";
  ctx.beginPath();
  ctx.ellipse(0, 16 * cam.zoom, 22 * cam.zoom, 8 * cam.zoom, 0, 0, Math.PI * 2);
  ctx.fill();
  if (img) {
    roundImage(ctx, img, -bw / 2, -bh, bw, bh, 8 * cam.zoom);
  } else {
    ctx.fillStyle = fac.color;
    ctx.fillRect(-bw / 2, -bh, bw, bh * 0.7);
  }
  ctx.strokeStyle = fac.gold;
  ctx.lineWidth = 2;
  ctx.strokeRect(-bw / 2, -bh, bw, bh * 0.72);
  ctx.font = `700 ${Math.max(11, 13 * cam.zoom)}px Manrope LK, sans-serif`;
  ctx.textAlign = "center";
  const label = town.name;
  const lw = ctx.measureText(label).width + 18 * cam.zoom;
  ctx.fillStyle = "rgba(18,8,12,.88)";
  ctx.fillRect(-lw / 2, -2 * cam.zoom, lw, 16 * cam.zoom);
  ctx.strokeStyle = fac.gold;
  ctx.strokeRect(-lw / 2, -2 * cam.zoom, lw, 16 * cam.zoom);
  ctx.fillStyle = fac.gold;
  ctx.fillText(label, 0, 10 * cam.zoom);
  const owner = state.players[town.owner];
  if (owner) {
    ctx.fillStyle = owner.color;
    ctx.beginPath();
    ctx.arc(bw / 2 - 4, -bh + 6, 5, 0, Math.PI * 2);
    ctx.fill();
  }
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
    const src = portraitFor(obj.guard.cr);
    prime(src);
    const img = imageSync(src);
    drawToken(ctx, img, 0, 0, 16 * z, "#c4374f", String(obj.guard.count));
  } else if (obj.type === "resource") {
    drawGem(ctx, z, obj.res);
  } else if (obj.type === "mine") {
    drawMine(ctx, z, obj.res, obj.owner >= 0 ? state.players[obj.owner].color : "#888");
  } else if (obj.type === "artifact" || obj.type === "grail") {
    drawToken(ctx, null, 0, 0, 13 * z, "#e7c56a", "♛");
  } else if (obj.type === "chest") {
    ctx.fillStyle = "#7a3b16";
    ctx.fillRect(-8 * z, -8 * z, 16 * z, 12 * z);
    ctx.fillStyle = "#e7c56a";
    ctx.fillRect(-8 * z, -4 * z, 16 * z, 3 * z);
  } else if (obj.type === "shrine") {
    ctx.fillStyle = "#d6b4ff";
    ctx.beginPath();
    ctx.moveTo(0, -16 * z); ctx.lineTo(8 * z, 4 * z); ctx.lineTo(-8 * z, 4 * z); ctx.fill();
    ctx.fillStyle = "rgba(214,180,255,.8)";
    ctx.beginPath(); ctx.arc(0, -4 * z, 3 * z, 0, Math.PI * 2); ctx.fill();
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
  prime(hero.portrait);
  const img = imageSync(hero.portrait);
  const fac = FACTIONS[hero.faction];
  ctx.save();
  ctx.translate(s.x, s.y + bob);
  const gallop = (time / 140 + hero.id) % (Math.PI * 2);
  drawMount(ctx, z, gallop);
  const r = 15 * z;
  if (selected) {
    ctx.beginPath(); ctx.arc(0, -18 * z, r + 5, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(231,197,106,.9)";
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  drawToken(ctx, img, 0, -18 * z, r, fac.color, "");
  ctx.fillStyle = state.players[hero.player].color;
  ctx.beginPath(); ctx.arc(r * 0.7, -18 * z - r * 0.7, 4 * z, 0, Math.PI * 2); ctx.fill();
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
  const bg = ctx.createLinearGradient(0, 0, 0, h);
  const tone = battle.terrain === "snow" ? ["#dbe7f5", "#8aa0b8"]
    : battle.terrain === "lava" ? ["#4a1c12", "#1a0908"]
    : battle.terrain === "swamp" ? ["#1d3324", "#0c1a12"]
    : battle.terrain === "sand" ? ["#e7d3a1", "#8c7044"]
    : ["#1d4d32", "#0e2418"];
  bg.addColorStop(0, tone[0]);
  bg.addColorStop(1, tone[1]);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  const size = (cam.size || 18) * cam.zoom;
  const reach = view.reach;
  const cur = view.currentUid;
  for (let r = 0; r < BROWS; r++) for (let c = 0; c < BCOLS; c++) {
    const p = battleScreen(c, r, view);
    hexPath(ctx, p.x, p.y, size * 0.96);
    const key = c + "," + r;
    const block = battle.obstacles[key];
    let fill = "rgba(255,255,255,.05)";
    if ((r + c) % 2 === 0) fill = "rgba(0,0,0,.08)";
    if (block === "moat") fill = "rgba(20,70,90,.55)";
    if (reach && reach.has(key)) fill = "rgba(231,197,106,.28)";
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,.08)";
    ctx.stroke();
    if (block === "rock") drawRock(ctx, p.x, p.y, size);
    if (block === "tree") drawBattleTree(ctx, p.x, p.y, size);
    if (block === "wall" || block === "gate") drawWall(ctx, p.x, p.y, size, block, battle.wallHp[key] || 0);
  }

  const stacks = battle.stacks.filter((s) => !s.dead);
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
  const src = portraitFor(stack.cr);
  prime(src);
  const img = imageSync(src);
  const bob = Math.sin(time / 260 + stack.uid) * size * 0.06;
  const lunge = (viewLunge(stack.uid) );
  ctx.save();
  ctx.translate(x, y + bob);
  if (active) {
    ctx.shadowColor = "rgba(231,197,106,.9)";
    ctx.shadowBlur = 12;
  }
  ctx.fillStyle = "rgba(0,0,0,.35)";
  ctx.beginPath(); ctx.ellipse(0, size * 0.55, size * 0.55, size * 0.22, 0, 0, Math.PI * 2); ctx.fill();
  ctx.shadowBlur = 0;
  const r = size * 0.98;
  const ring = stack.side === "left" ? "#e7c56a" : "#d946ef";
  drawToken(ctx, img, 0, -r * 0.2, r, active ? "#fff4c8" : ring, "");
  // блик
  ctx.strokeStyle = "rgba(255,255,255,.45)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(0, -r * 0.2, r * 0.72, Math.PI * 1.15, Math.PI * 1.7);
  ctx.stroke();
  const hpMax = cr.hp * stack.initCount;
  const hp = (stack.count - 1) * cr.hp + stack.topHp;
  const ratio = Math.max(0, Math.min(1, hp / hpMax));
  ctx.fillStyle = "rgba(0,0,0,.55)";
  ctx.fillRect(-r, r * 0.72, r * 2, 4);
  ctx.fillStyle = ratio > 0.5 ? "#4ade80" : ratio > 0.25 ? "#fbbf24" : "#f87171";
  ctx.fillRect(-r, r * 0.72, r * 2 * ratio, 4);
  ctx.font = `700 ${Math.max(10, size * 0.42)}px Manrope LK, sans-serif`;
  ctx.textAlign = "center";
  ctx.lineWidth = 3;
  ctx.strokeStyle = "#14080c";
  ctx.strokeText(String(stack.count), 0, r * 0.62);
  ctx.fillStyle = "#fff8e8";
  ctx.fillText(String(stack.count), 0, r * 0.62);
  if (stack.defending) {
    ctx.fillStyle = "rgba(125, 211, 252, .9)";
    ctx.font = `${Math.max(9, size * 0.32)}px Manrope LK, sans-serif`;
    ctx.fillText("щит", 0, -r * 1.15);
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
  for (const f of Object.values(FACTIONS)) prime(f.castle);
  for (const id of Object.keys(CREATURES)) {
    const p = portraitFor(id);
    if (p) prime(p);
  }
}

export { hexDist, hexNeighbors, effective };
