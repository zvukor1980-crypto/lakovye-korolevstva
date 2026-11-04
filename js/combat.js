/** Пошаговый бой на гексах. */

import { CREATURES, SPELLS, wisdomCap } from "./data.js";
import { mulberry32, clamp } from "./util.js";

export const BCOLS = 15;
export const BROWS = 11;

const HEX_DIRS_EVEN = [[1, 0], [1, -1], [0, -1], [-1, 0], [0, 1], [1, 1]];
const HEX_DIRS_ODD = [[1, 0], [0, -1], [-1, -1], [-1, 0], [-1, 1], [0, 1]];

export function hexNeighbors(c, r) {
  // Column-offset layout matches the portrait battlefield in render.js.
  const dirs = (c & 1) ? HEX_DIRS_EVEN : HEX_DIRS_ODD;
  return dirs.map(([dr, dc]) => [c + dc, r + dr]);
}

function toCube(c, r) {
  const x = r - (c - (c & 1)) / 2;
  const z = c;
  const y = -x - z;
  return [x, y, z];
}

export function hexDist(c1, r1, c2, r2) {
  const a = toCube(c1, r1);
  const b = toCube(c2, r2);
  return Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]), Math.abs(a[2] - b[2]));
}

export function inBounds(c, r) {
  return c >= 0 && r >= 0 && c < BCOLS && r < BROWS;
}

function hk(c, r) { return c + "," + r; }

function roll(battle) {
  const rng = mulberry32(battle.rngState >>> 0);
  const v = rng();
  battle.rngState = rng.state >>> 0;
  return v;
}

function rollInt(battle, a, b) {
  return a + Math.floor(roll(battle) * (b - a + 1));
}

function abil(stack, name) {
  const cr = CREATURES[stack.cr];
  if (cr && cr.abilities && cr.abilities.includes(name)) return true;
  if (name === "flying" && (cr?.flying || (stack.buffs && stack.buffs.fly))) return true;
  return false;
}

export function stackByUid(battle, uid) {
  return battle.stacks.find((s) => s.uid === uid) || null;
}

export function unitAt(battle, c, r) {
  return battle.stacks.find((s) => !s.dead && s.c === c && s.r === r) || null;
}

export function speedOf(stack) {
  if (abil(stack, "immobile")) return stack.speedOverride || 0;
  const cr = CREATURES[stack.cr];
  let spd = stack.speedOverride || cr.spd;
  if (stack.buffs.haste) spd += stack.buffs.haste.v;
  if (stack.buffs.slow) spd -= stack.buffs.slow.v;
  if (stack.buffs.prayer) spd += 2;
  return Math.max(1, spd);
}

function retalMax(stack) {
  if (abil(stack, "unlimitedRetal")) return 99;
  let n = 1;
  if (abil(stack, "retal2")) n = 2;
  if (stack.buffs.counter) n += stack.buffs.counter.v;
  return n;
}

export function living(battle, pred) {
  return battle.stacks.filter((s) => !s.dead && (!pred || pred(s)));
}

function creaturesAlive(battle, side) {
  return battle.stacks.some((s) => s.side === side && !s.dead && !s.machine);
}

export function checkWinner(battle) {
  if (battle.result) return battle.result;
  const L = creaturesAlive(battle, "left");
  const R = creaturesAlive(battle, "right");
  if (!L && !R) battle.result = { winner: "draw" };
  else if (!L) battle.result = { winner: "right" };
  else if (!R) battle.result = { winner: "left" };
  return battle.result;
}

function luckChance(n) {
  const a = Math.abs(n);
  if (a <= 0) return 0;
  if (a === 1) return 0.042;
  if (a === 2) return 0.083;
  return 0.125;
}

export function stackMorale(battle, stack) {
  const cr = CREATURES[stack.cr];
  if (!cr || cr.undead || cr.mindless) return 0;
  const hero = battle.heroes[stack.side];
  let m = hero ? hero.morale : 0;
  m += battle.auraMorale[stack.side] || 0;
  m -= battle.auraFear[stack.side] || 0;
  if (stack.buffs.sorrow) m -= 1;
  return clamp(m, -3, 3);
}

export function stackLuck(battle, stack) {
  const cr = CREATURES[stack.cr];
  if (!cr || cr.mindless) return 0;
  const hero = battle.heroes[stack.side];
  let l = hero ? hero.luck : 0;
  l += battle.auraLuck[stack.side] || 0;
  return clamp(l, -3, 3);
}

function recomputeAuras(battle) {
  battle.auraLuck = { left: 0, right: 0 };
  battle.auraMorale = { left: 0, right: 0 };
  battle.auraFear = { left: 0, right: 0 };
  for (const s of battle.stacks) {
    if (s.dead) continue;
    const opp = s.side === "left" ? "right" : "left";
    if (abil(s, "auraLuck")) battle.auraLuck[s.side] += 1;
    if (abil(s, "auraLuck2")) battle.auraLuck[s.side] += 2;
    if (abil(s, "auraMorale")) battle.auraMorale[s.side] += 1;
    if (abil(s, "auraFear")) battle.auraFear[opp] += 1;
  }
}

function poolOf(stack) {
  const cr = CREATURES[stack.cr];
  if (stack.dead || stack.count <= 0) return 0;
  return (stack.count - 1) * cr.hp + stack.topHp;
}

function setPool(stack, pool, capCount) {
  const cr = CREATURES[stack.cr];
  const cap = Math.max(0, capCount) * cr.hp;
  pool = clamp(pool, 0, cap);
  if (pool <= 0) {
    stack.count = 0;
    stack.topHp = 0;
    stack.dead = true;
    return;
  }
  stack.dead = false;
  stack.count = Math.ceil(pool / cr.hp);
  stack.topHp = pool - (stack.count - 1) * cr.hp;
  if (stack.topHp <= 0) stack.topHp = cr.hp;
}

function deal(stack, amount) {
  const before = stack.count;
  const pool = Math.max(0, poolOf(stack) - Math.max(0, Math.floor(amount)));
  setPool(stack, pool, stack.initCount);
  return { dmg: Math.floor(amount), killed: Math.max(0, before - stack.count), died: stack.dead };
}

function heal(stack, amount, revive) {
  const before = stack.dead ? 0 : stack.count;
  const cap = revive ? stack.initCount : Math.max(stack.count, before);
  if (!revive && stack.dead) return { healed: 0, raised: 0 };
  const pool = poolOf(stack) + Math.max(0, Math.floor(amount));
  setPool(stack, pool, cap);
  return { healed: Math.floor(amount), raised: Math.max(0, stack.count - before) };
}

function rollSum(battle, count, min, max) {
  if (count <= 0) return 0;
  if (min > max) [min, max] = [max, min];
  if (min === max) return min * count;
  if (count > 48) {
    const mean = (min + max) / 2;
    const variance = ((max - min + 1) ** 2 - 1) / 12;
    const std = Math.sqrt(Math.max(0.01, variance * count));
    const u = Math.max(1e-6, roll(battle));
    const v = roll(battle);
    const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(Math.PI * 2 * v);
    return clamp(Math.round(mean * count + z * std), count * min, count * max);
  }
  let s = 0;
  for (let i = 0; i < count; i++) s += rollInt(battle, min, max);
  return s;
}

