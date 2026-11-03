/**
 * Прогон на WebKit, окно 390×844, как iPhone 16e в Safari.
 * Запуск: PLAYWRIGHT_BROWSERS_PATH=/tmp/pw-browsers node tools/iphone-play.mjs
 */
import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire("/tmp/pw/package.json");
const { webkit } = require("playwright");
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = "/opt/cursor/artifacts";

const problems = [];
function note(msg) { problems.push(msg); console.log("!!", msg); }

const server = spawn("python3", ["-m", "http.server", "8771", "--directory", root], { stdio: "ignore" });
await new Promise((r) => setTimeout(r, 400));

const browser = await webkit.launch({ headless: true });
const page = await browser.newPage({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 1,
  isMobile: true,
  hasTouch: true,
  userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
});
page.on("pageerror", (e) => note("pageerror: " + e.message + (e.stack ? " | " + e.stack.split("\n").slice(0, 3).join(" ") : "")));
page.on("console", (m) => {
  if (m.type() !== "error") return;
  const loc = m.location();
  note("console: " + m.text() + " @ " + (loc.url || "") + ":" + loc.lineNumber);
});
page.on("requestfailed", (r) => {
  const u = r.url();
  if (u.includes("favicon")) return;
  note("request failed: " + u + " " + (r.failure() && r.failure().errorText));
});

async function shot(name) {
  await page.screenshot({ path: path.join(outDir, name + ".png"), fullPage: false });
}
async function clickAct(act, extra) {
  const sel = extra ? `[data-act="${act}"]${extra}` : `[data-act="${act}"]`;
  const el = page.locator(sel).first();
  await el.waitFor({ state: "visible", timeout: 8000 });
  await el.tap();
}
async function audit(where) {
  const report = await page.evaluate(() => {
    const doc = document.documentElement;
    const small = [];
    for (const b of document.querySelectorAll("button")) {
      const r = b.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) continue;
      const st = getComputedStyle(b);
      if (st.visibility === "hidden" || st.display === "none" || st.pointerEvents === "none") continue;
      if (r.bottom < 0 || r.top > innerHeight) continue;
      if (r.width < 44 || r.height < 44) small.push({ act: b.dataset.act || "", t: (b.innerText || "").replace(/\s+/g, " ").slice(0, 32), w: Math.round(r.width), h: Math.round(r.height) });
    }
    return { scrollW: doc.scrollWidth, clientW: doc.clientWidth, small };
  });
  if (report.scrollW > report.clientW + 2) note(where + ": горизонтальный вылет " + report.scrollW + ">" + report.clientW);
  for (const s of report.small) note(where + `: мелкая кнопка ${s.act} «${s.t}» ${s.w}×${s.h}`);
}

