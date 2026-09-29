/* La barra in basso resta attaccata al fondo dello schermo mentre si scorre
   (29/09/2026, foto di Andrea: su iPhone, scorrendo la Home, restava a metà).
   Sul computer resta il menu a sinistra. Niente contenuto nascosto sotto.
   Uso: NODE_PATH=/opt/node22/lib/node_modules node eval/barra-fissa.test.js */
const { chromium } = require("playwright");
const { spawn } = require("child_process");
const path = require("path");

const PORT = 9022;
const ROOT = path.resolve(__dirname, "..");
let fallimenti = 0;
function verifica(nome, condizione, dettaglio) {
  console.log(`  ${condizione ? "OK  " : "FAIL"} ${nome}${condizione || !dettaglio ? "" : " — " + dettaglio}`);
  if (!condizione) fallimenti++;
}
function supabaseFinto() {
  const q = { select: () => q, eq: () => q, is: () => q, not: () => q, order: () => q, limit: () => q, in: () => q, gt: () => q, then: (ok) => ok({ data: [], error: null }), maybeSingle: async () => ({ data: null }), single: async () => ({ data: null }) };
  window.supabase = { createClient: () => ({ from: () => q, channel: () => ({ on() { return this; }, subscribe() { return this; } }), storage: { from: () => ({}) }, auth: { getSession: async () => ({ data: { session: null } }), onAuthStateChange: () => ({}) } }) };
}
async function main() {
  const server = spawn("python3", ["-m", "http.server", String(PORT)], { cwd: ROOT, stdio: "ignore" });
  await new Promise((r) => setTimeout(r, 800));
  const browser = await chromium.launch();
  try {
    for (const [w, h, nome] of [[390, 844, "telefono"], [390, 600, "telefono basso"], [1280, 800, "computer"]]) {
      const page = await browser.newPage({ viewport: { width: w, height: h } });
      await page.addInitScript(supabaseFinto);
      await page.route("**/api?action=*", (r) => r.fulfill({ status: 200, contentType: "application/json", body: "{}" }));
      await page.goto(`http://localhost:${PORT}/index.html`, { waitUntil: "networkidle" });
      await page.evaluate(async () => { document.getElementById("onboardingScreen").style.display = "none"; await applyProfession("edile", true); navigateTo("home"); });
      const misure = [];
      for (const y of [0, 150, 99999]) {
        await page.evaluate((y) => window.scrollTo(0, y), y);
        await page.waitForTimeout(100);
        misure.push(await page.evaluate(() => {
          const r = document.querySelector(".tabbar").getBoundingClientRect();
          const ultimo = document.querySelector("#page-home .cartelle-nuova, #page-home [class*='nuova-cartella']") || [...document.querySelectorAll("#page-home *")].filter((e) => e.offsetParent && e.children.length === 0).pop();
          return { top: Math.round(r.top), bottom: Math.round(r.bottom), left: Math.round(r.left), w: Math.round(r.width), h: Math.round(r.height), vh: innerHeight, fine: Math.round(ultimo.getBoundingClientRect().bottom) };
        }));
      }
      if (w < 1024) {
        verifica(`${nome}: la barra sta sempre in fondo allo schermo mentre si scorre`, misure.every((m) => m.bottom === m.vh && m.h < 90), JSON.stringify(misure));
        verifica(`${nome}: in fondo alla pagina niente resta nascosto sotto la barra`, misure[2].fine <= misure[2].top, JSON.stringify(misure[2]));
      } else {
        verifica(`${nome}: resta il menu a sinistra, alto quanto lo schermo`, misure.every((m) => m.left === 0 && m.w === 240 && m.top === 0 && m.bottom === m.vh), JSON.stringify(misure));
      }
      await page.close();
    }
  } finally {
    await browser.close();
    server.kill();
  }
  console.log(fallimenti ? `\n${fallimenti} controlli falliti` : "\nTutto ok");
  process.exit(fallimenti ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
