/** Статические данные «Лаковых королевств». Оригинальный мир, механика близкая к HoMM III. */

export const GAME_VERSION = "1.2.0";

export const RES_KEYS = ["gold", "lacquer", "resin", "pigment", "amber", "crystal", "pearl"];
export const RES_NAME = {
  gold: "Золото",
  lacquer: "Лак",
  resin: "Смола",
  pigment: "Пигмент",
  amber: "Янтарь",
  crystal: "Хрусталь",
  pearl: "Жемчуг",
};

export const T_GRASS = 0;
export const T_DIRT = 1;
export const T_SAND = 2;
export const T_SNOW = 3;
export const T_SWAMP = 4;
export const T_LAVA = 5;
export const T_HILL = 6;
export const T_FOREST = 7;
export const T_WATER = 8;
export const T_MOUNTAIN = 9;
export const T_NAMES = ["луг", "грунт", "песок", "снег", "топь", "лава", "холм", "лес", "вода", "горы"];

export const FLAG_ROAD = 1;
export const FLAG_RIVER = 2;
export const FLAG_FORD = 4;

export const FACTIONS = {
  scarlet: {
    id: "scarlet",
    name: "Алый Лак",
    epithet: "Двор багряного блеска",
    town: "Лаковая цитадель",
    blurb: "Рыцарский двор, где доспех сияет как мокрый кармин, а клятвы держат крепче стали.",
    color: "#c4374f",
    deep: "#4a1020",
    gold: "#e6c56b",
    castle: "art/castle-scarlet.jpg",
  },
  emerald: {
    id: "emerald",
    name: "Изумрудный Винил",
    epithet: "Роща живого лака",
    town: "Виниловая цитадель",
    blurb: "Лесные дома, где листва глянцевая, как винил, а ведьмы говорят с корнями.",
    color: "#1f8a5b",
    deep: "#0c3a28",
    gold: "#d5e6c8",
    castle: "art/castle-emerald.jpg",
  },
  onyx: {
    id: "onyx",
    name: "Чернильный Оникс",
    epithet: "Бездна ночного лака",
    town: "Ониксовый шпиль",
    blurb: "Учёные ночи и чернильные клятвы. Их мёртвые не спят — они блестят.",
    color: "#8b6bc4",
    deep: "#1a1028",
    gold: "#c9b6ef",
    castle: "art/castle-onyx.jpg",
  },
};

const ab = (list) => list;

function unit(p) {
  return Object.assign(
    {
      shots: 0,
      ranged: false,
      flying: false,
      undead: false,
      mindless: false,
      abilities: [],
      growth: 0,
      cost: { gold: 0 },
    },
    p
  );
}

export const CREATURES = {};

function add(u) {
  CREATURES[u.id] = u;
}

// --- Алый Лак ---
add(unit({ id: "s_page", faction: "scarlet", tier: 1, name: "Паж лака", levelUpTo: "s_page_u", atk: 4, def: 5, min: 1, max: 2, hp: 10, spd: 4, growth: 14, cost: { gold: 50 }, desc: "Молодая присяжная двора. Держит строй и не отступает.", abilities: [] }));
add(unit({ id: "s_page_u", faction: "scarlet", tier: 1, name: "Глянцевая паж", upgradeOf: "s_page", atk: 5, def: 6, min: 1, max: 3, hp: 12, spd: 5, growth: 14, cost: { gold: 70 }, desc: "Знамя двора: рядом с ней свои смелее.", abilities: ["auraMorale"] }));
add(unit({ id: "s_shield", faction: "scarlet", tier: 2, name: "Щитоносица", levelUpTo: "s_shield_u", atk: 6, def: 9, min: 2, max: 3, hp: 18, spd: 4, growth: 9, cost: { gold: 100 }, desc: "Стена лака. Принимает удар на широкий щит.", abilities: [] }));
add(unit({ id: "s_shield_u", faction: "scarlet", tier: 2, name: "Бастионная щитоносица", upgradeOf: "s_shield", atk: 7, def: 11, min: 2, max: 4, hp: 22, spd: 5, growth: 9, cost: { gold: 140 }, desc: "Отвечает на удар дважды.", abilities: ["retal2"] }));
add(unit({ id: "s_xbow", faction: "scarlet", tier: 3, name: "Арбалетчица", levelUpTo: "s_xbow_u", atk: 6, def: 3, min: 2, max: 4, hp: 10, spd: 4, growth: 7, shots: 12, ranged: true, cost: { gold: 150 }, desc: "Бьёт с галерей цитадели.", abilities: [] }));
add(unit({ id: "s_xbow_u", faction: "scarlet", tier: 3, name: "Снайперша двора", upgradeOf: "s_xbow", atk: 8, def: 4, min: 3, max: 5, hp: 12, spd: 6, growth: 7, shots: 24, ranged: true, cost: { gold: 220 }, desc: "Нет штрафа дистанции: болт находит цель.", abilities: ["noRangePenalty"] }));
add(unit({ id: "s_griff", faction: "scarlet", tier: 4, name: "Грифонша", levelUpTo: "s_griff_u", atk: 8, def: 8, min: 4, max: 7, hp: 30, spd: 6, growth: 5, flying: true, cost: { gold: 280 }, desc: "Крылатая стража. Бьёт в ответ без устали.", abilities: ["unlimitedRetal"] }));
add(unit({ id: "s_griff_u", faction: "scarlet", tier: 4, name: "Королевская грифонша", upgradeOf: "s_griff", atk: 9, def: 9, min: 5, max: 9, hp: 36, spd: 9, growth: 5, flying: true, cost: { gold: 380 }, desc: "Пикирует и отвечает на каждый удар.", abilities: ["unlimitedRetal"] }));
add(unit({ id: "s_knight", faction: "scarlet", tier: 5, name: "Рыцарша", levelUpTo: "s_knight_u", atk: 12, def: 12, min: 8, max: 12, hp: 45, spd: 6, growth: 4, cost: { gold: 500 }, desc: "Клятва и лаковая кираса.", abilities: [] }));
add(unit({ id: "s_knight_u", faction: "scarlet", tier: 5, name: "Паладинша лака", upgradeOf: "s_knight", atk: 14, def: 14, min: 10, max: 14, hp: 55, spd: 7, growth: 4, cost: { gold: 700 }, desc: "Аура удачи и двойной ответ, если стоит на месте.", abilities: ["auraLuck", "retal2"] }));
add(unit({ id: "s_champ", faction: "scarlet", tier: 6, name: "Чемпионша", levelUpTo: "s_champ_u", atk: 16, def: 14, min: 12, max: 20, hp: 90, spd: 7, growth: 2, cost: { gold: 1000 }, desc: "Тяжёлая конница двора.", abilities: ["joust"] }));
add(unit({ id: "s_champ_u", faction: "scarlet", tier: 6, name: "Лак-чемпионша", upgradeOf: "s_champ", atk: 18, def: 16, min: 15, max: 25, hp: 110, spd: 9, growth: 2, cost: { gold: 1400 }, desc: "Чем дальше разгон, тем страшнее копьё.", abilities: ["joust"] }));
add(unit({ id: "s_dragon", faction: "scarlet", tier: 7, name: "Лакдраконица", levelUpTo: "s_dragon_u", atk: 20, def: 20, min: 30, max: 40, hp: 180, spd: 11, growth: 1, flying: true, cost: { gold: 3000, crystal: 2, amber: 2 }, desc: "Дыхание лака задевает строй за целью.", abilities: ["breath"] }));
add(unit({ id: "s_dragon_u", faction: "scarlet", tier: 7, name: "Багровая лакдраконица", upgradeOf: "s_dragon", atk: 24, def: 24, min: 40, max: 50, hp: 250, spd: 13, growth: 1, flying: true, cost: { gold: 4500, crystal: 2, amber: 2, pearl: 1 }, desc: "Дыхание и удар, на который не отвечают.", abilities: ["breath", "noEnemyRetal"] }));