try {
  await page.addInitScript(() => {
    try { localStorage.setItem("lk-settings", JSON.stringify({ fast: true, sound: false })); } catch { /* */ }
  });
  await page.goto("http://127.0.0.1:8771/", { waitUntil: "networkidle", timeout: 20000 });
  await page.evaluate(() => document.documentElement.classList.add("emulate-safe"));
  await page.waitForSelector("[data-act=campaign]");
  await audit("меню");
  await shot("menu");

  await clickAct("settings");
  await audit("настройки");
  await shot("settings");
  await clickAct("back");

  await clickAct("help");
  await audit("справка");
  await clickAct("back");

  await clickAct("shop-menu");
  await audit("лавка-меню");
  await clickAct("back");

  await clickAct("campaign");
  await audit("кампания");
  await shot("campaign");
  await clickAct("start-camp");
  await page.waitForSelector("[data-act=close-modal]");
  await shot("brief");
  await clickAct("close-modal");
  await page.waitForSelector("#cv");
  await page.waitForTimeout(400);
  await audit("карта");
  await shot("map");

  const box = await page.locator("#cv").boundingBox();
  await page.touchscreen.tap(box.x + box.width * 0.62, box.y + box.height * 0.55);
  await page.waitForTimeout(700);
  await shot("map-moved");

  await clickAct("open-hero");
  await page.waitForTimeout(200);
  await audit("героиня");
  await shot("hero");
  await clickAct("close-modal");

  await clickAct("open-spell");
  await audit("книга");
  await shot("spellbook");
  await clickAct("close-modal");

  await clickAct("open-town");
  await page.waitForTimeout(200);
  await audit("город");
  await shot("town");
  const build = page.locator("[data-act=open-hall]");
  if (await build.count()) {
    await build.first().tap();
    await audit("ратуша");
    await shot("hall");
    const bld = page.locator("[data-act=build]");
    if (await bld.count()) await bld.first().tap();
    await page.waitForTimeout(200);
    const back = page.locator("[data-act=back-town]");
    if (await back.count()) await back.first().tap();
  }
  const hit = page.locator("[data-act=town-hit]").first();
  if (await hit.count()) {
    await hit.tap();
    await page.waitForTimeout(200);
    await shot("town-action");
    const back = page.locator("[data-act=back-town]");
    if (await back.count()) await back.first().tap();
    else if (await page.locator("[data-act=close-modal]").count()) await clickAct("close-modal");
  }
  if (await page.locator("[data-act=close-modal]").count()) await clickAct("close-modal");

  await clickAct("open-overview");
  await audit("обзор");
  await shot("overview");
  await clickAct("close-modal");

  await clickAct("open-system");
  await clickAct("open-shop");
  await audit("лавка");
  await shot("shop");
  await page.locator("[data-act=shop-pack]").first().tap();
  await page.waitForTimeout(200);
  await clickAct("close-modal");

  await clickAct("open-system");
  await clickAct("open-save");
  for (const id of ["1", "2", "3"]) {
    await page.locator(`[data-act=write-slot][data-id="${id}"]`).tap();
    await page.waitForTimeout(80);
  }
  await clickAct("close-modal");
  await clickAct("open-system");
  await clickAct("open-load-game");
  await page.locator("[data-act=load-slot][data-id='1']").tap();
  await page.waitForTimeout(400);
  await shot("loaded");

  await clickAct("end-turn");
  const force = page.locator("[data-act=end-turn-force]");
  if (await force.count()) await force.tap();
  await page.waitForTimeout(1500);
  await shot("after-turn");

  const battle = await page.evaluate(async () => {
    const engine = await import("./js/engine.js");
    const g = window.LK.game;
    if (!g) return "no game";
    const hero = g.heroes.find((h) => h.player === 0 && !h.lost);
    const obj = g.objects.find((o) => o.type === "monster" && !o.removed);
    if (!hero || !obj) return "no monster";
    hero.x = obj.x + 1;
    hero.y = obj.y;
    const r = engine.engage(g, hero.id, { objectId: obj.id }, { force: true });
    window.LK.mode = g.battle ? "deploy" : "map";
    window.LK.battleCam = null;
    window.LK.modal = null;
    return r;
  });
  console.log("engage", JSON.stringify(battle));
  await clickAct("open-system");
  await clickAct("close-modal");
  await page.waitForTimeout(300);
  await audit("бой");
  await shot("battle");
  const auto = page.locator("[data-act=battle-auto]");
  if (await auto.count()) {
    await auto.tap();
    await page.waitForTimeout(2500);
    await shot("battle-done");
  }

  const errs = problems.filter((p) => p.startsWith("pageerror") || p.startsWith("console"));
  console.log("---");
  console.log(problems.length ? problems.join("\n") : "ui clean");
  if (errs.length) process.exitCode = 1;
} catch (e) {
  note("тест упал: " + e.message);
  try { await shot("fail"); } catch { /* нет кадра */ }
  console.log(problems.join("\n"));
  process.exitCode = 1;
} finally {
  await browser.close();
  server.kill();
}
