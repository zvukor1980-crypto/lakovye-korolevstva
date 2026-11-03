/** Правила партии: карта, экономика, герои, ИИ, связь с боем. */

import {
  ARTIFACTS, CLASSES, CREATURES, FACTIONS, FLAG_FORD, FLAG_RIVER, FLAG_ROAD,
  FLAVOR_SIGNS, MACHINES, MAGE_POOL, PLAYER_COLORS, ROSTER, SCENARIOS, SETS, SKILLS,
  SPELLS, START_ARMIES, T_DIRT, T_FOREST, T_GRASS, T_HILL, T_LAVA, T_MOUNTAIN, T_SAND,
  T_SNOW, T_SWAMP, T_WATER, TRADE, aiValue, baseCreatureId, buildingDef, calendar,
  portraitFor, tiersOf, wisdomCap, xpForLevel,
} from "./data.js";
import {
  act, attackOptions, chooseAiAction, controllerOf, createBattle, currentStack,
  prepareTurn, spellManaCost, startFight, surrenderCost,
} from "./combat.js";
import {
  b64ToBytes, bytesToB64, canAfford, clamp, emptyArmy, emptyResources, gain, irand,
  mulberry32, pay, pick, shuffle, uid,
} from "./util.js";

const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];

function roll(state) {
  const rng = mulberry32(state.rngState >>> 0);
  const v = rng();
  state.rngState = rng.state >>> 0;
  return v;
}
function ri(state, a, b) { return a + Math.floor(roll(state) * (b - a + 1)); }
function choice(state, arr) { return arr[Math.floor(roll(state) * arr.length)]; }

const sameId = (a, b) => String(a) === String(b);
export function heroById(state, id) { return state.heroes.find((h) => sameId(h.id, id)) || null; }
export function townById(state, id) { return state.towns.find((t) => sameId(t.id, id)) || null; }
export function playerById(state, id) { return state.players.find((p) => sameId(p.id, id)) || null; }
export function objectById(state, id) { return state.objects.find((o) => sameId(o.id, id)) || null; }

export function idx(state, x, y) { return y * state.map.w + x; }
export function inMap(state, x, y) {
  return x >= 0 && y >= 0 && x < state.map.w && y < state.map.h;
}

export function skillLv(hero, id) { return (hero.skills && hero.skills[id]) || 0; }

export function equippedIds(hero) {
  return Object.values(hero.artifacts || {}).filter(Boolean);
}

export function modsOf(hero) {
  const m = { attack: 0, defense: 0, power: 0, knowledge: 0, morale: 0, luck: 0, move: 0, sight: 0, spell: 0, regen: 0, income: 0, resist: 0, ranged: 0 };
  const ids = equippedIds(hero);
  for (const id of ids) {
    const a = ARTIFACTS[id];
    if (!a) continue;
    for (const k of Object.keys(a.mods || {})) m[k] = (m[k] || 0) + a.mods[k];
  }
  for (const set of Object.values(SETS)) {
    if (set.parts.every((p) => ids.includes(p))) {
      for (const k of Object.keys(set.bonus)) m[k] = (m[k] || 0) + set.bonus[k];
    }
  }
  return m;
}

export function armyMoraleMod(hero) {
  const fac = new Set();
  let undead = 0, living = 0;
  for (const sl of hero.army) {
    if (!sl) continue;
    const cr = CREATURES[sl.id];
    if (!cr) continue;
    fac.add(cr.faction);
    if (cr.undead) undead++; else living++;
  }
  if (!living) return 0;
  let m = 0;
  if (fac.size === 1 && [...fac][0] === hero.faction) m += 1;
  else m -= Math.max(0, fac.size - 1);
  if (undead && living) m -= 1;
  return m;
}

export function effective(hero) {
  const md = modsOf(hero);
  return {
    attack: hero.attack + md.attack,
    defense: hero.defense + md.defense,
    power: hero.power + md.power,
    knowledge: hero.knowledge + md.knowledge,
    morale: md.morale + skillLv(hero, "leadership") + armyMoraleMod(hero),
    luck: md.luck + skillLv(hero, "luck"),
    move: md.move,
    sight: 5 + skillLv(hero, "scouting") + md.sight,
    spell: md.spell,
    regen: md.regen,
    income: md.income,
    resist: (skillLv(hero, "resistance") === 1 ? 10 : skillLv(hero, "resistance") === 2 ? 20 : skillLv(hero, "resistance") === 3 ? 30 : 0) + md.resist,
    ranged: md.ranged,
    offense: [0, 0.1, 0.2, 0.3][skillLv(hero, "offense")],
    armorer: [0, 0.05, 0.1, 0.15][skillLv(hero, "armorer")],
    archery: [0, 0.15, 0.3, 0.5][skillLv(hero, "archery")] + md.ranged / 100,
    sorcery: [0, 0.15, 0.3, 0.5][skillLv(hero, "sorcery")] + md.spell / 100,
  };
}

export function maxMana(hero) {
  const e = effective(hero);
  const intel = [1, 1.25, 1.5, 2][skillLv(hero, "intelligence")];
  return Math.max(10, Math.round(e.knowledge * 10 * intel));
}

export function maxMove(hero) {
  const e = effective(hero);
  let m = 1500;
  m = Math.round(m * (1 + [0, 0.1, 0.2, 0.3][skillLv(hero, "logistics")]));
  m += e.move;
  m += hero.bonusMove || 0;
  return m;
}

export function powerOf(army) {
  let v = 0;
  for (const sl of army || []) {
    if (!sl) continue;
    v += aiValue(CREATURES[sl.id]) * sl.count;
  }
  return v;
}

function hash2(x, y, seed) {
  let n = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(seed | 0, 1442695041);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}
function fade(t) { return t * t * (3 - 2 * t); }
function noise(x, y, seed) {
  const x0 = Math.floor(x), y0 = Math.floor(y);
  const fx = fade(x - x0), fy = fade(y - y0);
  const a = hash2(x0, y0, seed) * (1 - fx) + hash2(x0 + 1, y0, seed) * fx;
  const b = hash2(x0, y0 + 1, seed) * (1 - fx) + hash2(x0 + 1, y0 + 1, seed) * fx;
  return a * (1 - fy) + b * fy;
}
function fbm(x, y, seed) {
  return noise(x, y, seed) * 0.62 + noise(x * 2, y * 2, seed + 19) * 0.28 + noise(x * 4, y * 4, seed + 47) * 0.1;
}

function makeHero(state, rosterId, playerId, x, y) {
  const r = ROSTER.find((h) => h.id === rosterId) || choice(state, ROSTER.filter((h) => CLASSES[h.classId].faction === playerById(state, playerId).faction));
  const cls = CLASSES[r.classId];
  const hero = {
    id: uid(state),
    rosterId: r.id,
    name: r.name,
    classId: cls.id,
    faction: cls.faction,
    portrait: r.portrait,
    player: playerId,
    x, y,
    level: 1,
    xp: 0,
    attack: cls.start.attack,
    defense: cls.start.defense,
    power: cls.start.power,
    knowledge: cls.start.knowledge,
    movement: 0,
    mana: 0,
    skills: { [cls.skill]: 1 },
    spells: cls.spells.slice(),
    book: !!cls.book,
    artifacts: { head: null, neck: null, cloak: null, weapon: null, shield: null, chest: null, feet: null, ring1: null, ring2: null, misc1: null, misc2: null, misc3: null, misc4: null },
    backpack: [],
    army: emptyArmy(),
    machines: { ballista: false, tent: false, ammo: false },
    fly: false,
    water: false,
    bonusMove: 0,
    stablesWeek: 0,
    unspent: 0,
    offer: null,
    lost: false,
  };
  const army = START_ARMIES[cls.id] || [];
  army.forEach((pair, i) => { hero.army[i] = { id: pair[0], count: pair[1] }; });
  hero.movement = maxMove(hero);
  hero.mana = maxMana(hero);
  return hero;
}

function stampTown(state, faction, owner, x, y, buildings) {
  const town = {
    id: uid(state),
    name: FACTIONS[faction].town,
    faction, owner, x, y,
    buildings: { villageHall: true },
    garrison: emptyArmy(),
    pool: {},
    spells: [],
    builtToday: false,
    grail: false,
  };
  for (const b of buildings || []) town.buildings[b] = true;
  learnGuildSpells(state, town);
  growTown(town, true);
  state.towns.push(town);
  return town;
}

function learnGuildSpells(state, town) {
  let lvl = 0;
  for (let i = 1; i <= 5; i++) if (town.buildings["mage" + i]) lvl = i;
  const pool = MAGE_POOL[town.faction] || MAGE_POOL.scarlet;
  town.spells = [];
  for (let i = 1; i <= lvl; i++) {
    const src = (pool[i] || []).slice();
    for (let k = src.length - 1; k > 0; k--) {
      const j = Math.floor(roll(state) * (k + 1));
      [src[k], src[j]] = [src[j], src[k]];
    }
    for (const id of src.slice(0, 3)) if (!town.spells.includes(id)) town.spells.push(id);
  }
}

export function growTown(town, reset) {
  const tiers = tiersOf(town.faction);
  const mult = town.buildings.castle ? 2 : town.buildings.citadel ? 1.5 : 1;
  const grail = town.buildings.grail ? 1.5 : 1;
  const hordeTier = town.buildings.horde ? (buildingDef(town.faction, "horde").hordeTier || 0) : 0;
  for (let i = 0; i < tiers.length; i++) {
    if (!town.buildings["dw" + (i + 1)]) continue;
    const b = tiers[i];
    let g = b.growth * mult * grail;
    if (hordeTier === i + 1) g += b.growth;
    if (town.buildings.special && town.faction === "emerald" && i < 3) g += 1;
    if (town.buildings.special && town.faction === "onyx" && b.id === "o_spark") g += 8;
    const add = Math.max(1, Math.round(g));
    town.pool[b.id] = (reset ? 0 : (town.pool[b.id] || 0)) + add;
  }
}

function carveRiver(elev, flags, terrain, w, h, rngSeed) {
  const rng = mulberry32(rngSeed);
  for (let n = 0; n < 3; n++) {
    let best = -1, bx = 1, by = 1;
    for (let k = 0; k < 30; k++) {
      const x = 2 + Math.floor(rng() * (w - 4));
      const y = 2 + Math.floor(rng() * (h - 4));
      if (elev[y * w + x] > best && terrain[y * w + x] !== T_WATER) { best = elev[y * w + x]; bx = x; by = y; }
    }
    let x = bx, y = by;
    const seen = new Set();
    for (let step = 0; step < w + h; step++) {
      if (!seen.has(y * w + x)) {
        seen.add(y * w + x);
        if (terrain[y * w + x] !== T_WATER && terrain[y * w + x] !== T_MOUNTAIN) flags[y * w + x] |= FLAG_RIVER;
      }
      if (terrain[y * w + x] === T_WATER) break;
      let lx = x, ly = y, le = elev[y * w + x];
      for (const [dx, dy] of DIRS) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        if (elev[ny * w + nx] < le) { le = elev[ny * w + nx]; lx = nx; ly = ny; }
      }
      if (lx === x && ly === y) break;
      x = lx; y = ly;
    }
  }
}