// --- Изумрудный Винил ---
add(unit({ id: "e_dew", faction: "emerald", tier: 1, name: "Росницесса", levelUpTo: "e_dew_u", atk: 3, def: 2, min: 1, max: 2, hp: 6, spd: 5, growth: 18, cost: { gold: 35 }, desc: "Быстрая застрельщица рощи.", abilities: [] }));
add(unit({ id: "e_dew_u", faction: "emerald", tier: 1, name: "Сияющая росницесса", upgradeOf: "e_dew", atk: 4, def: 3, min: 1, max: 3, hp: 8, spd: 7, growth: 18, cost: { gold: 55 }, desc: "Бьёт и отступает из-под ответа.", abilities: ["noEnemyRetal"] }));
add(unit({ id: "e_bow", faction: "emerald", tier: 2, name: "Виниловая лучница", levelUpTo: "e_bow_u", atk: 6, def: 3, min: 2, max: 3, hp: 10, spd: 5, growth: 10, shots: 12, ranged: true, cost: { gold: 110 }, desc: "Стрела из лаковой лозы.", abilities: [] }));
add(unit({ id: "e_bow_u", faction: "emerald", tier: 2, name: "Мастер-лучница", upgradeOf: "e_bow", atk: 8, def: 4, min: 2, max: 4, hp: 12, spd: 6, growth: 10, shots: 24, ranged: true, cost: { gold: 170 }, desc: "Два выстрела за ход.", abilities: ["doubleShot"] }));
add(unit({ id: "e_uni", faction: "emerald", tier: 3, name: "Единорожка", levelUpTo: "e_uni_u", atk: 9, def: 7, min: 3, max: 5, hp: 26, spd: 7, growth: 6, cost: { gold: 220 }, desc: "Рядом с ней удача липнет к своим.", abilities: ["auraLuck"] }));
add(unit({ id: "e_uni_u", faction: "emerald", tier: 3, name: "Боевая единорожка", upgradeOf: "e_uni", atk: 11, def: 9, min: 4, max: 7, hp: 32, spd: 8, growth: 6, cost: { gold: 320 }, desc: "Сильная аура удачи. Слепота её не берёт.", abilities: ["auraLuck2", "blindImmune"] }));
add(unit({ id: "e_tree", faction: "emerald", tier: 4, name: "Древесная стражница", levelUpTo: "e_tree_u", atk: 9, def: 12, min: 5, max: 8, hp: 45, spd: 4, growth: 4, cost: { gold: 350 }, desc: "Корни держат землю, кора держит удар.", abilities: [] }));
add(unit({ id: "e_tree_u", faction: "emerald", tier: 4, name: "Древняя стражница", upgradeOf: "e_tree", atk: 10, def: 15, min: 6, max: 10, hp: 60, spd: 5, growth: 4, cost: { gold: 480 }, desc: "Затягивает раны каждый свой ход.", abilities: ["regenerate"] }));
add(unit({ id: "e_witch", faction: "emerald", tier: 5, name: "Ведьма рощи", levelUpTo: "e_witch_u", atk: 12, def: 8, min: 8, max: 11, hp: 30, spd: 6, growth: 3, shots: 12, ranged: true, cost: { gold: 500 }, desc: "Бьёт чарами в упор без штрафа.", abilities: ["noRangePenalty"] }));
add(unit({ id: "e_witch_u", faction: "emerald", tier: 5, name: "Верховная ведьма", upgradeOf: "e_witch", atk: 14, def: 10, min: 10, max: 14, hp: 36, spd: 7, growth: 3, shots: 24, ranged: true, cost: { gold: 700 }, desc: "Попадание ослабляет защиту цели.", abilities: ["noRangePenalty", "poison"] }));
add(unit({ id: "e_serpent", faction: "emerald", tier: 6, name: "Изумрудный змей", levelUpTo: "e_serpent_u", atk: 15, def: 13, min: 14, max: 20, hp: 80, spd: 8, growth: 2, cost: { gold: 900 }, desc: "Яд снимает защиту.", abilities: ["poison"] }));
add(unit({ id: "e_serpent_u", faction: "emerald", tier: 6, name: "Королевский змей", upgradeOf: "e_serpent", atk: 17, def: 15, min: 18, max: 26, hp: 100, spd: 11, growth: 2, cost: { gold: 1300 }, desc: "Ядовитый бросок, на который не отвечают.", abilities: ["poison", "noEnemyRetal"] }));
add(unit({ id: "e_titan", faction: "emerald", tier: 7, name: "Виниловый титан", levelUpTo: "e_titan_u", atk: 19, def: 18, min: 20, max: 30, hp: 160, spd: 7, growth: 1, shots: 16, ranged: true, cost: { gold: 2800, pearl: 2, crystal: 1 }, desc: "Лук размером с ворота. Штрафа дистанции нет.", abilities: ["noRangePenalty"] }));
add(unit({ id: "e_titan_u", faction: "emerald", tier: 7, name: "Изумрудный титан", upgradeOf: "e_titan", atk: 22, def: 22, min: 28, max: 40, hp: 200, spd: 11, growth: 1, shots: 24, ranged: true, cost: { gold: 4200, pearl: 2, crystal: 2 }, desc: "Два сокрушительных выстрела.", abilities: ["noRangePenalty", "doubleShot"] }));

// --- Чернильный Оникс ---
add(unit({ id: "o_spark", faction: "onyx", tier: 1, name: "Чернильная искра", levelUpTo: "o_spark_u", atk: 3, def: 3, min: 1, max: 2, hp: 6, spd: 5, growth: 20, undead: true, cost: { gold: 30 }, desc: "Мелкая нежить чернил. Мораль её не касается.", abilities: [] }));
add(unit({ id: "o_spark_u", faction: "onyx", tier: 1, name: "Сгусток чернил", upgradeOf: "o_spark", atk: 4, def: 4, min: 1, max: 3, hp: 8, spd: 6, growth: 20, undead: true, cost: { gold: 45 }, desc: "Гуще, злее, всё так же не знает страха.", abilities: [] }));
add(unit({ id: "o_shade", faction: "onyx", tier: 2, name: "Теневая лучница", levelUpTo: "o_shade_u", atk: 5, def: 3, min: 2, max: 3, hp: 8, spd: 5, growth: 10, shots: 12, ranged: true, undead: true, cost: { gold: 100 }, desc: "Стрелы из сгустившейся ночи.", abilities: [] }));
add(unit({ id: "o_shade_u", faction: "onyx", tier: 2, name: "Ночная лучница", upgradeOf: "o_shade", atk: 7, def: 4, min: 2, max: 4, hp: 10, spd: 6, growth: 10, shots: 24, ranged: true, undead: true, cost: { gold: 150 }, desc: "Стреляет без штрафа и сквозь суету ближнего боя.", abilities: ["noRangePenalty"] }));
add(unit({ id: "o_wraith", faction: "onyx", tier: 3, name: "Призрачная всадница", levelUpTo: "o_wraith_u", atk: 7, def: 6, min: 3, max: 5, hp: 18, spd: 7, growth: 7, flying: true, undead: true, cost: { gold: 180 }, desc: "Проходит над строем.", abilities: [] }));
add(unit({ id: "o_wraith_u", faction: "onyx", tier: 3, name: "Спектральная всадница", upgradeOf: "o_wraith", atk: 9, def: 8, min: 4, max: 7, hp: 24, spd: 9, growth: 7, flying: true, undead: true, cost: { gold: 260 }, desc: "Удар из тумана не получает ответа.", abilities: ["noEnemyRetal"] }));
add(unit({ id: "o_vamp", faction: "onyx", tier: 4, name: "Кровопийца", levelUpTo: "o_vamp_u", atk: 10, def: 8, min: 5, max: 8, hp: 32, spd: 6, growth: 4, undead: true, cost: { gold: 380 }, desc: "Пьёт нанесённый урон и встаёт плотнее.", abilities: ["drain"] }));
add(unit({ id: "o_vamp_u", faction: "onyx", tier: 4, name: "Высшая кровопийца", upgradeOf: "o_vamp", atk: 12, def: 10, min: 6, max: 10, hp: 40, spd: 8, growth: 4, undead: true, cost: { gold: 550 }, desc: "Пьёт жизнь и не получает ответа.", abilities: ["drain", "noEnemyRetal"] }));
add(unit({ id: "o_bone", faction: "onyx", tier: 5, name: "Костяная ведьма", levelUpTo: "o_bone_u", atk: 12, def: 10, min: 8, max: 11, hp: 32, spd: 6, growth: 3, shots: 12, ranged: true, undead: true, cost: { gold: 580 }, desc: "Чернильный заряд с кладбищенским холодом.", abilities: [] }));
add(unit({ id: "o_bone_u", faction: "onyx", tier: 5, name: "Лич-королева", upgradeOf: "o_bone", atk: 15, def: 12, min: 11, max: 15, hp: 42, spd: 7, growth: 3, shots: 24, ranged: true, undead: true, cost: { gold: 800 }, desc: "Стреляет без штрафа и роняет боевой дух врага.", abilities: ["noRangePenalty", "sorrowHit"] }));
add(unit({ id: "o_knight", faction: "onyx", tier: 6, name: "Чернильный рыцарь", levelUpTo: "o_knight_u", atk: 16, def: 16, min: 12, max: 18, hp: 95, spd: 7, growth: 2, undead: true, cost: { gold: 1100 }, desc: "Тяжёлая нежить в ониксовом лаке.", abilities: ["auraFear"] }));
add(unit({ id: "o_knight_u", faction: "onyx", tier: 6, name: "Рыцарь бездны", upgradeOf: "o_knight", atk: 18, def: 18, min: 15, max: 24, hp: 120, spd: 9, growth: 2, undead: true, cost: { gold: 1600 }, desc: "Взгляд бездны иногда забирает лишнюю жизнь.", abilities: ["auraFear", "deathStare"] }));
add(unit({ id: "o_dragon", faction: "onyx", tier: 7, name: "Ониксовый дракон", levelUpTo: "o_dragon_u", atk: 22, def: 20, min: 30, max: 45, hp: 200, spd: 12, growth: 1, flying: true, undead: true, cost: { gold: 3200, pigment: 2, pearl: 2 }, desc: "Дыхание чернил бьёт по шеренге.", abilities: ["breath"] }));
add(unit({ id: "o_dragon_u", faction: "onyx", tier: 7, name: "Абсолют оникса", upgradeOf: "o_dragon", atk: 26, def: 24, min: 40, max: 55, hp: 280, spd: 15, growth: 1, flying: true, undead: true, cost: { gold: 4800, pigment: 2, pearl: 2, crystal: 1 }, desc: "Дыхание, страх и удар без ответа.", abilities: ["breath", "auraFear", "noEnemyRetal"] }));