function isDragonish(stack) {
  const id = stack.cr;
  return id.includes("dragon") || id.includes("titan") || id.includes("serpent");
}

function damageOf(battle, atk, def, opts) {
  const ac = CREATURES[atk.cr];
  const dc = CREATURES[def.cr];
  const ha = battle.heroes[atk.side];
  const hd = battle.heroes[def.side];
  let A = ac.atk + (ha ? ha.attack : 0);
  let D = dc.def + (hd ? hd.defense : 0);
  if (atk.buffs.bloodlust) A += atk.buffs.bloodlust.v;
  if (atk.buffs.weakness) A -= atk.buffs.weakness.v;
  if (atk.buffs.prayer) A += 4;
  if (atk.buffs.slayer && isDragonish(def)) A += atk.buffs.slayer.v;
  if (def.buffs.stone) D += def.buffs.stone.v;
  if (def.buffs.prayer) D += 4;
  if (def.buffs.poison) D -= def.buffs.poison.v;
  if (def.defending) D = Math.round(D * 1.3);
  A = Math.max(0, A);
  D = Math.max(0, D);
  let min = ac.min;
  let max = ac.max;
  const ranged = !!opts.ranged;
  if (atk.buffs.bless || (ranged && atk.buffs.precision)) min = max;
  if (atk.buffs.curse) max = min;
  const raw = rollSum(battle, atk.count, min, max);
  const diff = A - D;
  let k = diff > 0 ? 1 + Math.min(3, diff * 0.05) : 1 - Math.min(0.7, -diff * 0.025);
  if (ranged) k *= 1 + ((ha && ha.archery) || 0);
  else k *= 1 + ((ha && ha.offense) || 0);
  if (ranged && !abil(atk, "noRangePenalty") && opts.dist > 10) k *= 0.5;
  if (!ranged && opts.joust) k *= 1 + 0.05 * opts.joust;
  if (hd && hd.armorer) k *= 1 - hd.armorer;
  if (!ranged && def.buffs.shield) k *= 1 - def.buffs.shield.v;
  if (ranged && def.buffs.airShield) k *= 1 - def.buffs.airShield.v;
  let luck = false;
  let unlucky = false;
  const lc = stackLuck(battle, atk);
  if (lc > 0 && roll(battle) < luckChance(lc)) { k *= 2; luck = true; }
  else if (lc < 0 && roll(battle) < luckChance(lc)) { k *= 0.5; unlucky = true; }
  let dmg = Math.max(1, Math.floor(raw * k));
  if (opts.half) dmg = Math.max(1, Math.floor(dmg * 0.5));
  return { dmg, luck, unlucky };
}

function hexBehind(ac, ar, tc, tr) {
  const dirs = hexNeighbors(tc, tr);
  let best = null;
  let bestD = -1;
  for (const [c, r] of dirs) {
    const d = hexDist(ac, ar, c, r);
    if (d > bestD) { bestD = d; best = [c, r]; }
  }
  return best;
}

function strike(battle, atk, def, opts) {
  const events = [];
  if (!atk || !def || atk.dead || def.dead) return events;
  const calc = damageOf(battle, atk, def, opts);
  let dmg = calc.dmg;
  let brokeBlind = false;
  if (def.buffs.blind && !abil(def, "blindImmune")) {
    dmg = Math.max(1, Math.floor(dmg * 0.5));
    delete def.buffs.blind;
    brokeBlind = true;
  }
  const hit = deal(def, dmg);
  events.push({
    type: "hit", from: atk.uid, to: def.uid, dmg: hit.dmg, killed: hit.killed,
    died: hit.died, luck: calc.luck, unlucky: calc.unlucky, ranged: !!opts.ranged,
    blind: brokeBlind,
  });
  if (!opts.ranged && abil(atk, "breath") && !def.dead) {
    const b = hexBehind(atk.c, atk.r, def.c, def.r);
    if (b) {
      const extra = unitAt(battle, b[0], b[1]);
      if (extra && extra.side !== atk.side && !extra.dead) {
        const splash = deal(extra, Math.max(1, Math.floor(dmg * 0.5)));
        events.push({ type: "breath", from: atk.uid, to: extra.uid, dmg: splash.dmg, killed: splash.killed, died: splash.died });
      }
    }
  }
  if (abil(atk, "poison") && !def.dead) def.buffs.poison = { t: 99, v: (def.buffs.poison ? def.buffs.poison.v : 0) + 3 };
  if (abil(atk, "sorrowHit")) def.buffs.sorrow = { t: 99, v: 1 };
  if (abil(atk, "drain")) {
    const h = heal(atk, hit.dmg, false);
    events.push({ type: "drain", uid: atk.uid, amount: h.healed });
  }
  if (abil(atk, "deathStare") && !def.dead && roll(battle) < 0.12) {
    const extra = Math.max(1, Math.floor(atk.count * 0.08));
    const cr = CREATURES[def.cr];
    const st = deal(def, extra * cr.hp);
    events.push({ type: "deathStare", from: atk.uid, to: def.uid, killed: st.killed, died: st.died });
  }
  const canRetal = !opts.ranged && !opts.noRetal && !abil(atk, "noEnemyRetal") && !def.dead && !atk.dead
    && def.retalLeft > 0 && !def.machine && !def.buffs.blind && !abil(def, "immobile");
  if (canRetal) {
    def.retalLeft -= 1;
    const back = damageOf(battle, def, atk, { ranged: false, retaliation: true });
    const bh = deal(atk, back.dmg);
    events.push({ type: "retal", from: def.uid, to: atk.uid, dmg: bh.dmg, killed: bh.killed, died: bh.died, luck: back.luck });
  }
  recomputeAuras(battle);
  return events;
}

export function reachable(battle, stack) {
  const spd = abil(stack, "immobile") ? 0 : speedOf(stack);
  const flying = abil(stack, "flying") || (stack.buffs && stack.buffs.fly);
  const dist = new Map();
  const parent = new Map();
  const start = hk(stack.c, stack.r);
  dist.set(start, 0);
  if (flying) {
    // Flight crosses occupied hexes and barriers, but must land on a free hex.
    for (let c = 0; c < BCOLS; c++) for (let r = 0; r < BROWS; r++) {
      const key = hk(c, r), cost = hexDist(stack.c, stack.r, c, r);
      if (!cost || cost > spd || unitAt(battle, c, r)) continue;
      if (["wall", "gate", "rock", "tree"].includes(battle.obstacles[key])) continue;
      dist.set(key, cost);
      parent.set(key, start);
    }
    return { dist, parent, spd, flying };
  }
  const q = [[stack.c, stack.r]];
  while (q.length) {
    const [c, r] = q.shift();
    const base = dist.get(hk(c, r));
    if (base >= spd) continue;
    for (const [nc, nr] of hexNeighbors(c, r)) {
      if (!inBounds(nc, nr)) continue;
      const key = hk(nc, nr);
      if (unitAt(battle, nc, nr)) continue;
      const block = battle.obstacles[key];
      if (!flying && (block === "wall" || block === "gate" || block === "rock" || block === "tree")) continue;
      let nd = base + 1;
      if (!flying && block === "moat") nd = spd;
      if (nd > spd) continue;
      if (dist.has(key) && dist.get(key) <= nd) continue;
      dist.set(key, nd);
      parent.set(key, hk(c, r));
      if (!(block === "moat" && !flying)) q.push([nc, nr]);
    }
  }
  return { dist, parent, spd, flying };
}

