import { CREATURES, GAME_VERSION, SKIRMISH, calendar } from "./data.js";
import { scenarioById } from "./engine.js";
import {
  aiAct, beginTurn, buildStructure, buyMachine, buySpellbook, castAdventure, chooseLevel,
  concludeBattle, createGame, endTurn, engage, equipArtifact, findPath, heroAt, heroById,
  hireHero, learnTownSpell, makeSkirmish, maxMove, objectAt, recruit, recruitDwelling,
  resolveChoice, acceptDiplomacy, shopApply, splitArmy, stepHero, townAt, townById, trade,
  transferArmy, unequipArtifact, upgradeCreatures, moveArmy, deserialize, serialize,
} from "./engine.js";
import {
  act as battleAct, attackOptions, chooseAiAction, controllerOf, currentStack, moveDeploy, prepareTurn,
  reachable, startFight,
} from "./combat.js";
import {
  battleCamera, drawBattle, drawMap, drawMinimap, focusHex, preloadFactionArt, screenToHex, screenToTile, tileCenter,
} from "./render.js";
import * as ui from "./ui.js";
import * as saves from "./save.js";
import { ensureMusic } from "./music.js";

const app = document.getElementById("app");
const S = {
  screen: "menu",
  game: null,
  mode: "map",
  cam: { x: 0, y: 0, zoom: 1 },
  battleCam: null,
  selected: null,
  path: null,
  grid: true,
  followUid: null,
  seenWeek: 1,
  modal: null,
  busy: false,
  settings: loadSettings(),
  progress: loadProgress(),
  slots: [],
  aim: null,
  armFrom: null,
  floaters: [],
  particles: [],
  audio: null,
  loopOn: false,
  fx: {},
};
window.LK = S;

function loadSettings() {
  try { return JSON.parse(localStorage.getItem("lk-settings") || "{}"); } catch { return {}; }
}
function loadProgress() {
  try { return JSON.parse(localStorage.getItem("lk-progress") || "{\"done\":[]}"); } catch { return { done: [] }; }
}
function saveProgress() { localStorage.setItem("lk-progress", JSON.stringify(S.progress)); }

function toast(text) {
  if (!text) return;
  const wrap = document.getElementById("toasts");
  if (!wrap) return;
  const host = document.querySelector(".game");
  if (host && wrap.parentElement !== host) host.appendChild(wrap);
  while (wrap.children.length >= 2) wrap.firstChild.remove();
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = text;
  wrap.appendChild(el);
  setTimeout(() => el.remove(), 2600);
}

function beep(freq = 440, dur = 0.05, type = "sine", gain = 0.03) {
  if (S.settings.sound === false) return;
  try {
    const ctx = S.audio || (S.audio = new AudioContext());
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.value = gain;
    o.connect(g); g.connect(ctx.destination);
    o.start();
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
    o.stop(ctx.currentTime + dur);
  } catch { /* звук необязателен */ }
}

async function boot() {
  preloadFactionArt();
  S.slots = await saves.listSaves().catch(() => []);
  renderScreen();
  registerSW();
  if (!S.loopOn) {
    S.loopOn = true;
    requestAnimationFrame(frame);
  }
}

function renderScreen() {
  if (S.screen === "game" && S.game) {
    ensureShell();
    paintChrome();
    return;
  }
  const cont = S.slots.some((s) => s.slot === "auto");
  const html = {
    menu: ui.menuHTML({ continue: cont }),
    help: ui.helpHTML(),
    campaign: ui.campaignHTML(S.progress.done || []),
    skirmish: ui.skirmishHTML(),
    load: ui.loadHTML(S.slots),
    bestiary: ui.bestiaryHTML(),
    settings: ui.settingsHTML(S.settings),
    shop: ui.shopHTML(S.game),
  }[S.screen] || ui.menuHTML({ continue: cont });
  app.innerHTML = html;
}

function ensureShell() {
  if (document.getElementById("cv")) return;
  app.innerHTML = `<div class="game">
    <div class="topbar" id="topbar"></div>
    <div class="stage"><canvas id="cv"></canvas><canvas id="minimap" width="192" height="192"></canvas></div>
    <div class="dock" id="dock"></div>
    <div id="modal"></div>
  </div>`;
  bindPointer(document.getElementById("cv"));
  bindMinimap(document.getElementById("minimap"));
}

function human() {
  return S.game && (S.game.players.find((p) => p.control === "human") || S.game.players[S.game.current]);
}
function selectedHero() {
  const g = S.game;
  if (!g) return null;
  const h = S.selected && g.heroes.find((x) => x.id === S.selected && !x.lost);
  if (h && h.player === human().id) return h;
  return g.heroes.find((x) => !x.lost && x.player === human().id) || null;
}

function paintChrome() {
  if (!S.game || !document.getElementById("topbar")) return;
  document.getElementById("topbar").innerHTML = ui.topHTML(S.game);
  document.getElementById("dock").innerHTML = ui.dockHTML(S.game, selectedHero(), S.mode, { grid: S.grid !== false });
  const mm = document.getElementById("minimap");
  if (mm) mm.classList.toggle("hidden", S.mode === "battle" || S.mode === "deploy");
  const modal = document.getElementById("modal");
  modal.innerHTML = S.modal ? modalHTML(S.modal) : "";
  if (S.armFrom) {
    const btn = modal.querySelector(`[data-act="army"][data-which="${S.armFrom.which}"][data-i="${S.armFrom.i}"]`);
    if (btn) btn.classList.add("on");
  }
  bindRanges();
}

function bindRanges() {
  for (const id of ["rec-n", "dw-n"]) {
    const range = document.getElementById(id);
    const out = document.getElementById(id === "rec-n" ? "rec-out" : "dw-out");
    if (!range || !out || range.dataset.bound) continue;
    range.dataset.bound = "1";
    const paint = () => { out.textContent = range.value; };
    range.addEventListener("input", paint);
    paint();
  }
}

function bindMinimap(cv) {
  cv.addEventListener("pointerdown", (e) => {
    if (!S.game || S.mode === "battle" || S.mode === "deploy") return;
    const r = cv.getBoundingClientRect();
    const x = Math.max(0, Math.min(S.game.map.w - 1, Math.floor(((e.clientX - r.left) / r.width) * S.game.map.w)));
    const y = Math.max(0, Math.min(S.game.map.h - 1, Math.floor(((e.clientY - r.top) / r.height) * S.game.map.h)));
    const c = tileCenter(x, y);
    S.cam.x = c.x;
    S.cam.y = c.y;
  });
}