// Нейтралы и боевые машины
add(unit({ id: "n_bandit", faction: "neutral", tier: 2, name: "Разбойница", levelUpTo: "n_bandit_u", atk: 6, def: 3, min: 2, max: 4, hp: 12, spd: 6, growth: 8, cost: { gold: 90 }, desc: "Вольная наёмница трактов.", abilities: [] }));
add(unit({ id: "n_bandit_u", faction: "neutral", tier: 2, name: "Атаманша", upgradeOf: "n_bandit", atk: 8, def: 5, min: 3, max: 5, hp: 16, spd: 7, growth: 8, cost: { gold: 140 }, desc: "Бьёт дважды, если дотянулась.", abilities: ["doubleStrike"] }));
add(unit({ id: "n_nomad", faction: "neutral", tier: 3, name: "Кочевница", levelUpTo: "n_nomad_u", atk: 8, def: 6, min: 3, max: 6, hp: 22, spd: 7, growth: 6, cost: { gold: 180 }, desc: "Степная наездница.", abilities: ["joust"] }));
add(unit({ id: "n_nomad_u", faction: "neutral", tier: 3, name: "Степная наездница", upgradeOf: "n_nomad", atk: 10, def: 7, min: 4, max: 8, hp: 28, spd: 9, growth: 6, cost: { gold: 260 }, desc: "Длинный разгон.", abilities: ["joust"] }));
add(unit({ id: "n_elem", faction: "neutral", tier: 4, name: "Лаковый элементаль", levelUpTo: "n_elem_u", atk: 10, def: 10, min: 6, max: 8, hp: 35, spd: 5, growth: 4, mindless: true, cost: { gold: 320 }, desc: "Оживший глянец. Не знает ни морали, ни удачи.", abilities: [] }));
add(unit({ id: "n_elem_u", faction: "neutral", tier: 4, name: "Большой элементаль", upgradeOf: "n_elem", atk: 12, def: 12, min: 8, max: 12, hp: 50, spd: 6, growth: 4, mindless: true, cost: { gold: 450 }, desc: "Тяжёлый голем лака.", abilities: [] }));
add(unit({ id: "n_mage", faction: "neutral", tier: 4, name: "Бродячая чародейка", atk: 11, def: 7, min: 7, max: 9, hp: 22, spd: 6, growth: 3, shots: 16, ranged: true, cost: { gold: 400 }, desc: "Продаёт заклинания и не любит штраф дистанции.", abilities: ["noRangePenalty"] }));
add(unit({ id: "el_air", faction: "neutral", tier: 5, name: "Элементаль воздуха", atk: 14, def: 10, min: 8, max: 10, hp: 30, spd: 8, growth: 0, flying: true, mindless: true, cost: { gold: 0 }, desc: "Вызванный вихрь.", abilities: [] }));
add(unit({ id: "el_fire", faction: "neutral", tier: 5, name: "Элементаль огня", atk: 15, def: 8, min: 9, max: 12, hp: 32, spd: 6, growth: 0, mindless: true, cost: { gold: 0 }, desc: "Вызванное пламя.", abilities: ["breath"] }));
add(unit({ id: "el_water", faction: "neutral", tier: 5, name: "Элементаль воды", atk: 12, def: 14, min: 6, max: 9, hp: 40, spd: 5, growth: 0, mindless: true, cost: { gold: 0 }, desc: "Вызванная стужа.", abilities: [] }));
add(unit({ id: "el_earth", faction: "neutral", tier: 5, name: "Элементаль земли", atk: 13, def: 16, min: 7, max: 10, hp: 45, spd: 4, growth: 0, mindless: true, cost: { gold: 0 }, desc: "Вызванный камень.", abilities: [] }));
add(unit({ id: "tower", faction: "neutral", tier: 5, name: "Башня", atk: 12, def: 16, min: 4, max: 6, hp: 120, spd: 0, shots: 99, ranged: true, mindless: true, cost: { gold: 0 }, desc: "Крепостная башня.", abilities: ["noRangePenalty", "immobile"] }));
add(unit({ id: "ballista", faction: "neutral", tier: 3, name: "Баллиста", atk: 8, def: 4, min: 2, max: 3, hp: 25, spd: 0, shots: 16, ranged: true, mindless: true, cost: { gold: 1500 }, desc: "Осадная машина героини.", abilities: ["immobile"] }));

export const ABILITY_DESC = {
  auraMorale: "Аура: +1 мораль союзникам",
  auraLuck: "Аура: +1 удача союзникам",
  auraLuck2: "Аура: +2 удача союзникам",
  auraFear: "Аура: −1 мораль врагам",
  retal2: "Два контрудара за раунд",
  unlimitedRetal: "Неограниченные контрудары",
  noRangePenalty: "Стрельба без штрафа дистанции и в упор",
  unlimitedRetal2: "",
  doubleShot: "Два выстрела",
  doubleStrike: "Два удара в ближнем бою",
  joust: "+5% урона за каждую клетку разгона",
  breath: "Дыхание бьёт и клетку за целью",
  noEnemyRetal: "Враг не отвечает на удар",
  drain: "Лечится нанесённым уроном",
  regenerate: "В начале хода лечит 20% здоровья",
  poison: "Удар снижает защиту цели",
  deathStare: "Шанс уничтожить дополнительную цель",
  sorrowHit: "Попадание снижает мораль вражеской армии",
  blindImmune: "Иммунитет к слепоте",
  immobile: "Не двигается",
};

export function baseCreatureId(id) {
  const c = CREATURES[id];
  return c && c.upgradeOf ? c.upgradeOf : id;
}

export function tiersOf(faction) {
  const list = [];
  for (let t = 1; t <= 7; t++) {
    const base = Object.values(CREATURES).find((c) => c.faction === faction && c.tier === t && !c.upgradeOf);
    if (base) list.push(base);
  }
  return list;
}