function pathFrom(parent, startKey, destKey) {
  const path = [];
  let cur = destKey;
  let guard = 0;
  while (cur && cur !== startKey && guard++ < 40) {
    const [c, r] = cur.split(",").map(Number);
    path.push({ c, r });
    cur = parent.get(cur);
  }
  path.reverse();
  return path;
}

function losBlocked(battle, a, b) {
  const steps = Math.max(hexDist(a.c, a.r, b.c, b.r), 1);
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const c = Math.round(a.c + (b.c - a.c) * t);
    const r = Math.round(a.r + (b.r - a.r) * t);
    const block = battle.obstacles[hk(c, r)];
    if (block === "wall" || block === "gate") return true;
  }
  return false;
}

function adjacentEnemy(battle, stack) {
  return hexNeighbors(stack.c, stack.r).some(([c, r]) => {
    const u = unitAt(battle, c, r);
    return u && u.side !== stack.side && !u.dead;
  });
}

export function attackOptions(battle, stack) {
  const opts = [];
  if (!stack || stack.dead) return opts;
  const reach = reachable(battle, stack);
  const cr = CREATURES[stack.cr];
  const ammo = battle.ammo && battle.ammo[stack.side];
  const canShoot = !!(cr.ranged && (ammo || stack.shots > 0) && !stack.buffs.forget);
  const blocked = adjacentEnemy(battle, stack) && !abil(stack, "noRangePenalty");
  const enemies = living(battle, (s) => s.side !== stack.side);
  const berserk = !!stack.buffs.berserk;
  const targets = berserk ? living(battle, (s) => s.uid !== stack.uid) : enemies;
  if (canShoot && !blocked && !berserk) {
    for (const e of targets) {
      if (e.machine && e.side === stack.side) continue;
      const blockedLos = losBlocked(battle, stack, e) && !abil(stack, "noRangePenalty");
      if (blockedLos) continue;
      opts.push({
        kind: "ranged", target: e.uid, dest: { c: stack.c, r: stack.r },
        dist: hexDist(stack.c, stack.r, e.c, e.r), joust: 0,
      });
    }
  }
  for (const e of targets) {
    if (e.machine && e.cr === "tower") {
      // можно бить башню в ближнем бою
    }
    const neigh = hexNeighbors(e.c, e.r).filter(([c, r]) => inBounds(c, r));
    let best = null;
    for (const [c, r] of neigh) {
      const key = hk(c, r);
      const isSelf = c === stack.c && r === stack.r;
      if (!isSelf && !reach.dist.has(key)) continue;
      const occ = unitAt(battle, c, r);
      if (occ && occ.uid !== stack.uid) continue;
      const cost = isSelf ? 0 : reach.dist.get(key);
      if (!best || cost > best.joust) best = { c, r, joust: cost };
    }
    if (best) {
      opts.push({
        kind: "melee", target: e.uid, dest: { c: best.c, r: best.r },
        dist: hexDist(best.c, best.r, e.c, e.r), joust: best.joust,
      });
    }
  }
  if (battle.siege && stack.side === "left" && !abil(stack, "flying") && !stack.buffs.fly) {
    for (const key of Object.keys(battle.obstacles)) {
      const kind = battle.obstacles[key];
      if (kind !== "wall" && kind !== "gate") continue;
      if ((battle.wallHp[key] || 0) <= 0) continue;
      const [wc, wr] = key.split(",").map(Number);
      for (const [c, r] of hexNeighbors(wc, wr)) {
        const isSelf = c === stack.c && r === stack.r;
        const kk = hk(c, r);
        if (!isSelf && !reach.dist.has(kk)) continue;
        const occ = unitAt(battle, c, r);
        if (occ && occ.uid !== stack.uid) continue;
        opts.push({ kind: "wall", wall: key, dest: { c, r }, target: null, dist: 1, joust: isSelf ? 0 : reach.dist.get(kk) });
        break;
      }
    }
  }
  return opts;
}

function schoolLevel(hero, spell) {
  if (!hero) return 0;
  if (!spell || spell.school === "all") {
    return Math.max(hero.skills.air || 0, hero.skills.fire || 0, hero.skills.water || 0, hero.skills.earth || 0);
  }
  return hero.skills[spell.school] || 0;
}

export function spellManaCost(hero, spell) {
  if (!spell) return 99;
  return Math.max(1, spell.cost - schoolLevel(hero, spell));
}

function buffSpec(battle, side, buff) {
  const hero = battle.heroes[side];
  const spell = Object.values(SPELLS).find((s) => s.buff === buff);
  const lv = spell ? schoolLevel(hero, spell) : 0;
  const dur = [2, 2, 3, 40][lv] || 2;
  switch (buff) {
    case "haste": return { t: dur, v: [3, 3, 4, 6][lv] || 3 };
    case "slow": return { t: dur, v: [3, 3, 4, 5][lv] || 3 };
    case "bless":
    case "curse":
    case "precision":
    case "forget":
    case "blind":
    case "berserk":
      return { t: dur, v: 1 };
    case "shield": return { t: dur, v: [0.15, 0.15, 0.25, 0.3][lv] || 0.15 };
    case "airShield": return { t: dur, v: [0.2, 0.25, 0.35, 0.5][lv] || 0.25 };
    case "bloodlust": return { t: dur, v: [3, 3, 5, 7][lv] || 3 };
    case "weakness": return { t: dur, v: [3, 3, 5, 7][lv] || 3 };
    case "stone": return { t: dur, v: [3, 3, 6, 8][lv] || 3 };
    case "prayer": return { t: dur, v: 1 };
    case "counter": return { t: dur, v: lv >= 3 ? 97 : 1 };
    case "slayer": return { t: dur, v: [10, 10, 20, 30][lv] || 10 };
    case "fly": return { t: 40, v: 1 };
    case "protectAir": return { t: dur, v: 0.5 };
    default: return { t: dur, v: 1 };
  }
}

function resist(battle, defenderSide, spell) {
  if (!spell || spell.kind === "heal" || spell.kind === "resurrect" || spell.kind === "buff") {
    if (spell && spell.target === "enemy") {
      /* debuffs can be resisted */
    } else if (spell && (spell.kind === "heal" || spell.kind === "resurrect" || spell.target === "ally" || spell.target === "allAlly")) {
      return false;
    }
  }
  const hero = battle.heroes[defenderSide];
  if (!hero) return false;
  const chance = (hero.resist || 0) / 100;
  if (chance <= 0) return false;
  return roll(battle) < chance;
}