function modalHTML(m) {
  if (m.type === "town") return ui.townHTML(S.game, m.id);
  if (m.type === "hero") return ui.heroHTML(S.game, m.id);
  if (m.type === "spell") return ui.spellbookHTML(S.game, heroById(S.game, m.id));
  if (m.type === "system") return ui.systemHTML();
  if (m.type === "shop") return `<div class="modal-back"><div class="sheet" style="max-height:100%"><div class="body scroll">${ui.shopHTML(S.game)}</div></div></div>`;
  if (m.type === "save") return `<div class="modal-back"><div class="sheet"><div class="body scroll">${ui.saveHTML(S.slots)}</div></div></div>`;
  if (m.type === "load") return `<div class="modal-back"><div class="sheet"><div class="body scroll">${ui.loadHTML(S.slots)}</div></div></div>`;
  if (m.type === "level") return ui.levelHTML(heroById(S.game, m.id));
  if (m.type === "choice") return ui.choiceHTML(m.choice);
  if (m.type === "diplo") return ui.diploHTML(m.data);
  if (m.type === "dwell") return ui.dwellingHTML(S.game, heroById(S.game, m.heroId), m.obj);
  if (m.type === "trade") return ui.tradeHTML(S.game);
  if (m.type === "overview") return ui.overviewHTML(S.game);
  if (m.type === "end") return ui.endHTML(m.end);
  if (m.type === "brief") return ui.briefHTML(S.game);
  if (m.type === "split") return ui.splitHTML(m.id);
  if (m.type === "bspell") return ui.battleSpellsHTML(S.game);
  if (m.type === "portal") return ui.townPortalHTML(m.heroId, m.spellId, m.towns);
  if (m.type === "hall") return ui.hallHTML(S.game, m.town);
  if (m.type === "recruit") return ui.recruitHTML(S.game, m.town, m.building);
  if (m.type === "mage") return ui.mageTownHTML(S.game, m.town);
  if (m.type === "smith") return ui.smithHTML(S.game, m.town);
  if (m.type === "creature") return ui.creatureHTML(m.id);
  if (m.type === "event") return ui.eventHTML(m.title, m.text);
  if (m.type === "week") return ui.weekHTML(S.game);
  if (m.type === "heroes") return ui.heroesHTML(S.game);
  if (m.type === "towns") return ui.townsHTML(S.game);
  if (m.type === "blog") return ui.battleLogHTML(S.game.battle);
  if (m.type === "surrender") return ui.surrenderHTML(m.cost);
  if (m.type === "confirm-end") return `<div class="modal-back"><div class="sheet"><header class="sheeth"><h2>Завершить ход?</h2></header><div class="body stack"><p>У героини ещё есть запас хода.</p><button class="btn primary" data-act="end-turn-force">Завершить</button><button class="btn ghost" data-act="close-modal">Остаться</button></div></div></div>`;
  if (m.type === "settings") return `<div class="modal-back"><div class="sheet"><div class="body">${ui.settingsHTML(S.settings)}</div></div></div>`;
  return "";
}

function frame(t) {
  const cv = document.getElementById("cv");
  try {
  if (cv && S.game && S.screen === "game") {
    const rect = cv.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const bw = Math.max(1, Math.round(rect.width * dpr));
    const bh = Math.max(1, Math.round(rect.height * dpr));
    if (cv.width !== bw || cv.height !== bh) { cv.width = bw; cv.height = bh; }
    const ctx = cv.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const heroNow = selectedHero();
    const view = {
      cam: S.cam, w: rect.width, h: rect.height, time: t, playerId: human().id,
      path: S.path, selectedId: S.selected, floaters: S.floaters, particles: S.particles,
      moveLeft: heroNow && heroNow.movement, moveMax: heroNow && maxMove(heroNow),
      grid: S.grid !== false,
    };
    if ((S.mode === "battle" || S.mode === "deploy") && S.game.battle) {
      if (!S.battleCam) S.battleCam = battleCamera(rect.width, rect.height);
      const bcam = S.battleCam;
      const cur = S.game.battle && currentStack(S.game.battle);
      let reach = null;
      if (cur && controllerOf(S.game.battle, cur) === "human") {
        reach = reachable(S.game.battle, cur).dist;
      }
      drawBattle(ctx, S.game.battle, { ...view, cam: bcam, reach, currentUid: cur && cur.uid, fx: S.fx });
    } else {
      drawMap(ctx, S.game, view);
      const mm = document.getElementById("minimap");
      if (mm) drawMinimap(mm, S.game, human().id, S.cam, rect.width, rect.height);
    }
    const now = performance.now();
    for (const id of Object.keys(S.fx)) if (now - S.fx[id].t0 > 900) delete S.fx[id];
    for (const f of S.floaters) f.age += 0.02;
    S.floaters = S.floaters.filter((f) => f.age < 1);
    for (const p of S.particles) { p.x += p.vx; p.y += p.vy; p.life -= 0.02; }
    S.particles = S.particles.filter((p) => p.life > 0);
  }
  } catch (err) {
    if (!S._frameErr) { S._frameErr = true; console.error(err && err.stack ? err.stack : err); }
  }
  requestAnimationFrame(frame);
}

function bindPointer(cv) {
  const ptrs = new Map();
  let pan = null;
  let pinch = null;
  const rectOf = () => cv.getBoundingClientRect();
  cv.addEventListener("pointerdown", (e) => {
    cv.setPointerCapture(e.pointerId);
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (ptrs.size === 1) {
      const cam = (S.mode === "battle" || S.mode === "deploy") ? S.battleCam : S.cam;
      pan = { x: e.clientX, y: e.clientY, cx: cam.x, cy: cam.y, moved: false, zoom: cam.zoom };
    }
    if (ptrs.size === 2) {
      const [a, b] = [...ptrs.values()];
      const cam = (S.mode === "battle" || S.mode === "deploy") ? S.battleCam : S.cam;
      pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), z: cam.zoom };
    }
  });
  cv.addEventListener("pointermove", (e) => {
    if (!ptrs.has(e.pointerId)) return;
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const cam = (S.mode === "battle" || S.mode === "deploy") ? S.battleCam : S.cam;
    if (!cam) return;
    if (ptrs.size >= 2 && pinch) {
      const [a, b] = [...ptrs.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      cam.zoom = clamp(pinch.z * (d / pinch.d), 0.45, 2.4);
      return;
    }
    if (pan) {
      const dx = e.clientX - pan.x, dy = e.clientY - pan.y;
      if (Math.hypot(dx, dy) > 8) pan.moved = true;
      cam.x = pan.cx - dx / cam.zoom;
      cam.y = pan.cy - dy / cam.zoom;
    }
  });
  cv.addEventListener("pointerup", (e) => {
    const was = pan;
    ptrs.delete(e.pointerId);
    if (ptrs.size < 2) pinch = null;
    if (ptrs.size === 0) pan = null;
    if (was && !was.moved) onTap(e);
  });
  cv.addEventListener("pointercancel", (e) => { ptrs.delete(e.pointerId); pan = null; });
}

