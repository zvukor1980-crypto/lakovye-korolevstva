/** Разметка экранов. Вся речь интерфейса — по-русски. */

import {
  ARTIFACTS, CREATURES, FACTIONS, RES_KEYS, RES_NAME, ROSTER, SCENARIOS, SHOP_PACKS,
  SKILL_RANK, SKILLS, SKIRMISH, SPELLS, SLOTS, TRADE, buildingDef, calendar,
  portraitFor, tiersOf, wisdomCap, xpForLevel,
} from "./data.js";
import { costStr } from "./util.js";
import { MACHINES } from "./data.js";
import {
  availableBuildings, effective, heroById, maxMana, maxMove, playerById, skillLv, townById,
} from "./engine.js";
import { attackOptions, currentStack, spellManaCost, surrenderCost } from "./combat.js";

export function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function gem(color) {
  return `<svg class="ico" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M8 1.2 14 8 8 14.8 2 8Z" fill="${color}" stroke="rgba(255,255,255,.7)" stroke-width=".6"/></svg>`;
}
const GEMS = {
  gold: gem("#f5d76a"),
  lacquer: gem("#e11d48"),
  resin: gem("#d97706"),
  pigment: gem("#e879f9"),
  amber: gem("#fbbf24"),
  crystal: gem("#67e8f9"),
  pearl: gem("#f8fafc"),
};

export function menuHTML(opts) {
  return `<div class="screen menu-lux">
    <div class="menu-crest">
      <h1>Лаковые<br>королевства</h1>
    </div>
    <div class="menu-actions lux">
      ${opts.continue ? `<button class="btn lux" data-act="continue">Продолжить</button>` : ""}
      <button class="btn lux" data-act="campaign">Кампания</button>
      <button class="btn lux" data-act="skirmish">Схватка</button>
      <button class="btn lux" data-act="load">Загрузить</button>
      <button class="btn lux" data-act="shop-menu">Лавка</button>
      <button class="btn lux" data-act="settings">Настройки</button>
      <div class="row">
        <button class="btn small ghost" data-act="bestiary">Бестиарий</button>
        <button class="btn small ghost" data-act="help">Как играть</button>
      </div>
    </div>
  </div>`;
}

export function helpHTML() {
  return sheet("Как играть", `
    <p class="help"><b>Карта.</b> Коснитесь клетки — героиня пойдёт. Перетаскивайте, чтобы двигать обзор, сведите два пальца, чтобы приблизить. Леса, реки, горы и вода замедляют или закрывают путь. Броды и дороги проходимы.</p>
    <p class="help"><b>Города.</b> Один дом в день. Жилища дают прирост по понедельникам, ратуша поднимает доход, укрепление ставит стены.</p>
    <p class="help"><b>Героини.</b> Атака, защита, сила магии и знание. При уровне выбирайте вторичный навык. Артефакты — в слоты. Книга заклинаний тратит ману, без отката, только мана.</p>
    <p class="help"><b>Бой.</b> Гексы, инициатива по скорости, стрельба, ответный удар, мораль и удача, преграды и заклинания. Кнопка «Авто» посчитает бой до конца.</p>
    <p class="help"><b>Лавка.</b> Внутри партии лавка отдаёт ресурсы, отряды и артефакты без лимита и без таймеров.</p>
    <button class="btn" data-act="back">Назад</button>`);
}

export function campaignHTML(done) {
  const items = SCENARIOS.map((sc, i) => {
    const open = i === 0 || done.includes(SCENARIOS[i - 1].id);
    const mark = done.includes(sc.id) ? " · пройдено" : "";
    return `<div class="list-item ${open ? "" : "lock"}">
      <div style="flex:1">
        <b>${esc(sc.name)}</b>${mark}
        <div class="muted">${esc(sc.briefing.slice(0, 110))}…</div>
      </div>
      <button class="btn small" data-act="start-camp" data-id="${esc(sc.id)}" ${open ? "" : "disabled"}>В путь</button>
    </div>`;
  }).join("");
  return sheet("Кампания", items + `<button class="btn ghost" data-act="back">Назад</button>`);
}

