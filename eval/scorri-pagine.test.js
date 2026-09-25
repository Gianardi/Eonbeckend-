/* Test dello scorrimento col dito tra le pagine principali (25/09/2026):
   Home ⇄ Clienti ⇄ Cresci ⇄ Menu. Tocchi veri simulati (eventi touch),
   e i casi in cui NON deve cambiare pagina: scroll in verticale, gesto
   corto, partenza da un campo di testo o dal bordo, pagine interne.

   Uso: NODE_PATH=/opt/node22/lib/node_modules node eval/scorri-pagine.test.js */

const { chromium } = require("playwright");
const { spawn } = require("child_process");
const path = require("path");

const PORT = 8983;
const ROOT = path.resolve(__dirname, "..");
let fallimenti = 0;
function verifica(nome, condizione, dettaglio) {
  console.log(`  ${condizione ? "OK  " : "FAIL"} ${nome}${condizione || !dettaglio ? "" : " — " + dettaglio}`);
  if (!condizione) fallimenti++;
}

async function main() {
  const server = spawn("python3", ["-m", "http.server", String(PORT)], { cwd: ROOT, stdio: "ignore" });
  await new Promise((r) => setTimeout(r, 800));
  const browser = await chromium.launch();
  try {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    const page = await ctx.newPage();
    const errori = [];
    page.on("pageerror", (e) => errori.push(e.message));
    await page.goto(`http://localhost:${PORT}/index.html`, { waitUntil: "networkidle" });
    await page.evaluate(() => { document.getElementById("onboardingScreen").style.display = "none"; navigateTo("home"); });
    const cdp = await ctx.newCDPSession(page);
    const scorri = async (x, y, dx, dy = 0, passi = 8) => {
      await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
      for (let i = 1; i <= passi; i++) await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: x + (dx * i) / passi, y: y + (dy * i) / passi }] });
      await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
      await page.waitForTimeout(300);
    };
    const qui = () => page.evaluate(() => document.querySelector(".page.visible").id.replace("page-", ""));
    /* Un punto "libero" della pagina: non un campo di testo, un pulsante
       del microfono o una riga che si elimina scorrendo. */
    const puntoLibero = () => page.evaluate(() => {
      const pagina = document.querySelector(".page.visible");
      for (let y = 160; y < 760; y += 20) {
        const el = document.elementFromPoint(200, y);
        if (el && pagina.contains(el) && !el.closest("input, textarea, select, button, .scorri-wrap")) return y;
      }
      return 300;
    });
    const scorriPagina = async (dx) => scorri(dx < 0 ? 300 : 90, await puntoLibero(), dx);

    await scorriPagina(-180);
    verifica("Home, dito verso sinistra → Clienti", (await qui()) === "clienti", await qui());
    await scorriPagina(-180);
    verifica("Clienti → Cresci", (await qui()) === "cresci", await qui());
    await scorriPagina(-180);
    verifica("Cresci → Menu", (await qui()) === "gestisci-azienda", await qui());
    await scorriPagina(-180);
    verifica("Menu è l'ultima: resta lì", (await qui()) === "gestisci-azienda", await qui());
    await scorriPagina(180);
    verifica("dito verso destra: Menu → Cresci", (await qui()) === "cresci", await qui());
    const tab = await page.evaluate(() => document.querySelector(".tab-item.active").dataset.tab);
    verifica("la barra in basso segue (Cresci acceso)", tab === "cresci", tab);
    await scorriPagina(180); await scorriPagina(180);
    verifica("fino alla Home", (await qui()) === "home", await qui());
    await scorriPagina(180);
    verifica("Home è la prima: resta lì", (await qui()) === "home", await qui());

    await scorri(200, 500, -40, -300);
    verifica("scroll in verticale (un po' storto): non cambia pagina", (await qui()) === "home", await qui());
    await scorri(300, await puntoLibero(), -40);
    verifica("gesto corto: non cambia pagina", (await qui()) === "home", await qui());
    await scorri(385, await puntoLibero(), -200);
    verifica("partendo dal bordo destro dello schermo: non cambia pagina", (await qui()) === "home", await qui());

    const campo = await page.locator("#homeHeroCampo").boundingBox();
    await scorri(campo.x + campo.width / 2 + 60, campo.y + campo.height / 2, -180);
    verifica("partendo dal campo di testo: non cambia pagina", (await qui()) === "home", await qui());

    await page.evaluate(() => navigateTo("calendario"));
    await scorriPagina(-180);
    verifica("pagina interna (Calendario): lo scorrimento non la cambia", (await qui()) === "calendario", await qui());
    verifica("nessun errore nella pagina", errori.length === 0, errori.join(" | "));
  } finally {
    await browser.close();
    server.kill();
  }
  console.log(fallimenti ? `\n${fallimenti} controlli falliti.` : "\nTutti i controlli passati.");
  if (fallimenti) process.exitCode = 1;
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