export const SKILLS = {
  offense: { id: "offense", name: "Нападение", desc: ["", "Урон в ближнем бою +10%", "Урон в ближнем бою +20%", "Урон в ближнем бою +30%"] },
  armorer: { id: "armorer", name: "Доспехи", desc: ["", "Получаемый урон −5%", "Получаемый урон −10%", "Получаемый урон −15%"] },
  archery: { id: "archery", name: "Стрельба", desc: ["", "Дальний урон +15%", "Дальний урон +30%", "Дальний урон +50%"] },
  leadership: { id: "leadership", name: "Лидерство", desc: ["", "+1 мораль", "+2 мораль", "+3 мораль"] },
  luck: { id: "luck", name: "Удача", desc: ["", "+1 удача", "+2 удача", "+3 удача"] },
  logistics: { id: "logistics", name: "Логистика", desc: ["", "Запас хода +10%", "Запас хода +20%", "Запас хода +30%"] },
  scouting: { id: "scouting", name: "Разведка", desc: ["", "Обзор +1", "Обзор +2", "Обзор +3"] },
  wisdom: { id: "wisdom", name: "Мудрость", desc: ["", "Заклинания до 2 круга", "Заклинания до 3 круга", "Заклинания до 5 круга"] },
  sorcery: { id: "sorcery", name: "Чародейство", desc: ["", "Урон заклинаний +15%", "Урон заклинаний +30%", "Урон заклинаний +50%"] },
  intelligence: { id: "intelligence", name: "Интеллект", desc: ["", "Мана +25%", "Мана +50%", "Мана +100%"] },
  mysticism: { id: "mysticism", name: "Мистицизм", desc: ["", "+2 маны в день", "+4 маны в день", "+6 маны в день"] },
  air: { id: "air", name: "Магия воздуха", desc: ["", "Воздух: базовый", "Воздух: продвинутый", "Воздух: эксперт"] },
  fire: { id: "fire", name: "Магия огня", desc: ["", "Огонь: базовый", "Огонь: продвинутый", "Огонь: эксперт"] },
  water: { id: "water", name: "Магия воды", desc: ["", "Вода: базовый", "Вода: продвинутый", "Вода: эксперт"] },
  earth: { id: "earth", name: "Магия земли", desc: ["", "Земля: базовый", "Земля: продвинутый", "Земля: эксперт"] },
  tactics: { id: "tactics", name: "Тактика", desc: ["", "Расстановка +2 ряда", "Расстановка +3 ряда", "Расстановка +4 ряда"] },
  learning: { id: "learning", name: "Учение", desc: ["", "Опыт +10%", "Опыт +20%", "Опыт +30%"] },
  resistance: { id: "resistance", name: "Сопротивление", desc: ["", "10% шанс сбить заклинание", "20% шанс сбить заклинание", "30% шанс сбить заклинание"] },
  diplomacy: { id: "diplomacy", name: "Дипломатия", desc: ["", "Иногда нанимает нейтралов", "Чаще нанимает нейтралов", "Почти всегда может нанять"] },
  estates: { id: "estates", name: "Имения", desc: ["", "+125 золота в день", "+250 золота в день", "+500 золота в день"] },
  pathfinding: { id: "pathfinding", name: "Поиск пути", desc: ["", "Штраф местности −25%", "Штраф местности −50%", "Штраф местности снят"] },
  artillery: { id: "artillery", name: "Артиллерия", desc: ["", "Баллиста бьёт точнее", "Катапульта редко мажет", "Машины бьют в полную силу"] },
  firstaid: { id: "firstaid", name: "Первая помощь", desc: ["", "Палатка лечит слабее", "Палатка лечит", "Палатка лечит сильно"] },
  necromancy: { id: "necromancy", name: "Чернильный призыв", desc: ["", "10% убитых встают искрами", "20% убитых встают искрами", "30% убитых встают искрами"] },
  eagle: { id: "eagle", name: "Орлиный глаз", desc: ["", "40% выучить боевое заклинание врага", "70% выучить", "Всегда учит заклинание врага"] },
};

export const SKILL_RANK = ["", "базовый", "продвинутый", "эксперт"];

export const CLASSES = {
  scarlet_might: {
    id: "scarlet_might", faction: "scarlet", name: "Паладинша",
    probs: { attack: 35, defense: 30, power: 15, knowledge: 20 },
    prefer: ["leadership", "offense", "armorer", "tactics", "luck", "estates", "pathfinding"],
    start: { attack: 3, defense: 2, power: 1, knowledge: 1 },
    skill: "leadership", book: false, spells: [],
  },
  scarlet_magic: {
    id: "scarlet_magic", faction: "scarlet", name: "Чародейка лака",
    probs: { attack: 10, defense: 10, power: 40, knowledge: 40 },
    prefer: ["wisdom", "sorcery", "intelligence", "air", "water", "mysticism", "eagle"],
    start: { attack: 1, defense: 0, power: 2, knowledge: 3 },
    skill: "wisdom", book: true, spells: ["magicArrow", "bless", "haste"],
  },
  emerald_might: {
    id: "emerald_might", faction: "emerald", name: "Хранительница",
    probs: { attack: 30, defense: 30, power: 20, knowledge: 20 },
    prefer: ["archery", "offense", "armorer", "logistics", "pathfinding", "luck", "leadership"],
    start: { attack: 2, defense: 3, power: 1, knowledge: 1 },
    skill: "archery", book: false, spells: [],
  },
  emerald_magic: {
    id: "emerald_magic", faction: "emerald", name: "Ведьма винила",
    probs: { attack: 10, defense: 15, power: 40, knowledge: 35 },
    prefer: ["wisdom", "sorcery", "earth", "water", "intelligence", "mysticism", "eagle"],
    start: { attack: 0, defense: 1, power: 3, knowledge: 2 },
    skill: "wisdom", book: true, spells: ["magicArrow", "slow", "cure"],
  },
  onyx_might: {
    id: "onyx_might", faction: "onyx", name: "Тёмная рыцарь",
    probs: { attack: 35, defense: 25, power: 20, knowledge: 20 },
    prefer: ["offense", "necromancy", "tactics", "leadership", "armorer", "resistance"],
    start: { attack: 3, defense: 2, power: 1, knowledge: 1 },
    skill: "offense", book: false, spells: [],
  },
  onyx_magic: {
    id: "onyx_magic", faction: "onyx", name: "Лич-госпожа",
    probs: { attack: 10, defense: 10, power: 45, knowledge: 35 },
    prefer: ["wisdom", "sorcery", "necromancy", "earth", "fire", "intelligence", "mysticism"],
    start: { attack: 1, defense: 0, power: 3, knowledge: 2 },
    skill: "necromancy", book: true, spells: ["magicArrow", "curse", "slow"],
  },
};

export const ROSTER = [
  { id: "ilera", name: "Илэра Валь", classId: "scarlet_might", portrait: "art/ride/ilera.webp" },
  { id: "serafina", name: "Серафина Лак", classId: "scarlet_magic", portrait: "art/ride/serafina.webp" },
  { id: "brienne", name: "Бриенна Двор", classId: "scarlet_might", portrait: "art/ride/brienne.webp" },
  { id: "mirana", name: "Мирана Велес", classId: "emerald_might", portrait: "art/ride/mirana.webp" },
  { id: "aelwin", name: "Аэльвин Роща", classId: "emerald_magic", portrait: "art/ride/aelwin.webp" },
  { id: "lorena", name: "Лорена Плющ", classId: "emerald_might", portrait: "art/ride/lorena.webp" },
  { id: "noxira", name: "Ноксира Тень", classId: "onyx_might", portrait: "art/ride/noxira.webp" },
  { id: "lilith", name: "Лилит Чернила", classId: "onyx_magic", portrait: "art/ride/lilith.webp" },
  { id: "morvana", name: "Морвана Шпиль", classId: "onyx_might", portrait: "art/ride/morvana.webp" },
  { id: "cassia", name: "Кассия Багр", classId: "scarlet_magic", portrait: "art/ride/cassia.webp" },
  { id: "silva", name: "Сильва Корня", classId: "emerald_magic", portrait: "art/ride/silva.webp" },
  { id: "umbra", name: "Умбра Лист", classId: "onyx_magic", portrait: "art/ride/umbra.webp" },
];