export function skirmishHTML() {
  const maps = SKIRMISH.map((m) => `<option value="${m.id}">${esc(m.name)} — ${m.w}×${m.h}, ${m.players} знамени</option>`).join("");
  const facs = Object.values(FACTIONS).map((f) => `<option value="${f.id}">${esc(f.name)}</option>`).join("");
  return sheet("Стычка", `
    <label class="field">Карта<select id="sk-map">${maps}</select></label>
    <label class="field">Ваш двор<select id="sk-fac">${facs}</select></label>
    <label class="field">Путь<select id="sk-role"><option value="might">Сила</option><option value="magic">Магия</option></select></label>
    <label class="field">Сложность соперниц<select id="sk-diff"><option value="easy">Мягкая</option><option value="normal" selected>Обычная</option><option value="hard">Жёсткая</option></select></label>
    <p class="float-note">Семена карты каждый раз новые. Победа — погасить все чужие знамёна.</p>
    <button class="btn primary" data-act="start-skirmish">Начать</button>
    <button class="btn ghost" data-act="back">Назад</button>`);
}

export function loadHTML(slots) {
  const rows = ["auto", "1", "2", "3", "4", "5", "6", "7", "8"].map((id) => {
    const s = slots.find((x) => String(x.slot) === id);
    const title = s ? `${esc(s.title)} · день ${s.day}` : "пусто";
    return `<div class="list-item">
      <div style="flex:1"><b>${id === "auto" ? "Авто" : "Слот " + id}</b><div class="muted">${title}</div></div>
      <button class="btn small" data-act="load-slot" data-id="${id}" ${s ? "" : "disabled"}>Открыть</button>
      <button class="btn small ghost" data-act="del-slot" data-id="${id}" ${s ? "" : "disabled"}>Стереть</button>
    </div>`;
  }).join("");
  return sheet("Загрузка", rows + `<button class="btn ghost" data-act="back">Назад</button>`);
}

export function saveHTML(slots) {
  const rows = ["1", "2", "3", "4", "5", "6", "7", "8"].map((id) => {
    const s = slots.find((x) => String(x.slot) === id);
    return `<div class="list-item">
      <div style="flex:1"><b>Слот ${id}</b><div class="muted">${s ? esc(s.title) + " · день " + s.day : "пусто"}</div></div>
      <button class="btn small primary" data-act="write-slot" data-id="${id}">Записать</button>
    </div>`;
  }).join("");
  return sheet("Сохранение", `<p class="float-note">Автосохранение пишется в конце хода и после боя.</p>` + rows + `<button class="btn ghost" data-act="close-modal">Закрыть</button>`);
}

export function bestiaryHTML() {
  const blocks = ["scarlet", "emerald", "onyx"].map((fid) => {
    const f = FACTIONS[fid];
    const units = tiersOf(fid).map((b) => {
      const up = CREATURES[b.levelUpTo];
      return `<div class="list-item">
        <img src="${portraitFor(b.id)}" alt="">
        <div><b>${esc(b.name)}</b> → ${esc(up.name)}<div class="muted">ранг ${b.tier} · ${b.atk}/${b.def} · урон ${b.min}–${b.max} · жизнь ${b.hp} · ход ${b.spd}${b.ranged ? " · стрельба" : ""}${b.flying ? " · полёт" : ""}</div></div>
      </div>`;
    }).join("");
    return `<h3 style="color:${f.color}">${esc(f.name)}</h3><p class="muted">${esc(f.blurb)}</p>${units}`;
  }).join("");
  return sheet("Бестиарий", blocks + `<button class="btn ghost" data-act="back">Назад</button>`);
}

export function settingsHTML(st) {
  return sheet("Настройки", `
    <label class="field">Звук<select id="set-sound"><option value="on" ${st.sound !== false ? "selected" : ""}>Включён</option><option value="off" ${st.sound === false ? "selected" : ""}>Выключен</option></select></label>
    <label class="field">Анимация<select id="set-fast"><option value="0" ${!st.fast ? "selected" : ""}>Плавная</option><option value="1" ${st.fast ? "selected" : ""}>Быстрая</option></select></label>
    <button class="btn" data-act="save-settings">Запомнить</button>
    <button class="btn ghost" data-act="back">Назад</button>`);
}