function spellDamageAmount(battle, side, spell) {
  const hero = battle.heroes[side];
  const pow = hero ? hero.power : 0;
  let dmg = (spell.base || 0) + (spell.per || 0) * pow;
  const lv = schoolLevel(hero, spell);
  dmg *= 1 + 0.15 * lv;
  dmg *= 1 + ((hero && hero.sorcery) || 0);
  return Math.max(1, Math.floor(dmg));
}

function applyDamageSpell(battle, side, targets, spell, events) {
  let dmg = spellDamageAmount(battle, side, spell);
  for (const t of targets) {
    if (!t || t.dead) continue;
    if (spell.id === "armageddon" && t.cr === "el_fire") continue;
    if (resist(battle, t.side, spell)) {
      events.push({ type: "resist", uid: t.uid, spell: spell.id });
      continue;
    }
    let amount = dmg;
    if (t.buffs.protectAir && (spell.school === "air" || spell.id === "magicArrow")) amount = Math.floor(amount * 0.5);
    const hit = deal(t, amount);
    events.push({ type: "spellHit", spell: spell.id, to: t.uid, dmg: hit.dmg, killed: hit.killed, died: hit.died });
  }
}

function massBuff(battle, side, spell) {
  const hero = battle.heroes[side];
  const lv = schoolLevel(hero, spell);
  if (lv < 3) return false;
  return ["haste", "slow", "bless", "curse", "shield", "bloodlust", "weakness", "stoneSkin", "precision", "airShield", "counterstrike", "dispel"].includes(spell.id);
}

export function castSpell(battle, side, spellId, targetUid, hex) {
  const events = [];
  const spell = SPELLS[spellId];
  const hero = battle.heroes[side];
  if (!spell || !spell.combat) return { ok: false, error: "Это не боевое заклинание.", events };
  if (!hero) return { ok: false, error: "Заклинать некому.", events };
  if (battle.castThisRound[side]) return { ok: false, error: "Заклинание в этом раунде уже сказано.", events };
  if (!hero.spells.includes(spellId)) return { ok: false, error: "Нет в книге.", events };
  const cap = wisdomCap(hero.skills.wisdom || 0);
  if (spell.level > cap) return { ok: false, error: "Не хватает мудрости.", events };
  const cost = spellManaCost(hero, spell);
  if (hero.mana < cost) return { ok: false, error: "Не хватает маны.", events };
  hero.mana -= cost;
  battle.castThisRound[side] = true;
  battle.casted = battle.casted || [];
  battle.casted.push(spellId);
  events.push({ type: "cast", side, spell: spellId, target: targetUid || null });

  const allies = living(battle, (s) => s.side === side && !s.machine);
  const enemies = living(battle, (s) => s.side !== side);
  const one = targetUid ? stackByUid(battle, targetUid) : null;

  if (spell.kind === "quake") {
    let n = 0;
    const hit = 180 + (hero.power || 0) * 40;
    for (const key of Object.keys(battle.wallHp)) {
      if ((battle.wallHp[key] || 0) <= 0) continue;
      battle.wallHp[key] -= hit;
      if (battle.wallHp[key] <= 0) {
        battle.wallHp[key] = 0;
        delete battle.obstacles[key];
        n++;
      }
    }
    events.push({ type: "quake", destroyed: n });
    return { ok: true, events };
  }

  if (spell.kind === "damageAll") {
    applyDamageSpell(battle, side, battle.stacks.filter((s) => !s.dead), spell, events);
    recomputeAuras(battle);
    checkWinner(battle);
    return { ok: true, events };
  }

  if (spell.kind === "summon") {
    if (!hex || !inBounds(hex.c, hex.r) || unitAt(battle, hex.c, hex.r) || battle.obstacles[hk(hex.c, hex.r)]) {
      hero.mana += cost;
      battle.castThisRound[side] = false;
      return { ok: false, error: "Нужна свободная клетка.", events: [] };
    }
    const schools = ["air", "fire", "water", "earth"];
    let best = "earth";
    let bl = -1;
    for (const s of schools) {
      const lv = hero.skills[s] || 0;
      if (lv > bl) { bl = lv; best = s; }
    }
    const id = "el_" + best;
    const count = Math.max(1, hero.power);
    const cr = CREATURES[id];
    battle.stacks.push({
      uid: ++battle.uidSeq,
      side, cr: id, count, initCount: count, topHp: cr.hp,
      c: hex.c, r: hex.r, shots: 0, retalLeft: 1, buffs: {}, defending: false,
      dead: false, machine: false, summoned: true, speedOverride: 0,
    });
    events.push({ type: "summon", uid: battle.uidSeq, cr: id, count });
    return { ok: true, events };
  }

  if (spell.kind === "teleport") {
    const st = one;
    if (!st || st.side !== side || st.dead || !hex || !inBounds(hex.c, hex.r) || unitAt(battle, hex.c, hex.r)) {
      hero.mana += cost; battle.castThisRound[side] = false;
      return { ok: false, error: "Некуда перенести.", events: [] };
    }
    const block = battle.obstacles[hk(hex.c, hex.r)];
    if (block === "wall" || block === "gate" || block === "rock" || block === "tree") {
      hero.mana += cost; battle.castThisRound[side] = false;
      return { ok: false, error: "Клетка занята преградой.", events: [] };
    }
    events.push({ type: "teleport", uid: st.uid, from: { c: st.c, r: st.r }, to: hex });
    st.c = hex.c; st.r = hex.r;
    return { ok: true, events };
  }

  if (spell.kind === "animate") {
    const count = Math.max(3, (hero.power || 1) * 3);
    const spot = findEmpty(battle, side === "left" ? 1 : BCOLS - 2);
    if (!spot) {
      hero.mana += cost; battle.castThisRound[side] = false;
      return { ok: false, error: "Нет места для подъёма.", events: [] };
    }
    const cr = CREATURES.o_spark;
    battle.stacks.push({
      uid: ++battle.uidSeq, side, cr: "o_spark", count, initCount: count, topHp: cr.hp,
      c: spot.c, r: spot.r, shots: 0, retalLeft: 1, buffs: {}, defending: false,
      dead: false, machine: false, summoned: true,
    });
    events.push({ type: "summon", uid: battle.uidSeq, cr: "o_spark", count });
    return { ok: true, events };
  }

  if (spell.kind === "heal" || spell.kind === "resurrect") {
    const list = massBuff(battle, side, spell) ? allies : (one && one.side === side ? [one] : []);
    if (!list.length) {
      hero.mana += cost; battle.castThisRound[side] = false;
      return { ok: false, error: "Нет цели.", events: [] };
    }
    const amount = spell.kind === "heal" ? 20 + hero.power * 8 : hero.power * 50;
    for (const t of list) {
      const h = heal(t, amount, spell.kind === "resurrect");
      events.push({ type: "heal", uid: t.uid, amount, raised: h.raised, spell: spell.id });
    }
    return { ok: true, events };
  }

  if (spell.kind === "dispel") {
    let list = [];
    if (massBuff(battle, side, spell) && one) list = living(battle, (s) => s.side === one.side);
    else if (one) list = [one];
    if (!list.length) {
      hero.mana += cost; battle.castThisRound[side] = false;
      return { ok: false, error: "Нет цели.", events: [] };
    }
    for (const t of list) {
      t.buffs = {};
      events.push({ type: "dispel", uid: t.uid });
    }
    return { ok: true, events };
  }

  if (spell.kind === "chain") {
    if (!one || one.side === side || one.dead) {
      hero.mana += cost; battle.castThisRound[side] = false;
      return { ok: false, error: "Нужен враг.", events: [] };
    }
    const hitList = [one];
    let dmg = spellDamageAmount(battle, side, spell);
    const used = new Set([one.uid]);
    let cursor = one;
    for (let i = 0; i < 4; i++) {
      let best = null;
      let bd = 99;
      for (const e of enemies) {
        if (used.has(e.uid) || e.dead) continue;
        const d = hexDist(cursor.c, cursor.r, e.c, e.r);
        if (d < bd) { bd = d; best = e; }
      }
      if (!best) break;
      used.add(best.uid);
      hitList.push(best);
      cursor = best;
    }
    hitList.forEach((t, i) => {
      const amount = Math.max(1, Math.floor(dmg * Math.pow(0.5, i)));
      if (resist(battle, t.side, spell)) {
        events.push({ type: "resist", uid: t.uid, spell: spell.id });
        return;
      }
      const hit = deal(t, amount);
      events.push({ type: "spellHit", spell: spell.id, to: t.uid, dmg: hit.dmg, killed: hit.killed, died: hit.died });
    });
    recomputeAuras(battle);
    checkWinner(battle);
    return { ok: true, events };
  }

  if (spell.kind === "buff") {
    let list = [];
    const enemyBuff = spell.target === "enemy";
    if (spell.target === "allAlly" || (massBuff(battle, side, spell) && !enemyBuff)) list = allies;
    else if (massBuff(battle, side, spell) && enemyBuff) list = enemies;
    else if (one) list = [one];
    list = list.filter((s) => !s.dead);
    if (enemyBuff) list = list.filter((s) => s.side !== side);
    if (!enemyBuff && spell.target !== "any") list = list.filter((s) => s.side === side);
    if (!list.length) {
      hero.mana += cost; battle.castThisRound[side] = false;
      return { ok: false, error: "Нет цели.", events: [] };
    }
    const spec = buffSpec(battle, side, spell.buff);
    for (const t of list) {
      if (enemyBuff && spell.buff === "blind" && abil(t, "blindImmune")) {
        events.push({ type: "resist", uid: t.uid, spell: spell.id });
        continue;
      }
      if (enemyBuff && resist(battle, t.side, spell)) {
        events.push({ type: "resist", uid: t.uid, spell: spell.id });
        continue;
      }
      t.buffs[spell.buff] = { t: spec.t, v: spec.v };
      if (spell.buff === "counter") t.retalLeft = retalMax(t);
      events.push({ type: "buff", uid: t.uid, buff: spell.buff, spell: spell.id });
    }
    return { ok: true, events };
  }

  if (spell.kind === "damage") {
    let list = [];
    if (spell.ring && hex) {
      list = hexNeighbors(hex.c, hex.r).map(([c, r]) => unitAt(battle, c, r)).filter((s) => s && s.side !== side);
    } else if (one) {
      list = [one];
      if (spell.area) {
        for (const [c, r] of hexNeighbors(one.c, one.r)) {
          const u = unitAt(battle, c, r);
          if (u && u.side !== side) list.push(u);
        }
      }
    }
    if (!list.length) {
      hero.mana += cost; battle.castThisRound[side] = false;
      return { ok: false, error: "Нет цели.", events: [] };
    }
    applyDamageSpell(battle, side, list, spell, events);
    recomputeAuras(battle);
    checkWinner(battle);
    return { ok: true, events };
  }

  hero.mana += cost;
  battle.castThisRound[side] = false;
  return { ok: false, error: "Заклинание не сработало.", events: [] };
}