const S = (p) => p;
export const SPELLS = {
  magicArrow: S({ id: "magicArrow", name: "Волшебная стрела", school: "all", level: 1, cost: 5, combat: true, target: "enemy", kind: "damage", base: 10, per: 10, desc: "Простой заряд. 10 + 10×сила." }),
  haste: S({ id: "haste", name: "Ускорение", school: "air", level: 1, cost: 6, combat: true, target: "ally", kind: "buff", buff: "haste", desc: "Цель ходит дальше." }),
  slow: S({ id: "slow", name: "Замедление", school: "earth", level: 1, cost: 6, combat: true, target: "enemy", kind: "buff", buff: "slow", desc: "Цель ходит меньше." }),
  bless: S({ id: "bless", name: "Благословение", school: "water", level: 1, cost: 5, combat: true, target: "ally", kind: "buff", buff: "bless", desc: "Урон цели всегда максимальный." }),
  curse: S({ id: "curse", name: "Проклятие", school: "fire", level: 1, cost: 5, combat: true, target: "enemy", kind: "buff", buff: "curse", desc: "Урон цели всегда минимальный." }),
  shield: S({ id: "shield", name: "Щит", school: "earth", level: 1, cost: 5, combat: true, target: "ally", kind: "buff", buff: "shield", desc: "Меньше урона от ближнего боя." }),
  protectAir: S({ id: "protectAir", name: "Заслон от воздуха", school: "air", level: 1, cost: 5, combat: true, target: "ally", kind: "buff", buff: "protectAir", desc: "Меньше урона от воздуха." }),
  bloodlust: S({ id: "bloodlust", name: "Ярость", school: "fire", level: 1, cost: 5, combat: true, target: "ally", kind: "buff", buff: "bloodlust", desc: "+атака цели." }),
  cure: S({ id: "cure", name: "Лечение", school: "water", level: 1, cost: 6, combat: true, target: "ally", kind: "heal", desc: "Лечит отряд, не воскрешает." }),
  lightning: S({ id: "lightning", name: "Молния", school: "air", level: 2, cost: 8, combat: true, target: "enemy", kind: "damage", base: 10, per: 25, desc: "10 + 25×сила." }),
  iceBolt: S({ id: "iceBolt", name: "Ледяная стрела", school: "water", level: 2, cost: 8, combat: true, target: "enemy", kind: "damage", base: 10, per: 20, desc: "10 + 20×сила." }),
  precision: S({ id: "precision", name: "Точность", school: "air", level: 2, cost: 8, combat: true, target: "ally", kind: "buff", buff: "precision", desc: "Стрелки бьют максимальным уроном." }),
  weakness: S({ id: "weakness", name: "Слабость", school: "water", level: 2, cost: 8, combat: true, target: "enemy", kind: "buff", buff: "weakness", desc: "−атака цели." }),
  stoneSkin: S({ id: "stoneSkin", name: "Каменная кожа", school: "earth", level: 2, cost: 8, combat: true, target: "ally", kind: "buff", buff: "stone", desc: "+защита цели." }),
  blind: S({ id: "blind", name: "Слепота", school: "fire", level: 2, cost: 10, combat: true, target: "enemy", kind: "buff", buff: "blind", desc: "Цель пропускает ходы, пока её не ударят." }),
  dispel: S({ id: "dispel", name: "Рассеивание", school: "water", level: 2, cost: 8, combat: true, target: "any", kind: "dispel", desc: "Снимает чары с отряда." }),
  fireball: S({ id: "fireball", name: "Огненный шар", school: "fire", level: 3, cost: 12, combat: true, target: "enemy", kind: "damage", base: 15, per: 15, area: 1, desc: "Бьёт цель и соседей." }),
  frostRing: S({ id: "frostRing", name: "Кольцо мороза", school: "water", level: 3, cost: 12, combat: true, target: "hex", kind: "damage", base: 10, per: 10, ring: true, desc: "Бьёт соседей выбранной клетки." }),
  forget: S({ id: "forget", name: "Забвение", school: "water", level: 3, cost: 12, combat: true, target: "enemy", kind: "buff", buff: "forget", desc: "Стрелки не могут стрелять." }),
  prayer: S({ id: "prayer", name: "Молитва", school: "water", level: 3, cost: 12, combat: true, target: "allAlly", kind: "buff", buff: "prayer", desc: "Всем своим: атака, защита и скорость." }),
  airShield: S({ id: "airShield", name: "Воздушный щит", school: "air", level: 3, cost: 12, combat: true, target: "ally", kind: "buff", buff: "airShield", desc: "Меньше урона от стрел." }),
  animate: S({ id: "animate", name: "Чернильный подъём", school: "earth", level: 3, cost: 15, combat: true, target: "corpse", kind: "animate", desc: "Поднимает часть павших нежитью на вашей стороне." }),
  chain: S({ id: "chain", name: "Цепная молния", school: "air", level: 4, cost: 18, combat: true, target: "enemy", kind: "chain", base: 25, per: 40, desc: "Бьёт цель и прыгает по врагам." }),
  meteor: S({ id: "meteor", name: "Метеоритный дождь", school: "earth", level: 4, cost: 16, combat: true, target: "enemy", kind: "damage", base: 20, per: 25, area: 1, desc: "Камни по площади." }),
  resurrect: S({ id: "resurrect", name: "Воскрешение", school: "earth", level: 4, cost: 20, combat: true, target: "ally", kind: "resurrect", desc: "Возвращает павших здоровьем силы×50." }),
  counterstrike: S({ id: "counterstrike", name: "Контрудар", school: "air", level: 4, cost: 16, combat: true, target: "ally", kind: "buff", buff: "counter", desc: "Цель отвечает на удары чаще." }),
  berserk: S({ id: "berserk", name: "Берсерк", school: "fire", level: 4, cost: 18, combat: true, target: "enemy", kind: "buff", buff: "berserk", desc: "Цель бросается на ближайшего." }),
  slayer: S({ id: "slayer", name: "Убийца драконов", school: "fire", level: 4, cost: 16, combat: true, target: "ally", kind: "buff", buff: "slayer", desc: "Огромный урон драконам и титанам." }),
  teleport: S({ id: "teleport", name: "Телепорт", school: "water", level: 4, cost: 16, combat: true, target: "allyHex", kind: "teleport", desc: "Переносит свой отряд на свободную клетку." }),
  quake: S({ id: "quake", name: "Землетрясение", school: "earth", level: 4, cost: 20, combat: true, target: "none", kind: "quake", desc: "Рвёт стены при осаде." }),
  implosion: S({ id: "implosion", name: "Взрыв", school: "earth", level: 5, cost: 25, combat: true, target: "enemy", kind: "damage", base: 50, per: 70, desc: "Сокрушительный удар по одной цели." }),
  armageddon: S({ id: "armageddon", name: "Армагеддон", school: "fire", level: 5, cost: 30, combat: true, target: "none", kind: "damageAll", base: 30, per: 40, desc: "Бьёт всех на поле, кроме элементалей огня." }),
  flyCombat: S({ id: "flyCombat", name: "Полёт", school: "air", level: 5, cost: 12, combat: true, target: "ally", kind: "buff", buff: "fly", desc: "Отряд летает до конца боя." }),
  summon: S({ id: "summon", name: "Вызов элементаля", school: "all", level: 5, cost: 22, combat: true, target: "hex", kind: "summon", desc: "Зовёт элементаля вашей сильнейшей стихии." }),
  townPortal: S({ id: "townPortal", name: "Врата города", school: "earth", level: 4, cost: 16, adventure: true, target: "town", kind: "townPortal", desc: "Переносит героиню в свой город." }),
  viewAir: S({ id: "viewAir", name: "Взор воздуха", school: "air", level: 2, cost: 4, adventure: true, target: "none", kind: "reveal", desc: "Открывает большой круг карты." }),
  fly: S({ id: "fly", name: "Полёт над королевством", school: "air", level: 5, cost: 20, adventure: true, target: "none", kind: "fly", desc: "До конца дня героиня летит над любыми преградами." }),
  waterWalk: S({ id: "waterWalk", name: "Хождение по воде", school: "water", level: 4, cost: 14, adventure: true, target: "none", kind: "water", desc: "До конца дня можно идти по воде и рекам." }),
  dd: S({ id: "dd", name: "Дверь измерений", school: "air", level: 5, cost: 20, adventure: true, target: "tile", kind: "dd", desc: "Прыжок в видимую точку. Тратит часть хода." }),
  vision: S({ id: "vision", name: "Ясновидение", school: "all", level: 2, cost: 6, adventure: true, target: "tile", kind: "vision", desc: "Показывает, кто стережёт объект." }),
};