export function shopHTML(game) {
  if (!game) {
    return sheet("Лавка двора", `<p class="help">Лавка открывается в партии: ресурсы, отряды, артефакты и свитки без ограничений, таймеров и платы.</p><button class="btn ghost" data-act="back">Назад</button>`);
  }
  const p = game.players.find((pl) => pl.control === "human") || game.players[game.current];
  const heroes = game.heroes.filter((h) => h.player === p.id && !h.lost);
  const heroOpts = heroes.map((h) => `<option value="${h.id}">${esc(h.name)}</option>`).join("");
  const crs = Object.values(CREATURES).filter((c) => c.growth || c.tier).map((c) => `<option value="${c.id}">${esc(c.name)}</option>`).join("");
  const arts = Object.values(ARTIFACTS).map((a) => `<option value="${a.id}">${esc(a.name)}</option>`).join("");
  const spells = Object.values(SPELLS).map((s) => `<option value="${s.id}">${esc(s.name)}</option>`).join("");
  const towns = game.towns.filter((t) => t.owner === p.id);
  const townOpts = towns.map((t) => `<option value="${t.id}">${esc(t.name)}</option>`).join("");
  const bopts = towns[0] ? availableBuildings(game, towns[0]).map((b) => `<option value="${b.id}">${esc(b.name)}</option>`).join("") : "";
  const packs = SHOP_PACKS.map((pk) => `<button class="btn small" data-act="shop-pack" data-id="${pk.id}">${esc(pk.name)}<div class="float-note">${esc(pk.desc)}</div></button>`).join("");
  return sheet("Лавка двора", `
    <p class="kicker">Бесплатно · без ограничений · без отката</p>
    <div class="stack">${packs}</div>
    <hr class="sep">
    <label class="field">Героиня<select id="shop-hero">${heroOpts}</select></label>
    <div class="row">
      <button class="btn small" data-act="shop-refresh">Полный ход и мана</button>
      <button class="btn small" data-act="shop-stats">+1 ко всем</button>
      <button class="btn small" data-act="shop-level">Уровень</button>
    </div>
    <label class="field">Отряд<select id="shop-cr">${crs}</select></label>
    <label class="field">Число<input id="shop-n" type="number" min="1" value="20"></label>
    <button class="btn" data-act="shop-troops">Зачислить отряд</button>
    <label class="field">Артефакт<select id="shop-art">${arts}</select></label>
    <button class="btn" data-act="shop-art">Положить в сумку</button>
    <label class="field">Заклинание<select id="shop-sp">${spells}</select></label>
    <button class="btn" data-act="shop-spell">Вписать в книгу</button>
    <button class="btn" data-act="shop-reveal">Открыть карту</button>
    <label class="field">Город<select id="shop-town">${townOpts}</select></label>
    <label class="field">Строение<select id="shop-bld">${bopts}</select></label>
    <button class="btn" data-act="shop-build">Возвести указом</button>
    <button class="btn ghost" data-act="close-modal">Закрыть</button>`);
}

function sheet(title, body) {
  return `<div class="screen" style="background:#14080c">
    <div class="card scroll">
      <h2>${esc(title)}</h2>
      <div style="height:8px"></div>
      ${body}
    </div>
  </div>`;
}

export function resourcesHTML(res) {
  return RES_KEYS.map((k) => `<span class="chip"><i>${GEMS[k]}</i>${res[k] | 0}</span>`).join("");
}

export function topHTML(game) {
  const p = game.players[game.current];
  const cal = calendar(game.day);
  const you = p.control === "human";
  return `<div class="dayline"><strong>${esc(cal.dayName)}</strong><span>неделя ${cal.week} · день ${cal.day}${you ? "" : " · " + esc(p.name)}</span></div>
    <div class="resbar">${resourcesHTML(p.resources)}</div>`;
}

export function dockHTML(game, hero, mode) {
  if (mode === "battle" || mode === "deploy") return battleDock(game, mode);
  const sub = hero ? `ход ${hero.movement} · мана ${hero.mana}/${maxMana(hero)}` : "нет героини";
  const img = hero ? hero.portrait : "icons/icon-192.png";
  const nm = hero ? hero.name : "—";
  return `<button class="hero-pill" data-act="open-hero">
      <img src="${esc(img)}" alt="">
      <div style="min-width:0"><div class="nm">${esc(nm)}</div><div class="sub">${esc(sub)}</div></div>
    </button>
    <div class="dock-row">
      <button class="btn small" data-act="open-town">Город</button>
      <button class="btn small" data-act="open-spell">Магия</button>
      <button class="btn small" data-act="open-shop">Лавка</button>
      <button class="btn small" data-act="open-system">Меню</button>
      <button class="btn small primary" data-act="end-turn">Ход</button>
    </div>`;
}