function onTap(e) {
  if (S.busy || !S.game) return;
  const cv = document.getElementById("cv");
  const r = cv.getBoundingClientRect();
  const x = e.clientX - r.left, y = e.clientY - r.top;
  if (S.mode === "battle") return battleTap(x, y, r.width, r.height);
  if (S.mode === "deploy") return deployTap(x, y, r.width, r.height);
  const tile = screenToTile(x, y, S.cam, r.width, r.height);
  if (!tile) return;
  mapTap(tile.x, tile.y);
}

function mapTap(x, y) {
  if (S.aimAdventure && S.game) {
    const a = S.aimAdventure;
    S.aimAdventure = null;
    const r = castAdventure(S.game, a.heroId, a.spellId, { x, y });
    toast(r.message || r.error);
    const h = heroById(S.game, a.heroId);
    if (h && r.ok) focus(h);
    paintChrome();
    return;
  }
  const g = S.game;
  const me = human();
  if (g.players[g.current].id !== me.id) { toast("Сейчас ход соперницы."); return; }
  const heroHere = heroAt(g, x, y);
  if (heroHere && heroHere.player === me.id) {
    S.selected = heroHere.id;
    S.path = null;
    paintChrome();
    beep(520, 0.04);
    return;
  }
  const town = townAt(g, x, y);
  const hero = selectedHero();
  if (!hero) { toast("Нет героини."); return; }
  if (town && town.owner === me.id && hero.x === town.x && hero.y === town.y) {
    S.modal = { type: "town", id: town.id };
    paintChrome();
    return;
  }
  const path = findPath(g, hero, x, y);
  if (!path) { toast("Сюда не пройти."); beep(180, 0.08, "square"); return; }
  S.path = path;
  paintChrome();
  walk(hero, path);
}

function showEvent(title, text) {
  return new Promise((resolve) => {
    S.modal = { type: "event", title, text };
    S._eventDone = resolve;
    paintChrome();
  });
}

async function walk(hero, path) {
  S.busy = true;
  const speed = S.settings.fast ? 40 : 110;
  let full = (path.full || path.tiles).slice();
  for (const step of path.tiles) {
    full = full.slice(1);
    S.path = { full, tiles: full };
    const r = stepHero(S.game, hero.id, step.x, step.y);
    focus(hero);
    await wait(speed);
    if (!r.ok) { toast(r.error); break; }
    if (r.openTown) { S.modal = { type: "town", id: r.openTown }; break; }
    if (r.siege) { engage(S.game, hero.id, { townId: r.siege }); break; }
    if (r.battle || S.game.battle) break;
    if (r.choose) { S.modal = { type: "choice", choice: r.choose }; break; }
    if (r.openDwelling) {
      const obj = objectAt(S.game, hero.x, hero.y);
      if (obj) S.modal = { type: "dwell", heroId: hero.id, obj };
      break;
    }
    if (r.diplomacy) { S.modal = { type: "diplo", data: r.diplomacy }; break; }
    if (r.message) toast(r.message);
    if (checkLevel(hero)) break;
  }
  if (path.attack && !S.game.battle && !S.modal) {
    const er = engage(S.game, hero.id, path.attack);
    if (er && er.diplomacy) S.modal = { type: "diplo", data: er.diplomacy };
    else if (er && er.error) toast(er.error);
  }
  S.path = null;
  S.busy = false;
  if (S.game.battle) await runBattle();
  afterAction();
}

function afterAction() {
  const end = S.game && (S.game.winner || S.game.loss);
  if (end) {
    const e = S.game.winner ? { win: true, text: "Знамя держится." } : { loss: true, text: "Двор пал." };
    // checkEnd already set text via conclude; keep modal if any
  }
  const hero = selectedHero();
  if (hero && hero.unspent && !S.modal) S.modal = { type: "level", id: hero.id };
  paintChrome();
  autosave();
}

function checkLevel(hero) {
  if (hero.unspent) { S.modal = { type: "level", id: hero.id }; return true; }
  return false;
}

function clearToasts() {
  const wrap = document.getElementById("toasts");
  if (wrap) wrap.replaceChildren();
}

async function runBattle() {
  const b = S.game.battle;
  if (!b) return;
  clearToasts();
  S.battleCam = null;
  S.followUid = null;
  if (b.phase === "deploy" && (b.human.left || b.human.right)) {
    S.mode = "deploy";
    paintChrome();
    return;
  }
  if (b.phase === "deploy") startFight(b);
  S.mode = "battle";
  paintChrome();
  await pump();
}

async function pump() {
  const b = S.game.battle;
  let guard = 0;
  while (b && !b.result && guard++ < 700) {
    const ev = prepareTurn(b);
    await showEvents(ev);
    if (b.result) break;
    const cur = currentStack(b);
    if (!cur) continue;
    if (controllerOf(b, cur) === "human" && !S.auto) {
      paintChrome();
      return;
    }
    const action = chooseAiAction(b);
    const res = battleAct(b, action);
    if (!res.ok) battleAct(b, { type: "defend", uid: cur.uid });
    else await showEvents(res.events);
  }
  if (b && b.result) await finishBattle();
}

async function humanBattle(action) {
  if (S.busy) return;
  const b = S.game.battle;
  const cur = currentStack(b);
  if (!cur || controllerOf(b, cur) !== "human") return;
  S.busy = true;
  const res = battleAct(b, action);
  S.busy = false;
  if (!res.ok) { toast(res.error); return; }
  beep(660, 0.04, "triangle");
  await showEvents(res.events);
  await pump();
}

