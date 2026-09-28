/* Versione da computer (28/09/2026): da 1024 px in su menu a sinistra (con
   Calendario e Messaggi), Home su due colonne, card su 4 colonne, Messaggi
   come WhatsApp Web, avvisi in alto a destra. Sul telefono niente cambia.
   Uso: NODE_PATH=/opt/node22/lib/node_modules node eval/pc.test.js */

const { chromium } = require("playwright");
const { spawn } = require("child_process");
const path = require("path");

const PORT = 8992;
const ROOT = path.resolve(__dirname, "..");
let fallimenti = 0;
function verifica(nome, condizione, dettaglio) {
  console.log(`  ${condizione ? "OK  " : "FAIL"} ${nome}${condizione || !dettaglio ? "" : " — " + dettaglio}`);
  if (!condizione) fallimenti++;
}

async function apri(browser, larghezza, altezza) {
  const page = await browser.newPage({ viewport: { width: larghezza, height: altezza } });
  const errori = [];
  page.on("pageerror", (e) => errori.push(e.message));
  await page.addInitScript(() => {
    const catena = () => { const q = { update: () => ({ eq: async () => ({ error: null }) }), insert: async () => ({ error: null }), select: () => q, not: () => q, is: () => q, eq: () => q, order: () => q, limit: () => q, in: () => q, gt: () => q, maybeSingle: async () => ({ data: null }), single: async () => ({ data: null }), then: (ok) => ok({ data: [], error: null }) }; return q; };
    window.supabase = { createClient: () => ({ from: catena, channel: () => ({ on() { return this; }, subscribe() { return this; } }), storage: { from: () => ({}) }, auth: { getSession: async () => ({ data: { session: null } }), onAuthStateChange: () => ({}) } }) };
  });
  await page.goto(`http://localhost:${PORT}/index.html`, { waitUntil: "networkidle" });
  await page.evaluate(() => {
    document.getElementById("onboardingScreen").style.display = "none";
    cantiereAppunti.push({ id: "a1", testo: "Chiamare Pedro", created: new Date().toISOString(), daFare: true, fattoIl: null });
    renderCantiereAppunti();
  });
  return { page, errori };
}
const box = (page, sel) => page.evaluate((s) => { const el = document.querySelector(s); if (!el) return null; const r = el.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), visibile: getComputedStyle(el).display !== "none" && r.width > 0 }; }, sel);