function battleDock(game, mode) {
  const b = game.battle;
  if (!b) return "";
  if (mode === "deploy" || b.phase === "deploy") {
    return `<div class="battlebar" style="width:100%"><button class="btn primary" data-act="battle-start">В бой</button><button class="btn ghost" data-act="battle-auto">Авто</button><button class="btn ghost" data-act="battle-retreat">Отступить</button></div>`;
  }
  const cur = currentStack(b);
  const name = cur ? CREATURES[cur.cr].name : "…";
  return `<div style="width:100%" class="stack">
    <div class="queue">${queueHTML(b)}</div>
    <div class="muted" style="font-size:12px">Ход: ${esc(name)} · раунд ${b.round}</div>
    <div class="battlebar">
      <button class="btn small" data-act="battle-wait">Ждать</button>
      <button class="btn small" data-act="battle-defend">Защита</button>
      <button class="btn small" data-act="battle-spell">Чары</button>
      <button class="btn small" data-act="battle-auto">Авто</button>
      <button class="btn small ghost" data-act="battle-retreat">Назад</button>
    </div>
  </div>`;
}
function queueHTML(b) {
  const ids = [...b.queue.slice(b.qi), ...b.waitQueue];
  return ids.map((uid, i) => {
    const s = b.stacks.find((x) => x.uid === uid);
    if (!s || s.dead) return "";
    const src = portraitFor(s.cr) || "icons/icon-192.png";
    return `<img class="q ${i === 0 ? "now" : ""}" src="${src}" alt="">`;
  }).join("");
}

export function systemHTML() {
  return `<div class="modal-back"><div class="sheet"><header class="sheeth"><h2>Меню партии</h2><button class="btn small ghost" data-act="close-modal">Закрыть</button></header>
    <div class="body stack">
      <button class="btn" data-act="open-overview">Обзор королевства</button>
      <button class="btn" data-act="open-save">Сохранить</button>
      <button class="btn" data-act="open-load-game">Загрузить</button>
      <button class="btn" data-act="open-shop">Лавка</button>
      <button class="btn" data-act="open-settings-game">Настройки</button>
      <button class="btn ghost" data-act="to-menu">Выйти в меню</button>
    </div></div></div>`;
}