function battleTap(x, y, w, h) {
  const b = S.game.battle;
  if (!b) return;
  const hex = screenToHex(x, y, { cam: S.battleCam, w, h });
  if (!hex) return;
  if (S.aim) return castAimed(hex);
  const cur = currentStack(b);
  if (!cur || controllerOf(b, cur) !== "human") return;
  const occ = b.stacks.find((s) => !s.dead && s.c === hex.c && s.r === hex.r);
  const opts = attackOptions(b, cur);
  if (occ && occ.uid !== cur.uid) {
    const ranged = opts.find((o) => o.kind === "ranged" && o.target === occ.uid);
    const melee = opts.find((o) => o.kind === "melee" && o.target === occ.uid);
    const pick = ranged || melee;
    if (!pick) { toast("Не достать."); return; }
    humanBattle({ type: "attack", uid: cur.uid, target: occ.uid, ranged: pick.kind === "ranged" });
    return;
  }
  const wall = opts.find((o) => o.kind === "wall" && o.wall === hex.c + "," + hex.r);
  if (wall) { humanBattle({ type: "attack", uid: cur.uid, wall: wall.wall }); return; }
  const reach = reachable(b, cur).dist;
  if (reach.has(hex.c + "," + hex.r)) humanBattle({ type: "move", uid: cur.uid, dest: hex });
}

function deployTap(x, y, w, h) {
  const b = S.game.battle;
  const hex = screenToHex(x, y, { cam: S.battleCam, w, h });
  if (!hex || !b) return;
  const occ = b.stacks.find((s) => !s.dead && s.c === hex.c && s.r === hex.r && !s.machine);
  if (S.deployUid && (!occ || occ.uid !== S.deployUid)) {
    const r = moveDeploy(b, S.deployUid, hex.c, hex.r);
    if (!r.ok) toast(r.error);
    S.deployUid = null;
    return;
  }
  if (occ) {
    const side = b.human.left ? "left" : "right";
    if (occ.side === side) S.deployUid = occ.uid;
  }
}

async function castAimed(hex) {
  const b = S.game.battle;
  const spell = S.aim;
  S.aim = null;
  const occ = b.stacks.find((s) => !s.dead && s.c === hex.c && s.r === hex.r);
  const side = b.human.right && !b.human.left ? "right" : "left";
  await humanBattle({ type: "spell", side, spellId: spell, target: occ && occ.uid, hex });
}

async function showEvents(events = []) {
  const b = S.game.battle;
  if (!b) return;
  const cv = document.getElementById("cv");
  const rect = cv ? cv.getBoundingClientRect() : { width: 300, height: 400 };
  for (const ev of events) {
    noteBattle(ev);
    if (ev.type === "hit" || ev.type === "spellHit" || ev.type === "retal" || ev.type === "breath") {
      if (ev.from) S.fx[ev.from] = { kind: "attack", t0: performance.now() };
      if (ev.to) S.fx[ev.to] = { kind: ev.died ? "die" : "hit", t0: performance.now() };
      if (ev.type === "spellHit") burst((rect.width || 200) / 2, (rect.height || 300) / 2, "#c4b5fd");
      const st = b.stacks.find((s) => s.uid === (ev.to || ev.uid));
      if (st && S.battleCam) {
        const p = hexCenterScreen(st.c, st.r, rect.width, rect.height);
        S.floaters.push({ x: p.x, y: p.y, text: "-" + (ev.dmg || ev.killed || ""), age: 0, color: ev.luck ? "#fde68a" : "#fff" });
        burst(p.x, p.y, ev.type === "spellHit" ? "#67e8f9" : "#fecaca");
      }
      beep(ev.type === "spellHit" ? 880 : 140, 0.05, "square", 0.02);
    }
    if (ev.type === "cast") burst(rect.width / 2, rect.height / 2, "#e9d5ff");
  }
  if (events.length) {
    const dock = document.getElementById("dock");
    if (dock) dock.innerHTML = ui.dockHTML(S.game, selectedHero(), S.mode, { grid: S.grid !== false });
    await wait(S.settings.fast ? 40 : 160);
  }
}

function noteBattle(ev) {
  const b = S.game && S.game.battle;
  if (!b) return;
  const name = (uid) => {
    const s = b.stacks.find((x) => x.uid === uid);
    return s ? CREATURES[s.cr].name : "отряд";
  };
  let line = "";
  if (ev.type === "hit" || ev.type === "retal" || ev.type === "breath") line = name(ev.from) + " бьёт " + name(ev.to) + ": " + (ev.dmg || 0) + (ev.killed ? " (−" + ev.killed + ")" : "");
  else if (ev.type === "shoot") line = name(ev.uid) + " стреляет.";
  else if (ev.type === "cast") line = "Произнесено заклинание.";
  else if (ev.type === "defend") line = name(ev.uid) + " встаёт в защиту.";
  else if (ev.type === "wait") line = name(ev.uid) + " ждёт.";
  else if (ev.type === "round") line = "Раунд " + ev.round + ".";
  else if (ev.type === "retreat") line = "Отступление.";
  else if (ev.type === "surrender") line = "Сдача.";
  else if (ev.type === "heal" || ev.type === "tent" || ev.type === "regen") line = name(ev.uid) + " восстанавливает силы.";
  else if (ev.type === "wall") line = "Удар по стене.";
  else if (ev.type === "catapult") line = ev.hit ? "Катапульта попала в стену." : "Катапульта промахнулась.";
  if (!line) return;
  b.log.push(line);
  if (b.log.length > 40) b.log.splice(0, b.log.length - 40);
}

function hexCenterScreen(c, r, w, h) {
  const cam = S.battleCam;
  const size = cam.size || 18;
  const x = size * Math.sqrt(3) * (c + 0.5 * (r & 1));
  const y = size * 1.5 * r;
  return { x: (x - cam.x) * cam.zoom + w / 2, y: (y - cam.y) * cam.zoom + h / 2 };
}
function burst(x, y, color) {
  for (let i = 0; i < 10; i++) {
    const a = Math.random() * Math.PI * 2;
    S.particles.push({ x, y, vx: Math.cos(a) * 1.4, vy: Math.sin(a) * 1.4, r: 2 + Math.random() * 2, life: 1, color });
  }
}