export function createGame(spec) {
  const mapSpec = spec.map;
  const w = mapSpec.w, h = mapSpec.h;
  const seed = mapSpec.seed >>> 0;
  const state = {
    version: 1,
    scenarioId: spec.id,
    name: spec.name,
    briefing: spec.briefing || "",
    victory: spec.victory || { type: "defeatAll" },
    campaign: !!spec.campaign,
    day: 1,
    rngState: seed ^ 0x51f1e,
    nextId: 1,
    current: 0,
    winner: null,
    loss: null,
    map: { w, h, terrain: new Uint8Array(w * h), flags: new Uint8Array(w * h) },
    players: [],
    heroes: [],
    towns: [],
    objects: [],
    log: [],
    battle: null,
    battleMeta: null,
  };
  const elev = new Float32Array(w * h);
  const moist = new Float32Array(w * h);
  const biome = mapSpec.biome || "green";
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    elev[y * w + x] = fbm(x / 9, y / 9, seed);
    moist[y * w + x] = fbm(x / 8, y / 8, seed + 99);
  }
  const waterLine = mapSpec.water ?? 0.07;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const e = elev[y * w + x];
    const m = moist[y * w + x];
    let t = T_GRASS;
    if (e < 0.30 + waterLine * 0.5) t = T_WATER;
    else if (e > 0.74) t = T_MOUNTAIN;
    else if (e > 0.66) t = T_HILL;
    else if (biome === "snow" || (biome !== "swamp" && y < h * 0.12 && e > 0.45)) t = m > 0.55 ? T_FOREST : T_SNOW;
    else if (biome === "swamp" && m > 0.42 && e < 0.62) t = T_SWAMP;
    else if (m > 0.62 && e < 0.66) t = T_FOREST;
    else if (m < 0.28 && e < 0.55) t = T_SAND;
    else if (e > 0.62 && m < 0.4) t = T_DIRT;
    else t = T_GRASS;
    if (biome === "lava" && e > 0.6 && m < 0.35) t = T_LAVA;
    state.map.terrain[y * w + x] = t;
  }
  if (mapSpec.rivers) carveRiver(elev, state.map.flags, state.map.terrain, w, h, seed + 7);

  spec.players.forEach((p, i) => {
    state.players.push({
      id: i,
      name: p.name,
      control: p.control,
      faction: p.faction,
      ai: p.ai || "normal",
      color: p.color || PLAYER_COLORS[i % PLAYER_COLORS.length],
      resources: emptyResources(spec.resources || { gold: 15000, lacquer: 20, resin: 12, pigment: 4, amber: 4, crystal: 4, pearl: 2 }),
      fog: new Uint8Array(w * h),
      keys: {},
      eliminated: false,
    });
    if (p.ai === "hard" && p.control === "ai") {
      state.players[i].resources.gold += 8000;
      gain(state.players[i].resources, { lacquer: 10, resin: 10, pigment: 4, amber: 4, crystal: 4, pearl: 4 });
    }
    if (p.ai === "easy" && p.control === "ai") {
      state.players[i].resources.gold = Math.max(4000, state.players[i].resources.gold - 4000);
    }
  });

  const spots = pickTownSpots(state, spec.players.length, elev);
  spec.players.forEach((p, i) => {
    const s = spots[i];
    clearDisc(state, s.x, s.y, 3);
    const town = stampTown(state, p.faction, i, s.x, s.y, spec.buildings || ["villageHall", "fort", "dw1"]);
    const hx = findLand(state, s.x, s.y);
    const hero = makeHero(state, p.hero, i, hx.x, hx.y);
    if (p.control === "ai" && p.ai === "hard") {
      const t = tiersOf(p.faction)[2];
      if (t) hero.army[3] = { id: t.id, count: 6 };
    }
    state.heroes.push(hero);
    reveal(state, i, hero.x, hero.y, effective(hero).sight);
    reveal(state, i, town.x, town.y, 5);
  });

  paveRoads(state);
  connectTowns(state);
  sprinkle(state, spec);
  if (spec.victory && spec.victory.type === "grail") placeGrail(state);
  // стартовый день уже с приростом (growTown вызван)
  state.log.push({ day: 1, text: "Рассвело. " + calendar(1).dayName + ", неделя 1." });
  beginTurn(state);
  return state;
}

function pickTownSpots(state, n, elev) {
  const { w, h } = state.map;
  const pts = [];
  for (let attempt = 0; attempt < 400 && pts.length < n; attempt++) {
    const x = 3 + Math.floor(roll(state) * (w - 6));
    const y = 3 + Math.floor(roll(state) * (h - 6));
    const t = state.map.terrain[idx(state, x, y)];
    if (t === T_WATER || t === T_MOUNTAIN) continue;
    if (elev && elev[idx(state, x, y)] > 0.72) continue;
    if (pts.some((p) => Math.hypot(p.x - x, p.y - y) < Math.min(w, h) * 0.38)) continue;
    pts.push({ x, y });
  }
  while (pts.length < n) {
    const ang = pts.length / n * Math.PI * 2;
    pts.push({
      x: clamp(Math.round(w / 2 + Math.cos(ang) * (w * 0.32)), 2, w - 3),
      y: clamp(Math.round(h / 2 + Math.sin(ang) * (h * 0.32)), 2, h - 3),
    });
  }
  return pts;
}

function clearDisc(state, cx, cy, rad) {
  for (let y = cy - rad; y <= cy + rad; y++) for (let x = cx - rad; x <= cx + rad; x++) {
    if (!inMap(state, x, y)) continue;
    if (Math.hypot(x - cx, y - cy) > rad) continue;
    const t = state.map.terrain[idx(state, x, y)];
    if (t === T_WATER || t === T_MOUNTAIN) state.map.terrain[idx(state, x, y)] = T_GRASS;
    if (state.map.flags[idx(state, x, y)] & FLAG_RIVER) state.map.flags[idx(state, x, y)] |= FLAG_FORD;
  }
}

function findLand(state, x, y) {
  if (landable(state, null, x + 1, y)) return { x: x + 1, y };
  for (const [dx, dy] of DIRS) if (landable(state, null, x + dx, y + dy)) return { x: x + dx, y: y + dy };
  return { x, y };
}

function landable(state, hero, x, y) {
  if (!inMap(state, x, y)) return false;
  const t = state.map.terrain[idx(state, x, y)];
  const f = state.map.flags[idx(state, x, y)];
  if (hero && hero.fly) return true;
  if (t === T_MOUNTAIN) return false;
  const bridge = (f & FLAG_ROAD) || (f & FLAG_FORD);
  if (t === T_WATER && !(hero && hero.water) && !bridge) return false;
  if ((f & FLAG_RIVER) && !bridge && !(hero && hero.water)) return false;
  return true;
}

export function tileCost(state, hero, x, y) {
  if (hero.fly) return 100;
  const t = state.map.terrain[idx(state, x, y)];
  const f = state.map.flags[idx(state, x, y)];
  if (f & FLAG_ROAD) return 65;
  const base = { [T_GRASS]: 100, [T_DIRT]: 110, [T_SAND]: 150, [T_SNOW]: 165, [T_SWAMP]: 185, [T_LAVA]: 150, [T_HILL]: 145, [T_FOREST]: 190, [T_WATER]: 100, [T_MOUNTAIN]: 100 };
  let c = base[t] ?? 100;
  const extra = Math.max(0, c - 100);
  const pf = [1, 0.75, 0.5, 0][skillLv(hero, "pathfinding")];
  return 100 + Math.round(extra * pf);
}

function paveRoads(state) {
  const towns = state.towns.slice();
  for (let i = 0; i < towns.length; i++) {
    let best = null, bd = 1e9;
    for (let j = 0; j < towns.length; j++) if (i !== j) {
      const d = Math.hypot(towns[i].x - towns[j].x, towns[i].y - towns[j].y);
      if (d < bd) { bd = d; best = towns[j]; }
    }
    if (!best) continue;
    roadBetween(state, towns[i], best);
  }
}
function connectTowns(state) {
  if (state.towns.length < 2) return;
  const origin = state.towns[0];
  const seen = flood(state, origin.x, origin.y);
  for (const t of state.towns) {
    if (seen[idx(state, t.x, t.y)]) continue;
    roadBetween(state, origin, t);
    const seen2 = flood(state, origin.x, origin.y);
    if (!seen2[idx(state, t.x, t.y)]) carveCorridor(state, origin, t);
  }
}
function flood(state, sx, sy) {
  const w = state.map.w;
  const seen = new Uint8Array(state.map.terrain.length);
  const dummy = { fly: false, water: false };
  const q = [[sx, sy]];
  if (!inMap(state, sx, sy)) return seen;
  seen[sy * w + sx] = 1;
  while (q.length) {
    const [x, y] = q.pop();
    for (const [dx, dy] of DIRS) {
      const nx = x + dx, ny = y + dy;
      if (!landable(state, dummy, nx, ny)) continue;
      const i = ny * w + nx;
      if (seen[i]) continue;
      seen[i] = 1;
      q.push([nx, ny]);
    }
  }
  return seen;
}
function carveCorridor(state, a, b) {
  let x = a.x, y = a.y;
  for (let n = 0; n < 800 && (x !== b.x || y !== b.y); n++) {
    state.map.terrain[idx(state, x, y)] = T_GRASS;
    state.map.flags[idx(state, x, y)] |= FLAG_ROAD | FLAG_FORD;
    if (x !== b.x) x += Math.sign(b.x - x);
    else if (y !== b.y) y += Math.sign(b.y - y);
  }
  state.map.flags[idx(state, b.x, b.y)] |= FLAG_ROAD;
}
function roadBetween(state, a, b) {
  let x = a.x, y = a.y;
  const seen = new Set();
  for (let step = 0; step < 400; step++) {
    state.map.flags[idx(state, x, y)] |= FLAG_ROAD;
    if (state.map.flags[idx(state, x, y)] & FLAG_RIVER) state.map.flags[idx(state, x, y)] |= FLAG_FORD;
    if (x === b.x && y === b.y) break;
    const key = x + "," + y;
    if (seen.has(key)) break;
    seen.add(key);
    const sx = Math.sign(b.x - x), sy = Math.sign(b.y - y);
    const opts = [[x + sx, y + sy], [x + sx, y], [x, y + sy]].filter(([nx, ny]) => inMap(state, nx, ny));
    let pickn = opts[0];
    for (const o of opts) {
      const t = state.map.terrain[idx(state, o[0], o[1])];
      if (t !== T_MOUNTAIN && t !== T_WATER) { pickn = o; break; }
    }
    if (state.map.terrain[idx(state, pickn[0], pickn[1])] === T_MOUNTAIN) state.map.terrain[idx(state, pickn[0], pickn[1])] = T_HILL;
    if (state.map.terrain[idx(state, pickn[0], pickn[1])] === T_WATER) {
      state.map.flags[idx(state, pickn[0], pickn[1])] |= FLAG_FORD | FLAG_ROAD;
    }
    x = pickn[0]; y = pickn[1];
  }
}