function findEmpty(battle, preferC) {
  for (let r = 0; r < BROWS; r++) {
    for (const c of [preferC, preferC - 1, preferC + 1, preferC + 2]) {
      if (!inBounds(c, r)) continue;
      if (unitAt(battle, c, r)) continue;
      const b = battle.obstacles[hk(c, r)];
      if (b && b !== "moat") continue;
      return { c, r };
    }
  }
  return null;
}

function moveStack(battle, stack, dest, parent) {
  const start = hk(stack.c, stack.r);
  const end = hk(dest.c, dest.r);
  if (start === end) return [];
  const path = pathFrom(parent, start, end);
  if (!path.length) {
    stack.c = dest.c;
    stack.r = dest.r;
    return [{ c: dest.c, r: dest.r }];
  }
  stack.c = dest.c;
  stack.r = dest.r;
  return path;
}

export function applyAction(battle, action) {
  const events = [];
  if (battle.result || battle.phase !== "fight") return { ok: false, error: "Бой уже завершён.", events };
  const stack = currentStack(battle);
  if (!stack) return { ok: false, error: "Нет активного отряда.", events };

  if (action.type === "spell") {
    const res = castSpell(battle, action.side || stack.side, action.spellId, action.target, action.hex);
    return res;
  }

  if (action.type === "retreat") {
    battle.result = { winner: stack.side === "left" ? "right" : "left", retreat: true, side: stack.side };
    events.push({ type: "retreat", side: stack.side });
    return { ok: true, events };
  }
  if (action.type === "surrender") {
    battle.result = { winner: stack.side === "left" ? "right" : "left", surrender: true, side: stack.side };
    events.push({ type: "surrender", side: stack.side });
    return { ok: true, events };
  }

  if (action.uid && action.uid !== stack.uid) return { ok: false, error: "Сейчас ходит другой отряд.", events };

  if (action.type === "wait") {
    if (stack.waited) return { ok: false, error: "Уже ждала.", events };
    stack.waited = true;
    battle.waitQueue.push(stack.uid);
    events.push({ type: "wait", uid: stack.uid });
    finish(battle, stack, events, true);
    return { ok: true, events };
  }

  if (action.type === "defend") {
    stack.defending = true;
    events.push({ type: "defend", uid: stack.uid });
    finish(battle, stack, events, false);
    return { ok: true, events };
  }

  if (action.type === "skip") {
    events.push({ type: "skip", uid: stack.uid });
    finish(battle, stack, events, false);
    return { ok: true, events };
  }

  if (action.type === "attack") {
    const options = attackOptions(battle, stack);
    const want = action.wall ? "wall" : action.ranged ? "ranged" : "melee";
    const opt = options.find((o) => {
      if (want === "wall") return o.kind === "wall" && o.wall === action.wall;
      return o.kind === want && o.target === action.target;
    }) || options.find((o) => (action.wall ? o.wall === action.wall : o.target === action.target));
    if (!opt) return { ok: false, error: "Цель недоступна.", events };
    const reach = reachable(battle, stack);
    if (opt.kind === "wall") {
      const path = moveStack(battle, stack, opt.dest, reach.parent);
      if (path.length) events.push({ type: "move", uid: stack.uid, path });
      const ac = CREATURES[stack.cr];
      const raw = rollSum(battle, stack.count, ac.min, ac.max);
      const dmg = Math.max(1, Math.floor(raw * (1 + ((battle.heroes[stack.side] && battle.heroes[stack.side].offense) || 0))));
      battle.wallHp[opt.wall] = (battle.wallHp[opt.wall] || 0) - dmg;
      const fell = battle.wallHp[opt.wall] <= 0;
      if (fell) {
        battle.wallHp[opt.wall] = 0;
        delete battle.obstacles[opt.wall];
      }
      events.push({ type: "wall", uid: stack.uid, wall: opt.wall, dmg, fell });
      finish(battle, stack, events, false);
      return { ok: true, events };
    }
    const target = stackByUid(battle, opt.target);
    if (!target || target.dead) return { ok: false, error: "Цель мертва.", events };
    if (opt.kind === "ranged") {
      if (!battle.ammo[stack.side]) stack.shots -= 1;
      const times = abil(stack, "doubleShot") ? 2 : 1;
      events.push({ type: "shoot", uid: stack.uid, target: target.uid, times });
      for (let i = 0; i < times; i++) {
        if (target.dead || stack.dead) break;
        events.push(...strike(battle, stack, target, { ranged: true, dist: opt.dist, noRetal: true }));
      }
    } else {
      const path = moveStack(battle, stack, opt.dest, reach.parent);
      if (path.length) events.push({ type: "move", uid: stack.uid, path, joust: path.length });
      const times = !abil(stack, "doubleStrike") ? 1 : 2;
      for (let i = 0; i < times; i++) {
        if (target.dead || stack.dead) break;
        events.push(...strike(battle, stack, target, {
          ranged: false,
          joust: abil(stack, "joust") ? path.length : 0,
          noRetal: i > 0,
        }));
      }
    }
    if (checkWinner(battle)) events.push({ type: "battleEnd", result: battle.result });
    finish(battle, stack, events, false);
    return { ok: true, events };
  }

  return { ok: false, error: "Неизвестное действие.", events };
}

