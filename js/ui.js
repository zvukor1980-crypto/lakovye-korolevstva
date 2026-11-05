import {eraId, eraStatus} from "./epochs.js";
/** Разметка экранов. Вся речь интерфейса — по-русски. */

import {
  GAME_VERSION, ERAS, FACTION_ORDER, BUILDING_IDS, eraArt, ARTIFACTS, CREATURES, FACTIONS, RES_KEYS, RES_NAME, ROSTER, SCENARIOS, SHOP_PACKS,
  SKILL_RANK, SKILLS, SKIRMISH, SPELLS, SLOTS, TRADE, buildingDef, calendar,
  portraitFor, tiersOf, wisdomCap, xpForLevel,
} from "./data.js";
import { canAfford, costStr } from "./util.js";
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
    <div class="menu-mist" aria-hidden="true"></div><div class="menu-crest"><span class="kicker">Четыре народа · Три эпохи</span>
      <h1>Лаковые<br>королевства</h1><p class="menu-caption">От древних королевств — к современным империям</p><span class="version-badge">Версия ${GAME_VERSION} · Героини эпох</span>
    </div>
    <div class="menu-actions lux">
      ${opts.continue ? `<button class="btn lux" data-act="continue">Продолжить</button>` : ""}
      <button class="btn lux" data-act="campaign">Кампания</button>
      <button class="btn lux" data-act="skirmish">Схватка</button>
      <button class="btn lux" data-act="load">Загрузить</button>
      <button class="btn lux" data-act="shop-menu">Лавка</button>
      <button class="btn lux" data-act="settings">Настройки</button>
      <button class="btn small ghost menu-update" data-act="check-update">Проверить обновление · ${GAME_VERSION}</button>
      <div class="row">
        <button class="btn small ghost" data-act="bestiary">Героини эпох</button>
        <button class="btn small ghost" data-act="help">Как играть</button>
      </div>
    </div>
  </div>`;
}

export function helpHTML() {
  return sheet("Как играть", `
    ${voiceHTML("Наставница Лира", "Я проведу вас по двору. Касания крупные, золото не кусается.")}
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
  return sheet("Кампания", factionChoice() + items + `<button class="btn ghost" data-act="back">Назад</button>`);
}