function sprinkle(state, spec) {
  const { w, h } = state.map;
  const resPool = ["lacquer", "lacquer", "resin", "resin", "gold", "gold", "pigment", "amber", "crystal", "pearl"];
  const cells = [];
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    if (!landable(state, null, x, y)) continue;
    if (nearTown(state, x, y, 3)) continue;
    cells.push([x, y]);
  }
  for (let i = cells.length - 1; i > 0; i--) {
    const j = Math.floor(roll(state) * (i + 1));
    [cells[i], cells[j]] = [cells[j], cells[i]];
  }
  let cursor = 0;
  const take = () => cells[cursor++] || null;
  const area = w * h;
  const minePlan = [
    ["lacquer", 2 + Math.floor(area / 700)],
    ["resin", 2 + Math.floor(area / 700)],
    ["gold", 1 + Math.floor(area / 900)],
    ["pigment", 1], ["amber", 1], ["crystal", 1], ["pearl", 1],
  ];
  for (const [res, n] of minePlan) for (let k = 0; k < n; k++) {
    const c = take(); if (!c) break;
    const dist = distToStart(state, c[0], c[1]);
    const guard = scaleGuard(state, dist, 0.8);
    state.objects.push({ id: uid(state), type: "mine", x: c[0], y: c[1], res, owner: -1, guard });
  }
  const piles = Math.round(area / 55);
  for (let k = 0; k < piles; k++) {
    const c = take(); if (!c) break;
    const res = choice(state, resPool);
    const amount = res === "gold" ? ri(state, 400, 1800) : ri(state, 2, 6);
    state.objects.push({ id: uid(state), type: "resource", x: c[0], y: c[1], res, amount });
  }
  const factions = ["scarlet", "emerald", "onyx", "neutral"];
  const dwellN = Math.round(area / 180);
  for (let k = 0; k < dwellN; k++) {
    const c = take(); if (!c) break;
    const fac = choice(state, factions);
    let list = fac === "neutral"
      ? ["n_bandit", "n_nomad", "n_elem", "n_mage"]
      : tiersOf(fac).slice(0, 5).map((t) => t.id);
    const cr = choice(state, list);
    const growth = CREATURES[cr].growth || 4;
    state.objects.push({ id: uid(state), type: "dwelling", x: c[0], y: c[1], creature: cr, pool: growth, growth });
  }
  const monN = Math.round(area / 42);
  for (let k = 0; k < monN; k++) {
    const c = take(); if (!c) break;
    const dist = distToStart(state, c[0], c[1]);
    const g = scaleGuard(state, dist, 1);
    const reward = monsterReward(state, g);
    state.objects.push({ id: uid(state), type: "monster", x: c[0], y: c[1], guard: g, reward, name: CREATURES[g.cr].name });
  }
  const artIds = shuffleArray(state, Object.keys(ARTIFACTS));
  const artN = Math.min(artIds.length, Math.round(area / 140));
  for (let k = 0; k < artN; k++) {
    const c = take(); if (!c) break;
    const dist = distToStart(state, c[0], c[1]);
    state.objects.push({ id: uid(state), type: "artifact", x: c[0], y: c[1], artifact: artIds[k], guard: dist > 8 ? scaleGuard(state, dist, 0.7) : null });
  }
  const shrines = ["bless", "haste", "curse", "slow", "lightning", "stoneSkin", "bloodlust", "dispel", "fireball", "prayer"];
  for (let k = 0; k < Math.round(area / 220); k++) {
    const c = take(); if (!c) break;
    state.objects.push({ id: uid(state), type: "shrine", x: c[0], y: c[1], spell: choice(state, shrines) });
  }
  for (let k = 0; k < Math.round(area / 260); k++) {
    const c = take(); if (!c) break;
    state.objects.push({ id: uid(state), type: "chest", x: c[0], y: c[1], guard: roll(state) < 0.45 ? scaleGuard(state, distToStart(state, c[0], c[1]), 0.6) : null });
  }
  const once = ["witch", "stone", "arena", "fountain", "stables", "mill", "garden", "tower", "university", "campfire", "scholar", "temple", "tree"];
  for (const type of once) {
    const count = type === "campfire" ? Math.round(area / 200) : type === "sign" ? 0 : Math.max(1, Math.round(area / 500));
    for (let k = 0; k < count; k++) {
      const c = take(); if (!c) break;
      const obj = { id: uid(state), type, x: c[0], y: c[1] };
      if (type === "tower") obj.used = false;
      if (type === "university" || type === "witch") obj.used = false;
      state.objects.push(obj);
    }
  }
  for (let k = 0; k < 4; k++) {
    const c = take(); if (!c) break;
    state.objects.push({ id: uid(state), type: "sign", x: c[0], y: c[1], text: FLAVOR_SIGNS[k % FLAVOR_SIGNS.length] });
  }
  // монолиты — две пары
  for (const color of ["red", "blue"]) {
    const a = take(), b = take();
    if (!a || !b) break;
    const ida = uid(state), idb = uid(state);
    state.objects.push({ id: ida, type: "monolith", x: a[0], y: a[1], color, pair: idb });
    state.objects.push({ id: idb, type: "monolith", x: b[0], y: b[1], color, pair: ida });
  }
  if ((state.map.w * state.map.h) > 900) {
    for (const color of ["red", "blue"]) {
      const g = take(), key = take();
      if (!g || !key) break;
      state.objects.push({ id: uid(state), type: "gate", x: g[0], y: g[1], color });
      state.objects.push({ id: uid(state), type: "key", x: key[0], y: key[1], color, guard: scaleGuard(state, distToStart(state, key[0], key[1]), 0.5) });
    }
  }
  // тюрьма с запасной героиней
  const pr = take();
  if (pr) state.objects.push({ id: uid(state), type: "prison", x: pr[0], y: pr[1], guard: scaleGuard(state, distToStart(state, pr[0], pr[1]), 0.9) });
}