function finish(battle, stack, events, waited) {
  if (battle.result) return;
  if (!waited && stack.goodMorale && !stack.usedExtra) {
    stack.usedExtra = true;
    stack.goodMorale = false;
    events.push({ type: "extra", uid: stack.uid });
    return;
  }
  stack.usedExtra = false;
  stack.goodMorale = false;
  stack.moraleChecked = false;
  stack.regenDone = false;
  battle.qi++;
}

export function currentStack(battle) {
  if (!battle || battle.phase !== "fight" || battle.result) return null;
  while (battle.qi < battle.queue.length) {
    const s = stackByUid(battle, battle.queue[battle.qi]);
    if (s && !s.dead) return s;
    battle.qi++;
  }
  return null;
}

function buildQueue(battle) {
  const arr = battle.stacks.filter((s) => !s.dead);
  arr.sort((a, b) => {
    const ds = speedOf(b) - speedOf(a);
    if (ds) return ds;
    if (a.side !== b.side) return a.side === "left" ? -1 : 1;
    return a.uid - b.uid;
  });
  battle.queue = arr.map((s) => s.uid);
  battle.qi = 0;
  battle.waitQueue = [];
  battle.castThisRound = { left: false, right: false };
  for (const s of battle.stacks) {
    s.waited = false;
    s.moraleChecked = false;
    s.regenDone = false;
    s.usedExtra = false;
    s.goodMorale = false;
    if (!s.dead) s.retalLeft = retalMax(s);
  }
}

function endRound(battle, events) {
  battle.round++;
  for (const s of battle.stacks) {
    if (s.dead) continue;
    for (const k of Object.keys(s.buffs)) {
      if (k === "poison" || k === "fly" || k === "sorrow") continue;
      s.buffs[k].t -= 1;
      if (s.buffs[k].t <= 0) delete s.buffs[k];
    }
  }
  tentHeal(battle, events);
  if (battle.siege) catapult(battle, events);
  buildQueue(battle);
  events.push({ type: "round", round: battle.round });
}

function tentHeal(battle, events) {
  for (const side of ["left", "right"]) {
    if (!battle.tent || !battle.tent[side]) continue;
    const hero = battle.heroes[side];
    const lv = hero ? (hero.skills.firstaid || 0) : 0;
    const amount = [30, 40, 70, 120][lv] || 30;
    const candidates = living(battle, (s) => s.side === side && !s.machine && !CREATURES[s.cr].undead);
    candidates.sort((a, b) => poolOf(a) / (CREATURES[a.cr].hp * a.count) - poolOf(b) / (CREATURES[b.cr].hp * b.count));
    if (!candidates.length) continue;
    const t = candidates[0];
    const h = heal(t, amount, false);
    events.push({ type: "tent", uid: t.uid, amount: h.healed });
  }
}

function catapult(battle, events) {
  const walls = Object.keys(battle.wallHp).filter((k) => battle.wallHp[k] > 0);
  if (!walls.length) return;
  const hero = battle.heroes.left;
  const art = hero ? (hero.skills.artillery || 0) : 0;
  const acc = [0.45, 0.7, 0.85, 0.98][art] || 0.45;
  if (roll(battle) > acc) {
    events.push({ type: "catapult", hit: false });
    return;
  }
  const gate = walls.find((k) => battle.obstacles[k] === "gate" && battle.wallHp[k] > 0);
  const key = gate || walls[Math.floor(roll(battle) * walls.length)];
  const dmg = rollInt(battle, 140, 230) + art * 40;
  battle.wallHp[key] -= dmg;
  const fell = battle.wallHp[key] <= 0;
  if (fell) {
    battle.wallHp[key] = 0;
    delete battle.obstacles[key];
  }
  events.push({ type: "catapult", hit: true, wall: key, dmg, fell });
}

