/** Мелкие чистые утилиты без DOM. */

export function mulberry32(seed) {
  let a = seed >>> 0;
  const fn = () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    fn.state = a >>> 0;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  fn.state = a >>> 0;
  return fn;
}

export function irand(rng, a, b) {
  return a + Math.floor(rng() * (b - a + 1));
}

export function pick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}

export function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}

export function clone(o) {
  return JSON.parse(JSON.stringify(o));
}

export function uid(state) {
  state.nextId = (state.nextId || 1) + 1;
  return state.nextId;
}

export function keyOf(x, y) {
  return x + "," + y;
}

export function bytesToB64(u8) {
  let s = "";
  const chunk = 0x8000;
  for (let i = 0; i < u8.length; i += chunk) {
    s += String.fromCharCode.apply(null, u8.subarray(i, i + chunk));
  }
  if (typeof btoa === "function") return btoa(s);
  return Buffer.from(s, "binary").toString("base64");
}

export function b64ToBytes(b64) {
  const s = typeof atob === "function" ? atob(b64) : Buffer.from(b64, "base64").toString("binary");
  const u = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i);
  return u;
}

export function emptyArmy() {
  return [null, null, null, null, null, null, null];
}

export function emptyResources(extra = {}) {
  return Object.assign(
    { gold: 0, lacquer: 0, resin: 0, pigment: 0, amber: 0, crystal: 0, pearl: 0 },
    extra
  );
}

export function canAfford(have, cost) {
  if (!cost) return true;
  for (const k of Object.keys(cost)) {
    if ((have[k] || 0) < cost[k]) return false;
  }
  return true;
}

export function pay(have, cost) {
  for (const k of Object.keys(cost || {})) have[k] -= cost[k];
}

export function gain(have, add) {
  for (const k of Object.keys(add || {})) have[k] = (have[k] || 0) + add[k];
}

export function costStr(cost) {
  if (!cost) return "бесплатно";
  const names = {
    gold: "зол.",
    lacquer: "лак",
    resin: "смола",
    pigment: "пигм.",
    amber: "янтарь",
    crystal: "хруст.",
    pearl: "жемч.",
  };
  return Object.entries(cost)
    .filter(([, v]) => v)
    .map(([k, v]) => v + " " + (names[k] || k))
    .join(", ");
}

export function shuffle(rng, arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