async function finishBattle() {
  const res = concludeBattle(S.game);
  S.mode = "map";
  S.auto = false;
  S.battleCam = null;
  for (const m of res.messages || []) toast(m);
  beep(523, 0.12, "triangle", 0.04);
  if (res.end) {
    if (res.end.win && S.game.campaign) {
      S.progress.done = Array.from(new Set([...(S.progress.done || []), S.game.scenarioId]));
      saveProgress();
    }
    S.modal = { type: "end", end: res.end };
  } else if (res.levelUp) S.modal = { type: "level", id: res.levelUp };
  paintChrome();
  autosave();
}

async function endPlayerTurn() {
  if (S.busy) return;
  const g = S.game;
  const me = human();
  if (g.players[g.current].id !== me.id) return;
  S.busy = true;
  const r = endTurn(g);
  toast(g.players[g.current].control === "human" ? "Ваш ход." : "Ход соперницы.");
  paintChrome();
  if (r.end) {
    S.modal = { type: "end", end: r.end };
    S.busy = false;
    paintChrome();
    return;
  }
  await runAI();
  S.busy = false;
  const cal = S.game && calendar(S.game.day);
  if (cal && cal.isWeekStart && S.game.day > 1 && S.seenWeek !== S.game.day && S.game.players[S.game.current].control === "human" && !S.modal) {
    S.seenWeek = S.game.day;
    S.modal = { type: "week" };
  }
  paintChrome();
  autosave();
}

async function runAI() {
  let guard = 0;
  while (guard++ < 500 && S.game && !S.game.winner && !S.game.loss) {
    const p = S.game.players[S.game.current];
    if (!p || p.control === "human" || p.eliminated) break;
    const a = aiAct(S.game);
    if (a.type === "end") {
      const r = endTurn(S.game);
      paintChrome();
      if (r.end) { S.modal = { type: "end", end: r.end }; break; }
      if (S.game.players[S.game.current].control === "human") break;
      continue;
    }
    if (a.type === "build") { buildStructure(S.game, a.townId, a.buildingId); continue; }
    if (a.type === "recruit") { recruit(S.game, a.townId, a.creatureId, a.count, a.dest); continue; }
    if (a.type === "path") {
      const hero = heroById(S.game, a.heroId);
      for (const step of a.tiles) {
        const r = stepHero(S.game, hero.id, step.x, step.y);
        if (!S.settings.fast) await wait(30);
        if (!r.ok) break;
        if (r.siege) { engage(S.game, hero.id, { townId: r.siege }); break; }
        if (S.game.battle) break;
      }
      if (a.attack && !S.game.battle) {
        const er = engage(S.game, hero.id, a.attack, { force: true });
        if (er && er.diplomacy) acceptDiplomacy(S.game, hero.id, er.diplomacy.objectId);
      }
      if (S.game.battle) await runBattle();
      continue;
    }
    if (a.type === "engage") {
      const er = engage(S.game, a.heroId, a.target);
      if (er && er.diplomacy) {
        const pl = S.game.players[heroById(S.game, a.heroId).player];
        if (pl.resources.gold >= er.diplomacy.gold) acceptDiplomacy(S.game, a.heroId, er.diplomacy.objectId);
        else engage(S.game, a.heroId, a.target, { force: true });
      }
      if (S.game.battle) await runBattle();
      continue;
    }
    break;
  }
}

function focus(hero) {
  const c = tileCenter(hero.x, hero.y);
  S.cam.x = c.x;
  S.cam.y = c.y;
}

function startGame(spec) {
  S.game = createGame(spec);
  S.screen = "game";
  S.mode = "map";
  S.modal = { type: "brief" };
  S.seenWeek = S.game.day;
  S.selected = S.game.heroes.find((h) => h.player === human().id && !h.lost)?.id || null;
  S.cam = { x: 0, y: 0, zoom: 1.5 };
  const h = selectedHero();
  if (h) focus(h);
  renderScreen();
  beep(392, 0.08);
}

async function autosave() {
  if (!S.game || S.game.battle) return;
  const title = S.game.name;
  await saves.writeSave("auto", { title, day: S.game.day, scenarioId: S.game.scenarioId, data: serialize(S.game) });
}

