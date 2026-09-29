/* Home: "Parla" e "Foto", due tasti uguali (30/09/2026, Andrea sceglie la
   simulazione D). La fotocamera solo per edile, idraulico, elettricista e
   amministratore; "La mia attività" resta col solo microfono grande.
   Un tocco su Foto apre la fotocamera (come "fai una foto": dopo lo scatto
   EON chiede di quale cliente è).
   Uso: NODE_PATH=/opt/node22/lib/node_modules node eval/home-foto.test.js */

const { chromium } = require("playwright");
const { spawn } = require("child_process");
const path = require("path");

const PORT = 9035;
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
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const errori = [];
    page.on("pageerror", (e) => errori.push(e.message));
    await page.addInitScript(() => { try { localStorage.setItem("eon-scorri-accennato", "1"); } catch (e) {} });
    await page.goto(`http://localhost:${PORT}/index.html`, { waitUntil: "networkidle" });
    await page.evaluate(() => { document.getElementById("onboardingScreen").style.display = "none"; navigateTo("home"); });
    const misura = () => page.evaluate(() => {
      const box = (id) => { const r = document.getElementById(id).getBoundingClientRect(); return { w: Math.round(r.width), x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2), visibile: r.width > 0 }; };
      return { mic: box("homeHeroMic"), foto: box("homeHeroFoto"), scritte: [...document.querySelectorAll("#homeHeroTasti .home-hero-etichetta")].filter((e) => e.offsetParent).map((e) => e.textContent) };
    });

    for (const mestiere of ["edile", "idraulico", "elettricista", "amministratore"]) {
      await page.evaluate(async (m) => { await applyProfession(m, true); navigateTo("home"); window.scrollTo(0, 0); }, mestiere);
      const m = await misura();
      verifica(`${mestiere}: «Parla» e «Foto», due tasti uguali affiancati con la scritta`, m.mic.visibile && m.foto.visibile && m.mic.w === 96 && m.foto.w === 96 && Math.abs(m.mic.y - m.foto.y) < 2 && m.foto.x > m.mic.x && m.scritte.join() === "Parla,Foto", JSON.stringify(m));
      if (mestiere === "edile") await page.screenshot({ path: path.join(process.env.SCREEN_DIR || "/tmp", "home-parla-foto.png") });
    }
    await page.evaluate(async () => { await applyProfession("artigiano", true); navigateTo("home"); });
    let m = await misura();
    verifica("«La mia attività»: solo il microfono grande, senza scritta", m.mic.w === 112 && !m.foto.visibile && m.scritte.length === 0, JSON.stringify(m));

    // Un tocco su Foto: la fotocamera (il file input) e poi "di quale cliente?"
    await page.evaluate(async () => {
      await applyProfession("edile", true); navigateTo("home");
      window.__scatti = 0;
      document.getElementById("fotoRapidaInput").click = () => { window.__scatti++; };
    });
    await page.click("#homeHeroFoto");
    const dopo = await page.evaluate(() => ({ scatti: window.__scatti, pronto: JSON.stringify(fotoRapidaDaSalvare) }));
    verifica("un tocco su «Foto» apre la fotocamera (senza cliente: dopo lo scatto EON chiede di chi è)", dopo.scatti === 1 && dopo.pronto === "{}", JSON.stringify(dopo));
    verifica("nessun errore nella pagina", errori.length === 0, JSON.stringify(errori));
  } finally {
    await browser.close();
    server.kill();
  }
  console.log(fallimenti ? `\n${fallimenti} controlli falliti` : "\nTutto ok");
  process.exit(fallimenti ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