/** Подготовить текущего бойца: реген, слепота, мораль. Может продвинуть очередь. */
export function prepareTurn(battle) {
  const events = [];
  if (battle.phase !== "fight" || battle.result) return events;
  let guard = 0;
  while (guard++ < 250 && !battle.result) {
    if (battle.qi >= battle.queue.length) {
      if (battle.waitQueue.length) {
        battle.queue = battle.waitQueue.slice();
        battle.waitQueue = [];
        battle.qi = 0;
        continue;
      }
      endRound(battle, events);
      if (checkWinner(battle)) break;
      continue;
    }
    const s = stackByUid(battle, battle.queue[battle.qi]);
    if (!s || s.dead) { battle.qi++; continue; }
    if (s.defending) s.defending = false;
    if (!s.regenDone) {
      s.regenDone = true;
      if (abil(s, "regenerate")) {
        const cr = CREATURES[s.cr];
        const h = heal(s, Math.floor(cr.hp * s.count * 0.2), false);
        if (h.healed) events.push({ type: "regen", uid: s.uid, amount: h.healed });
      }
    }
    if (s.buffs.blind && s.buffs.blind.t > 0 && !abil(s, "blindImmune")) {
      events.push({ type: "skip", uid: s.uid, reason: "blind" });
      s.buffs.blind.t -= 1;
      if (s.buffs.blind.t <= 0) delete s.buffs.blind;
      s.regenDone = false;
      battle.qi++;
      continue;
    }
    if (!s.moraleChecked) {
      s.moraleChecked = true;
      const m = stackMorale(battle, s);
      if (m < 0 && roll(battle) < luckChance(m)) {
        events.push({ type: "morale", uid: s.uid, good: false });
        s.regenDone = false;
        s.moraleChecked = false;
        battle.qi++;
        continue;
      }
      if (m > 0 && roll(battle) < luckChance(m)) {
        s.goodMorale = true;
        events.push({ type: "morale", uid: s.uid, good: true });
      }
    }
    const spell = aiSpell(battle, s.side, s);
    if (spell) {
      const res = castSpell(battle, s.side, spell.spellId, spell.target, spell.hex);
      if (res.ok) events.push(...res.events);
    }
    return events;
  }
  checkWinner(battle);
  return events;
}

function aiSpell(battle, side, stack) {
  if (battle.castThisRound[side]) return null;
  if (stack.buffs && stack.buffs.berserk) return null;
  const hero = battle.heroes[side];
  if (!hero) return null;
  // Только сторона под автобоем или не-человеческая сама колдует здесь.
  // Человек колдует кнопкой. Флаг battle.spellAi.
  if (!battle.spellAi[side]) return null;
  const enemies = living(battle, (s) => s.side !== side && !s.machine);
  const allies = living(battle, (s) => s.side === side && !s.machine);
  if (!enemies.length) return null;
  const known = hero.spells.filter((id) => SPELLS[id] && SPELLS[id].combat && SPELLS[id].level <= wisdomCap(hero.skills.wisdom || 0));
  const affordable = known.filter((id) => hero.mana >= spellManaCost(hero, SPELLS[id]));
  if (!affordable.length) return null;
  enemies.sort((a, b) => threat(b) - threat(a));
  const best = enemies[0];
  const killSpell = ["implosion", "chain", "lightning", "iceBolt", "fireball", "meteor", "magicArrow", "armageddon"];
  for (const id of killSpell) {
    if (!affordable.includes(id)) continue;
    const sp = SPELLS[id];
    const dmg = spellDamageAmount(battle, side, sp);
    if (sp.kind === "damageAll") return { spellId: id };
    if (dmg >= poolOf(best) * 0.8) return { spellId: id, target: best.uid };
  }
  const wounded = allies.slice().sort((a, b) => poolOf(a) / a.initCount - poolOf(b) / b.initCount)[0];
  if (wounded && poolOf(wounded) < CREATURES[wounded.cr].hp * wounded.count * 0.6 && affordable.includes("cure")) {
    return { spellId: "cure", target: wounded.uid };
  }
  if (affordable.includes("haste")) {
    const slow = allies.slice().sort((a, b) => speedOf(a) - speedOf(b))[0];
    if (slow && !slow.buffs.haste) return { spellId: "haste", target: slow.uid };
  }
  if (affordable.includes("bless")) {
    const br = allies.find((a) => !a.buffs.bless && CREATURES[a.cr].min !== CREATURES[a.cr].max);
    if (br) return { spellId: "bless", target: br.uid };
  }
  if (affordable.includes("slow") && !best.buffs.slow) return { spellId: "slow", target: best.uid };
  if (affordable.includes("curse") && !best.buffs.curse) return { spellId: "curse", target: best.uid };
  return null;
}

function threat(s) {
  const cr = CREATURES[s.cr];
  return s.count * (cr.min + cr.max) * (cr.atk + 3) * Math.max(1, cr.spd);
}

export function chooseAiAction(battle) {
  const s = currentStack(battle);
  if (!s) return { type: "skip" };
  if (s.buffs.berserk || true) {
    /* fallthrough */
  }
  const options = attackOptions(battle, s);
  const enemies = living(battle, (e) => (s.buffs.berserk ? e.uid !== s.uid : e.side !== s.side));
  if (!enemies.length) return { type: "defend", uid: s.uid };
  let best = null;
  let bestScore = -1e9;
  for (const o of options) {
    if (o.kind === "wall") {
      const score = 50 + (battle.obstacles[o.wall] === "gate" ? 30 : 0);
      if (score > bestScore) { bestScore = score; best = { type: "attack", uid: s.uid, wall: o.wall }; }
      continue;
    }
    const t = stackByUid(battle, o.target);
    if (!t) continue;
    const cr = CREATURES[s.cr];
    const est = s.count * (cr.min + cr.max) / 2;
    const kill = est >= poolOf(t) ? 1000 : 0;
    const score = kill + threat(t) / 10 + (o.kind === "ranged" ? 40 : 0) + o.joust * 3 - (o.kind === "melee" ? 0 : 0);
    if (score > bestScore) {
      bestScore = score;
      best = { type: "attack", uid: s.uid, target: t.uid, ranged: o.kind === "ranged", wall: null };
    }
  }
  if (best) return best;
  const reach = reachable(battle, s);
  if (abil(s, "immobile") || reach.dist.size <= 1) return { type: "defend", uid: s.uid };
  let target = enemies.slice().sort((a, b) => hexDist(s.c, s.r, a.c, a.r) - hexDist(s.c, s.r, b.c, b.r))[0];
  let bestHex = null;
  let bestD = 999;
  for (const [key, cost] of reach.dist) {
    if (cost <= 0) continue;
    const [c, r] = key.split(",").map(Number);
    const d = hexDist(c, r, target.c, target.r);
    if (d < bestD || (d === bestD && cost > (bestHex ? bestHex.cost : 0))) {
      bestD = d;
      bestHex = { c, r, cost };
    }
  }
  if (!bestHex) return { type: "defend", uid: s.uid };
  // Шаг к цели закодирован как атака по стене? Нет — отдельный тип move.
  return { type: "move", uid: s.uid, dest: { c: bestHex.c, r: bestHex.r } };
}

// Дополняю applyAction обработкой move — патч через обёртку ниже, если тип не пойман.
const _apply = applyAction;
export function act(battle, action) {
  if (action && action.type === "move") {
    const events = [];
    const stack = currentStack(battle);
    if (!stack || (action.uid && action.uid !== stack.uid)) return { ok: false, error: "Не тот отряд.", events };
    const reach = reachable(battle, stack);
    const key = hk(action.dest.c, action.dest.r);
    if (!reach.dist.has(key)) return { ok: false, error: "Слишком далеко.", events };
    const path = moveStack(battle, stack, action.dest, reach.parent);
    events.push({ type: "move", uid: stack.uid, path });
    finish(battle, stack, events, false);
    return { ok: true, events };
  }
  return _apply(battle, action);
}