async function onAct(actName, el) {
  const g = S.game;
  try {
    if (actName === "campaign") { S.screen = "campaign"; renderScreen(); return; }
    if (actName === "shop-menu") { S.screen = "shop"; renderScreen(); return; }
    if (actName === "skirmish") { S.screen = "skirmish"; renderScreen(); return; }
    if (actName === "load" || actName === "open-load-game") {
      S.slots = await saves.listSaves();
      if (actName === "load") { S.screen = "load"; renderScreen(); }
      else { S.modal = { type: "load" }; paintChrome(); }
      return;
    }
    if (actName === "bestiary") { S.screen = "bestiary"; renderScreen(); return; }
    if (actName === "help") { S.screen = "help"; renderScreen(); return; }
    if (actName === "settings" || actName === "open-settings-game") {
      if (S.screen === "game") { S.modal = { type: "settings" }; paintChrome(); }
      else { S.screen = "settings"; renderScreen(); }
      return;
    }
    if (actName === "back") { S.screen = "menu"; renderScreen(); return; }
    if (actName === "close-modal" || actName === "modal-back") {
      const done = S._eventDone;
      S._eventDone = null;
      if (actName === "modal-back" && S.modal && S.modal.prev) S.modal = S.modal.prev;
      else S.modal = null;
      S.aim = null;
      if (done) done();
      if (S.screen !== "game") { S.screen = "menu"; renderScreen(); return; }
      paintChrome();
      return;
    }
    if (actName === "continue") { await loadSlot("auto"); return; }
    if (actName === "start-camp") {
      const sc = scenarioById(el.dataset.id);
      startGame(JSON.parse(JSON.stringify(sc)));
      return;
    }
    if (actName === "start-skirmish") {
      const map = SKIRMISH.find((m) => m.id === document.getElementById("sk-map").value);
      startGame(makeSkirmish({
        map,
        faction: document.getElementById("sk-fac").value,
        role: document.getElementById("sk-role").value,
        difficulty: document.getElementById("sk-diff").value,
      }));
      return;
    }
    if (actName === "save-settings") {
      S.settings.sound = document.getElementById("set-sound").value !== "off";
      S.settings.fast = document.getElementById("set-fast").value === "1";
      localStorage.setItem("lk-settings", JSON.stringify(S.settings));
      toast("Настройки записаны.");
      return;
    }
    if (actName === "load-slot") { await loadSlot(el.dataset.id); return; }
    if (actName === "del-slot") {
      await saves.deleteSave(el.dataset.id);
      S.slots = await saves.listSaves();
      renderScreen();
      return;
    }
    if (!g) return;
    if (actName === "end-turn") {
      const hero = selectedHero();
      if (hero && hero.movement > 250 && !S.forceEnd) {
        S.modal = { type: "confirm-end" };
        paintChrome();
        return;
      }
      S.forceEnd = false;
      S.modal = null;
      await endPlayerTurn();
      return;
    }
    if (actName === "end-turn-force") { S.forceEnd = true; S.modal = null; await endPlayerTurn(); return; }
    if (actName === "next-hero") {
      const list = g.heroes.filter((h) => h.player === human().id && !h.lost);
      if (!list.length) return;
      const i = Math.max(0, list.findIndex((h) => h.id === S.selected));
      const n = list[(i + 1) % list.length];
      S.selected = n.id;
      focus(n);
      if (S.modal && S.modal.type === "hero") S.modal = { type: "hero", id: n.id };
      paintChrome();
      return;
    }
    if (actName === "open-hero") {
      const h = selectedHero();
      if (h) { S.modal = { type: "hero", id: h.id }; paintChrome(); }
      return;
    }
    if (actName === "open-town") {
      const h = selectedHero();
      const towns = g.towns.filter((t) => t.owner === human().id);
      let town = h && towns.find((t) => t.x === h.x && t.y === h.y);
      if (!town) town = towns[0];
      if (!town) { toast("Нет города."); return; }
      S.modal = { type: "town", id: town.id };
      paintChrome();
      return;
    }
    if (actName === "open-spell") {
      const h = selectedHero();
      if (!h) return;
      S.modal = { type: "spell", id: h.id };
      paintChrome();
      return;
    }
    if (actName === "open-shop") { S.modal = { type: "shop" }; paintChrome(); return; }
    if (actName === "dismiss-coach") { localStorage.setItem("lk-coach", "1"); paintChrome(); return; }
    if (actName === "open-system") { S.modal = { type: "system" }; paintChrome(); return; }
    if (actName === "open-overview") { S.modal = { type: "overview" }; paintChrome(); return; }
    if (actName === "open-save") { S.slots = await saves.listSaves(); S.modal = { type: "save" }; paintChrome(); return; }
    if (actName === "to-menu") { S.screen = "menu"; S.modal = null; S.mode = "map"; S.slots = await saves.listSaves(); renderScreen(); return; }
    if (actName === "write-slot") {
      await saves.writeSave(el.dataset.id, { title: g.name, day: g.day, scenarioId: g.scenarioId, data: serialize(g) });
      toast("Записано в слот " + el.dataset.id);
      S.slots = await saves.listSaves();
      paintChrome();
      return;
    }
    if (actName === "open-heroes") { S.modal = { type: "heroes" }; paintChrome(); return; }
    if (actName === "open-towns") { S.modal = { type: "towns" }; paintChrome(); return; }
    if (actName === "pick-hero") {
      const h = g.heroes.find((x) => String(x.id) === el.dataset.id);
      if (h) { S.selected = h.id; focus(h); S.modal = { type: "hero", id: h.id }; }
      paintChrome();
      return;
    }
    if (actName === "open-hall") { S.modal = { type: "hall", town: el.dataset.town }; paintChrome(); return; }
    if (actName === "back-town") { S.modal = { type: "town", id: el.dataset.town }; paintChrome(); return; }
    if (actName === "town-hit") {
      const id = el.dataset.id;
      const town = el.dataset.town;
      if (id === "tavern") {
        const r = hireHero(g, town);
        toast(r.message || r.error);
        S.modal = { type: "town", id: town };
      } else if (id === "market") S.modal = { type: "trade" };
      else if (id === "blacksmith") S.modal = { type: "smith", town };
      else if (String(id).startsWith("mage")) S.modal = { type: "mage", town };
      else if (String(id).startsWith("dw") || String(id).startsWith("up")) S.modal = { type: "recruit", town, building: id };
      else S.modal = { type: "hall", town };
      paintChrome();
      return;
    }
    if (actName === "creature") {
      S.modal = { type: "creature", id: el.dataset.id, prev: S.modal };
      paintChrome();
      return;
    }
    if (actName === "recruit-max" || actName === "recruit-go") {
      const n = actName === "recruit-max"
        ? (Number(el.dataset.n) || 1)
        : (Number((document.getElementById("rec-n") || {}).value) || 1);
      let r = recruit(g, el.dataset.town, el.dataset.cr, n, "hero");
      if (!r.ok) r = recruit(g, el.dataset.town, el.dataset.cr, n, "garrison");
      toast(r.message || r.error);
      S.modal = { type: "town", id: el.dataset.town };
      paintChrome();
      return;
    }
    if (actName === "battle-grid") { S.grid = !(S.grid !== false); paintChrome(); return; }
    if (actName === "battle-log") { S.modal = { type: "blog" }; paintChrome(); return; }
    if (actName === "battle-surrender") {
      S.modal = { type: "surrender", cost: Number(el.dataset.cost) || 0 };
      paintChrome();
      return;
    }
    if (actName === "battle-surrender-yes") {
      S.modal = null;
      const c = g.battle && currentStack(g.battle);
      humanBattle({ type: "surrender", uid: c && c.uid });
      return;
    }
    if (actName === "build") {
      const r = buildStructure(g, el.dataset.town, el.dataset.id);
      toast(r.message || r.error);
      paintChrome();
      return;
    }
    if (actName === "recruit") {
      const n = Number(el.dataset.n) || 1;
      const r = recruit(g, el.dataset.town, el.dataset.cr, n, "hero");
      if (!r.ok) {
        const r2 = recruit(g, el.dataset.town, el.dataset.cr, n, "garrison");
        toast(r2.message || r2.error || r.error);
      } else toast(r.message);
      paintChrome();
      return;
    }
    if (actName === "hire") { const r = hireHero(g, el.dataset.town); toast(r.message || r.error); paintChrome(); return; }
    if (actName === "buy-book") { const r = buySpellbook(g, el.dataset.town, el.dataset.hero); toast(r.message || r.error); paintChrome(); return; }
    if (actName === "buy-machine") { const r = buyMachine(g, el.dataset.town, el.dataset.hero, el.dataset.id); toast(r.message || r.error); paintChrome(); return; }
    if (actName === "learn-spell") {
      const visitor = g.heroes.find((h) => !h.lost && h.x === townById(g, el.dataset.town).x && h.y === townById(g, el.dataset.town).y);
      if (!visitor) { toast("Героиня должна стоять в городе."); return; }
      const r = learnTownSpell(g, el.dataset.town, visitor.id, el.dataset.spell);
      toast(r.message || r.error);
      paintChrome();
      return;
    }
    if (actName === "open-trade") { S.modal = { type: "trade" }; paintChrome(); return; }
    if (actName === "trade") {
      const res = document.getElementById("tr-res").value;
      const n = Number(document.getElementById("tr-n").value) || 1;
      const r = el.dataset.dir === "buy" ? trade(g, human().id, "gold", res, n) : trade(g, human().id, res, "gold", n);
      toast(r.ok ? "Сделка состоялась." : r.error);
      paintChrome();
      return;
    }
    if (actName === "army") {
      const which = el.dataset.which;
      const i = Number(el.dataset.i);
      if (S.armFrom && S.armFrom.which === which && S.armFrom.i === i) {
        const sl = (armyOf(which) || [])[i];
        S.armFrom = null;
        if (sl) S.modal = { type: "creature", id: sl.id, prev: S.modal };
        paintChrome();
        return;
      }
      if (!S.armFrom) { S.armFrom = { which, i }; toast("Слот выбран. Другой слот — перенос, тот же — сведения."); paintChrome(); return; }
      const A = armyOf(S.armFrom.which);
      const B = armyOf(which);
      if (A && B) {
        if (A === B) moveArmy(A, S.armFrom.i, i);
        else transferArmy(A, S.armFrom.i, B, i);
      }
      S.armFrom = null;
      paintChrome();
      return;
    }
    if (actName === "split-ask") { S.modal = { type: "split", id: el.dataset.hero }; paintChrome(); return; }
    if (actName === "split-do") {
      const hero = heroById(g, el.dataset.hero);
      const idx = S.armFrom && S.armFrom.which === "hero:" + hero.id ? S.armFrom.i : hero.army.findIndex(Boolean);
      const n = Number(document.getElementById("split-n").value) || 1;
      const r = splitArmy(hero.army, idx, n);
      toast(r.ok ? "Отряд разделён." : r.error);
      S.modal = { type: "hero", id: hero.id };
      paintChrome();
      return;
    }
    if (actName === "equip") {
      const hero = heroById(g, el.dataset.hero);
      const r = equipArtifact(hero, Number(el.dataset.i));
      toast(r.ok ? "Надето." : (r.error || "Не вышло."));
      paintChrome();
      return;
    }
    if (actName === "unequip") {
      const hero = heroById(g, el.dataset.hero);
      unequipArtifact(hero, el.dataset.slot);
      paintChrome();
      return;
    }
    if (actName === "cast-adv") {
      const r = castAdventure(g, el.dataset.hero, el.dataset.spell, null);
      if (r.needTown) { S.modal = { type: "portal", heroId: el.dataset.hero, spellId: el.dataset.spell, towns: r.needTown }; paintChrome(); return; }
      if (r.ok && (el.dataset.spell === "dd" || el.dataset.spell === "vision")) {
        S.aimAdventure = { heroId: el.dataset.hero, spellId: el.dataset.spell };
        S.modal = null;
        toast(el.dataset.spell === "dd" ? "Коснитесь клетки прыжка." : "Коснитесь клетки.");
        paintChrome();
        return;
      }
      toast(r.message || r.error);
      if (r.ok) { const h = heroById(g, el.dataset.hero); focus(h); }
      paintChrome();
      return;
    }
    if (actName === "cast-portal") {
      const r = castAdventure(g, el.dataset.hero, el.dataset.spell, { townId: el.dataset.town });
      toast(r.message || r.error);
      S.modal = null;
      const h = heroById(g, el.dataset.hero);
      if (h) focus(h);
      paintChrome();
      return;
    }
    if (actName === "level") {
      const r = chooseLevel(g, el.dataset.hero, el.dataset.id);
      if (r.more) S.modal = { type: "level", id: el.dataset.hero };
      else S.modal = null;
      paintChrome();
      return;
    }
    if (actName === "resolve") {
      const h = selectedHero();
      const r = resolveChoice(g, h.id, el.dataset.obj, el.dataset.id);
      toast(r.message || r.error);
      S.modal = null;
      paintChrome();
      return;
    }
    if (actName === "diplo-yes") {
      const r = acceptDiplomacy(g, el.dataset.hero, el.dataset.obj);
      toast(r.message || r.error);
      S.modal = null;
      paintChrome();
      return;
    }
    if (actName === "diplo-no") {
      S.modal = null;
      engage(g, el.dataset.hero, { objectId: el.dataset.obj }, { force: true });
      paintChrome();
      if (g.battle) await runBattle();
      return;
    }
    if (actName === "dwell-buy") {
      const n = Number(document.getElementById("dw-n").value) || 1;
      const r = recruitDwelling(g, el.dataset.hero, el.dataset.obj, n);
      toast(r.message || r.error);
      paintChrome();
      return;
    }
    if (actName === "focus-hero") {
      S.selected = Number(el.dataset.id) || el.dataset.id;
      // ids are numbers
      S.selected = g.heroes.find((h) => String(h.id) === el.dataset.id)?.id;
      const h = heroById(g, S.selected);
      if (h) focus(h);
      S.modal = null;
      paintChrome();
      return;
    }
    if (actName === "focus-town") {
      const t = townById(g, el.dataset.id);
      if (t) { const c = tileCenter(t.x, t.y); S.cam.x = c.x; S.cam.y = c.y; }
      S.modal = { type: "town", id: t.id };
      paintChrome();
      return;
    }
    if (actName === "battle-start") {
      const ev = startFight(g.battle);
      S.mode = "battle";
      await showEvents(ev);
      await pump();
      return;
    }
    if (actName === "battle-wait") { const c = currentStack(g.battle); if (c) humanBattle({ type: "wait", uid: c.uid }); return; }
    if (actName === "battle-defend") { const c = currentStack(g.battle); if (c) humanBattle({ type: "defend", uid: c.uid }); return; }
    if (actName === "battle-retreat") {
      const b = g.battle;
      if (!b) return;
      if (b.phase !== "fight") {
        const side = b.human.right && !b.human.left ? "right" : "left";
        b.result = { winner: side === "left" ? "right" : "left", retreat: true, side };
        await finishBattle();
        return;
      }
      const c = currentStack(b);
      humanBattle({ type: "retreat", uid: c && c.uid });
      return;
    }
    if (actName === "battle-auto") {
      S.auto = true;
      if (g.battle.phase === "deploy") startFight(g.battle);
      S.mode = "battle";
      g.battle.spellAi.left = true;
      g.battle.human.left = false;
      await pump();
      return;
    }
    if (actName === "battle-spell") { S.modal = { type: "bspell" }; paintChrome(); return; }
    if (actName === "aim-spell") {
      S.aim = el.dataset.spell;
      S.modal = null;
      toast("Коснитесь цели.");
      paintChrome();
      return;
    }
    if (actName === "shop-pack") {
      const { SHOP_PACKS } = await import("./data.js");
      const pk = SHOP_PACKS.find((p) => p.id === el.dataset.id);
      const r = shopApply(g, { kind: "res", res: pk.res });
      toast(r.message || r.error);
      paintChrome();
      return;
    }
    if (actName === "shop-refresh") { toast(shopApply(g, { kind: "refresh", heroId: shopHero() }).message); paintChrome(); return; }
    if (actName === "shop-stats") { toast(shopApply(g, { kind: "stats", heroId: shopHero() }).message); paintChrome(); return; }
    if (actName === "shop-level") {
      const r = shopApply(g, { kind: "level", heroId: shopHero() });
      toast(r.message);
      const h = heroById(g, shopHero());
      if (h && h.unspent) S.modal = { type: "level", id: h.id };
      paintChrome();
      return;
    }
    if (actName === "shop-troops") {
      const r = shopApply(g, { kind: "troops", heroId: shopHero(), creatureId: document.getElementById("shop-cr").value, count: Number(document.getElementById("shop-n").value) || 1 });
      toast(r.message || r.error); paintChrome(); return;
    }
    if (actName === "shop-art") {
      const r = shopApply(g, { kind: "artifact", heroId: shopHero(), artifactId: document.getElementById("shop-art").value });
      toast(r.message || r.error); paintChrome(); return;
    }
    if (actName === "shop-spell") {
      const r = shopApply(g, { kind: "spell", heroId: shopHero(), spellId: document.getElementById("shop-sp").value });
      toast(r.message || r.error); paintChrome(); return;
    }
    if (actName === "shop-reveal") { toast(shopApply(g, { kind: "reveal" }).message); paintChrome(); return; }
    if (actName === "shop-build") {
      const r = shopApply(g, { kind: "build", townId: document.getElementById("shop-town").value, buildingId: document.getElementById("shop-bld").value });
      toast(r.message || r.error); paintChrome(); return;
    }
  } catch (err) {
    console.error(err);
    toast("Сбой: " + err.message);
    S.busy = false;
  }
}