export function skirmishHTML() {
  const maps = SKIRMISH.map((m) => `<option value="${m.id}">${esc(m.name)} — ${m.w}×${m.h}, ${m.players} знамени</option>`).join("");
  const facs = Object.values(FACTIONS).map((f) => `<option value="${f.id}">${esc(f.name)}</option>`).join("");
  return sheet("Стычка", `
    <label class="field">Карта<select id="sk-map">${maps}</select></label>
    ${factionChoice()}
    <label class="field">Начальная эпоха<select id="sk-era"><option value="0">Древность — постепенное развитие</option><option value="1">Средневековье</option><option value="2">Современность — новые героини сразу</option></select></label><label class="field">Путь<select id="sk-role"><option value="might">Сила</option><option value="magic">Магия</option></select></label>
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

export function bestiaryHTML(era=2) {
  const blocks = FACTION_ORDER.map((fid) => {
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
  return sheet("Героини эпох", `<button class="btn ghost" data-act="back">В главное меню</button><nav class="era-gallery-tabs">${ERAS.map(e=>`<button class="btn ${e.id===era?'primary':''}" data-act="gallery-era" data-era="${e.id}">${e.name}</button>`).join('')}</nav><p class="muted">${era===2?'Современные образы: лаковые плащи, комбинезоны и костюмы. Эти героини появляются в отрядах и городах выбранной эпохи.':'Образы героинь этой эпохи.'}</p>${FACTION_ORDER.map(f=>`<section class="era-lookbook"><h3>${esc(FACTIONS[f].name)}</h3><div class="era-models">${[0,1,2].map((role)=>`<figure><img src="${eraArt(f,era,role)}" alt="${esc(FACTIONS[f].name)} · ${['Разведчица','Командирша','Хранительница'][role]}" loading="lazy"><figcaption>${['Разведчица','Командирша','Хранительница'][role]}</figcaption></figure>`).join('')}</div></section>`).join('')}<details><summary>Характеристики войск древности</summary>${blocks}</details><div class="court-gallery">${[['architect','Архитектор двора'],['merchant','Хранительница лавки'],['priestess','Жрица солнца']].map(([id,name])=>`<figure><img src="art/court/${id}.webp" alt="${name}" loading="lazy"><figcaption>${name}</figcaption></figure>`).join('')}</div>` + `<button class="btn ghost" data-act="back">Назад</button>`);
}

export function settingsHTML(st) {
  return sheet("Настройки", `<p>Версия ${GAME_VERSION}</p><button class="btn" data-act="check-update">Проверить обновление</button><a class="btn ghost" href="./update.html">Восстановить загрузку файлов</a>
    <label class="field">Звук<select id="set-sound"><option value="on" ${st.sound !== false ? "selected" : ""}>Включён</option><option value="off" ${st.sound === false ? "selected" : ""}>Выключен</option></select></label>
    <label class="field">Музыка<select id="set-music"><option value="on" ${st.music !== false ? "selected" : ""}>Камерная тема</option><option value="off" ${st.music === false ? "selected" : ""}>Выключена</option></select></label>
    <button class="btn primary" data-act="test-music">▶ Включить музыку / проверить звук</button><p class="muted">Музыка включается отдельно от звуков. Выбор применяется сразу.</p><label class="field">Громкость музыки<input id="set-volume" type="range" min="0" max="100" value="${Math.round((st.volume ?? .4)*100)}"></label>
    <label class="field">Голосовые реплики<select id="set-voice"><option value="off" ${!st.voice ? "selected" : ""}>Выключены</option><option value="on" ${st.voice ? "selected" : ""}>Русский голос устройства</option></select></label>
    <p class="muted">Музыка синтезирована: арфа, флейта и струнные тембры. Реплики доступны при наличии русского системного голоса.</p>
    <button class="btn ghost" data-act="test-voice">Послушать голос</button>
    <label class="field">Атмосферные эффекты<select id="set-effects"><option value="on" ${st.effects !== false ? "selected" : ""}>Включены</option><option value="off" ${st.effects === false ? "selected" : ""}>Экономия энергии</option></select></label>
    <label class="field">Анимация<select id="set-fast"><option value="0" ${!st.fast ? "selected" : ""}>Плавная</option><option value="1" ${st.fast ? "selected" : ""}>Быстрая</option></select></label>
    <button class="btn" data-act="save-settings">Запомнить</button>
    <button class="btn ghost" data-act="back">Назад</button>`);
}

export function shopHTML(game) {
 if(!game)return sheet("Лавка",`<p>Начните партию: здесь можно бесплатно получить ресурсы, войска и предметы.</p><button class="btn" data-act="back">Назад</button>`);
 const p=game.players.find(p=>p.control==="human"), era=p.era||0;
 const heroes=game.heroes.filter(h=>h.player===p.id&&!h.lost);
 const heroOpts=heroes.map(h=>`<option value="${h.id}">${esc(h.name)}</option>`).join("");
 const troops=tiersOf(p.faction).flatMap(c=>[c.id,c.levelUpTo]).filter(Boolean).map(id=>CREATURES[eraId(id,era)]).map(c=>`<article class="commerce-card"><div class="commerce-art"><img src="${portraitFor(c.id)}" alt="${esc(c.name)}" loading="lazy"></div><div class="commerce-copy"><span class="tag">Ранг ${c.tier} · ${c.ranged?"Стрелок":"Ближний бой"}</span><h3>${esc(c.name)}</h3><p>Атака ${c.atk} · Защита ${c.def}<br>Здоровье ${c.hp} · Урон ${c.min}–${c.max}</p><button class="btn primary" data-act="shop-card-unit" data-cr="${c.id}" ${heroes.length?"":"disabled"}>Получить бесплатно</button></div></article>`).join("");
 const packs=SHOP_PACKS.map(pk=>`<button class="supply-card" data-act="shop-pack" data-id="${pk.id}"><img src="art/sprites/gold.webp" alt=""><span><b>${esc(pk.name)}</b><small>${esc(pk.desc)}</small></span><strong>Получить</strong></button>`).join("");
 const arts=Object.values(ARTIFACTS).map(a=>`<option value="${a.id}">${esc(a.name)} — ${esc(a.desc)}</option>`).join("");
 const spells=Object.values(SPELLS).map(a=>`<option value="${a.id}">${esc(a.name)} — ${esc(a.desc)}</option>`).join("");
 const towns=game.towns.filter(t=>t.owner===p.id).map(t=>`<h3>${esc(t.name)}</h3><div class="commerce-grid">${availableBuildings(game,t).map(b=>`<button class="supply-card" data-act="shop-card-build" data-town="${t.id}" data-id="${b.id}"><img src="${buildingArt(b,t,era)}" alt=""><span><b>${esc(b.name)}</b><small>${esc(b.desc)}</small></span><strong>Возвести</strong></button>`).join("")||"Все доступные здания уже построены."}</div>`).join("");
 return sheet("Лавка двора",`<div class="shop-heading"><img src="art/court/merchant.webp" alt="Лавочница"><div><span class="kicker">${esc(ERAS[era].name)}</span><h3>Всё для вашего королевства</h3><p>Бесплатная помощь. Золото не списывается.</p></div><button class="btn ghost" data-act="close-modal">Закрыть</button></div><label class="field">Кому передать покупки<select id="shop-hero">${heroOpts}</select></label><details class="shop-section" open><summary>Ресурсы и помощь</summary><div class="commerce-grid">${packs}</div><div class="row"><button class="btn" data-act="shop-refresh">Восстановить ход и ману</button><button class="btn" data-act="shop-stats">+1 к характеристикам</button><button class="btn" data-act="shop-level">Повысить уровень</button></div></details><details class="shop-section"><summary>Воительницы · ${esc(FACTIONS[p.faction].name)}</summary><label class="field">Количество в получаемом отряде<input id="shop-n" type="number" min="1" max="9999" value="20"></label><div class="commerce-grid">${troops}</div></details><details class="shop-section"><summary>Артефакты и заклинания</summary><img class="section-art" src="art/sprites/chest.webp" alt="Сундук с сокровищами"><label class="field">Артефакт<select id="shop-art">${arts}</select></label><button class="btn primary" data-act="shop-art">Получить артефакт</button><label class="field">Заклинание<select id="shop-sp">${spells}</select></label><button class="btn" data-act="shop-spell">Получить заклинание</button><button class="btn" data-act="shop-reveal">Открыть карту</button></details><details class="shop-section"><summary>Бесплатные здания</summary><p class="muted">Указ лавки не требует ресурсов. Зависимости зданий сохраняются.</p>${towns}</details>`);
}

export function voiceHTML(name, line) {
  return `<div class="voice"><img src="art/ui/narrator.webp" alt=""><div><b>${esc(name)}</b><p>${esc(line)}</p></div></div>`;
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
  return `<div class="woodtop">
      <div class="dayline"><strong>${esc(cal.label)}</strong><span>${esc(ERAS[p.era||0].name)} · ${esc(cal.dayName)}${you ? "" : " · " + esc(p.name)}</span>
        <button class="btn icon" data-act="open-system" aria-label="Меню"></button>
      </div>
      <div class="resbar">${resourcesHTML(p.resources)}</div>
    </div>`;
}

export function dockHTML(game, hero, mode, flags = {}) {
  if (mode === "battle" || mode === "deploy") return battleDock(game, mode, flags);
  const img = hero ? hero.portrait : "icons/icon-192.png";
  const nm = hero ? hero.name : "—";
  let coach = "";
  try {
    if (!localStorage.getItem("lk-coach")) {
      coach = `<div class="coach"><span>Коснитесь клетки — героиня пойдёт. «Ход» отдаёт день.</span><button class="btn small" data-act="dismiss-coach">Ясно</button></div>`;
    }
  } catch { /* хранилище недоступно */ }
  const e = hero ? effective(hero) : null;
  const dots = (n) => {
    const v = Math.max(0, Math.min(3, n || 0));
    return "●".repeat(v) + "○".repeat(3 - v);
  };
  return `${coach}<div class="herobar">
      <button class="herobar-port" data-act="open-hero" aria-label="Героиня"><img src="${esc(img)}" alt=""></button>
      <div class="herobar-text">
        <b>${esc(nm)}</b>
        <div>${hero ? esc(FACTIONS[hero.faction].name) + " · ур. " + hero.level : ""}</div>
        <div>Ход ${hero ? hero.movement : 0} · Мана ${hero ? hero.mana + "/" + maxMana(hero) : "—"}</div>
        <div>Мораль ${e ? dots(e.morale) : "—"} · Удача ${e ? dots(e.luck) : "—"}</div>
      </div>
      <button class="btn small" data-act="next-hero">Дальше</button>
    </div>
    <div class="cmdbar">
      <button class="cmd" data-act="end-turn"><b>⚑</b>Ход</button>
      <button class="cmd" data-act="open-hero"><b>♛</b>Герой</button>
      <button class="cmd" data-act="open-town"><b>⌂</b>Замок</button>
      <button class="cmd" data-act="open-overview"><b>◉</b>Царство</button>
      <button class="cmd" data-act="open-spell"><b>✦</b>Книга</button>
      <button class="cmd" data-act="open-quest"><b>✦</b>Цель</button>
    </div>`;
}

function battleDock(game, mode, flags) {
  const b = game.battle;
  if (!b) return "";
  const log = (b.log || []).slice(-2).map((l) => esc(l)).join("<br>") || "Поле ждёт приказа.";
  if (mode === "deploy" || b.phase === "deploy") {
    return `<div class="clog">${log}</div>
      <div class="battlebar">
        <button class="btn small primary" data-act="battle-start">В бой</button>
        <button class="btn small" data-act="battle-auto">Авто</button>
        <button class="btn small" data-act="battle-retreat">Отступить</button>
        <button class="btn small" data-act="battle-grid">${flags.grid === false ? "Сетка" : "Сетка ✓"}</button>
      </div>`;
  }
  const cur = currentStack(b);
  const name = cur ? CREATURES[cur.cr].name : "…";
  const side = b.human.right && !b.human.left ? "right" : "left";
  const cost = surrenderCost(b, side);
  const faces = ["left", "right"].map((sd) => {
    const hero = b.heroes && b.heroes[sd];
    if (!hero) return "";
    const src = hero.portrait || "icons/icon-192.png";
    return `<div class="bface ${sd}"><img src="${esc(src)}" alt=""><b>${esc(hero.name || "")}</b></div>`;
  }).join("");
  return `<div style="width:100%" class="stack">
    <div class="bfaces">${faces}<div class="clog">Ход: ${esc(name)} · раунд ${b.round}<br>${log}</div></div>
    <div class="queue">${queueHTML(b)}</div>
    <div class="battlebar">
      <button class="btn small" data-act="battle-wait">Ждать</button>
      <button class="btn small" data-act="battle-defend">Защита</button>
      <button class="btn small" data-act="battle-spell">Книга</button>
      <button class="btn small" data-act="battle-auto">Авто</button>
      <button class="btn small" data-act="battle-grid">${flags.grid === false ? "Сетка" : "Сетка ✓"}</button>
      <button class="btn small" data-act="battle-log">Журнал</button>
      <button class="btn small" data-act="battle-retreat">Отступить</button>
      <button class="btn small" data-act="battle-surrender" data-cost="${cost}">Сдаться</button>
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

const BLD_SPRITE = {
  hall: "art/sprites/hall.webp",
  tavern: "art/sprites/tavern.webp",
  market: "art/sprites/market.webp",
  smith: "art/sprites/smith.webp",
  silo: "art/sprites/silo.webp",
  mage: "art/sprites/mage.webp",
  low: "art/sprites/dw-low.webp",
  mid: "art/sprites/dw-mid.webp",
  high: "art/sprites/dw-high.webp",
  grail: "art/sprites/grail.webp",
};

function townSpots(town) {
  const b = town.buildings || {};
  const spots = [];
  const hallId = b.capitol ? "capitol" : b.cityHall ? "cityHall" : b.townHall ? "townHall" : "village";
  spots.push({ id: hallId, art: BLD_SPRITE.hall, x: 46, y: 18, h: b.capitol ? 128 : b.cityHall ? 116 : 104 });
  if (b.castle || b.citadel || b.fort) {
    const id = b.castle ? "castle" : b.citadel ? "citadel" : "fort";
    spots.push({ id, art: `art/sprites/castle-${town.faction === "inca" ? "emerald" : town.faction}.webp`, x: 14, y: 12, h: b.castle ? 142 : 118 });
  }
  let mage = 0;
  for (let i = 5; i >= 1; i--) if (b["mage" + i]) { mage = i; break; }
  if (mage) spots.push({ id: "mage" + mage, art: BLD_SPRITE.mage, x: 78, y: 26, h: 78 + mage * 8 });
  if (b.tavern) spots.push({ id: "tavern", art: BLD_SPRITE.tavern, x: 28, y: 4, h: 72 });
  if (b.market) spots.push({ id: "market", art: BLD_SPRITE.market, x: 60, y: 2, h: 70 });
  if (b.blacksmith) spots.push({ id: "blacksmith", art: BLD_SPRITE.smith, x: 88, y: 14, h: 76 });
  if (b.silo) spots.push({ id: "silo", art: BLD_SPRITE.silo, x: 94, y: 0, h: 64 });
  const arts = ["low", "low", "mid", "mid", "high", "high", "high"];
  const xs = [6, 20, 34, 50, 64, 78, 92];
  for (let i = 0; i < 7; i++) {
    if (!b["dw" + (i + 1)]) continue;
    const up = !!b["up" + (i + 1)];
    spots.push({
      id: up ? "up" + (i + 1) : "dw" + (i + 1),
      art: BLD_SPRITE[arts[i]],
      x: xs[i],
      y: 0,
      h: 54 + (i > 4 ? 12 : 0),
      up,
    });
  }
  if (b.special) spots.push({ id: "special", art: BLD_SPRITE.mage, x: 40, y: 34, h: 86 });
  if (b.horde) spots.push({ id: "horde", art: BLD_SPRITE.mid, x: 56, y: 0, h: 78 });
  if (b.grail) spots.push({ id: "grail", art: BLD_SPRITE.grail, x: 50, y: 40, h: 100 });
  return spots;
}

export function townHTML(game, townId) {
  const town = townById(game, townId);
  if (!town) return "";
  const p = playerById(game, town.owner);
  const you = p && p.control === "human" && game.players[game.current].id === p.id;
  const fac = FACTIONS[town.faction];
  const visitor = game.heroes.find((h) => !h.lost && h.x === town.x && h.y === town.y && h.player === town.owner);
  const order = ["capitol", "cityHall", "townHall", "castle", "citadel", "fort", "mage5", "mage4", "mage3", "mage2", "mage1", "tavern", "market", "blacksmith", "silo", "dw7", "dw6", "dw5", "dw4", "dw3", "dw2", "dw1", "up7", "up6", "up5", "up4", "up3", "up2", "up1", "special", "horde", "grail"];
  const standing = order.filter((id) => {
    if (!town.buildings[id]) return false;
    if (/^dw(\d)$/.test(id) && town.buildings["up" + id.slice(2)]) return false;
    return true;
  });
  const built = standing.map((id) => {
    const def = buildingDef(town.faction, id) || { name: id, desc: "" };
    const name = def.name.replace(/^Жилище: /, "").replace(/^Улучшение: /, "");
    return `<button class="btn bld-row" data-act="town-hit" data-town="${town.id}" data-id="${id}"><img class="building-thumb" src="${buildingArt(def,town)}" alt=""><b>${def.tier?"Нанять: ":""}${esc(name)}</b><span>${esc(def.desc || "")}</span></button>`;
  }).join("");
  const bar = standing.map((id) => {
    const def = buildingDef(town.faction, id) || { name: id };
    const name = (def.name || id).replace(/^Жилище: /, "").replace(/^Улучшение: /, "").split(" ")[0];
    return `<button class="btn small" data-act="town-hit" data-town="${town.id}" data-id="${id}">${esc(name)}</button>`;
  }).join("");
  const fortSrc = town.buildings.fort || town.buildings.citadel || town.buildings.castle ? `art/sprites/castle-${town.faction === "inca" ? "emerald" : town.faction}.webp` : BLD_SPRITE.hall;
  return `<div class="modal-back"><div class="sheet town-sheet">
    <div class="town-stage" style="background-image:url(art/towns/${town.faction}.jpg)">
      <img class="town-deco" src="${fortSrc}" alt="">
      <img class="town-steward" src="${eraArt(town.faction,playerById(game,town.owner)?.era||0,2)}" alt="">
      <div class="town-caption">${esc(town.name)}<small>${esc(fac.name)}</small></div>
    </div>
    <header class="sheeth">
      <h2>${esc(fac.epithet)}</h2>
      <button class="btn small ghost" data-act="close-modal">Закрыть</button>
    </header>
    <div class="town-body">
      <p class="kicker">${esc(ERAS[playerById(game,town.owner)?.era||0].name)} · ${town.builtToday?"Сегодня уже строили":"Можно построить одно здание"}</p>
      <div class="build-bar">${bar}</div>
      <div class="army-line"><span>${visitor ? esc(visitor.name) : "В гостях"}</span>${visitor ? armyRow(visitor.army, "hero:" + visitor.id, you) : `<p class="muted">Героини в городе нет. Поставьте её на замок.</p>`}</div>
      <div class="army-line"><span>Гарнизон</span>${armyRow(town.garrison, "garrison", you)}</div>
      <div class="row">
        ${you ? `<button class="btn small primary" data-act="open-hall" data-town="${town.id}">Строительство и эпохи</button>` : ""}
        ${you ? `<button class="btn small" data-act="open-trade" data-town="${town.id}" ${town.buildings.market ? "" : "disabled"}>Рынок</button>` : ""}
      </div>
      <h3>Здания и найм войск</h3>
      <div class="stack">${built || `<p class="muted">Пока только покои. Откройте «Строить».</p>`}</div>
      <p class="float-note">${town.builtToday ? "Сегодня уже строили." : "Один дом в день. Повторное касание слота войска открывает сведения."}</p>
    </div>
  </div></div>`;
}

export function hallHTML(game, townId) {
  const town=townById(game,townId);if(!town)return "";
  const p=playerById(game,town.owner), you=p.control==="human"&&game.players[game.current].id===p.id;
  const allowed=new Set(availableBuildings(game,town).map(b=>b.id));
  const cards=BUILDING_IDS.map(id=>buildingDef(town.faction,id)).filter(Boolean).map(b=>{
    const built=!!town.buildings[b.id], missing=(b.req||[]).filter(id=>!town.buildings[id]);
    const affordable=canAfford(p.resources,b.cost), ready=you&&!built&&!town.builtToday&&allowed.has(b.id)&&affordable;
    const reasons=built?"Построено":missing.length?"Сначала: "+missing.map(id=>buildingDef(town.faction,id)?.name||id).join(", "):b.needsGrail&&!allowed.has(b.id)?"Найдите Корону Блеска":town.builtToday?"Следующая стройка — завтра":!affordable?"Не хватает: "+costStr(Object.fromEntries(Object.entries(b.cost).filter(([k,v])=>(p.resources[k]||0)<v).map(([k,v])=>[k,v-(p.resources[k]||0)]))):"Можно построить";
    return {ready,built,html:`<article data-building-card data-ready="${ready}" data-troops="${!!b.tier}" data-city="${!b.tier}" data-built="${built}" class="commerce-card ${built?"is-built":""}"><div class="commerce-art"><img src="${buildingArt(b,town,p.era||0)}" alt="${esc(b.name)}" loading="lazy"></div><div class="commerce-copy"><span class="tag">${built?"Готово":b.tier?"Войска · ранг "+b.tier:"Город"}</span><h3>${esc(b.name)}</h3><p>${esc(b.desc)}</p><div class="price">${esc(costStr(b.cost))}</div><p class="availability ${ready?"ready":""}">${esc(reasons)}</p><button class="btn ${ready?"primary":"ghost"}" data-act="build" data-town="${town.id}" data-id="${b.id}" ${ready?"":"disabled"}>${built?"Построено":"Построить"}</button></div></article>`};
  }).sort((a,b)=>Number(b.ready)-Number(a.ready)||Number(a.built)-Number(b.built)).map(c=>c.html).join("");
  return `<div class="modal-back"><div class="sheet commerce-sheet"><header class="sheeth"><h2>Строительство</h2><button class="btn small ghost" data-act="back-town" data-town="${town.id}">В город</button></header><div class="body"><div class="budget-bar">${resourcesHTML(p.resources)}</div><div class="court-banner"><img src="art/court/architect.webp" alt="Архитектор двора"><div><span class="kicker">${esc(town.name)}</span><h3>Создайте своё королевство</h3><p>${town.builtToday?'Сегодня строительство завершено. Следующее — завтра.':'Выберите одно здание для строительства сегодня.'}</p></div></div><details class="era-disclosure"><summary>Развитие цивилизации · ${esc(ERAS[p.era||0].name)}</summary>${eraPanel(game,town)}</details><nav class="commerce-filters" aria-label="Категории зданий">${[['all','Все'],['ready','Доступно'],['city','Город'],['troops','Войска'],['built','Готово']].map(([key,label])=>`<button class="btn" data-act="commerce-filter" data-filter="${key}" aria-pressed="${key==='all'}">${label}</button>`).join('')}</nav><p class="filter-status" role="status">Доступные здания показаны первыми. Цена и условия — в каждой карточке.</p><div class="commerce-grid">${cards}</div></div></div></div>`;
}

export function recruitHTML(game, townId, buildingId) {
  const town = townById(game, townId);
  if (!town) return "";
  const tier = Math.max(1, Number(String(buildingId).replace(/\D/g, "")) || 1);
  const base = tiersOf(town.faction)[tier - 1];
  if (!base) return "";
  const up = town.buildings["up" + tier] && base.levelUpTo;
  const p=playerById(game,town.owner);
  const id = eraId(up ? base.levelUpTo : base.id,p.era||0);
  const cr = CREATURES[id];
  const pool = town.pool[base.id] || 0;
  const cost = esc(costStr(cr.cost));
  const affordable=Math.max(0,Math.min(pool,...Object.entries(cr.cost).filter(([,v])=>v>0).map(([k,v])=>Math.floor((p.resources[k]||0)/v))));
  return `<div class="modal-back"><div class="sheet"><header class="sheeth"><h2>${esc(cr.name)}</h2><button class="btn small ghost" data-act="back-town" data-town="${town.id}">Назад</button></header>
    <div class="body stack">
      <img class="portrait-lg" src="${portraitFor(id)}" alt="" style="max-height:200px">
      <p>${esc(cr.desc)}</p><p class="muted">${game.heroes.some(h=>!h.lost&&h.player===town.owner&&h.x===town.x&&h.y===town.y)?"Отряд присоединится к героине в городе.":"Отряд поступит в гарнизон города. Приведите героиню, чтобы забрать его."}</p>
      <p class="muted">Доступно: <b>${pool}</b> · Хватает ресурсов на: <b>${affordable}</b><br>Цена за одну: ${cost}.</p>
      <label class="field">Сколько нанять
        <input id="rec-n" type="range" min="1" max="${Math.max(1, affordable)}" value="${Math.max(1, affordable)}" ${affordable ? "" : "disabled"}>
      </label>
      <div id="rec-out" class="kicker" data-cost="${esc(JSON.stringify(cr.cost))}">1</div>
      <div class="row">
        <button class="btn primary" data-act="recruit-go" data-town="${town.id}" data-cr="${id}" ${affordable ? "" : "disabled"}>Нанять</button>
        <button class="btn" data-act="recruit-max" data-town="${town.id}" data-cr="${id}" data-n="${affordable}" ${affordable ? "" : "disabled"}>На все доступные средства</button>
        <button class="btn" data-act="creature" data-id="${id}">О существе</button>
      </div>
    </div></div></div>`;
}

export function mageTownHTML(game, townId) {
  const town = townById(game, townId);
  if (!town) return "";
  const visitor = game.heroes.find((h) => !h.lost && h.x === town.x && h.y === town.y && h.player === town.owner);
  const you = playerById(game, town.owner) && game.players[game.current].id === town.owner;
  const spells = (town.spells || []).map((id) => {
    const sp = SPELLS[id];
    return `<div class="list-item"><div style="flex:1"><b>${esc(sp.name)}</b> <span class="tag">круг ${sp.level}</span><div class="muted">${esc(sp.desc)}</div></div>
      <button class="btn small" data-act="learn-spell" data-town="${town.id}" data-spell="${id}" ${you && visitor ? "" : "disabled"}>Учить</button></div>`;
  }).join("");
  return `<div class="modal-back"><div class="sheet"><header class="sheeth"><h2>Гильдия магов</h2><button class="btn small ghost" data-act="back-town" data-town="${town.id}">Назад</button></header>
    <div class="body stack">
      ${you && visitor ? `<button class="btn" data-act="buy-book" data-town="${town.id}" data-hero="${visitor.id}">Книга заклинаний · 500</button>` : `<p class="muted">Чтобы учить, героиня должна стоять в городе.</p>`}
      ${spells || `<p class="muted">Страниц ещё нет.</p>`}
    </div></div></div>`;
}

export function smithHTML(game, townId) {
  const town = townById(game, townId);
  if (!town) return "";
  const visitor = game.heroes.find((h) => !h.lost && h.x === town.x && h.y === town.y && h.player === town.owner);
  const rows = Object.values(MACHINES).map((m) => `<div class="list-item"><div style="flex:1"><b>${esc(m.name)}</b><div class="muted">${esc(m.desc)} · ${esc(costStr(m.cost))}</div></div>
    <button class="btn small" data-act="buy-machine" data-town="${town.id}" data-hero="${visitor ? visitor.id : ""}" data-id="${m.id}" ${visitor ? "" : "disabled"}>Купить</button></div>`).join("");
  return `<div class="modal-back"><div class="sheet"><header class="sheeth"><h2>Оружейная</h2><button class="btn small ghost" data-act="back-town" data-town="${town.id}">Назад</button></header>
    <div class="body stack">${visitor ? "" : `<p class="muted">Нужна героиня в городе.</p>`}${rows}</div></div></div>`;
}

export function armyRow(army, which, enabled) {
  return `<div class="grid7">${army.map((sl, i) => {
    if (!sl) return `<button class="unit" data-act="army" data-which="${which}" data-i="${i}" ${enabled ? "" : "disabled"}>—</button>`;
    const cr = CREATURES[sl.id];
    return `<button class="unit" data-act="army" data-which="${which}" data-i="${i}" aria-label="${esc(cr.name)}">
      <img src="${portraitFor(sl.id)}" alt="">
      <b>${sl.count}</b>
    </button>`;
  }).join("")}</div>`;
}

function slotBtn(hero, id, label) {
  const aid = hero.artifacts[id];
  const a = aid && ARTIFACTS[aid];
  return `<button class="aslot ${a ? "on" : ""}" data-act="unequip" data-hero="${hero.id}" data-slot="${id}">
    <div class="tag">${esc(label)}</div>
    <div>${a ? esc(a.name) : "—"}</div>
  </button>`;
}

export function heroHTML(game, heroId) {
  const hero = heroById(game, heroId);
  if (!hero) return "";
  const e = effective(hero);
  const you = game.players[hero.player].control === "human";
  const byId = Object.fromEntries(SLOTS);
  const left = ["head", "cloak", "weapon", "feet"].map((id) => slotBtn(hero, id, byId[id])).join("");
  const right = ["neck", "shield", "chest", "ring1"].map((id) => slotBtn(hero, id, byId[id])).join("");
  const misc = ["ring2", "misc1", "misc2", "misc3", "misc4"].map((id) => slotBtn(hero, id, byId[id])).join("");
  const known = Object.entries(hero.skills);
  const skills = known.map(([id, lv]) => `<div class="skill"><b>${esc(SKILLS[id].name)}</b> <span class="tag">${esc(SKILL_RANK[lv])}</span><div class="muted">${esc(SKILLS[id].desc[lv] || "")}</div></div>`).join("")
    || `<p class="muted">Навыков пока нет.</p>`;
  const bag = hero.backpack.map((id, i) => {
    const a = ARTIFACTS[id];
    if (!a) return "";
    return `<button class="btn small" data-act="equip" data-hero="${hero.id}" data-i="${i}">${esc(a.name)}</button>`;
  }).join(" ");
  const next = xpForLevel(hero.level + 1);
  return `<div class="modal-back"><div class="sheet">
    <header class="sheeth"><h2>${esc(hero.name)}</h2><button class="btn small ghost" data-act="close-modal">Закрыть</button></header>
    <div class="body">
      <p class="kicker">${esc(FACTIONS[hero.faction].name)} · уровень ${hero.level} · опыт ${hero.xp}/${next}</p>
      <div class="hero-face">
        <img src="${esc(hero.portrait)}" alt="">
        <div class="stats">
          <div class="stat"><b>${e.attack}</b><span>атака</span></div>
          <div class="stat"><b>${e.defense}</b><span>защита</span></div>
          <div class="stat"><b>${e.power}</b><span>сила</span></div>
          <div class="stat"><b>${e.knowledge}</b><span>знание</span></div>
        </div>
      </div>
      <p class="muted">мораль ${e.morale} · удача ${e.luck} · ход ${hero.movement}/${maxMove(hero)} · мана ${hero.mana}/${maxMana(hero)} · обзор ${e.sight}</p>
      <h3>Снаряжение</h3>
      <div class="slots gear">${left}${right}${misc}</div>
      <h3>Навыки</h3>
      <div class="stack">${skills}</div>
      <h3>Войско</h3>
      ${armyRow(hero.army, "hero:" + hero.id, you)}
      <div class="row">
        <button class="btn small" data-act="split-ask" data-hero="${hero.id}">Разделить</button>
        <button class="btn small" data-act="next-hero">Следующая</button>
        <button class="btn small ghost" data-act="hero-wait">Снять выделение</button>
      </div>
      <h3>Сумка</h3>
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
  if (!hero) return `<div class="modal-back"><div class="sheet"><header class="sheeth"><h2>Уровень</h2></header><div class="body"><button class="btn" data-act="close-modal">Дальше</button></div></div></div>`;
  const offer = hero.offer;
  if (!offer) return `<div class="modal-back"><div class="sheet"><header class="sheeth"><h2>Уровень</h2></header><div class="body"><button class="btn" data-act="close-modal">Дальше</button></div></div></div>`;
  if (offer.kind === "stat") {
    const btns = ["attack", "defense", "power", "knowledge"].map((id) => {
      const nm = { attack: "Атака", defense: "Защита", power: "Сила магии", knowledge: "Знание" }[id];
      return `<button class="btn" data-act="level" data-hero="${hero.id}" data-id="${id}">${nm}</button>`;
    }).join("");
    return `<div class="modal-back"><div class="sheet"><header class="sheeth"><h2>Уровень ${hero.level}</h2></header><div class="body"><p>Все навыки на пределе. Куда вложить ещё единицу?</p><div class="stack">${btns}</div></div></div></div>`;
  }
  const btns = offer.options.map((id) => `<button class="choice-card" data-act="level" data-hero="${hero.id}" data-id="${id}"><b>${esc(SKILLS[id].name)}</b><span>${esc(SKILLS[id].desc[(hero.skills[id] || 0) + 1] || "")}</span></button>`).join("");
  return `<div class="modal-back"><div class="sheet"><header class="sheeth"><h2>${esc(hero.name)} · уровень ${hero.level}</h2></header>
    <div class="body"><p class="muted">Первичный навык уже вырос. Выберите одно из двух умений. Осталось выборов: ${hero.unspent}.</p><div class="choice-pair">${btns}</div></div></div></div>`;
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

const ABIL_NAME = {
  auraMorale: "аура морали", retal2: "двойной ответ", noRangePenalty: "без штрафа дистанции",
  unlimitedRetal: "неустанный ответ", auraLuck: "аура удачи", auraLuck2: "сильная аура удачи",
  joust: "разгон", breath: "дыхание", noEnemyRetal: "удар без ответа", doubleStrike: "двойной удар",
  doubleShot: "два выстрела", blindImmune: "иммунитет к слепоте", regenerate: "регенерация",
  poison: "яд", drain: "вампиризм", sorrowHit: "уныние", auraFear: "аура страха",
  deathStare: "взгляд смерти", immobile: "не двигается",
};

export function creatureHTML(id, back) {
  const cr = CREATURES[id];
  if (!cr) return "";
  const backBtn = `<button class="btn small ghost" data-act="modal-back">Назад</button>`;
  const abs = (cr.abilities || []).map((a) => ABIL_NAME[a] || a).join(", ");
  return `<div class="modal-back"><div class="sheet"><header class="sheeth"><h2>${esc(cr.name)}</h2>${backBtn}</header>
    <div class="body stack">
      <img class="portrait-lg" src="${portraitFor(id)}" alt="" style="max-height:220px">
      <div class="stats">
        <div class="stat"><b>${cr.atk}</b><span>атака</span></div>
        <div class="stat"><b>${cr.def}</b><span>защита</span></div>
        <div class="stat"><b>${cr.min}–${cr.max}</b><span>урон</span></div>
        <div class="stat"><b>${cr.hp}</b><span>здоровье</span></div>
        <div class="stat"><b>${cr.spd}</b><span>скорость</span></div>
        <div class="stat"><b>${cr.shots || "—"}</b><span>выстрелы</span></div>
      </div>
      <p>${esc(cr.desc)}</p>
      <p class="muted">${cr.flying ? "Летает. " : ""}${cr.ranged ? "Стреляет. " : ""}${abs ? "Умения: " + esc(abs) + ". " : ""}Цена: ${esc(costStr(cr.cost))}.</p>
    </div></div></div>`;
}

export function eventHTML(title, text) {
  return `<div class="modal-back"><div class="sheet"><header class="sheeth"><h2>${esc(title || "Событие")}</h2></header>
    <div class="body stack">${voiceHTML("Странница", text)}
    <button class="btn primary" data-act="close-modal">Дальше</button></div></div></div>`;
}

export function weekHTML(game) {
  const cal = calendar(game.day);
  const lines = (game.log || []).filter((l) => l.day === game.day).slice(-6).map((l) => `<p>${esc(l.text)}</p>`).join("");
  return `<div class="modal-back"><div class="sheet"><header class="sheeth"><h2>${esc(cal.label)}</h2></header>
    <div class="body stack"><p class="kicker">День ${esc(cal.dayName)}</p>${lines || "<p>Новая неделя.</p>"}
    <button class="btn primary" data-act="close-modal">В путь</button></div></div></div>`;
}

export function heroesHTML(game) {
  const p = game.players.find((pl) => pl.control === "human");
  const list = game.heroes.filter((h) => h.player === p.id && !h.lost).map((h) =>
    `<button class="list-item" data-act="pick-hero" data-id="${h.id}"><img src="${esc(h.portrait)}" alt=""><div><b>${esc(h.name)}</b><div class="muted">уровень ${h.level} · ход ${h.movement} · мана ${h.mana}</div></div></button>`).join("");
  return `<div class="modal-back"><div class="sheet"><header class="sheeth"><h2>Героини</h2><button class="btn small ghost" data-act="close-modal">Закрыть</button></header>
    <div class="body stack">${list || `<p class="muted">Никого не осталось.</p>`}</div></div></div>`;
}

export function townsHTML(game) {
  const p = game.players.find((pl) => pl.control === "human");
  const list = game.towns.filter((t) => t.owner === p.id).map((t) =>
    `<button class="list-item" data-act="focus-town" data-id="${t.id}"><div><b>${esc(t.name)}</b><div class="muted">${esc(FACTIONS[t.faction].name)}</div></div></button>`).join("");
  return `<div class="modal-back"><div class="sheet"><header class="sheeth"><h2>Города</h2><button class="btn small ghost" data-act="close-modal">Закрыть</button></header>
    <div class="body stack">${list || `<p class="muted">Городов нет.</p>`}</div></div></div>`;
}

export function battleLogHTML(battle) {
  const lines = (battle.log || []).slice(-16).map((l) => `<p>${esc(l)}</p>`).join("") || "<p class=\"muted\">Журнал пуст.</p>";
  return `<div class="modal-back"><div class="sheet"><header class="sheeth"><h2>Журнал боя</h2><button class="btn small ghost" data-act="close-modal">Закрыть</button></header>
    <div class="body">${lines}</div></div></div>`;
}

export function surrenderHTML(cost) {
  return `<div class="modal-back"><div class="sheet"><header class="sheeth"><h2>Сдаться?</h2></header>
    <div class="body stack"><p>Войско будет распущено. Выкуп: ${cost} золота, если казна потянет.</p>
      <button class="btn primary" data-act="battle-surrender-yes">Сдаться</button>
      <button class="btn ghost" data-act="close-modal">Драться дальше</button>
    </div></div></div>`;
}

export function dwellingHTML(game, hero, obj) {
  const cr = CREATURES[obj.creature];
  const pool = obj.pool || 0;
  return `<div class="modal-back"><div class="sheet"><header class="sheeth"><h2>${esc(cr.name)}</h2><button class="btn small ghost" data-act="close-modal">Закрыть</button></header>
    <div class="body stack">
      <img class="portrait-lg" src="${portraitFor(obj.creature)}" alt="" style="max-height:180px">
      <p>Доступно ${pool}. Цена: ${esc(costStr(cr.cost))}.</p>
      <label class="field">Сколько<input id="dw-n" type="range" min="1" max="${Math.max(1, affordable)}" value="${Math.max(1, affordable)}" ${affordable ? "" : "disabled"}></label>
      <div id="dw-out" class="kicker">${Math.min(pool, pool) || 0}</div>
      <button class="btn primary" data-act="dwell-buy" data-hero="${hero.id}" data-obj="${obj.id}" ${affordable ? "" : "disabled"}>Нанять в армию</button>
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
  if (!p) {
    return `<div class="modal-back"><div class="sheet"><header class="sheeth"><h2>Королевство</h2><button class="btn small ghost" data-act="close-modal">Закрыть</button></header><div class="body"><p>Двор ещё не выбран.</p></div></div></div>`;
  }
  const heroes = game.heroes.filter((h) => h.player === p.id && !h.lost).map((h) =>
    `<button class="btn small" data-act="focus-hero" data-id="${h.id}">${esc(h.name)} · ур.${h.level} · ход ${h.movement}</button>`).join("");
  const towns = game.towns.filter((t) => t.owner === p.id).map((t) =>
    `<button class="btn small" data-act="focus-town" data-id="${t.id}">${esc(t.name)}</button>`).join("");
  return `<div class="modal-back"><div class="sheet"><header class="sheeth"><h2>Королевство</h2><button class="btn small ghost" data-act="close-modal">Закрыть</button></header>
    <div class="body"><h3>Героини</h3><div class="stack">${heroes}</div><h3>Города</h3><div class="stack">${towns}</div>
    <h3>Журнал</h3>${game.log.slice(-8).map((l) => `<div class="muted">${esc(l.text)}</div>`).join("")}
    </div></div></div>`;
}

export function questHTML(game) {
  const goal = (game.victory && game.victory.type === "grail")
    ? "Найдите святыню и поставьте её в город."
    : "Погасите все чужие знамёна.";
  const lines = (game.log || []).slice(-6).map((l) => `<p class="muted">${esc(l.text)}</p>`).join("");
  return `<div class="modal-back"><div class="sheet"><header class="sheeth"><h2>Цель</h2><button class="btn small ghost" data-act="close-modal">Закрыть</button></header>
    <div class="body stack">${voiceHTML("Кастелянша Лира", goal)}${lines}
      <button class="btn" data-act="close-modal">В путь</button>
    </div></div></div>`;
}

export function endHTML(end) {
  return `<div class="modal-back"><div class="sheet"><header class="sheeth"><h2>${end.win ? "Победа" : "Поражение"}</h2></header>
    <div class="body stack">${voiceHTML(end.win ? "Глашатайша" : "Кастелянша Лира", end.win ? "Знамя держится. Двор ваш." : "Двор отступил, но имена помнят.")}
      <p>${esc(end.text)}</p>
      <button class="btn primary" data-act="to-menu">В меню</button>
    </div></div></div>`;
}

export function briefHTML(game) {
  return `<div class="modal-back"><div class="sheet"><header class="sheeth"><h2>${esc(game.name)}</h2></header>
    <div class="body stack">${voiceHTML("Кастелянша Лира", "Слушайте приказ двора и не теряйте знамя.")}
      <p>${esc(game.briefing || "Знамя поднято.")}</p>
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

export function resourceName(k){return RES_NAME[k]||k;}
function factionChoice(){return `<fieldset class="faction-picker"><legend>Выберите свой народ</legend><div class="faction-grid">${FACTION_ORDER.map((id,i)=>`<label class="faction-option"><input type="radio" name="faction-choice" value="${id}" ${i===0?"checked":""}><span class="faction-card" style="--faction:${FACTIONS[id].color}"><img src="${eraArt(id,0,0)}" alt="${esc(FACTIONS[id].name)}"><b>${esc(FACTIONS[id].name)}</b><small>${esc(FACTIONS[id].blurb)}</small></span></label>`).join("")}</div><p class="muted">Соперницы принадлежат другим народам. В кампании развитие начинается с древности. В схватке можно выбрать эпоху.</p></fieldset>`;}
function buildingArt(b,town,era=0){if(b.tier)return portraitFor(eraId(tiersOf(town.faction)[b.tier-1]?.id||"s_page",era));if(/Hall|capitol/.test(b.id))return BLD_SPRITE.hall;if(/fort|citadel|castle/.test(b.id))return `art/sprites/castle-${town.faction==="inca"?"emerald":town.faction}.webp`;if(b.id.startsWith("mage"))return BLD_SPRITE.mage;return BLD_SPRITE[b.id]||BLD_SPRITE[b.id==="blacksmith"?"smith":b.id==="special"?"mage":"silo"];}
function eraPanel(game,town){const s=eraStatus(game,town),p=playerById(game,town.owner);return `<section class="era-panel"><div class="era-steps">${ERAS.map(e=>`<span class="${e.id===s.current?"current":e.id<s.current?"done":""}">${e.id<s.current?"✓ ":""}${e.name}</span>`).join("")}</div>${s.next?`<div class="era-preview"><img src="${eraArt(p.faction,s.next.id,0)}" alt="Образ следующей эпохи"><div><h3>Открыть: ${s.next.name}</h3><p>${esc(s.next.desc)}</p><p class="price">${esc(costStr(s.next.cost))}</p><p class="muted">${s.reasons.map(r=>r.startsWith("building:")?"Нужно здание: "+(buildingDef(town.faction,r.split(":")[1])?.name||r):r.startsWith("resource:")?"Не хватает: "+r.split(":")[2]+" "+resourceName(r.split(":")[1]):r).map(esc).join("<br>")||"Все условия выполнены"}</p><button class="btn primary" data-act="research-era" data-town="${town.id}" ${s.ready&&p.control==="human"?"":"disabled"}>Перейти в новую эпоху</button></div></div>`:`<h3>Современная цивилизация</h3><p>Ваши воительницы используют новейшее снаряжение.</p>`}</section>`;}