export function townHTML(game, townId) {
  const town = townById(game, townId);
  if (!town) return "";
  const p = playerById(game, town.owner);
  const you = p && p.control === "human" && game.players[game.current].id === p.id;
  const fac = FACTIONS[town.faction];
  const built = Object.keys(town.buildings).filter((id) => id !== "villageHall" && town.buildings[id]);
  const avail = you ? availableBuildings(game, town) : [];
  const visitor = game.heroes.find((h) => !h.lost && h.x === town.x && h.y === town.y && h.player === town.owner);
  const tiers = tiersOf(town.faction);
  const rec = tiers.map((b, i) => {
    if (!town.buildings["dw" + (i + 1)]) return "";
    const up = town.buildings["up" + (i + 1)] && b.levelUpTo;
    const id = up ? b.levelUpTo : b.id;
    const cr = CREATURES[id];
    const pool = town.pool[b.id] || 0;
    return `<div class="list-item">
      <img src="${portraitFor(b.id)}" alt="">
      <div style="flex:1"><b>${esc(cr.name)}</b><div class="muted">в жилище ${pool} · ${esc(costStr(cr.cost))}</div></div>
      ${you ? `<button class="btn small" data-act="recruit" data-town="${town.id}" data-cr="${id}" data-n="1">+1</button>
      <button class="btn small" data-act="recruit" data-town="${town.id}" data-cr="${id}" data-n="${pool}">Все</button>` : ""}
    </div>`;
  }).join("");
  const builds = avail.map((b) => `<div class="list-item"><div style="flex:1"><b>${esc(b.name)}</b><div class="muted">${esc(b.desc)} · ${esc(costStr(b.cost))}</div></div>
    <button class="btn small primary" data-act="build" data-town="${town.id}" data-id="${b.id}" ${town.builtToday ? "disabled" : ""}>Строить</button></div>`).join("");
  const spells = (town.spells || []).map((id) => {
    const sp = SPELLS[id];
    return `<button class="btn small" data-act="learn-spell" data-town="${town.id}" data-spell="${id}" ${you && visitor ? "" : "disabled"}>${esc(sp.name)} <span class="tag">${sp.level}</span></button>`;
  }).join(" ");
  const dwellers = tiers.map((b, i) => {
    if (!town.buildings["dw" + (i + 1)]) return "";
    const id = town.buildings["up" + (i + 1)] && b.levelUpTo ? b.levelUpTo : b.id;
    return `<img class="town-unit" style="left:${6 + i * 13}%;animation-delay:${i * 0.25}s" src="${portraitFor(id)}" alt="">`;
  }).join("");
  return `<div class="modal-back"><div class="sheet">
    <div class="town-stage" style="background-image:url(art/towns/${town.faction}.jpg)">
      ${town.buildings.fort || town.buildings.citadel || town.buildings.castle ? `<img class="town-bld fort" src="art/sprites/castle-${town.faction}.webp" alt="">` : ""}
      ${town.buildings.tavern ? `<img class="town-bld tavern" src="art/sprites/tavern.webp" alt="">` : ""}
      ${town.buildings.mage1 ? `<img class="town-bld mage" src="art/sprites/mage.webp" alt="">` : ""}
      ${dwellers}
      <div class="town-caption">${esc(fac.name)}</div>
    </div>
    <header class="sheeth"><h2>${esc(town.name)}</h2><button class="btn small ghost" data-act="close-modal">Закрыть</button></header>
    <div class="body">
      <div class="muted">${esc(fac.epithet)}${town.builtToday ? " · сегодня уже строили" : ""}</div>
      <h3>Найм</h3>
      ${rec || `<p class="muted">Постройте жилище.</p>`}
      <div class="row">
        ${you ? `<button class="btn small" data-act="hire" data-town="${town.id}" ${town.buildings.tavern ? "" : "disabled"}>Салон · 2500</button>` : ""}
        ${you && visitor ? `<button class="btn small" data-act="buy-book" data-town="${town.id}" data-hero="${visitor.id}">Книга · 500</button>` : ""}
        ${you ? `<button class="btn small" data-act="open-trade" data-town="${town.id}">Рынок</button>` : ""}
      </div>
      ${you && visitor ? `<div class="row">${Object.values(MACHINES).map((m) => `<button class="btn small" data-act="buy-machine" data-town="${town.id}" data-hero="${visitor.id}" data-id="${m.id}">${esc(m.name)}</button>`).join("")}</div>` : ""}
      <h3>Гильдия</h3>
      <div class="stack">${spells || `<span class="muted">Гильдмастера ещё нет.</span>`}</div>
      <h3>Строить</h3>
      ${builds || `<p class="muted">Нет доступных строений.</p>`}
      <h3>Уже стоит</h3>
      <p class="muted">${built.map((id) => esc((buildingDef(town.faction, id) || {}).name || id)).join(" · ") || "только покои"}</p>
      <h3>Гарнизон ${visitor ? "· в гостях " + esc(visitor.name) : ""}</h3>
      ${armyRow(town.garrison, "garrison", you)}
      <p class="float-note">В осаде без героини дерётся гарнизон. Если героиня в городе — в бой идёт её армия. Перетаскивать отряды: коснитесь слота гарнизона, затем слота героини на её экране и наоборот через «в гарнизон».</p>
    </div></div></div>`;
}

export function armyRow(army, which, enabled) {
  return `<div class="grid7">${army.map((sl, i) => {
    if (!sl) return `<button class="unit" data-act="army" data-which="${which}" data-i="${i}" ${enabled ? "" : "disabled"}>—</button>`;
    const cr = CREATURES[sl.id];
    return `<button class="unit" data-act="army" data-which="${which}" data-i="${i}">
      <img src="${portraitFor(sl.id) || "icons/icon-192.png"}" alt="">
      <div>${esc(cr.name.split(" ")[0])}</div><b>${sl.count}</b>
    </button>`;
  }).join("")}</div>`;
}