async function main() {
  const server = spawn("python3", ["-m", "http.server", String(PORT)], { cwd: ROOT, stdio: "ignore" });
  await new Promise((r) => setTimeout(r, 800));
  const browser = await chromium.launch();
  try {
    /* ---- Computer ---- */
    const { page, errori } = await apri(browser, 1440, 900);
    const menu = await box(page, ".tabbar");
    const voci = await page.evaluate(() => [...document.querySelectorAll(".tabbar .tab-item")].filter((e) => getComputedStyle(e).display !== "none").map((e) => e.textContent.trim()));
    verifica("menu a sinistra, alto quanto lo schermo, con Calendario e Messaggi", menu.x === 0 && menu.y === 0 && menu.w === 240 && menu.h === 900 && JSON.stringify(voci) === '["Home","Clienti","Cresci","Calendario","Messaggi","Menu"]', JSON.stringify({ menu, voci }));
    const campo = await box(page, "#homeHeroCampo");
    const lato = await box(page, ".home-hero-lato");
    const card = await page.evaluate(() => [...document.querySelectorAll(".cantiere-grid > .cantiere-card")].slice(0, 4).map((c) => Math.round(c.getBoundingClientRect().y)));
    verifica("Home su due colonne (a destra la giornata) e card su una riga da 4", lato.x > campo.x + campo.w && Math.abs(lato.y - campo.y) < 300 && card.length === 4 && new Set(card).size === 1, JSON.stringify({ campo, lato, card }));
    await page.click(".tabbar .tab-item[data-tab='calendario']");
    const attivo = await page.evaluate(() => ({ pagina: document.querySelector(".page.visible").id, attivi: [...document.querySelectorAll(".tab-item.active")].map((e) => e.dataset.tab) }));
    verifica("Calendario dal menu: si apre ed è l'unica voce accesa", attivo.pagina === "page-calendario" && JSON.stringify(attivo.attivi) === '["calendario"]', JSON.stringify(attivo));
    await page.click(".tabbar .tab-item[data-tab='chat']");
    await page.waitForTimeout(350);
    const elenco = await box(page, ".chat-list-panel"), conv = await box(page, ".chat-conv-panel");
    const vuota = await page.evaluate(() => getComputedStyle(document.querySelector(".chat-conv-panel"), "::after").content);
    verifica("Messaggi come WhatsApp Web: elenco a sinistra, a destra \"Scegli una conversazione\"", elenco.x === 240 && elenco.w === 380 && conv.x === 620 && /Scegli una conversazione/.test(vuota), JSON.stringify({ elenco, conv, vuota }));
    await page.click(".chat-list-panel .chat-item");
    await page.waitForTimeout(350);
    const aperta = await page.evaluate(() => ({ elenco: Math.round(document.querySelector(".chat-list-panel").getBoundingClientRect().x), conv: Math.round(document.querySelector(".chat-conv-panel").getBoundingClientRect().x), dopo: getComputedStyle(document.querySelector(".chat-conv-panel"), "::after").content }));
    verifica("aprendo una chat l'elenco resta visibile accanto", aperta.elenco === 240 && aperta.conv === 620 && !/Scegli/.test(aperta.dopo), JSON.stringify(aperta));
    await page.evaluate(() => showAIToast("Fatto", "Prova"));
    const avviso = await box(page, "#aiToastContainer");
    verifica("avvisi in alto a destra (non coprono la casella della chat)", avviso.y <= 30 && avviso.x + avviso.w >= 1400, JSON.stringify(avviso));
    await page.evaluate(() => navigateTo("clienti"));
    const nuovo = await box(page, ".cl-nuovo"), principale = await box(page, "main");
    verifica("\"Nuovo cliente\" dentro l'area della pagina, non attaccato al bordo dello schermo", nuovo && nuovo.x + nuovo.w <= principale.x + principale.w, JSON.stringify({ nuovo, principale }));
    verifica("nessun errore (computer)", errori.length === 0, JSON.stringify(errori));
    await page.close();

    /* ---- Telefono: come prima ---- */
    const t = await apri(browser, 390, 844);
    const barra = await box(t.page, ".tabbar");
    const vociTel = await t.page.evaluate(() => [...document.querySelectorAll(".tabbar .tab-item")].filter((e) => getComputedStyle(e).display !== "none").map((e) => e.textContent.trim()));
    const marchio = await box(t.page, ".tabbar-marchio");
    verifica("telefono: barra in basso con le solite 4 voci, niente marchio né voci del computer", barra.y > 700 && barra.w === 390 && JSON.stringify(vociTel) === '["Home","Clienti","Cresci","Menu"]' && !marchio.visibile, JSON.stringify({ barra, vociTel, marchio }));
    const campoT = await box(t.page, "#homeHeroCampo"), latoT = await box(t.page, ".home-hero-lato");
    verifica("telefono: la giornata resta sotto la casella, una colonna", latoT.y > campoT.y + campoT.h && latoT.x === campoT.x, JSON.stringify({ campoT, latoT }));
    await t.page.evaluate(() => navigateTo("calendario"));
    const attiviT = await t.page.evaluate(() => [...document.querySelectorAll(".tab-item.active")].map((e) => e.dataset.tab));
    verifica("telefono: in Calendario resta accesa Home, come prima", JSON.stringify(attiviT) === '["home"]', JSON.stringify(attiviT));
    verifica("nessun errore (telefono)", t.errori.length === 0, JSON.stringify(t.errori));
  } finally {
    await browser.close();
    server.kill();
  }
  console.log(fallimenti ? `\n${fallimenti} controlli falliti` : "\nTutto ok");
  process.exit(fallimenti ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