function shopHero() {
  const el = document.getElementById("shop-hero");
  if (el && el.value) return Number(el.value);
  const h = selectedHero();
  return h && h.id;
}
function armyOf(which) {
  if (which === "garrison") {
    const t = S.game.towns.find((tn) => tn.owner === human().id && S.modal && S.modal.type === "town" && tn.id === S.modal.id) || S.game.towns.find((tn) => tn.owner === human().id);
    return t && t.garrison;
  }
  if (which.startsWith("hero:")) return heroById(S.game, which.slice(5)).army;
  return null;
}

async function loadSlot(id) {
  const rec = await saves.readSave(id);
  if (!rec || !rec.data) { toast("Слот пуст."); return; }
  S.game = deserialize(rec.data);
  S.seenWeek = S.game.day;
  S.screen = "game";
  S.mode = S.game.battle ? "battle" : "map";
  S.modal = null;
  S.selected = selectedHero() && selectedHero().id;
  const h = selectedHero();
  if (h) focus(h);
  renderScreen();
  toast("Партия открыта.");
}

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function wait(ms) { return new Promise((r) => setTimeout(r, ms)); }

document.body.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-act]");
  if (!btn) return;
  beep(700, 0.02, "sine", 0.02);
  onAct(btn.dataset.act, btn);
});