export function heroHTML(game, heroId) {
  const hero = heroById(game, heroId);
  if (!hero) return "";
  const e = effective(hero);
  const you = game.players[hero.player].control === "human";
  const skills = Object.entries(hero.skills).map(([id, lv]) => `<div class="skill"><b>${esc(SKILLS[id].name)}</b> <span class="tag">${SKILL_RANK[lv]}</span><div class="muted">${esc(SKILLS[id].desc[lv])}</div></div>`).join("");
  const slots = SLOTS.map(([id, label]) => {
    const aid = hero.artifacts[id];
    const a = aid && ARTIFACTS[aid];
    return `<button class="aslot ${a ? "on" : ""}" data-act="unequip" data-hero="${hero.id}" data-slot="${id}">
      <div class="tag">${esc(label)}</div>
      <div>${a ? esc(a.name) : "—"}</div>
    </button>`;
  }).join("");
  const bag = hero.backpack.map((id, i) => {
    const a = ARTIFACTS[id];
    if (!a) return "";
    return `<button class="btn small" data-act="equip" data-hero="${hero.id}" data-i="${i}">${esc(a.name)}</button>`;
  }).join(" ");
  const next = xpForLevel(hero.level + 1);
  return `<div class="modal-back"><div class="sheet">
    <header class="sheeth"><h2>${esc(hero.name)}</h2><button class="btn small ghost" data-act="close-modal">Закрыть</button></header>
    <div class="body">
      <img class="portrait-lg" src="${hero.portrait}" alt="">
      <p class="kicker">${esc(FACTIONS[hero.faction].name)} · уровень ${hero.level} · опыт ${hero.xp}/${next}</p>
      <div class="stats">
        <div class="stat"><b>${e.attack}</b><span>атака</span></div>
        <div class="stat"><b>${e.defense}</b><span>защита</span></div>
        <div class="stat"><b>${e.power}</b><span>сила</span></div>
        <div class="stat"><b>${e.knowledge}</b><span>знание</span></div>
      </div>
      <p class="muted">мораль ${e.morale} · удача ${e.luck} · ход ${hero.movement}/${maxMove(hero)} · мана ${hero.mana}/${maxMana(hero)} · обзор ${e.sight}</p>
      <h3>Войско</h3>
      ${armyRow(hero.army, "hero:" + hero.id, you)}
      <div class="row">
        <button class="btn small" data-act="split-ask" data-hero="${hero.id}">Разделить</button>
        <button class="btn small ghost" data-act="hero-wait">Снять выделение</button>
      </div>
      <h3>Навыки</h3>
      <div class="stack">${skills}</div>
      <h3>Артефакты</h3>
      <div class="slots" style="grid-template-columns:repeat(3,1fr)">${slots}</div>
      <p class="kicker">Сумка</p>
      <div class="stack">${bag || `<span class="muted">пусто</span>`}</div>
    </div></div></div>`;
}

export function spellbookHTML(game, hero) {
  if (!hero) return "";
  const cap = wisdomCap(skillLv(hero, "wisdom"));
  const list = hero.spells.map((id) => {
    const sp = SPELLS[id];
    const cost = spellManaCost({ ...effective(hero), skills: hero.skills, spells: hero.spells }, sp);
    const adv = sp.adventure ? `<button class="btn small" data-act="cast-adv" data-hero="${hero.id}" data-spell="${id}">Сотворить</button>` : "";
    return `<div class="list-item"><div style="flex:1"><b>${esc(sp.name)}</b> <span class="tag">${sp.level} · ${cost} маны</span><div class="muted">${esc(sp.desc)}</div></div>${adv}</div>`;
  }).join("");
  return `<div class="modal-back"><div class="sheet"><header class="sheeth"><h2>Книга</h2><button class="btn small ghost" data-act="close-modal">Закрыть</button></header>
    <div class="body">${hero.book ? "" : `<p class="muted">Книги нет — купите в гильдии.</p>`}
    <p class="muted">Мана ${hero.mana}. Мудрость открывает до ${cap} круга. Откатов нет.</p>
    ${list || `<p class="muted">Страницы пусты.</p>`}</div></div></div>`;
}