export function wisdomCap(level) {
  return [1, 2, 3, 5][level] || 1;
}

export const MAGE_POOL = {
  scarlet: {
    1: ["magicArrow", "bless", "haste", "shield", "cure"],
    2: ["lightning", "precision", "stoneSkin", "dispel", "weakness"],
    3: ["fireball", "prayer", "airShield", "frostRing"],
    4: ["chain", "resurrect", "counterstrike", "teleport", "townPortal"],
    5: ["implosion", "fly", "flyCombat", "summon"],
  },
  emerald: {
    1: ["magicArrow", "slow", "cure", "bless", "shield"],
    2: ["iceBolt", "weakness", "stoneSkin", "dispel", "viewAir"],
    3: ["frostRing", "forget", "prayer", "animate"],
    4: ["meteor", "resurrect", "waterWalk", "teleport", "quake"],
    5: ["implosion", "summon", "dd", "fly"],
  },
  onyx: {
    1: ["magicArrow", "curse", "slow", "bloodlust", "shield"],
    2: ["lightning", "blind", "weakness", "dispel", "iceBolt"],
    3: ["fireball", "forget", "animate", "airShield"],
    4: ["meteor", "berserk", "slayer", "quake", "townPortal"],
    5: ["armageddon", "implosion", "summon", "fly"],
  },
};

export const ARTIFACTS = {};
function art(a) { ARTIFACTS[a.id] = a; }

art({ id: "crown_scarlet", name: "Корона багрянца", slot: "head", mods: { attack: 3, defense: 3 }, desc: "+3 атаки и защиты.", set: "scarlet" });
art({ id: "diadem", name: "Диадема ведьмы", slot: "head", mods: { power: 3, knowledge: 3 }, desc: "+3 силы магии и знания." });
art({ id: "helm_onyx", name: "Шлем оникса", slot: "head", mods: { defense: 4, morale: 1 }, desc: "+4 защиты, +1 мораль.", set: "onyx" });
art({ id: "helm_scout", name: "Обруч разведки", slot: "head", mods: { sight: 2, knowledge: 1 }, desc: "+2 обзора, +1 знание." });
art({ id: "neck_pearl", name: "Ожерелье жемчуга", slot: "neck", mods: { knowledge: 4 }, desc: "+4 знания." });
art({ id: "neck_pigment", name: "Амулет пигмента", slot: "neck", mods: { power: 2, luck: 1 }, desc: "+2 силы, +1 удача." });
art({ id: "neck_mana", name: "Медальон маны", slot: "neck", mods: { regen: 4, knowledge: 1 }, desc: "+4 маны каждый день." });
art({ id: "cloak_herald", name: "Плащ герольда", slot: "cloak", mods: { morale: 1, move: 250 }, desc: "+1 мораль и +250 хода." });
art({ id: "cloak_night", name: "Мантия ночи", slot: "cloak", mods: { power: 2, spell: 10 }, desc: "+2 силы, +10% урона заклинаний.", set: "onyx" });
art({ id: "cloak_road", name: "Плащ тракта", slot: "cloak", mods: { move: 400 }, desc: "+400 хода." });
art({ id: "blade_scarlet", name: "Лаковый клинок", slot: "weapon", mods: { attack: 4 }, desc: "+4 атаки.", set: "scarlet" });
art({ id: "staff_grove", name: "Посох рощи", slot: "weapon", mods: { power: 4 }, desc: "+4 силы магии." });
art({ id: "dagger_onyx", name: "Чернильный кинжал", slot: "weapon", mods: { attack: 2, power: 2 }, desc: "+2 атаки и силы.", set: "onyx" });
art({ id: "bow_vinyl", name: "Виниловый лук", slot: "weapon", mods: { attack: 2, ranged: 15 }, desc: "+2 атаки, +15% дальнего урона." });
art({ id: "shield_court", name: "Щит двора", slot: "shield", mods: { defense: 4 }, desc: "+4 защиты." });
art({ id: "shield_mirror", name: "Зеркальный щит", slot: "shield", mods: { defense: 2, resist: 10 }, desc: "+2 защиты, +10% сопротивления." });
art({ id: "mail_scarlet", name: "Кираса блеска", slot: "chest", mods: { attack: 2, defense: 2, morale: 1 }, desc: "+2 атаки и защиты, +1 мораль.", set: "scarlet" });
art({ id: "mail_vinyl", name: "Виниловый доспех", slot: "chest", mods: { defense: 5 }, desc: "+5 защиты." });
art({ id: "mail_onyx", name: "Ониксовая броня", slot: "chest", mods: { defense: 3, power: 1 }, desc: "+3 защиты, +1 сила.", set: "onyx" });
art({ id: "boots_log", name: "Сапоги логиста", slot: "feet", mods: { move: 500 }, desc: "+500 хода." });
art({ id: "boots_scout", name: "Сапоги странницы", slot: "feet", mods: { move: 300, sight: 1 }, desc: "+300 хода и +1 обзор." });
art({ id: "ring_luck", name: "Кольцо удачи", slot: "ring", mods: { luck: 1 }, desc: "+1 удача." });
art({ id: "ring_life", name: "Кольцо жизни", slot: "ring", mods: { morale: 1 }, desc: "+1 мораль." });
art({ id: "ring_wise", name: "Кольцо мудрости", slot: "ring", mods: { power: 1, knowledge: 1 }, desc: "+1 силы и знания." });
art({ id: "ring_war", name: "Кольцо войны", slot: "ring", mods: { attack: 2, defense: 1 }, desc: "+2 атаки, +1 защита." });
art({ id: "sphere", name: "Сфера знаний", slot: "misc", mods: { knowledge: 3, power: 1 }, desc: "+3 знания, +1 сила." });
art({ id: "map_relic", name: "Карта королевств", slot: "misc", mods: { sight: 3 }, desc: "+3 обзора." });
art({ id: "cup", name: "Кубок изобилия", slot: "misc", mods: { income: 750 }, desc: "+750 золота в день." });
art({ id: "emblem_off", name: "Эмблема нападения", slot: "misc", mods: { attack: 3 }, desc: "+3 атаки." });
art({ id: "scroll_def", name: "Свиток брони", slot: "misc", mods: { defense: 3 }, desc: "+3 защиты." });
art({ id: "horseshoe", name: "Подкова", slot: "misc", mods: { luck: 1, move: 150 }, desc: "+1 удача, +150 хода." });
art({ id: "banner", name: "Знамя лидерства", slot: "misc", mods: { morale: 1 }, desc: "+1 мораль." });
art({ id: "grimoire", name: "Гримуар ученицы", slot: "misc", mods: { knowledge: 2, regen: 2 }, desc: "+2 знания и +2 маны в день." });
art({ id: "tome_air", name: "Том воздуха", slot: "misc", mods: { spell: 15, power: 1 }, desc: "+1 сила, +15% урона заклинаний." });
art({ id: "badge", name: "Жетон имений", slot: "misc", mods: { income: 500, morale: 1 }, desc: "+500 золота и +1 мораль." });

export const SETS = {
  scarlet: { name: "Двор багрянца", parts: ["crown_scarlet", "blade_scarlet", "mail_scarlet"], bonus: { attack: 2, defense: 2, morale: 1 } },
  onyx: { name: "Ночь оникса", parts: ["helm_onyx", "cloak_night", "dagger_onyx", "mail_onyx"], bonus: { power: 3, knowledge: 2 } },
};

export const SLOTS = [
  ["head", "Голова"],
  ["neck", "Шея"],
  ["cloak", "Плащ"],
  ["weapon", "Оружие"],
  ["shield", "Щит"],
  ["chest", "Доспех"],
  ["feet", "Обувь"],
  ["ring1", "Кольцо"],
  ["ring2", "Кольцо"],
  ["misc1", "Мелочь"],
  ["misc2", "Мелочь"],
  ["misc3", "Мелочь"],
  ["misc4", "Мелочь"],
];