document.body.addEventListener("pointerdown", () => {
  if (S.audio && S.audio.state === "suspended") S.audio.resume();
  ensureMusic(S.settings.sound !== false);
}, { once: false });

function registerSW() {
  if (!("serviceWorker" in navigator)) return;
  window.addEventListener("load", async () => {
    try {
      const reg = await navigator.serviceWorker.register("./sw.js");
      reg.addEventListener("updatefound", () => {
        const nw = reg.installing;
        if (!nw) return;
        nw.addEventListener("statechange", () => {
          if (nw.state === "installed" && navigator.serviceWorker.controller) showUpdate(reg);
        });
      });
      if (reg.waiting && navigator.serviceWorker.controller) showUpdate(reg);
      let hadController = !!navigator.serviceWorker.controller;
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (!hadController) { hadController = true; return; }
        if (S.reloading || sessionStorage.getItem("lk-reloaded")) return;
        S.reloading = true;
        sessionStorage.setItem("lk-reloaded", "1");
        location.reload();
      });
      const res = await fetch("./version.json", { cache: "no-store" });
      const v = await res.json();
      if (v.version && v.version !== GAME_VERSION) showUpdate(reg);
    } catch { /* офлайн */ }
  });
}
function showUpdate(reg) {
  if (document.getElementById("upd")) return;
  const el = document.createElement("div");
  el.id = "upd";
  el.className = "banner";
  el.innerHTML = `<div class="card"><b>Есть обновление</b><p class="muted">Новая версия лаковых королевств готова.</p><button class="btn primary" id="upd-btn">Обновить</button></div>`;
  document.body.appendChild(el);
  document.getElementById("upd-btn").onclick = () => {
    const w = reg && (reg.waiting || (reg.installing));
    if (w) w.postMessage({ type: "SKIP_WAITING" });
    else location.reload();
  };
}

boot();