export function battleSpellsHTML(game) {
  const b = game.battle;
  const side = "left";
  const hero = b.heroes[side];
  if (!hero) return "";
  const list = hero.spells.filter((id) => SPELLS[id] && SPELLS[id].combat).map((id) => {
    const sp = SPELLS[id];
    const cost = spellManaCost(hero, sp);
    return `<button class="btn" data-act="aim-spell" data-spell="${id}">${esc(sp.name)} · ${cost}<div class="float-note">${esc(sp.desc)}</div></button>`;
  }).join("");
  return `<div class="modal-back"><div class="sheet"><header class="sheeth"><h2>Боевые чары</h2><button class="btn small ghost" data-act="close-modal">Закрыть</button></header>
    <div class="body stack">${list || `<p class="muted">Нет боевых заклинаний.</p>`}</div></div></div>`;
}

export function levelHTML(hero) {
  const offer = hero.offer;
  if (!offer) return "";
  if (offer.kind === "stat") {
    const btns = ["attack", "defense", "power", "knowledge"].map((id) => {
      const nm = { attack: "Атака", defense: "Защита", power: "Сила магии", knowledge: "Знание" }[id];
      return `<button class="btn" data-act="level" data-hero="${hero.id}" data-id="${id}">${nm}</button>`;
    }).join("");
    return `<div class="modal-back"><div class="sheet"><header class="sheeth"><h2>Уровень ${hero.level}</h2></header><div class="body"><p>Все навыки на пределе. Куда вложить ещё единицу?</p><div class="stack">${btns}</div></div></div></div>`;
  }
  const btns = offer.options.map((id) => `<button class="btn" data-act="level" data-hero="${hero.id}" data-id="${id}"><b>${esc(SKILLS[id].name)}</b><div class="float-note">${esc(SKILLS[id].desc[(hero.skills[id] || 0) + 1] || "")}</div></button>`).join("");
  return `<div class="modal-back"><div class="sheet"><header class="sheeth"><h2>${esc(hero.name)} · уровень ${hero.level}</h2></header>
    <div class="body"><p class="muted">Первичный навык уже вырос. Выберите умение. Осталось выборов: ${hero.unspent}.</p><div class="stack">${btns}</div></div></div></div>`;
}

export function choiceHTML(ch) {
  if (ch.kind === "arena") {
    return `<div class="modal-back"><div class="sheet"><header class="sheeth"><h2>${esc(ch.title)}</h2></header><div class="body stack">
      <p>${esc(ch.text)}</p>
      <button class="btn" data-act="resolve" data-obj="${ch.objectId}" data-id="attack">+2 атаки</button>
      <button class="btn" data-act="resolve" data-obj="${ch.objectId}" data-id="defense">+2 защиты</button>
    </div></div></div>`;
  }
  if (ch.kind === "university") {
    const btns = Object.values(SKILLS).map((s) => `<button class="btn small" data-act="resolve" data-obj="${ch.objectId}" data-id="${s.id}">${esc(s.name)}</button>`).join("");
    return `<div class="modal-back"><div class="sheet"><header class="sheeth"><h2>Университет</h2></header><div class="body"><p class="muted">Один навык, один раз.</p><div class="stack">${btns}</div></div></div></div>`;
  }
  return "";
}

export function diploHTML(d) {
  const cr = CREATURES[d.cr];
  return `<div class="modal-back"><div class="sheet"><header class="sheeth"><h2>Дипломатия</h2></header><div class="body stack">
    <p>${esc(cr.name)} ×${d.count} готовы перейти за ${d.gold} золота.</p>
    <button class="btn primary" data-act="diplo-yes" data-hero="${d.heroId}" data-obj="${d.objectId}">Нанять</button>
    <button class="btn ghost" data-act="diplo-no" data-hero="${d.heroId}" data-obj="${d.objectId}">В бой</button>
  </div></div></div>`;
}