export function createBattle(spec) {
  const battle = {
    rngState: spec.seed >>> 0 || 1,
    cols: BCOLS,
    rows: BROWS,
    siege: !!spec.siege,
    fortLevel: spec.fortLevel || 0,
    obstacles: {},
    wallHp: {},
    stacks: [],
    heroes: { left: spec.attacker.hero || null, right: spec.defender.hero || null },
    round: 1,
    queue: [],
    qi: 0,
    waitQueue: [],
    phase: "deploy",
    castThisRound: { left: false, right: false },
    ammo: {
      left: !!(spec.attacker.ammo),
      right: !!(spec.defender.ammo),
    },
    tent: {
      left: !!(spec.attacker.tent),
      right: !!(spec.defender.tent),
    },
    spellAi: { left: !!spec.attacker.ai, right: !!spec.defender.ai },
    human: { left: !!spec.attacker.human, right: !!spec.defender.human },
    tactics: {
      left: spec.attacker.tactics || 0,
      right: spec.defender.tactics || 0,
    },
    uidSeq: 1,
    log: [],
    result: null,
    auraLuck: { left: 0, right: 0 },
    auraMorale: { left: 0, right: 0 },
    auraFear: { left: 0, right: 0 },
    terrain: spec.terrain || "grass",
    kind: spec.kind || "field",
  };
  const rows = [1, 3, 5, 7, 9, 2, 8, 4, 6, 0, 10];
  function pushSide(list, side) {
    list.forEach((st, i) => {
      const cr = CREATURES[st.cr];
      if (!cr || st.count <= 0) return;
      const c = side === "left" ? 0 : BCOLS - 1;
      const r = rows[i % rows.length];
      battle.stacks.push({
        uid: battle.uidSeq++,
        side,
        cr: st.cr,
        count: st.count,
        initCount: st.count,
        topHp: cr.hp,
        c, r,
        shots: cr.shots || 0,
        retalLeft: 1,
        buffs: {},
        defending: false,
        dead: false,
        machine: !!st.machine,
        summoned: false,
        speedOverride: st.speedOverride || 0,
        slot: st.slot,
      });
    });
  }
  pushSide(spec.attacker.stacks || [], "left");
  pushSide(spec.defender.stacks || [], "right");
  if (spec.attacker.ballista) {
    const cr = CREATURES.ballista;
    battle.stacks.push({
      uid: battle.uidSeq++, side: "left", cr: "ballista", count: 1, initCount: 1, topHp: cr.hp,
      c: 1, r: 10, shots: 24, retalLeft: 0, buffs: {}, defending: false, dead: false,
      machine: true, speedOverride: 8, slot: -1,
    });
  }
  placeObstacles(battle, spec.seed || 1);
  if (battle.siege) placeWalls(battle);
  // развести наложившиеся фигуры
  const seen = new Set();
  for (const s of battle.stacks) {
    let guard = 0;
    while (guard++ < 40 && ([...battle.stacks].some((o) => o !== s && !o.dead && o.c === s.c && o.r === s.r) || seen.has(hk(s.c, s.r)))) {
      s.r = (s.r + 1) % BROWS;
      if (s.side === "left") s.c = Math.min(2, s.c + (guard % 2));
    }
    seen.add(hk(s.c, s.r));
  }
  for (const s of battle.stacks) s.retalLeft = retalMax(s);
  recomputeAuras(battle);
  return battle;
}

function placeObstacles(battle, seed) {
  const rng = mulberry32(seed ^ 0x9e3779b9);
  if (battle.siege) return;
  const n = 8 + Math.floor(rng() * 6);
  for (let i = 0; i < n * 3 && Object.keys(battle.obstacles).length < n; i++) {
    const c = 3 + Math.floor(rng() * (BCOLS - 6));
    const r = Math.floor(rng() * BROWS);
    const key = hk(c, r);
    if (battle.obstacles[key]) continue;
    battle.obstacles[key] = rng() < 0.5 ? "rock" : "tree";
  }
}

function placeWalls(battle) {
  const col = 10;
  for (let r = 0; r < BROWS; r++) {
    const key = hk(col, r);
    if (r === 5) {
      battle.obstacles[key] = "gate";
      battle.wallHp[key] = 320;
    } else {
      battle.obstacles[key] = "wall";
      battle.wallHp[key] = 420;
    }
    const moat = hk(col - 1, r);
    battle.obstacles[moat] = battle.obstacles[moat] || "moat";
  }
  const towers = battle.fortLevel >= 3 ? [[12, 0], [12, 10], [13, 5]] : battle.fortLevel >= 2 ? [[12, 0], [12, 10]] : [[12, 5]];
  const cr = CREATURES.tower;
  for (const [c, r] of towers) {
    const dmgBonus = battle.fortLevel >= 3 ? 4 : battle.fortLevel === 2 ? 2 : 0;
    battle.stacks.push({
      uid: battle.uidSeq++, side: "right", cr: "tower", count: 1, initCount: 1,
      topHp: cr.hp + battle.fortLevel * 30,
      c, r, shots: 99, retalLeft: 0, buffs: {}, defending: false, dead: false,
      machine: true, speedOverride: 10, slot: -1, towerBonus: dmgBonus,
    });
  }
}

export function deployZone(battle, side) {
  const extra = battle.tactics[side] || 0;
  if (side === "left") return { c0: 0, c1: Math.min(1 + extra, 6) };
  return { c0: Math.max(BCOLS - 2 - extra, 8), c1: BCOLS - 1 };
}

export function moveDeploy(battle, uid, c, r) {
  if (battle.phase !== "deploy") return { ok: false, error: "Расстановка закончена." };
  const s = stackByUid(battle, uid);
  if (!s || s.machine) return { ok: false, error: "Нельзя двигать." };
  const z = deployZone(battle, s.side);
  if (c < z.c0 || c > z.c1 || !inBounds(c, r)) return { ok: false, error: "Вне зоны." };
  const occ = unitAt(battle, c, r);
  if (occ && occ.uid !== uid) return { ok: false, error: "Занято." };
  const block = battle.obstacles[hk(c, r)];
  if (block === "wall" || block === "gate" || block === "rock" || block === "tree") return { ok: false, error: "Преграда." };
  s.c = c; s.r = r;
  return { ok: true };
}

export function startFight(battle) {
  battle.phase = "fight";
  battle.round = 1;
  if (battle.siege) catapult(battle, battle.log);
  buildQueue(battle);
  return prepareTurn(battle);
}

export function controllerOf(battle, stack) {
  if (!stack) return "ai";
  if (stack.buffs && stack.buffs.berserk) return "ai";
  if (stack.machine) return "ai";
  return battle.human[stack.side] ? "human" : "ai";
}

export function surrenderCost(battle, side) {
  let v = 0;
  for (const s of battle.stacks) {
    if (s.side !== side || s.machine) continue;
    const cr = CREATURES[s.cr];
    v += (cr.cost.gold || 50) * s.initCount;
  }
  return Math.max(500, Math.floor(v * 0.5));
}