function shuffleArray(state, arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(roll(state) * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function nearTown(state, x, y, r) {
  return state.towns.some((t) => Math.hypot(t.x - x, t.y - y) <= r);
}
function distToStart(state, x, y) {
  let d = 99;
  for (const t of state.towns) d = Math.min(d, Math.hypot(t.x - x, t.y - y));
  return d;
}
function scaleGuard(state, dist, mul) {
  const span = Math.hypot(state.map.w, state.map.h);
  const t = clamp(dist / (span * 0.55), 0, 1);
  const tier = clamp(1 + Math.floor(t * 6.2), 1, 7);
  const table = [
    ["s_page", "e_dew", "o_spark", "n_bandit"],
    ["s_shield", "e_bow", "o_shade", "n_bandit_u"],
    ["s_xbow", "e_uni", "o_wraith", "n_nomad"],
    ["s_griff", "e_tree", "o_vamp", "n_elem"],
    ["s_knight", "e_witch", "o_bone", "n_nomad_u"],
    ["s_champ", "e_serpent", "o_knight", "n_elem_u"],
    ["s_dragon", "e_titan", "o_dragon", "n_mage"],
  ];
  const cr = choice(state, table[tier - 1]);
  const base = [14, 9, 7, 5, 4, 2, 1][tier - 1];
  const count = Math.max(1, Math.round(base * (0.45 + t) * mul));
  return { cr, count };
}
function monsterReward(state, g) {
  const cr = CREATURES[g.cr];
  const gold = Math.round((cr.cost.gold || 40) * g.count * (0.35 + roll(state) * 0.4));
  const reward = { gold };
  if (roll(state) < 0.4) {
    const res = choice(state, ["lacquer", "resin", "pigment", "amber", "crystal", "pearl"]);
    reward[res] = ri(state, 1, 4);
  }
  return reward;
}
function placeGrail(state) {
  let best = null, bd = -1;
  for (let y = 2; y < state.map.h - 2; y++) for (let x = 2; x < state.map.w - 2; x++) {
    if (!landable(state, null, x, y)) continue;
    if (occupied(state, x, y)) continue;
    const d = distToStart(state, x, y);
    if (d > bd) { bd = d; best = [x, y]; }
  }
  if (!best) best = [Math.floor(state.map.w / 2), Math.floor(state.map.h / 2)];
  state.objects.push({
    id: uid(state), type: "grail", x: best[0], y: best[1],
    guard: { cr: "s_dragon", count: 1 + (state.map.w > 40 ? 1 : 0) },
  });
}
function occupied(state, x, y) {
  if (state.towns.some((t) => t.x === x && t.y === y)) return true;
  if (state.heroes.some((h) => !h.lost && h.x === x && h.y === y)) return true;
  if (state.objects.some((o) => !o.removed && o.x === x && o.y === y)) return true;
  return false;
}

export function objectAt(state, x, y) {
  return state.objects.find((o) => !o.removed && o.x === x && o.y === y) || null;
}
export function townAt(state, x, y) {
  return state.towns.find((t) => t.x === x && t.y === y) || null;
}
export function heroAt(state, x, y) {
  return state.heroes.find((h) => !h.lost && h.x === x && h.y === y) || null;
}

function hardBlock(state, x, y) {
  if (!inMap(state, x, y)) return true;
  const t = state.map.terrain[idx(state, x, y)];
  const f = state.map.flags[idx(state, x, y)];
  const bridge = (f & FLAG_ROAD) || (f & FLAG_FORD);
  if (t === T_MOUNTAIN) return true;
  if (t === T_WATER && !bridge) return true;
  if ((f & FLAG_RIVER) && !bridge) return true;
  return false;
}

export function passable(state, hero, x, y) {
  if (!inMap(state, x, y)) return false;
  const gate = objectAt(state, x, y);
  if (gate && gate.type === "gate") {
    const p = playerById(state, hero.player);
    if (!p.keys[gate.color]) return false;
  }
  if (hero.fly) return true;
  return landable(state, hero, x, y);
}

function blockedByBody(state, hero, x, y, goalX, goalY) {
  if (x === goalX && y === goalY) return false;
  const h = heroAt(state, x, y);
  if (h && h.id !== hero.id) return true;
  const o = objectAt(state, x, y);
  if (o && o.type === "monster") return true;
  return false;
}

export function findPath(state, hero, tx, ty) {
  if (!inMap(state, tx, ty)) return null;
  let gx = tx, gy = ty;
  const foe = heroAt(state, tx, ty);
  const obj = objectAt(state, tx, ty);
  const attackHero = foe && foe.player !== hero.player;
  const attackMon = obj && obj.type === "monster";
  if (attackHero || attackMon) {
    let best = null, bestCost = 1e9;
    for (const [dx, dy] of DIRS) {
      const nx = tx + dx, ny = ty + dy;
      if (!passable(state, hero, nx, ny)) continue;
      if (blockedByBody(state, hero, nx, ny, nx, ny) && !(nx === hero.x && ny === hero.y)) continue;
      const p = astar(state, hero, nx, ny);
      if (p && p.total < bestCost) { bestCost = p.total; best = p; }
    }
    if (!best) return null;
    best.attack = attackHero ? { heroId: foe.id } : { objectId: obj.id };
    return best;
  }
  return astar(state, hero, gx, gy);
}

function astar(state, hero, tx, ty) {
  const w = state.map.w;
  const startI = hero.y * w + hero.x;
  const goalI = ty * w + tx;
  if (!passable(state, hero, tx, ty) && !(hero.x === tx && hero.y === ty)) return null;
  const open = [startI];
  const g = new Map([[startI, 0]]);
  const parent = new Map();
  const closed = new Set();
  while (open.length) {
    let bi = 0;
    for (let i = 1; i < open.length; i++) {
      const af = g.get(open[i]) + heur(open[i], tx, ty, w);
      const bf = g.get(open[bi]) + heur(open[bi], tx, ty, w);
      if (af < bf) bi = i;
    }
    const cur = open.splice(bi, 1)[0];
    if (cur === goalI) break;
    if (closed.has(cur)) continue;
    closed.add(cur);
    const cx = cur % w, cy = (cur / w) | 0;
    for (const [dx, dy] of DIRS) {
      const nx = cx + dx, ny = cy + dy;
      if (!inMap(state, nx, ny)) continue;
      if (dx && dy && hardBlock(state, cx + dx, cy) && hardBlock(state, cx, cy + dy) && !hero.fly) continue;
      if (!passable(state, hero, nx, ny)) continue;
      if (blockedByBody(state, hero, nx, ny, tx, ty)) continue;
      const ni = ny * w + nx;
      const ng = g.get(cur) + tileCost(state, hero, nx, ny);
      if (g.has(ni) && ng >= g.get(ni)) continue;
      g.set(ni, ng);
      parent.set(ni, cur);
      open.push(ni);
    }
  }
  if (!parent.has(goalI) && startI !== goalI) return null;
  const tiles = [];
  let cur = goalI;
  const guard = new Set();
  while (cur !== startI && !guard.has(cur)) {
    guard.add(cur);
    const x = cur % w, y = (cur / w) | 0;
    tiles.push({ x, y, cost: tileCost(state, hero, x, y) });
    cur = parent.get(cur);
    if (cur === undefined) return null;
  }
  tiles.reverse();
  let total = 0;
  const within = [];
  let budget = hero.movement;
  for (const t of tiles) {
    if (t.cost > budget) break;
    budget -= t.cost;
    total += t.cost;
    within.push(t);
  }
  return { tiles: within, full: tiles, total, partial: within.length < tiles.length, remain: budget };
}
function heur(i, tx, ty, w) {
  const x = i % w, y = (i / w) | 0;
  return (Math.abs(tx - x) + Math.abs(ty - y)) * 90;
}

export function reveal(state, playerId, x, y, radius) {
  const p = playerById(state, playerId);
  const r = radius || 5;
  const { w, h } = state.map;
  for (let yy = Math.max(0, y - r); yy <= Math.min(h - 1, y + r); yy++) {
    for (let xx = Math.max(0, x - r); xx <= Math.min(w - 1, x + r); xx++) {
      if (Math.hypot(xx - x, yy - y) <= r + 0.2) p.fog[yy * w + xx] = 1;
    }
  }
}
export function remembered(state, playerId, x, y) {
  const p = playerById(state, playerId);
  if (!inMap(state, x, y)) return false;
  return p.fog[idx(state, x, y)] === 1;
}
export function inVision(state, playerId, x, y) {
  const p = playerById(state, playerId);
  for (const h of state.heroes) {
    if (h.lost || h.player !== playerId) continue;
    const rad = effective(h).sight;
    if (Math.hypot(h.x - x, h.y - y) <= rad + 0.15) return true;
  }
  for (const t of state.towns) {
    if (t.owner !== playerId) continue;
    if (Math.hypot(t.x - x, t.y - y) <= 5.15) return true;
  }
  return false;
}

export function stepHero(state, heroId, x, y) {
  const hero = heroById(state, heroId);
  if (!hero || hero.lost) return { ok: false, error: "Нет героини." };
  if (!passable(state, hero, x, y)) return { ok: false, error: "Туда не пройти." };
  const cost = tileCost(state, hero, x, y);
  if (hero.movement < cost) return { ok: false, error: "Не хватает хода." };
  const h = heroAt(state, x, y);
  if (h && h.id !== hero.id) return { ok: false, error: "Клетка занята." };
  const obj = objectAt(state, x, y);
  if (obj && obj.type === "monster") return { ok: false, error: "Отряд загораживает клетку." };
  hero.movement -= cost;
  hero.x = x; hero.y = y;
  reveal(state, hero.player, x, y, effective(hero).sight);
  if (obj && obj.type === "gate") {
    obj.removed = true;
    return { ok: true, message: "Врата " + colorName(obj.color) + " открыты." };
  }
  if (obj) return enterObject(state, hero, obj);
  const town = townAt(state, x, y);
  if (town) {
    if (town.owner === hero.player) return { ok: true, openTown: town.id };
    return { ok: true, siege: town.id };
  }
  return { ok: true };
}

function colorName(c) { return c === "red" ? "алые" : c === "blue" ? "синие" : c; }

export function engage(state, heroId, target, opts = {}) {
  const hero = heroById(state, heroId);
  if (!hero) return { ok: false, error: "Нет героини." };
  if (target.objectId) {
    const obj = objectById(state, target.objectId);
    if (!obj || obj.removed) return { ok: false, error: "Цель исчезла." };
    const dist = Math.max(Math.abs(hero.x - obj.x), Math.abs(hero.y - obj.y));
    if (dist > 1) return { ok: false, error: "Слишком далеко." };
    if (obj.type === "monster") return startMonsterFight(state, hero, obj, opts);
    if (obj.guard) return startGuardFight(state, hero, obj);
  }
  if (target.heroId) {
    const foe = heroById(state, target.heroId);
    if (!foe || foe.lost) return { ok: false, error: "Героиня скрылась." };
    const dist = Math.max(Math.abs(hero.x - foe.x), Math.abs(hero.y - foe.y));
    if (dist > 1 && !(hero.x === foe.x && hero.y === foe.y)) return { ok: false, error: "Слишком далеко." };
    return startHeroFight(state, hero, foe);
  }
  if (target.townId) {
    const town = townById(state, target.townId);
    if (!town) return { ok: false };
    return startSiege(state, hero, town);
  }
  return { ok: false, error: "Некого атаковать." };
}

function startMonsterFight(state, hero, obj, opts = {}) {
  if (!opts.force) {
    const dip = tryDiplomacy(state, hero, obj);
    if (dip) return dip;
  }
  openBattle(state, hero, {
    kind: "monster",
    objectId: obj.id,
    defender: packSide(null, [{ id: obj.guard.cr, count: obj.guard.count }], false),
  });
  return { ok: true, battle: true };
}
function startGuardFight(state, hero, obj) {
  openBattle(state, hero, {
    kind: "guard",
    objectId: obj.id,
    defender: packSide(null, [{ id: obj.guard.cr, count: obj.guard.count }], false),
  });
  return { ok: true, battle: true };
}
function startHeroFight(state, hero, foe) {
  openBattle(state, hero, {
    kind: "hero",
    foeHeroId: foe.id,
    defender: packSide(foe, foe.army, playerById(state, foe.player).control === "human"),
  });
  return { ok: true, battle: true };
}
function startSiege(state, hero, town) {
  const visitor = heroAt(state, town.x, town.y);
  let army;
  let defHero = null;
  if (visitor && visitor.player === town.owner) {
    defHero = visitor;
    army = visitor.army.map((sl) => (sl ? { ...sl } : null));
  } else {
    army = town.garrison.map((sl) => (sl ? { ...sl, fromGarrison: true } : null));
  }
  const fort = town.buildings.castle ? 3 : town.buildings.citadel ? 2 : town.buildings.fort ? 1 : 0;
  openBattle(state, hero, {
    kind: "siege",
    townId: town.id,
    foeHeroId: defHero ? defHero.id : null,
    siege: fort > 0,
    fortLevel: fort,
    defender: packSide(defHero, army, defHero ? playerById(state, defHero.player).control === "human" : false),
  });
  return { ok: true, battle: true };
}

function packSide(hero, army, human) {
  const stacks = [];
  (army || []).forEach((sl, i) => {
    if (!sl) return;
    stacks.push({ cr: sl.id, count: sl.count, slot: i, machine: false, fromGarrison: !!sl.fromGarrison });
  });
  if (!hero) {
    return { hero: null, stacks, human: !!human, ai: !human, ammo: false, tent: false, ballista: false, tactics: 0 };
  }
  const e = effective(hero);
  return {
    hero: snapHero(hero, e),
    stacks,
    human: !!human,
    ai: !human,
    ammo: !!hero.machines.ammo,
    tent: !!hero.machines.tent,
    ballista: !!hero.machines.ballista,
    tactics: skillLv(hero, "tactics"),
  };
}
function snapHero(hero, e) {
  return {
    id: hero.id,
    name: hero.name,
    attack: e.attack,
    defense: e.defense,
    power: e.power,
    knowledge: e.knowledge,
    morale: e.morale,
    luck: e.luck,
    mana: hero.mana,
    skills: { ...hero.skills },
    spells: hero.spells.slice(),
    offense: e.offense,
    armorer: e.armorer,
    archery: e.archery,
    sorcery: e.sorcery,
    resist: e.resist,
    faction: hero.faction,
  };
}

function openBattle(state, attacker, extra) {
  const e = effective(attacker);
  const human = playerById(state, attacker.player).control === "human";
  const battle = createBattle({
    seed: state.rngState ^ (state.day * 997),
    siege: extra.siege,
    fortLevel: extra.fortLevel || 0,
    terrain: terrainName(state, attacker.x, attacker.y),
    kind: extra.kind,
    attacker: {
      hero: snapHero(attacker, e),
      stacks: attacker.army.map((sl, i) => (sl ? { cr: sl.id, count: sl.count, slot: i } : null)).filter(Boolean),
      human,
      ai: !human,
      ammo: attacker.machines.ammo,
      tent: attacker.machines.tent,
      ballista: attacker.machines.ballista,
      tactics: skillLv(attacker, "tactics"),
    },
    defender: extra.defender,
  });
  state.battle = battle;
  state.battleMeta = {
    attackerId: attacker.id,
    foeHeroId: extra.foeHeroId || null,
    objectId: extra.objectId || null,
    townId: extra.townId || null,
    kind: extra.kind,
  };
  state.rngState = (state.rngState + 17) >>> 0;
}

function terrainName(state, x, y) {
  const t = state.map.terrain[idx(state, x, y)];
  if (t === T_SNOW) return "snow";
  if (t === T_LAVA) return "lava";
  if (t === T_SWAMP) return "swamp";
  if (t === T_SAND) return "sand";
  if (t === T_FOREST) return "forest";
  return "grass";
}

function tryDiplomacy(state, hero, obj) {
  const guard = obj && obj.guard;
  const lv = skillLv(hero, "diplomacy");
  if (!lv || !guard) return null;
  const chance = [0, 0.25, 0.45, 0.7][lv];
  if (roll(state) > chance) return null;
  const cr = CREATURES[guard.cr];
  const mult = [0, 1, 0.75, 0.5][lv];
  const gold = Math.max(100, Math.round((cr.cost.gold || 50) * guard.count * mult));
  return { ok: true, diplomacy: { objectId: obj.id, cr: guard.cr, count: guard.count, gold, heroId: hero.id } };
}

export function acceptDiplomacy(state, heroId, objectId) {
  const hero = heroById(state, heroId);
  const obj = objectById(state, objectId);
  if (!hero || !obj || obj.type !== "monster") return { ok: false };
  const lv = skillLv(hero, "diplomacy");
  const cr = CREATURES[obj.guard.cr];
  const mult = [0, 1, 0.75, 0.5][lv] || 1;
  const gold = Math.max(100, Math.round((cr.cost.gold || 50) * obj.guard.count * mult));
  const p = playerById(state, hero.player);
  if (p.resources.gold < gold) return { ok: false, error: "Не хватает золота." };
  p.resources.gold -= gold;
  const added = addToArmy(hero.army, obj.guard.cr, obj.guard.count);
  if (!added) return { ok: false, error: "Нет места в армии. Золото возвращено.", refund: (p.resources.gold += gold) };
  obj.removed = true;
  return { ok: true, message: cr.name + " присоединяются." };
}

export function concludeBattle(state) {
  const battle = state.battle;
  const meta = state.battleMeta;
  if (!battle || !battle.result || !meta) return { ok: false };
  const result = battle.result;
  const attacker = heroById(state, meta.attackerId);
  const messages = [];
  // вернуть ману
  if (attacker && battle.heroes.left) attacker.mana = Math.max(0, battle.heroes.left.mana);
  const foe = meta.foeHeroId ? heroById(state, meta.foeHeroId) : null;
  if (foe && battle.heroes.right) foe.mana = Math.max(0, battle.heroes.right.mana);

  writeCasualties(attacker, battle, "left");
  if (foe) writeCasualties(foe, battle, "right");
  if (meta.townId) {
    const town = townById(state, meta.townId);
    writeGarrisonCasualties(town, battle);
  }

  const leftWin = result.winner === "left";
  const rightWin = result.winner === "right";

  if (result.retreat || result.surrender) {
    const fleeingSide = result.side;
    const fleeing = fleeingSide === "left" ? attacker : foe;
    if (result.surrender && fleeing) {
      const cost = surrenderCost(battle, fleeingSide);
      const p = playerById(state, fleeing.player);
      if (p.resources.gold >= cost) {
        p.resources.gold -= cost;
        const winner = fleeingSide === "left" ? foe : attacker;
        if (winner) playerById(state, winner.player).resources.gold += cost;
        messages.push("Сдача: уплачено " + cost + " золота.");
      }
    }
    if (fleeing) exileHero(state, fleeing);
    messages.push(fleeing ? fleeing.name + " отступает, войско рассеяно." : "Отступление.");
  }

  if (leftWin && attacker && !result.retreat) {
    const xp = xpFromBattle(battle, "right");
    grantXp(state, attacker, xp);
    messages.push("Победа. Опыт: " + xp + ".");
    necromancy(attacker, battle, "right", messages);
    eagle(state, attacker, battle, messages);
    if (meta.kind === "monster" || meta.kind === "guard") {
      const obj = objectById(state, meta.objectId);
      if (obj) {
        if (meta.kind === "monster") {
          giveReward(state, attacker, obj.reward || {});
          obj.removed = true;
          messages.push("Добыча собрана.");
        } else {
          obj.guard = null;
          const follow = enterObject(state, attacker, obj);
          if (follow.message) messages.push(follow.message);
          if (follow.dialog) messages.push(follow.dialog);
        }
      }
    }
    if (meta.kind === "hero" && foe && !result.retreat && !result.surrender) {
      takeArtifacts(foe, attacker);
      foe.lost = true;
      foe.army = emptyArmy();
      messages.push(foe.name + " повержена.");
    }
    if (meta.kind === "siege") {
      const town = townById(state, meta.townId);
      if (town) {
        town.owner = attacker.player;
        messages.push(town.name + " переходит под ваше знамя.");
        if (foe && !result.retreat && !result.surrender && !anyAlive(battle, "right")) {
          takeArtifacts(foe, attacker);
          foe.lost = true;
        }
      }
    }
  }

  if (rightWin && attacker && !result.retreat && !result.surrender) {
    if (!anyAlive(battle, "left")) {
      if (foe) {
        grantXp(state, foe, xpFromBattle(battle, "left"));
        takeArtifacts(attacker, foe);
      }
      attacker.lost = true;
      attacker.army = emptyArmy();
      messages.push(attacker.name + " пала в бою.");
    }
  }
  if (rightWin && foe && meta.kind === "hero") {
    necromancy(foe, battle, "left", messages);
  }

  // баллиста
  for (const s of battle.stacks) {
    if (s.cr === "ballista" && s.dead && attacker) attacker.machines.ballista = false;
  }

  state.battle = null;
  state.battleMeta = null;
  eliminateBroken(state);
  const end = checkEnd(state);
  return { ok: true, messages, end, levelUp: attacker && attacker.unspent > 0 ? attacker.id : null };
}

function anyAlive(battle, side) {
  return battle.stacks.some((s) => s.side === side && !s.dead && !s.machine);
}
function writeCasualties(hero, battle, side) {
  if (!hero) return;
  for (const s of battle.stacks) {
    if (s.side !== side || s.machine || s.summoned || s.fromGarrison) continue;
    if (s.slot === undefined || s.slot < 0) continue;
    if (s.dead || s.count <= 0) hero.army[s.slot] = null;
    else hero.army[s.slot] = { id: s.cr, count: s.count };
  }
}
function writeGarrisonCasualties(town, battle) {
  if (!town) return;
  for (const s of battle.stacks) {
    if (!s.fromGarrison || s.machine) continue;
    if (s.slot === undefined || s.slot < 0) continue;
    if (s.dead || s.count <= 0) town.garrison[s.slot] = null;
    else town.garrison[s.slot] = { id: s.cr, count: s.count };
  }
}
function xpFromBattle(battle, victimSide) {
  let xp = 0;
  for (const s of battle.stacks) {
    if (s.side !== victimSide || s.machine || s.summoned) continue;
    const killed = Math.max(0, s.initCount - (s.dead ? 0 : s.count));
    xp += Math.round(aiValue(CREATURES[s.cr]) * killed * 5);
  }
  return Math.max(0, xp);
}
function necromancy(hero, battle, victimSide, messages) {
  const lv = skillLv(hero, "necromancy");
  if (!lv) return;
  let kills = 0;
  for (const s of battle.stacks) {
    if (s.side !== victimSide || s.machine) continue;
    kills += Math.max(0, s.initCount - (s.dead ? 0 : s.count));
  }
  const raised = Math.floor(kills * [0, 0.1, 0.2, 0.3][lv]);
  if (raised <= 0) return;
  if (addToArmy(hero.army, "o_spark", raised)) messages.push("Чернильный призыв: +" + raised + " искр.");
}
function eagle(state, hero, battle, messages) {
  const lv = skillLv(hero, "eagle");
  if (!lv || !battle.casted) return;
  const chance = [0, 0.4, 0.7, 1][lv];
  for (const id of battle.casted) {
    if (hero.spells.includes(id)) continue;
    const sp = SPELLS[id];
    if (!sp) continue;
    if (sp.level > wisdomCap(skillLv(hero, "wisdom"))) continue;
    if (!hero.book) continue;
    if (roll(state) <= chance) {
      hero.spells.push(id);
      messages.push("Орлиный глаз: выучено «" + sp.name + "».");
      return;
    }
  }
}
function giveReward(state, hero, reward) {
  const p = playerById(state, hero.player);
  for (const [k, v] of Object.entries(reward || {})) {
    if (k === "artifact") giveArtifact(hero, v);
    else p.resources[k] = (p.resources[k] || 0) + v;
  }
}
function exileHero(state, hero) {
  hero.army = emptyArmy();
  hero.movement = 0;
  const towns = state.towns.filter((t) => t.owner === hero.player);
  if (!towns.length) { hero.lost = true; return; }
  towns.sort((a, b) => Math.hypot(a.x - hero.x, a.y - hero.y) - Math.hypot(b.x - hero.x, b.y - hero.y));
  const spot = findLand(state, towns[0].x, towns[0].y);
  hero.x = spot.x; hero.y = spot.y;
}
function takeArtifacts(from, to) {
  if (!from || !to) return;
  for (const slot of Object.keys(from.artifacts)) {
    if (from.artifacts[slot]) {
      to.backpack.push(from.artifacts[slot]);
      from.artifacts[slot] = null;
    }
  }
  to.backpack.push(...from.backpack);
  from.backpack = [];
}

export function grantXp(state, hero, amount) {
  if (!hero || hero.lost || amount <= 0) return;
  const mult = 1 + [0, 0.1, 0.2, 0.3][skillLv(hero, "learning")];
  hero.xp += Math.round(amount * mult);
  while (hero.level < 36 && hero.xp >= xpForLevel(hero.level + 1)) {
    hero.level += 1;
    const stat = rollPrimary(state, hero);
    hero[stat] += 1;
    hero.unspent = (hero.unspent || 0) + 1;
  }
  if (hero.unspent > 0 && !hero.offer) hero.offer = makeOffer(state, hero);
}
function rollPrimary(state, hero) {
  const probs = CLASSES[hero.classId].probs;
  const bag = [];
  for (const k of ["attack", "defense", "power", "knowledge"]) for (let i = 0; i < probs[k]; i++) bag.push(k);
  return choice(state, bag);
}
function makeOffer(state, hero) {
  const all = Object.keys(SKILLS);
  const learnable = all.filter((id) => {
    const lv = skillLv(hero, id);
    if (lv >= 3) return false;
    if (lv === 0 && Object.keys(hero.skills).length >= 8) return false;
    return true;
  });
  if (!learnable.length) return { kind: "stat" };
  const prefer = new Set(CLASSES[hero.classId].prefer || []);
  const weighted = [];
  for (const id of learnable) {
    let w = 2;
    if (prefer.has(id)) w += 5;
    if (skillLv(hero, id) > 0) w += 4;
    for (let i = 0; i < w; i++) weighted.push(id);
  }
  const a = choice(state, weighted);
  let b = a;
  let guard = 0;
  while (b === a && guard++ < 20) b = choice(state, weighted);
  if (b === a) b = learnable.find((id) => id !== a) || a;
  return { kind: "skill", options: b === a ? [a] : [a, b] };
}
export function chooseLevel(state, heroId, choiceId) {
  const hero = heroById(state, heroId);
  if (!hero || !hero.unspent) return { ok: false };
  if (!hero.offer) hero.offer = makeOffer(state, hero);
  if (hero.offer.kind === "stat") {
    if (!["attack", "defense", "power", "knowledge"].includes(choiceId)) return { ok: false };
    hero[choiceId] += 1;
  } else {
    if (!hero.offer.options.includes(choiceId)) return { ok: false };
    hero.skills[choiceId] = skillLv(hero, choiceId) + 1;
  }
  hero.unspent -= 1;
  hero.offer = null;
  hero.movement = Math.max(hero.movement, 0);
  const mm = maxMove(hero);
  if (hero.movement > mm) hero.movement = mm;
  if (hero.mana > maxMana(hero)) hero.mana = maxMana(hero);
  if (hero.unspent > 0) hero.offer = makeOffer(state, hero);
  return { ok: true, more: hero.unspent > 0 };
}

function addToArmy(army, id, count) {
  for (const sl of army) if (sl && sl.id === id) { sl.count += count; return true; }
  for (let i = 0; i < army.length; i++) if (!army[i]) { army[i] = { id, count }; return true; }
  return false;
}

function enterObject(state, hero, obj) {
  if (obj.guard) {
    return startGuardFight(state, hero, obj);
  }
  const p = playerById(state, hero.player);
  switch (obj.type) {
    case "resource": {
      p.resources[obj.res] = (p.resources[obj.res] || 0) + obj.amount;
      obj.removed = true;
      const nm = obj.res === "gold" ? obj.amount + " золота" : obj.amount + " " + obj.res;
      return { ok: true, message: "Найдено: " + nm + "." };
    }
    case "mine": {
      obj.owner = hero.player;
      return { ok: true, message: "Копь занята (" + obj.res + ")." };
    }
    case "artifact": {
      giveArtifact(hero, obj.artifact);
      obj.removed = true;
      return { ok: true, message: "Артефакт: " + ARTIFACTS[obj.artifact].name + "." };
    }
    case "shrine": {
      if (!hero.book) return { ok: true, message: "Святилище молчит без книги заклинаний." };
      const sp = SPELLS[obj.spell];
      if (hero.spells.includes(obj.spell)) return { ok: true, message: "Вы уже знаете «" + sp.name + "»." };
      if (sp.level > wisdomCap(skillLv(hero, "wisdom"))) return { ok: true, message: "Слова слишком сложны. Нужна мудрость." };
      hero.spells.push(obj.spell);
      obj.removed = true;
      return { ok: true, message: "Изучено заклинание «" + sp.name + "»." };
    }
    case "chest": {
      const gold = ri(state, 800, 2500);
      p.resources.gold += gold;
      if (roll(state) < 0.35) {
        const res = choice(state, ["lacquer", "resin", "pigment", "amber", "crystal", "pearl"]);
        const n = ri(state, 2, 5);
        p.resources[res] += n;
      }
      obj.removed = true;
      return { ok: true, message: "В сундуке " + gold + " золота." };
    }
    case "dwelling": {
      return { ok: true, openDwelling: obj.id };
    }
    case "witch": {
      if (obj.used) return { ok: true, message: "Хижина пуста." };
      const offer = makeOffer(state, { ...hero, unspent: 1, skills: hero.skills });
      obj.used = true;
      if (offer.kind !== "skill") return { ok: true, message: "Ведьме нечему учить." };
      const id = offer.options[0];
      hero.skills[id] = Math.min(3, skillLv(hero, id) + 1);
      return { ok: true, message: "Ведьма учит: " + SKILLS[id].name + "." };
    }
    case "stone": {
      if (obj.used) return { ok: true, message: "Камень молчит." };
      obj.used = true;
      const stat = choice(state, ["attack", "defense", "power", "knowledge"]);
      hero[stat] += 1;
      const names = { attack: "атака", defense: "защита", power: "сила магии", knowledge: "знание" };
      return { ok: true, message: "Камень знания: +" + names[stat] + "." };
    }
    case "arena":
      return { ok: true, choose: { kind: "arena", objectId: obj.id, title: "Арена", text: "Что тренировать?", options: [["attack", "+2 атаки"], ["defense", "+2 защиты"]] } };
    case "university":
      return { ok: true, choose: { kind: "university", objectId: obj.id } };
    case "fountain": {
      hero.bonusMove = Math.max(hero.bonusMove || 0, 400);
      hero.movement += 400;
      return { ok: true, message: "Фонтан: +400 хода сегодня." };
    }
    case "stables": {
      const week = calendar(state.day).week;
      if (hero.stablesWeek === week) return { ok: true, message: "Конюшня уже отдала лошадей на этой неделе." };
      hero.stablesWeek = week;
      hero.bonusMove = (hero.bonusMove || 0) + 400;
      hero.movement += 400;
      return { ok: true, message: "Конюшня: +400 хода до конца недели." };
    }
    case "mill":
    case "garden":
      obj.owner = hero.player;
      return { ok: true, message: obj.type === "mill" ? "Мельница ваша и смелет ресурс к понедельнику." : "Сад ваш и зацветёт к понедельнику." };
    case "tower": {
      reveal(state, hero.player, obj.x, obj.y, 14);
      return { ok: true, message: "С башни видно далеко." };
    }
    case "campfire": {
      const n = ri(state, 1, 3);
      p.resources.lacquer += n; p.resources.resin += n;
      obj.removed = true;
      return { ok: true, message: "У костра: +" + n + " лака и смолы." };
    }
    case "scholar": {
      if (!hero.book) return { ok: true, message: "Учёной нужна книга заклинаний." };
      const known = new Set(hero.spells);
      const opts = Object.values(SPELLS).filter((s) => s.level <= wisdomCap(skillLv(hero, "wisdom")) && !known.has(s.id) && s.level <= 3);
      if (!opts.length) return { ok: true, message: "Учёная молчит." };
      const sp = choice(state, opts);
      hero.spells.push(sp.id);
      obj.removed = true;
      return { ok: true, message: "Учёная учит «" + sp.name + "»." };
    }
    case "temple":
      return { ok: true, message: "Храм шепчет молитву. Мораль в следующем бою будет щедрее, если войско едино." };
    case "tree": {
      if (hero.level < 8) return { ok: true, message: "Древо ждёт восьмого уровня." };
      if (obj.used) return { ok: true, message: "Древо уже отдало силу." };
      obj.used = true;
      hero.attack++; hero.defense++; hero.power++; hero.knowledge++;
      return { ok: true, message: "Древо познания: +1 ко всем первичным навыкам." };
    }
    case "monolith": {
      const pair = objectById(state, obj.pair);
      if (!pair) return { ok: true };
      const spot = findLand(state, pair.x, pair.y);
      hero.x = spot.x; hero.y = spot.y;
      reveal(state, hero.player, hero.x, hero.y, effective(hero).sight);
      return { ok: true, message: "Монолит переносит вас к паре." };
    }
    case "key": {
      p.keys[obj.color] = true;
      obj.removed = true;
      return { ok: true, message: "Ключ от " + colorName(obj.color) + " врат." };
    }
    case "grail": {
      giveArtifact(hero, "crown_scarlet");
      hero.backpack = hero.backpack.filter((id) => id !== "grail");
      hero._hasGrail = true;
      obj.removed = true;
      return { ok: true, message: "Корона Блеска ваша. Отнесите её в город." };
    }
    case "prison": {
      const fac = hero.faction;
      const free = ROSTER.find((r) => CLASSES[r.classId].faction === fac && !state.heroes.some((h) => h.rosterId === r.id && !h.lost));
      obj.removed = true;
      if (!free) return { ok: true, message: "Темница пуста." };
      const spot = findLand(state, obj.x, obj.y);
      const nh = makeHero(state, free.id, hero.player, spot.x, spot.y);
      state.heroes.push(nh);
      return { ok: true, message: "Освобождена " + nh.name + "." };
    }
    case "sign":
      return { ok: true, message: obj.text };
    default:
      return { ok: true };
  }
}

export function resolveChoice(state, heroId, objectId, option) {
  const hero = heroById(state, heroId);
  const obj = objectById(state, objectId);
  if (!hero || !obj || obj.used) return { ok: false };
  if (obj.type === "arena") {
    if (option !== "attack" && option !== "defense") return { ok: false };
    hero[option] += 2;
    obj.used = true;
    return { ok: true, message: option === "attack" ? "+2 атаки." : "+2 защиты." };
  }
  if (obj.type === "university") {
    if (!SKILLS[option]) return { ok: false };
    if (skillLv(hero, option) >= 3) return { ok: false, error: "Навык уже на пределе." };
    if (!skillLv(hero, option) && Object.keys(hero.skills).length >= 8) return { ok: false, error: "Нет свободного слота навыка." };
    hero.skills[option] = skillLv(hero, option) + 1;
    obj.used = true;
    return { ok: true, message: "Университет: " + SKILLS[option].name + "." };
  }
  return { ok: false };
}

export function recruitDwelling(state, heroId, objectId, count) {
  const hero = heroById(state, heroId);
  const obj = objectById(state, objectId);
  if (!hero || !obj || obj.type !== "dwelling") return { ok: false };
  if (Math.max(Math.abs(hero.x - obj.x), Math.abs(hero.y - obj.y)) > 0) return { ok: false, error: "Нужно стоять на жилище." };
  count = Math.max(0, count | 0);
  if (count > obj.pool) return { ok: false, error: "Столько нет." };
  const cr = CREATURES[obj.creature];
  const cost = {};
  for (const [k, v] of Object.entries(cr.cost)) cost[k] = v * count;
  const p = playerById(state, hero.player);
  if (!canAfford(p.resources, cost)) return { ok: false, error: "Не хватает ресурсов." };
  if (!addToArmy(hero.army, obj.creature, count)) return { ok: false, error: "Нет места в армии." };
  pay(p.resources, cost);
  obj.pool -= count;
  return { ok: true, message: "Нанято: " + cr.name + " ×" + count + "." };
}

function giveArtifact(hero, id) {
  if (!ARTIFACTS[id] && id !== "grail") {
    hero._hasGrail = true;
    return;
  }
  if (id === "crown_scarlet" && hero._wantGrail) hero._hasGrail = true;
  hero.backpack.push(id);
  if (id === "crown_scarlet") hero._hasGrail = true;
}

export function equipArtifact(hero, backpackIndex, slot) {
  const id = hero.backpack[backpackIndex];
  if (!id || !ARTIFACTS[id]) return { ok: false };
  const a = ARTIFACTS[id];
  let use = slot;
  if (!use) {
    if (a.slot === "ring") use = hero.artifacts.ring1 ? (hero.artifacts.ring2 ? "ring1" : "ring2") : "ring1";
    else if (a.slot === "misc") {
      use = ["misc1", "misc2", "misc3", "misc4"].find((s) => !hero.artifacts[s]) || "misc1";
    } else use = a.slot;
  }
  if (a.slot === "ring" && !use.startsWith("ring")) return { ok: false, error: "Это кольцо." };
  if (a.slot === "misc" && !use.startsWith("misc")) return { ok: false, error: "Это мелочь." };
  if (a.slot !== "ring" && a.slot !== "misc" && use !== a.slot) return { ok: false, error: "Не тот слот." };
  const prev = hero.artifacts[use];
  hero.artifacts[use] = id;
  hero.backpack.splice(backpackIndex, 1);
  if (prev) hero.backpack.push(prev);
  return { ok: true };
}
export function unequipArtifact(hero, slot) {
  if (!hero.artifacts[slot]) return { ok: false };
  hero.backpack.push(hero.artifacts[slot]);
  hero.artifacts[slot] = null;
  return { ok: true };
}

export function moveArmy(army, from, to) {
  if (from === to || !army[from]) return;
  if (!army[to]) { army[to] = army[from]; army[from] = null; return; }
  if (army[to].id === army[from].id) { army[to].count += army[from].count; army[from] = null; return; }
  const tmp = army[to]; army[to] = army[from]; army[from] = tmp;
}
export function splitArmy(army, index, count) {
  const sl = army[index];
  if (!sl || count <= 0 || count >= sl.count) return { ok: false, error: "Нечего делить." };
  const empty = army.findIndex((s) => !s);
  if (empty < 0) return { ok: false, error: "Нет свободного слота." };
  sl.count -= count;
  army[empty] = { id: sl.id, count };
  return { ok: true };
}
export function transferArmy(fromArmy, fi, toArmy, ti) {
  if (!fromArmy[fi]) return { ok: false };
  if (!toArmy[ti]) { toArmy[ti] = fromArmy[fi]; fromArmy[fi] = null; return { ok: true }; }
  if (toArmy[ti].id === fromArmy[fi].id) { toArmy[ti].count += fromArmy[fi].count; fromArmy[fi] = null; return { ok: true }; }
  const tmp = toArmy[ti]; toArmy[ti] = fromArmy[fi]; fromArmy[fi] = tmp;
  return { ok: true };
}

export function availableBuildings(state, town) {
  const list = [];
  const ids = ["townHall", "cityHall", "capitol", "fort", "citadel", "castle", "tavern", "market", "silo", "blacksmith", "mage1", "mage2", "mage3", "mage4", "mage5", "dw1", "dw2", "dw3", "dw4", "dw5", "dw6", "dw7", "up1", "up2", "up3", "up4", "up5", "up6", "up7", "horde", "special", "grail"];
  for (const id of ids) {
    if (town.buildings[id]) continue;
    const def = buildingDef(town.faction, id);
    if (!def) continue;
    if (def.needsGrail && !townHasGrail(state, town)) continue;
    if ((def.req || []).some((r) => !town.buildings[r])) continue;
    list.push(def);
  }
  return list;
}
function townHasGrail(state, town) {
  if (town.grail) return true;
  const visitor = state.heroes.find((h) => !h.lost && h.x === town.x && h.y === town.y && h.player === town.owner);
  if (!visitor) return false;
  return !!(visitor._hasGrail || visitor.backpack.includes("crown_scarlet") || Object.values(visitor.artifacts).includes("crown_scarlet"));
}
export function buildStructure(state, townId, buildingId, free = false) {
  const town = townById(state, townId);
  if (!town) return { ok: false, error: "Нет города." };
  if (town.builtToday && !free) return { ok: false, error: "Сегодня уже строили." };
  const def = buildingDef(town.faction, buildingId);
  if (!def) return { ok: false };
  if (town.buildings[buildingId]) return { ok: false, error: "Уже стоит." };
  if ((def.req || []).some((r) => !town.buildings[r])) return { ok: false, error: "Нет требования." };
  if (def.needsGrail && !townHasGrail(state, town)) return { ok: false, error: "Нужна Корона Блеска в городе." };
  const p = playerById(state, town.owner);
  if (!free && !canAfford(p.resources, def.cost)) return { ok: false, error: "Не хватает ресурсов." };
  if (!free) pay(p.resources, def.cost);
  if (def.needsGrail) {
    town.grail = true;
    const visitor = state.heroes.find((h) => !h.lost && h.x === town.x && h.y === town.y);
    if (visitor) {
      visitor._hasGrail = false;
      visitor.backpack = visitor.backpack.filter((id) => id !== "crown_scarlet");
      for (const s of Object.keys(visitor.artifacts)) if (visitor.artifacts[s] === "crown_scarlet") visitor.artifacts[s] = null;
    }
  }
  town.buildings[buildingId] = true;
  if (!free) town.builtToday = true;
  if (buildingId.startsWith("mage")) learnGuildSpells(state, town);
  if (buildingId.startsWith("dw") || buildingId === "horde" || buildingId === "special" || buildingId === "citadel" || buildingId === "castle") {
    /* прирост придёт в понедельник; сразу даём половину, если жилище только что открыто */
    if (buildingId.startsWith("dw")) {
      const tier = Number(buildingId.slice(2));
      const base = tiersOf(town.faction)[tier - 1];
      if (base) town.pool[base.id] = (town.pool[base.id] || 0) + base.growth;
    }
  }
  return { ok: true, message: "Построено: " + def.name + "." };
}

export function recruit(state, townId, creatureId, count, dest) {
  const town = townById(state, townId);
  const cr = CREATURES[creatureId];
  if (!town || !cr) return { ok: false };
  count = count | 0;
  if (count <= 0) return { ok: false, error: "Укажите число." };
  const base = baseCreatureId(creatureId);
  const baseCr = CREATURES[base];
  const tier = baseCr.tier;
  if (!town.buildings["dw" + tier]) return { ok: false, error: "Нет жилища." };
  if (cr.upgradeOf && !town.buildings["up" + tier]) return { ok: false, error: "Нет улучшения." };
  if ((town.pool[base] || 0) < count) return { ok: false, error: "В жилище меньше существ." };
  const p = playerById(state, town.owner);
  const cost = {};
  for (const [k, v] of Object.entries(cr.cost)) cost[k] = v * count;
  if (!canAfford(p.resources, cost)) return { ok: false, error: "Не хватает ресурсов." };
  const visitor = state.heroes.find((h) => !h.lost && h.player === town.owner && h.x === town.x && h.y === town.y);
  const army = dest === "garrison" || !visitor ? town.garrison : visitor.army;
  if (!addToArmy(army, creatureId, count)) return { ok: false, error: "Нет места в отряде." };
  pay(p.resources, cost);
  town.pool[base] -= count;
  return { ok: true, message: "Нанято " + count + " × " + cr.name + "." };
}

export function upgradeCreatures(state, townId, which, slot) {
  const town = townById(state, townId);
  const army = which === "garrison" ? town.garrison : (state.heroes.find((h) => h.id === which)?.army);
  if (!army || !army[slot]) return { ok: false };
  const cur = CREATURES[army[slot].id];
  if (!cur.levelUpTo) return { ok: false, error: "Улучшать некуда." };
  if (!town.buildings["up" + cur.tier]) return { ok: false, error: "Нет здания улучшения." };
  const next = CREATURES[cur.levelUpTo];
  const cost = {};
  for (const k of new Set([...Object.keys(cur.cost), ...Object.keys(next.cost)])) {
    const d = (next.cost[k] || 0) - (cur.cost[k] || 0);
    if (d > 0) cost[k] = d * army[slot].count;
  }
  const p = playerById(state, town.owner);
  if (!canAfford(p.resources, cost)) return { ok: false, error: "Не хватает ресурсов." };
  pay(p.resources, cost);
  army[slot].id = next.id;
  return { ok: true, message: "Улучшено: " + next.name + "." };
}

export function buyMachine(state, townId, heroId, machineId) {
  const town = townById(state, townId);
  const hero = heroById(state, heroId);
  if (!town || !town.buildings.blacksmith) return { ok: false, error: "Нужна оружейная." };
  if (!hero || hero.player !== town.owner) return { ok: false };
  const m = MACHINES[machineId];
  if (!m) return { ok: false };
  if (hero.machines[machineId]) return { ok: false, error: "Уже есть." };
  const p = playerById(state, hero.player);
  if (!canAfford(p.resources, m.cost)) return { ok: false, error: "Не хватает золота." };
  pay(p.resources, m.cost);
  hero.machines[machineId] = true;
  return { ok: true, message: m.name + " куплена." };
}

export function learnTownSpell(state, townId, heroId, spellId) {
  const town = townById(state, townId);
  const hero = heroById(state, heroId);
  if (!town || !hero) return { ok: false };
  if (!town.spells.includes(spellId)) return { ok: false, error: "В гильдии нет такого заклинания." };
  if (!hero.book) return { ok: false, error: "Сначала купите книгу." };
  const sp = SPELLS[spellId];
  if (sp.level > wisdomCap(skillLv(hero, "wisdom"))) return { ok: false, error: "Не хватает мудрости." };
  if (hero.spells.includes(spellId)) return { ok: false, error: "Уже известно." };
  hero.spells.push(spellId);
  return { ok: true, message: "Выучено «" + sp.name + "»." };
}
export function buySpellbook(state, townId, heroId) {
  const town = townById(state, townId);
  const hero = heroById(state, heroId);
  if (!town.buildings.mage1) return { ok: false, error: "Нужна гильдия магов." };
  if (hero.book) return { ok: false, error: "Книга уже есть." };
  const p = playerById(state, hero.player);
  if (p.resources.gold < 500) return { ok: false, error: "Нужно 500 золота." };
  p.resources.gold -= 500;
  hero.book = true;
  return { ok: true, message: "Книга заклинаний куплена." };
}

export function hireHero(state, townId) {
  const town = townById(state, townId);
  if (!town.buildings.tavern) return { ok: false, error: "Нужен салон." };
  const p = playerById(state, town.owner);
  if (p.resources.gold < 2500) return { ok: false, error: "Найм стоит 2500 золота." };
  const roster = ROSTER.filter((r) => CLASSES[r.classId].faction === town.faction && !state.heroes.some((h) => h.rosterId === r.id && !h.lost));
  if (!roster.length) return { ok: false, error: "В салоне пусто." };
  const r = choice(state, roster);
  const spot = findLand(state, town.x, town.y);
  if (heroAt(state, spot.x, spot.y)) return { ok: false, error: "У ворот нет места." };
  p.resources.gold -= 2500;
  const hero = makeHero(state, r.id, town.owner, spot.x, spot.y);
  state.heroes.push(hero);
  reveal(state, town.owner, hero.x, hero.y, effective(hero).sight);
  return { ok: true, message: "Нанята " + hero.name + ".", heroId: hero.id };
}

export function trade(state, playerId, giveRes, getRes, qty) {
  const p = playerById(state, playerId);
  const owns = state.towns.some((t) => t.owner === playerId && t.buildings.market);
  if (!owns) return { ok: false, error: "Нужен рынок." };
  qty = qty | 0;
  if (qty <= 0) return { ok: false };
  if (giveRes === "gold") {
    const rate = TRADE[getRes];
    if (!rate) return { ok: false };
    const cost = rate.buy * qty;
    if (p.resources.gold < cost) return { ok: false, error: "Мало золота." };
    p.resources.gold -= cost;
    p.resources[getRes] += qty;
    return { ok: true };
  }
  if (getRes === "gold") {
    const rate = TRADE[giveRes];
    if (!rate) return { ok: false };
    if ((p.resources[giveRes] || 0) < qty) return { ok: false, error: "Мало ресурса." };
    p.resources[giveRes] -= qty;
    p.resources.gold += rate.sell * qty;
    return { ok: true };
  }
  return { ok: false, error: "Меняйте ресурс на золото или наоборот." };
}

export function castAdventure(state, heroId, spellId, target) {
  const hero = heroById(state, heroId);
  const sp = SPELLS[spellId];
  if (!hero || !sp || !sp.adventure) return { ok: false, error: "Не то заклинание." };
  if (!hero.spells.includes(spellId)) return { ok: false, error: "Нет в книге." };
  if (sp.level > wisdomCap(skillLv(hero, "wisdom"))) return { ok: false, error: "Не хватает мудрости." };
  const e = effective(hero);
  const cost = Math.max(1, sp.cost - Math.max(e && 0, skillLv(hero, sp.school === "all" ? "air" : sp.school)));
  if (hero.mana < cost) return { ok: false, error: "Не хватает маны." };
  if (sp.kind === "townPortal") {
    const towns = state.towns.filter((t) => t.owner === hero.player);
    if (!towns.length) return { ok: false, error: "Нет своих городов." };
    let town = towns[0];
    if (target && target.townId) town = towns.find((t) => t.id === target.townId) || town;
    if (towns.length > 1 && !(target && target.townId)) return { ok: false, needTown: towns.map((t) => ({ id: t.id, name: t.name })) };
    const spot = findLand(state, town.x, town.y);
    hero.mana -= cost;
    hero.x = spot.x; hero.y = spot.y;
    reveal(state, hero.player, hero.x, hero.y, effective(hero).sight);
    return { ok: true, message: "Врата ведут в " + town.name + "." };
  }
  if (sp.kind === "reveal") {
    hero.mana -= cost;
    reveal(state, hero.player, hero.x, hero.y, 10 + e.power);
    return { ok: true, message: "Ветер открывает окрестности." };
  }
  if (sp.kind === "fly") {
    hero.mana -= cost;
    hero.fly = true;
    return { ok: true, message: "До заката вы летите." };
  }
  if (sp.kind === "water") {
    hero.mana -= cost;
    hero.water = true;
    return { ok: true, message: "Вода держит шаг до конца дня." };
  }
  if (sp.kind === "dd") {
    if (!target || !inMap(state, target.x, target.y)) return { ok: false, error: "Выберите клетку." };
    if (!passable(state, hero, target.x, target.y)) return { ok: false, error: "Туда нельзя шагнуть." };
    if (occupied(state, target.x, target.y)) return { ok: false, error: "Клетка занята." };
    const range = 12 + Math.floor(e.power / 2);
    if (Math.hypot(hero.x - target.x, hero.y - target.y) > range) return { ok: false, error: "Слишком далеко." };
    hero.mana -= cost;
    hero.movement = Math.max(0, hero.movement - 300);
    hero.x = target.x; hero.y = target.y;
    reveal(state, hero.player, hero.x, hero.y, effective(hero).sight);
    return { ok: true, message: "Дверь измерений закрылась за спиной." };
  }
  if (sp.kind === "vision") {
    if (!target) return { ok: false, error: "Выберите клетку." };
    hero.mana -= cost;
    const obj = objectAt(state, target.x, target.y);
    reveal(state, hero.player, target.x, target.y, 2);
    if (!obj) return { ok: true, message: "Там пусто." };
    if (obj.guard) return { ok: true, message: "Стража: " + CREATURES[obj.guard.cr].name + " ×" + obj.guard.count + "." };
    return { ok: true, message: "Объект без стражи." };
  }
  return { ok: false };
}

function onNewDay(state) {
  const cal = calendar(state.day);
  if (cal.isWeekStart) {
    for (const t of state.towns) growTown(t, false);
    for (const o of state.objects) if (!o.removed && o.type === "dwelling") o.pool = (o.pool || 0) + (o.growth || 0);
    for (const pl of state.players) {
      if (pl.eliminated) continue;
      for (const o of state.objects) {
        if (o.removed || o.owner !== pl.id) continue;
        if (o.type === "mill") gain(pl.resources, { lacquer: 2, resin: 2 });
        if (o.type === "garden") {
          const res = ["pigment", "amber", "crystal", "pearl"][state.day % 4];
          pl.resources[res] += 2;
        }
      }
    }
  }
  for (const h of state.heroes) {
    if (h.lost) continue;
    if (h.fly || h.water) {
      h.fly = false;
      h.water = false;
      if (!passable(state, h, h.x, h.y)) {
        const s = findLand(state, h.x, h.y);
        h.x = s.x;
        h.y = s.y;
      }
    }
    if (h.stablesWeek && h.stablesWeek !== cal.week) h.bonusMove = Math.max(0, (h.bonusMove || 0) - 400);
  }
}

export function beginTurn(state) {
  const p = state.players[state.current];
  const cal = calendar(state.day);
  for (const h of state.heroes) {
    if (h.lost || h.player !== p.id) continue;
    h.movement = maxMove(h);
    const regen = 1 + [0, 2, 4, 6][skillLv(h, "mysticism")] + modsOf(h).regen;
    let extra = 0;
    for (const t of state.towns) if (t.owner === p.id && t.buildings.special && t.faction === "emerald") extra += 2;
    h.mana = Math.min(maxMana(h), h.mana + regen + extra);
    h._aiStuck = false;
    reveal(state, p.id, h.x, h.y, effective(h).sight);
  }
  let gold = 0;
  const resGain = emptyResources();
  for (const t of state.towns) if (t.owner === p.id) {
    t.builtToday = false;
    gold += townIncome(t);
    if (t.buildings.silo) for (const k of ["lacquer", "resin", "pigment", "amber", "crystal", "pearl"]) resGain[k] += 1;
  }
  for (const h of state.heroes) if (!h.lost && h.player === p.id) gold += [0, 125, 250, 500][skillLv(h, "estates")] + modsOf(h).income;
  for (const o of state.objects) {
    if (o.removed || o.type !== "mine" || o.owner !== p.id) continue;
    if (o.res === "gold") gold += 1000;
    else resGain[o.res] += 1;
  }
  p.resources.gold += gold;
  gain(p.resources, resGain);
  state.log.push({ day: state.day, text: p.name + ": " + cal.dayName + ", неделя " + cal.week + ". Доход " + gold + " золота." });
  return { gold, player: p.id };
}

function townIncome(town) {
  let g = 500;
  if (town.buildings.capitol) g = 4000;
  else if (town.buildings.cityHall) g = 2000;
  else if (town.buildings.townHall) g = 1000;
  if (town.buildings.special && town.faction === "scarlet") g += 500;
  if (town.buildings.grail) g += 5000;
  return g;
}

export function endTurn(state) {
  if (state.winner || state.loss) return { ended: true };
  const n = state.players.length;
  let i = state.current;
  for (let k = 0; k < n; k++) {
    i = (i + 1) % n;
    if (i === 0) {
      state.day += 1;
      onNewDay(state);
    }
    if (!state.players[i].eliminated) { state.current = i; break; }
  }
  const info = beginTurn(state);
  eliminateBroken(state);
  const end = checkEnd(state);
  return { ended: !!end, info, end };
}

function eliminateBroken(state) {
  for (const p of state.players) {
    if (p.eliminated) continue;
    const heroes = state.heroes.some((h) => h.player === p.id && !h.lost);
    const towns = state.towns.some((t) => t.owner === p.id);
    if (!heroes && !towns) {
      p.eliminated = true;
      state.log.push({ day: state.day, text: p.name + " выбывает." });
    }
  }
}
export function checkEnd(state) {
  const alive = state.players.filter((p) => !p.eliminated);
  const human = state.players.find((p) => p.control === "human");
  if (human && human.eliminated) {
    state.loss = true;
    return { loss: true, text: "Ваш двор пал. Знамя можно поднять в новой партии." };
  }
  const v = state.victory || { type: "defeatAll" };
  if (v.type === "defeatAll") {
    if (alive.length === 1 && alive[0].control === "human") {
      state.winner = alive[0].id;
      return { win: true, text: "Все соперницы склонили знамёна. Корона ваша." };
    }
  }
  if (v.type === "captureAll" && human) {
    if (state.towns.every((t) => t.owner === human.id)) {
      state.winner = human.id;
      return { win: true, text: "Все города под одним лаком." };
    }
  }
  if (v.type === "grail" && human) {
    const crowned = state.towns.some((t) => t.owner === human.id && t.grail && t.buildings.grail);
    if (crowned) {
      state.winner = human.id;
      return { win: true, text: "Корона Блеска легла на алтарь. Печать державы зажглась." };
    }
  }
  return null;
}

const BUILD_PRIORITY = ["townHall", "fort", "dw1", "tavern", "dw2", "mage1", "citadel", "dw3", "blacksmith", "cityHall", "dw4", "market", "mage2", "dw5", "castle", "dw6", "special", "horde", "capitol", "mage3", "dw7", "silo", "mage4", "mage5", "up1", "up2", "up3", "up4", "up5", "up6", "up7", "grail"];

export function aiAct(state) {
  const p = state.players[state.current];
  if (!p || p.control !== "ai" || p.eliminated || state.winner || state.loss) return { type: "end" };
  if (state.battle) return { type: "battle" };
  for (const h of state.heroes) if (h.player === p.id && !h.lost && h.unspent) {
    const offer = h.offer || makeOffer(state, h);
    h.offer = offer;
    const choiceId = offer.kind === "stat" ? "attack" : offer.options[0];
    chooseLevel(state, h.id, choiceId);
  }
  for (const town of state.towns) {
    if (town.owner !== p.id) continue;
    if (!town.builtToday) {
      const opts = availableBuildings(state, town).filter((b) => canAfford(p.resources, b.cost));
      opts.sort((a, b) => BUILD_PRIORITY.indexOf(a.id) - BUILD_PRIORITY.indexOf(b.id));
      if (opts.length && (p.ai !== "easy" || roll(state) < 0.85)) {
        return { type: "build", townId: town.id, buildingId: opts[0].id };
      }
    }
    const visitor = state.heroes.find((h) => !h.lost && h.player === p.id && h.x === town.x && h.y === town.y);
    const tiers = tiersOf(town.faction);
    for (let i = tiers.length - 1; i >= 0; i--) {
      const base = tiers[i];
      const upId = town.buildings["up" + (i + 1)] && base.levelUpTo ? base.levelUpTo : base.id;
      const have = town.pool[base.id] || 0;
      if (!have || !town.buildings["dw" + (i + 1)]) continue;
      const cr = CREATURES[upId];
      const affordOne = canAfford(p.resources, cr.cost);
      if (!affordOne) continue;
      let count = 0;
      const bag = { ...p.resources };
      while (count < have && canAfford(bag, cr.cost)) { pay(bag, cr.cost); count++; }
      if (p.ai === "easy") count = Math.max(1, Math.floor(count * 0.6));
      if (count > 0) return { type: "recruit", townId: town.id, creatureId: upId, count, dest: visitor ? "hero" : "garrison" };
    }
  }
  const heroes = state.heroes.filter((h) => h.player === p.id && !h.lost && h.movement >= 100 && !h._aiStuck);
  for (const hero of heroes) {
    const goal = aiGoal(state, hero);
    if (!goal) { hero._aiStuck = true; continue; }
    if (goal.battle) {
      let tx = goal.x, ty = goal.y;
      if (goal.battle.heroId) {
        const foe = heroById(state, goal.battle.heroId);
        if (foe) { tx = foe.x; ty = foe.y; }
      }
      const dist = Math.max(Math.abs(hero.x - tx), Math.abs(hero.y - ty));
      if (dist <= 1 && !(hero.x === tx && hero.y === ty)) return { type: "engage", heroId: hero.id, target: goal.battle };
    }
    const path = findPath(state, hero, goal.x, goal.y);
    if (!path || !path.tiles.length) { hero._aiStuck = true; continue; }
    return { type: "path", heroId: hero.id, tiles: path.tiles, attack: path.attack || null };
  }
  return { type: "end" };
}

function aiGoal(state, hero) {
  const p = playerById(state, hero.player);
  const aggr = p.ai === "hard" ? 0.95 : p.ai === "easy" ? 1.55 : 1.2;
  let best = null;
  let bestScore = -1e9;
  const consider = (x, y, score, battle) => {
    if (score > bestScore) { bestScore = score; best = { x, y, battle }; }
  };
  for (const o of state.objects) {
    if (o.removed) continue;
    if (!remembered(state, hero.player, o.x, o.y) && Math.hypot(o.x - hero.x, o.y - hero.y) > effective(hero).sight + 6) continue;
    const d = Math.hypot(o.x - hero.x, o.y - hero.y) + 1;
    if (o.type === "resource") consider(o.x, o.y, 220 / d + (o.res === "gold" ? 30 : 10), null);
    else if (o.type === "mine" && o.owner !== hero.player) consider(o.x, o.y, 260 / d, o.guard ? { objectId: o.id } : null);
    else if (o.type === "artifact") consider(o.x, o.y, 240 / d, o.guard ? { objectId: o.id } : null);
    else if (o.type === "chest") consider(o.x, o.y, 180 / d, o.guard ? { objectId: o.id } : null);
    else if (o.type === "monster") {
      const gp = aiValue(CREATURES[o.guard.cr]) * o.guard.count;
      if (powerOf(hero.army) > gp * aggr) consider(o.x, o.y, (140 + Math.min(80, gp)) / d, { objectId: o.id });
    } else if (o.type === "shrine" || o.type === "witch" || o.type === "stone" || o.type === "tower" || o.type === "key" || o.type === "grail") {
      consider(o.x, o.y, 120 / d, o.guard ? { objectId: o.id } : null);
    } else if (o.type === "dwelling" && o.pool > 0) consider(o.x, o.y, 70 / d, null);
  }
  for (const foe of state.heroes) {
    if (foe.lost || foe.player === hero.player) continue;
    if (!remembered(state, hero.player, foe.x, foe.y) && !inVision(state, hero.player, foe.x, foe.y)) continue;
    const d = Math.hypot(foe.x - hero.x, foe.y - hero.y) + 1;
    if (powerOf(hero.army) > powerOf(foe.army) * aggr) consider(foe.x, foe.y, 500 / d, { heroId: foe.id });
  }
  for (const t of state.towns) {
    if (t.owner === hero.player) continue;
    const d = Math.hypot(t.x - hero.x, t.y - hero.y) + 1;
    const gp = powerOf(t.garrison);
    if (powerOf(hero.army) > Math.max(8, gp) * aggr) consider(t.x, t.y, 420 / d, null);
  }
  // разведка: ближайшая невидимая
  if (!best || bestScore < 8) {
    let fx = -1, fy = -1, fd = 1e9;
    const rad = 18;
    for (let y = Math.max(0, hero.y - rad); y < Math.min(state.map.h, hero.y + rad); y++) {
      for (let x = Math.max(0, hero.x - rad); x < Math.min(state.map.w, hero.x + rad); x++) {
        if (playerById(state, hero.player).fog[idx(state, x, y)]) continue;
        if (!passable(state, hero, x, y)) continue;
        const d = Math.hypot(x - hero.x, y - hero.y);
        if (d < fd) { fd = d; fx = x; fy = y; }
      }
    }
    if (fx >= 0) consider(fx, fy, 20, null);
  }
  return best;
}

export function shopApply(state, action) {
  const p = state.players.find((pl) => pl.control === "human" && !pl.eliminated) || state.players[state.current];
  if (!p) return { ok: false, error: "Нет партии." };
  if (action.kind === "res") {
    gain(p.resources, action.res || {});
    return { ok: true, message: "Лавка прислала ресурсы." };
  }
  const hero = heroById(state, action.heroId) || state.heroes.find((h) => h.player === p.id && !h.lost);
  if (action.kind === "troops") {
    if (!hero) return { ok: false, error: "Нет героини." };
    const n = Math.max(1, action.count | 0);
    if (!CREATURES[action.creatureId]) return { ok: false };
    if (!addToArmy(hero.army, action.creatureId, n)) return { ok: false, error: "Нет места в армии." };
    return { ok: true, message: "Отряд влился в армию " + hero.name + "." };
  }
  if (action.kind === "artifact") {
    if (!hero) return { ok: false, error: "Нет героини." };
    if (!ARTIFACTS[action.artifactId]) return { ok: false };
    giveArtifact(hero, action.artifactId);
    return { ok: true, message: ARTIFACTS[action.artifactId].name + " в сумке." };
  }
  if (action.kind === "spell") {
    if (!hero) return { ok: false };
    hero.book = true;
    if (!hero.spells.includes(action.spellId) && SPELLS[action.spellId]) hero.spells.push(action.spellId);
    return { ok: true, message: "Свиток вписан в книгу." };
  }
  if (action.kind === "refresh") {
    if (!hero) return { ok: false };
    hero.movement = maxMove(hero);
    hero.mana = maxMana(hero);
    return { ok: true, message: "Ход и мана восстановлены." };
  }
  if (action.kind === "reveal") {
    p.fog.fill(1);
    return { ok: true, message: "Карта открыта." };
  }
  if (action.kind === "stats") {
    if (!hero) return { ok: false };
    hero.attack++; hero.defense++; hero.power++; hero.knowledge++;
    return { ok: true, message: "+1 ко всем первичным навыкам." };
  }
  if (action.kind === "level") {
    if (!hero) return { ok: false };
    hero.xp = Math.max(hero.xp, xpForLevel(hero.level + 1));
    grantXp(state, hero, 0);
    // grantXp requires amount > 0; force level:
    if (hero.xp >= xpForLevel(hero.level + 1)) {
      hero.level += 1;
      hero[rollPrimary(state, hero)] += 1;
      hero.unspent = (hero.unspent || 0) + 1;
      if (!hero.offer) hero.offer = makeOffer(state, hero);
    }
    return { ok: true, message: hero.name + " достигает нового уровня." };
  }
  if (action.kind === "build") {
    return buildStructure(state, action.townId, action.buildingId, true);
  }
  return { ok: false, error: "Лавка не поняла заказ." };
}

export function battleApi() {
  return { act, prepareTurn, currentStack, attackOptions, chooseAiAction, controllerOf, startFight };
}

export function serialize(state) {
  return JSON.stringify({
    version: state.version,
    scenarioId: state.scenarioId,
    name: state.name,
    briefing: state.briefing,
    victory: state.victory,
    campaign: state.campaign,
    day: state.day,
    rngState: state.rngState,
    nextId: state.nextId,
    current: state.current,
    winner: state.winner,
    loss: state.loss,
    map: {
      w: state.map.w, h: state.map.h,
      terrain: bytesToB64(state.map.terrain),
      flags: bytesToB64(state.map.flags),
    },
    players: state.players.map((p) => ({ ...p, fog: bytesToB64(p.fog) })),
    heroes: state.heroes,
    towns: state.towns,
    objects: state.objects,
    log: state.log.slice(-80),
    battle: state.battle,
    battleMeta: state.battleMeta,
  });
}
export function deserialize(raw) {
  const s = typeof raw === "string" ? JSON.parse(raw) : raw;
  s.map.terrain = b64ToBytes(s.map.terrain);
  s.map.flags = b64ToBytes(s.map.flags);
  for (const p of s.players) p.fog = b64ToBytes(p.fog);
  return s;
}

export function scenarioById(id) {
  return SCENARIOS.find((s) => s.id === id) || null;
}

export function makeSkirmish(opts) {
  const map = opts.map;
  const factions = ["scarlet", "emerald", "onyx"];
  const players = [];
  players.push({
    control: "human",
    faction: opts.faction,
    name: FACTIONS[opts.faction].name,
    ai: "normal",
    hero: ROSTER.find((r) => r.classId === opts.faction + "_" + (opts.role || "might")).id,
  });
  const used = new Set([players[0].hero]);
  for (let i = 1; i < map.players; i++) {
    const fac = opts.opponents && opts.opponents[i - 1] ? opts.opponents[i - 1] : factions[i % 3];
    const hero = ROSTER.find((r) => CLASSES[r.classId].faction === fac && !used.has(r.id)) || ROSTER.find((r) => !used.has(r.id));
    used.add(hero.id);
    players.push({
      control: "ai",
      faction: fac,
      name: FACTIONS[fac].name + (i > 3 ? " II" : ""),
      ai: opts.difficulty || "normal",
      hero: hero.id,
      color: PLAYER_COLORS[i],
    });
  }
  return {
    id: "skirmish-" + map.id + "-" + Date.now(),
    name: "Стычка: " + map.name,
    briefing: map.desc,
    campaign: false,
    map: { w: map.w, h: map.h, seed: (Math.floor(Math.random() * 1e9) ^ Date.now()) >>> 0, forest: 0.4, water: 0.08, rivers: 1, biome: map.biome || "green" },
    players,
    resources: { gold: 18000, lacquer: 24, resin: 16, pigment: 6, amber: 6, crystal: 6, pearl: 4 },
    buildings: ["villageHall", "fort", "dw1", "dw2", "tavern"],
    victory: { type: "defeatAll" },
  };
}

export { calendar, portraitFor, xpForLevel };