export function dwellingHTML(game, hero, obj) {
  const cr = CREATURES[obj.creature];
  return `<div class="modal-back"><div class="sheet"><header class="sheeth"><h2>${esc(cr.name)}</h2><button class="btn small ghost" data-act="close-modal">Закрыть</button></header>
    <div class="body stack">
      <img src="${portraitFor(obj.creature)}" alt="" style="width:100%;border-radius:12px;max-height:180px;object-fit:cover">
      <p>Доступно ${obj.pool}. Цена: ${esc(costStr(cr.cost))}.</p>
      <label class="field">Сколько<input id="dw-n" type="number" min="1" max="${obj.pool}" value="${Math.min(obj.pool, 5)}"></label>
      <button class="btn primary" data-act="dwell-buy" data-hero="${hero.id}" data-obj="${obj.id}">Нанять в армию</button>
    </div></div></div>`;
}

export function tradeHTML(game) {
  const opts = Object.keys(TRADE).map((k) => `<option value="${k}">${RES_NAME[k]} · купить ${TRADE[k].buy} / продать ${TRADE[k].sell}</option>`).join("");
  return `<div class="modal-back"><div class="sheet"><header class="sheeth"><h2>Рынок</h2><button class="btn small ghost" data-act="close-modal">Закрыть</button></header>
    <div class="body stack">
      <label class="field">Ресурс<select id="tr-res">${opts}</select></label>
      <label class="field">Количество<input id="tr-n" type="number" min="1" value="1"></label>
      <div class="row">
        <button class="btn" data-act="trade" data-dir="buy">Купить</button>
        <button class="btn" data-act="trade" data-dir="sell">Продать</button>
      </div>
    </div></div></div>`;
}

export function overviewHTML(game) {
  const p = game.players.find((pl) => pl.control === "human");
  const heroes = game.heroes.filter((h) => h.player === p.id && !h.lost).map((h) =>
    `<button class="btn small" data-act="focus-hero" data-id="${h.id}">${esc(h.name)} · ур.${h.level} · ход ${h.movement}</button>`).join("");
  const towns = game.towns.filter((t) => t.owner === p.id).map((t) =>
    `<button class="btn small" data-act="focus-town" data-id="${t.id}">${esc(t.name)}</button>`).join("");
  return `<div class="modal-back"><div class="sheet"><header class="sheeth"><h2>Королевство</h2><button class="btn small ghost" data-act="close-modal">Закрыть</button></header>
    <div class="body"><h3>Героини</h3><div class="stack">${heroes}</div><h3>Города</h3><div class="stack">${towns}</div>
    <h3>Журнал</h3>${game.log.slice(-8).map((l) => `<div class="muted">${esc(l.text)}</div>`).join("")}
    </div></div></div>`;
}

export function endHTML(end) {
  return `<div class="modal-back"><div class="sheet"><header class="sheeth"><h2>${end.win ? "Победа" : "Поражение"}</h2></header>
    <div class="body stack"><p>${esc(end.text)}</p>
      <button class="btn primary" data-act="to-menu">В меню</button>
    </div></div></div>`;
}

export function briefHTML(game) {
  return `<div class="modal-back"><div class="sheet"><header class="sheeth"><h2>${esc(game.name)}</h2></header>
    <div class="body stack"><p>${esc(game.briefing || "Знамя поднято.")}</p>
      <button class="btn primary" data-act="close-modal">В поход</button>
    </div></div></div>`;
}

export function splitHTML(heroId) {
  return `<div class="modal-back"><div class="sheet"><header class="sheeth"><h2>Разделить отряд</h2></header>
    <div class="body stack">
      <p class="muted">Сначала коснитесь слота войска, затем укажите, сколько отделить.</p>
      <label class="field">Число<input id="split-n" type="number" min="1" value="1"></label>
      <button class="btn" data-act="split-do" data-hero="${heroId}">Отделить</button>
      <button class="btn ghost" data-act="close-modal">Отмена</button>
    </div></div></div>`;
}

export function townPortalHTML(heroId, spellId, towns) {
  const btns = towns.map((t) => `<button class="btn" data-act="cast-portal" data-hero="${heroId}" data-spell="${spellId}" data-town="${t.id}">${esc(t.name)}</button>`).join("");
  return `<div class="modal-back"><div class="sheet"><header class="sheeth"><h2>Врата города</h2></header><div class="body stack">${btns}<button class="btn ghost" data-act="close-modal">Отмена</button></div></div></div>`;
}

export { attackOptions, currentStack };