export function xpForLevel(level) {
  if (level <= 1) return 0;
  const table = [0, 0, 1000, 2200, 3600, 5200, 7000, 9000, 11400, 14200, 17400, 21200, 25600, 30800, 37000, 44400, 53200, 63600, 76000, 90800, 108000];
  if (level < table.length) return table[level];
  let xp = table[table.length - 1];
  let inc = 18000;
  for (let l = table.length; l <= level; l++) {
    xp += inc;
    inc = Math.round(inc * 1.15);
  }
  return xp;
}

export const BUILDING_IDS = [
  "townHall", "cityHall", "capitol",
  "fort", "citadel", "castle",
  "tavern", "market", "silo", "blacksmith",
  "mage1", "mage2", "mage3", "mage4", "mage5",
  "dw1", "dw2", "dw3", "dw4", "dw5", "dw6", "dw7",
  "up1", "up2", "up3", "up4", "up5", "up6", "up7",
  "horde", "special", "grail",
];

export function buildingDef(faction, id) {
  const tiers = tiersOf(faction);
  const tname = (i) => (tiers[i] ? tiers[i].name : "отряд");
  const uname = (i) => {
    const b = tiers[i];
    return b && b.levelUpTo ? CREATURES[b.levelUpTo].name : "улучшение";
  };
  const hordeTier = faction === "emerald" ? 2 : faction === "onyx" ? 3 : 4;
  const table = {
    townHall: { name: "Ратуша", cost: { gold: 2500 }, req: [], desc: "Доход 1000 золота вместо 500." },
    cityHall: { name: "Магистрат", cost: { gold: 5000 }, req: ["townHall"], desc: "Доход 2000 золота." },
    capitol: { name: "Тронный зал", cost: { gold: 10000 }, req: ["cityHall"], desc: "Доход 4000 золота." },
    fort: { name: "Укрепление", cost: { gold: 5000, lacquer: 20, resin: 20 }, req: [], desc: "Стены, ров и башня при осаде." },
    citadel: { name: "Цитадель", cost: { gold: 2500, lacquer: 5, resin: 5 }, req: ["fort"], desc: "Вторая башня и +50% прироста." },
    castle: { name: "Замок", cost: { gold: 5000, lacquer: 10, resin: 10 }, req: ["citadel"], desc: "Главная башня и удвоенный прирост." },
    tavern: { name: "Салон", cost: { gold: 500, lacquer: 5 }, req: [], desc: "Наём героинь." },
    market: { name: "Рынок", cost: { gold: 500, lacquer: 5 }, req: [], desc: "Обмен ресурсов." },
    silo: { name: "Кладовая", cost: { gold: 5000, resin: 5 }, req: [], desc: "+1 каждого ресурса в день." },
    blacksmith: { name: "Оружейная", cost: { gold: 1000, lacquer: 5 }, req: [], desc: "Баллиста, палатка, телега снарядов." },
    mage1: { name: "Гильдия магов 1", cost: { gold: 2000, lacquer: 5, resin: 5 }, req: [], desc: "Заклинания 1 круга." },
    mage2: { name: "Гильдия магов 2", cost: { gold: 1000, pigment: 4, amber: 4, crystal: 4, pearl: 4 }, req: ["mage1"], desc: "Заклинания 2 круга." },
    mage3: { name: "Гильдия магов 3", cost: { gold: 1500, pigment: 6, amber: 6, crystal: 6, pearl: 6 }, req: ["mage2"], desc: "Заклинания 3 круга." },
    mage4: { name: "Гильдия магов 4", cost: { gold: 2000, pigment: 8, amber: 8, crystal: 8, pearl: 8 }, req: ["mage3"], desc: "Заклинания 4 круга." },
    mage5: { name: "Гильдия магов 5", cost: { gold: 3000, pigment: 10, amber: 10, crystal: 10, pearl: 10 }, req: ["mage4"], desc: "Заклинания 5 круга." },
    dw1: { name: "Жилище: " + tname(0), cost: { gold: 400, lacquer: 5 }, req: [], desc: "Еженедельный найм.", tier: 1 },
    dw2: { name: "Жилище: " + tname(1), cost: { gold: 1000, lacquer: 5 }, req: [], desc: "Еженедельный найм.", tier: 2 },
    dw3: { name: "Жилище: " + tname(2), cost: { gold: 1500, lacquer: 5, resin: 5 }, req: ["dw1"], desc: "Еженедельный найм.", tier: 3 },
    dw4: { name: "Жилище: " + tname(3), cost: { gold: 2500, crystal: 3, lacquer: 8 }, req: ["dw2", "fort"], desc: "Еженедельный найм.", tier: 4 },
    dw5: { name: "Жилище: " + tname(4), cost: { gold: 3500, pigment: 5, resin: 5 }, req: ["dw3"], desc: "Еженедельный найм.", tier: 5 },
    dw6: { name: "Жилище: " + tname(5), cost: { gold: 5000, lacquer: 10, resin: 10, amber: 5 }, req: ["dw4", "citadel"], desc: "Еженедельный найм.", tier: 6 },
    dw7: { name: "Жилище: " + tname(6), cost: { gold: 10000, lacquer: 15, resin: 15, pigment: 8, amber: 8, crystal: 8, pearl: 8 }, req: ["dw6", "castle"], desc: "Еженедельный найм.", tier: 7 },
    up1: { name: "Улучшение: " + uname(0), cost: { gold: 800, lacquer: 5 }, req: ["dw1"], desc: "Наём и улучшение.", tier: 1 },
    up2: { name: "Улучшение: " + uname(1), cost: { gold: 1200, lacquer: 5 }, req: ["dw2"], desc: "Наём и улучшение.", tier: 2 },
    up3: { name: "Улучшение: " + uname(2), cost: { gold: 1500, resin: 5 }, req: ["dw3"], desc: "Наём и улучшение.", tier: 3 },
    up4: { name: "Улучшение: " + uname(3), cost: { gold: 2000, crystal: 3 }, req: ["dw4"], desc: "Наём и улучшение.", tier: 4 },
    up5: { name: "Улучшение: " + uname(4), cost: { gold: 2500, pigment: 4 }, req: ["dw5"], desc: "Наём и улучшение.", tier: 5 },
    up6: { name: "Улучшение: " + uname(5), cost: { gold: 3500, amber: 4 }, req: ["dw6"], desc: "Наём и улучшение.", tier: 6 },
    up7: { name: "Улучшение: " + uname(6), cost: { gold: 7000, pearl: 5, crystal: 5 }, req: ["dw7"], desc: "Наём и улучшение.", tier: 7 },
    horde: {
      name: faction === "emerald" ? "Чаща лучниц" : faction === "onyx" ? "Склеп всадниц" : "Гнездо грифонш",
      cost: { gold: 3000, lacquer: 10 },
      req: [faction === "emerald" ? "dw2" : faction === "onyx" ? "dw3" : "dw4"],
      desc: "Дополнительный еженедельный прирост.",
      hordeTier,
    },
    special: faction === "scarlet"
      ? { name: "Часовня блеска", cost: { gold: 2000, crystal: 5 }, req: ["fort"], desc: "+1 мораль всем героиням дома и +500 золота." }
      : faction === "emerald"
        ? { name: "Сердце рощи", cost: { gold: 2000, pearl: 5 }, req: ["dw3"], desc: "+1 прироста к 1–3 рангу и +2 маны в день." }
        : { name: "Чернильница", cost: { gold: 2500, pigment: 5 }, req: ["mage1"], desc: "Каждую неделю даёт чернильных искр и усиливает призыв." },
    grail: { name: "Алтарь короны", cost: { gold: 5000 }, req: ["capitol"], desc: "Нужна Корона Блеска. +5000 золота и +50% прироста.", needsGrail: true },
  };
  const d = table[id];
  return d ? Object.assign({ id }, d) : null;
}

export const TRADE = {
  lacquer: { buy: 250, sell: 125 },
  resin: { buy: 250, sell: 125 },
  pigment: { buy: 500, sell: 250 },
  amber: { buy: 500, sell: 250 },
  crystal: { buy: 500, sell: 250 },
  pearl: { buy: 500, sell: 250 },
};

export const MACHINES = {
  ballista: { id: "ballista", name: "Баллиста", cost: { gold: 1500 }, desc: "Стреляет в бою каждый раунд." },
  tent: { id: "tent", name: "Палатка лекаря", cost: { gold: 800 }, desc: "Лечит живой отряд в конце раунда." },
  ammo: { id: "ammo", name: "Телега снарядов", cost: { gold: 1000 }, desc: "Стрелкам не кончаются выстрелы." },
};

export const START_ARMIES = {
  scarlet_might: [["s_page", 18], ["s_shield", 8], ["s_xbow", 6]],
  scarlet_magic: [["s_page", 14], ["s_xbow", 7]],
  emerald_might: [["e_dew", 16], ["e_bow", 8], ["e_uni", 3]],
  emerald_magic: [["e_dew", 12], ["e_bow", 9]],
  onyx_might: [["o_spark", 20], ["o_shade", 8], ["o_wraith", 4]],
  onyx_magic: [["o_spark", 16], ["o_shade", 9]],
};

export const DAY_NAMES = ["Блеск", "Смола", "Пигмент", "Янтарь", "Хрусталь", "Жемчуг", "Корона"];

export function calendar(day) {
  const d = Math.max(1, day | 0);
  return {
    day: d,
    week: Math.floor((d - 1) / 7) + 1,
    dayName: DAY_NAMES[(d - 1) % 7],
    isWeekStart: (d - 1) % 7 === 0,
  };
}

export const SHOP_PACKS = [
  { id: "gold", name: "Сундук золота", desc: "+10 000 золота", res: { gold: 10000 } },
  { id: "gold2", name: "Казна", desc: "+50 000 золота", res: { gold: 50000 } },
  { id: "common", name: "Обоз лака и смолы", desc: "+40 лака и смолы", res: { lacquer: 40, resin: 40 } },
  { id: "rares", name: "Шкатулка редкостей", desc: "+20 редких ресурсов", res: { pigment: 20, amber: 20, crystal: 20, pearl: 20 } },
  { id: "all", name: "Дар двора", desc: "+30 000 золота и +15 каждого ресурса", res: { gold: 30000, lacquer: 15, resin: 15, pigment: 15, amber: 15, crystal: 15, pearl: 15 } },
];

export const SCENARIOS = [
  {
    id: "camp1",
    campaign: true,
    name: "Первый блеск",
    briefing: "Илэра Валь получила малый двор и приказ: перейти тракт, взять копи и сбить знамя Чернильного Оникса. Враги ещё не собрали дракона — но разбойницы на дороге уже точат ножи.",
    map: { w: 30, h: 30, seed: 4201, forest: 0.42, water: 0.06, rivers: 1, mountains: 0.08 },
    players: [
      { control: "human", faction: "scarlet", name: "Дом Алого Лака", ai: "easy", hero: "ilera" },
      { control: "ai", faction: "onyx", name: "Дом Чернил", ai: "easy", hero: "noxira" },
    ],
    resources: { gold: 10000, lacquer: 18, resin: 10, pigment: 2, amber: 2, crystal: 2, pearl: 0 },
    buildings: ["villageHall", "dw1", "tavern"],
    victory: { type: "defeatAll" },
  },
  {
    id: "camp2",
    campaign: true,
    name: "Река между дворами",
    briefing: "Лаковая река режет королевство надвое. Броды сторожат врата, ключи лежат у святилищ. Захватите оба чужих города — или не будет ни моста, ни короны.",
    map: { w: 40, h: 36, seed: 4202, forest: 0.38, water: 0.08, rivers: 2, mountains: 0.1 },
    players: [
      { control: "human", faction: "scarlet", name: "Дом Алого Лака", ai: "normal", hero: "serafina" },
      { control: "ai", faction: "emerald", name: "Дом Винила", ai: "normal", hero: "mirana" },
      { control: "ai", faction: "onyx", name: "Дом Оникса", ai: "normal", hero: "lilith" },
    ],
    resources: { gold: 14000, lacquer: 20, resin: 14, pigment: 4, amber: 4, crystal: 4, pearl: 2 },
    buildings: ["villageHall", "fort", "dw1", "dw2", "tavern"],
    victory: { type: "captureAll" },
  },
  {
    id: "camp3",
    campaign: true,
    name: "Изумрудная печать",
    briefing: "Корона Блеска спрятана в сердце чащи, под крылом нейтрального дракона. Принесите её в свой город и воздвигните алтарь — иначе два соседних двора сомнут рощу.",
    map: { w: 42, h: 42, seed: 4203, forest: 0.55, water: 0.07, rivers: 1, mountains: 0.12, biome: "forest" },
    players: [
      { control: "human", faction: "emerald", name: "Дом Винила", ai: "normal", hero: "aelwin" },
      { control: "ai", faction: "scarlet", name: "Дом Багрянца", ai: "normal", hero: "ilera" },
      { control: "ai", faction: "onyx", name: "Дом Оникса", ai: "hard", hero: "morvana" },
    ],
    resources: { gold: 16000, lacquer: 22, resin: 16, pigment: 6, amber: 6, crystal: 6, pearl: 4 },
    buildings: ["villageHall", "fort", "dw1", "dw2", "mage1", "tavern"],
    victory: { type: "grail" },
  },
  {
    id: "camp4",
    campaign: true,
    name: "Три короны",
    briefing: "Большая война. Четыре знамени, одна карта, никаких переговоров. Удержите свои города и погасите чужие. Лавка двора открыта — но победа, купленная без похода, всё равно считается вашей.",
    map: { w: 52, h: 48, seed: 4204, forest: 0.4, water: 0.09, rivers: 2, mountains: 0.14 },
    players: [
      { control: "human", faction: "scarlet", name: "Дом Алого Лака", ai: "normal", hero: "ilera" },
      { control: "ai", faction: "emerald", name: "Дом Винила", ai: "hard", hero: "mirana" },
      { control: "ai", faction: "onyx", name: "Дом Оникса", ai: "hard", hero: "noxira" },
      { control: "ai", faction: "emerald", name: "Отколовшаяся роща", ai: "normal", hero: "lorena", color: "#d4a017" },
    ],
    resources: { gold: 20000, lacquer: 30, resin: 20, pigment: 8, amber: 8, crystal: 8, pearl: 6 },
    buildings: ["villageHall", "fort", "dw1", "dw2", "tavern", "mage1"],
    victory: { type: "defeatAll" },
  },
];

export const SKIRMISH = [
  { id: "sk-small", name: "Дуэль", w: 28, h: 28, players: 2, desc: "Короткий спор двух дворов." },
  { id: "sk-med", name: "Пограничье", w: 40, h: 40, players: 2, desc: "Средняя карта, копи и чащи." },
  { id: "sk-three", name: "Три знамени", w: 44, h: 44, players: 3, desc: "Трое делят одну корону." },
  { id: "sk-war", name: "Война четырёх", w: 54, h: 50, players: 4, desc: "Большая стычка." },
  { id: "sk-snow", name: "Северный лак", w: 36, h: 36, players: 2, biome: "snow", desc: "Снег, скалы и редкие броды." },
  { id: "sk-swamp", name: "Топи пигмента", w: 36, h: 36, players: 2, biome: "swamp", desc: "Трясины и топкие тракты." },
];

export const PLAYER_COLORS = ["#c4374f", "#1f8a5b", "#8b6bc4", "#d4a017", "#3a7bd5", "#d06b3a"];

export function portraitFor(creatureId) {
  return `art/bodies/${creatureId}.webp`;
}

export function aiValue(cr) {
  if (!cr) return 0;
  const dmg = (cr.min + cr.max) / 2;
  let v = (cr.hp * dmg * (cr.atk + cr.def) * Math.max(1, cr.spd)) / 80;
  if (cr.ranged) v *= 1.35;
  if (cr.flying) v *= 1.12;
  if (cr.abilities.includes("noEnemyRetal")) v *= 1.15;
  if (cr.abilities.includes("unlimitedRetal") || cr.abilities.includes("retal2")) v *= 1.12;
  if (cr.abilities.includes("breath")) v *= 1.1;
  return v;
}

export const FLAVOR_SIGNS = [
  "«Здесь Илэра впервые надела лаковую кирасу. Дождь стекал, не смачивая её.»",
  "«Не пей из реки в неделю Короны — она помнит имена.»",
  "«Винил не гниёт. Он запоминает шаги.»",
  "«Чернила высыхают только на живых.»",
  "«Кто возьмёт Корону Блеска, тот откроет алтарь.»",
  "«Брод севернее безопасен, пока грифонши сыты.»",
];
