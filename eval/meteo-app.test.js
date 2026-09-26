/* Test meteo e percorsi nell'app (26/09/2026, Gianardi: "Che tempo fa?
   deve dirmelo"; "Ci metto di più ad arrivare in viale Nicolò Fieschi o
   Pisa?"). Il meteo risponde in una card senza AI (con la posizione del
   telefono se non dici la città); le frasi più articolate vanno all'AI.
   I percorsi aprono le Mappe con il traffico vero. Server finto.

   Uso: NODE_PATH=/opt/node22/lib/node_modules node eval/meteo-app.test.js */

const { chromium } = require("playwright");
const { spawn } = require("child_process");
const path = require("path");

const PORT = 8989;
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
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, geolocation: { latitude: 44.1025, longitude: 9.8241 }, permissions: ["geolocation"] });
    const page = await context.newPage();
    const errori = [];
    page.on("pageerror", (e) => errori.push(e.message));
    await page.addInitScript(() => {
      const catena = () => { const q = { select: () => q, not: () => q, is: () => q, eq: () => q, order: () => q, limit: () => q, in: () => q, single: async () => ({ data: null, error: null }), then: (ok) => ok({ data: [], error: null }) }; return q; };
      window.supabase = { createClient: () => ({ from: catena, channel: () => ({ on() { return this; }, subscribe() { return this; } }),
        auth: { getSession: async () => ({ data: { session: { access_token: "t", user: { id: "u1" } } } }), onAuthStateChange: () => ({}) } }) };
    });
    const meteo = [];
    await page.route("https://eonbeckend.vercel.app/api?action=meteo**", (route) => {
      const u = new URL(route.request().url());
      meteo.push(Object.fromEntries(u.searchParams));
      const luogo = u.searchParams.get("luogo");
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ luogo: luogo ? "Pisa" : "Lerici", giorno: new Date(Date.now() + 86400000).toISOString().slice(0, 10), cielo: "Pioggia", categoria: "pioggia", minima: 12, massima: 19, pioggia_mm: 10.5, vento_max_kmh: 45, ore: [{ ora: "08:00", temperatura: 13, cielo: "nuvoloso" }, { ora: "11:00", temperatura: 16, cielo: "pioggia" }, { ora: "14:00", temperatura: 18, cielo: "pioggia" }, { ora: "17:00", temperatura: 17, cielo: "variabile" }], fonte: "MET Norway" }) });
    });
    let richiesteAI = 0;
    await page.route("https://eonbeckend.vercel.app/api?action=assistant", (route) => { richiesteAI++; route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ testo: "Ok.", azioni: [] }) }); });
    await page.goto(`http://localhost:${PORT}/index.html`, { waitUntil: "networkidle" });
    await page.evaluate(() => { document.getElementById("onboardingScreen").style.display = "none"; currentSession = { access_token: "t", user: { id: "u1" } }; tokenValido = async () => "t"; });

    const capisci = await page.evaluate(() => ({
      a: capisciRichiestaMeteo("Che tempo fa?"),
      b: capisciRichiestaMeteo("che tempo fa domani a Pisa"),
      c: capisciRichiestaMeteo("Piove domani a Lerici?"),
      d: capisciRichiestaMeteo("meteo a La Spezia"),
      e: capisciRichiestaMeteo("posso gettare il cemento sabato a Lerici"),
      f: capisciRichiestaMeteo("che tempo fa sabato"),
      g: capisciRichiestaPercorso("Ci metto di più ad arrivare in viale Nicolò fieschi o Pisa ?"),
      h: capisciRichiestaPercorso("quanto ci metto ad andare a Sarzana"),
    }));
    verifica("\"Che tempo fa?\" → oggi, dove sei", JSON.stringify(capisci.a) === '{"giorno":"oggi","luogo":""}', JSON.stringify(capisci.a));
    verifica("\"che tempo fa domani a Pisa\" → domani, pisa", JSON.stringify(capisci.b) === '{"giorno":"domani","luogo":"pisa"}', JSON.stringify(capisci.b));
    verifica("\"Piove domani a Lerici?\" → domani, lerici", JSON.stringify(capisci.c) === '{"giorno":"domani","luogo":"lerici"}', JSON.stringify(capisci.c));
    verifica("\"meteo a La Spezia\" → la spezia", capisci.d && capisci.d.luogo === "la spezia", JSON.stringify(capisci.d));
    verifica("\"posso gettare il cemento sabato a Lerici\" → decide l'AI", capisci.e === null, JSON.stringify(capisci.e));
    verifica("\"che tempo fa sabato\" → la data del prossimo sabato", capisci.f && /^\d{4}-\d{2}-\d{2}$/.test(capisci.f.giorno) && new Date(capisci.f.giorno + "T12:00:00").getDay() === 6, JSON.stringify(capisci.f));
    verifica("\"Ci metto di più ad arrivare in viale Nicolò fieschi o Pisa?\" → due mete", JSON.stringify(capisci.g) === '["viale Nicolò fieschi","Pisa"]', JSON.stringify(capisci.g));
    verifica("\"quanto ci metto ad andare a Sarzana\" → Sarzana", JSON.stringify(capisci.h) === '["Sarzana"]', JSON.stringify(capisci.h));

    // "Che tempo fa?" dal campo della Home: posizione del telefono, card, niente AI
    richiesteAI = 0;
    await page.fill("#homeHeroCampo", "Che tempo fa?");
    await page.click("#homeHeroSend");
    await page.waitForFunction(() => document.getElementById("risorsaOverlay").style.display === "flex" && !!document.querySelector(".meteo-card"), null, { timeout: 5000 });
    const card = await page.evaluate(() => ({ titolo: document.getElementById("risorsaTitolo").textContent, cielo: document.querySelector(".meteo-cielo").textContent, temp: document.querySelector(".meteo-temp").textContent.replace(/\s+/g, ""), ore: document.querySelectorAll(".meteo-ore > div").length, consiglio: (document.querySelector(".meteo-consiglio") || {}).textContent || "" }));
    verifica("posizione del telefono mandata al server, titolo col paese", meteo.at(-1).lat === "44.1025" && meteo.at(-1).lon === "9.8241" && meteo.at(-1).giorno === "oggi" && !meteo.at(-1).luogo && card.titolo === "Meteo · Lerici", JSON.stringify({ q: meteo.at(-1), t: card.titolo }));
    verifica("card meteo: cielo, massima/minima, 4 orari, senza AI", card.cielo === "Pioggia" && card.temp === "19°12°" && card.ore === 4 && richiesteAI === 0, JSON.stringify(card));
    verifica("consigli da cantiere (pioggia, vento forte)", /Pioggia prevista/.test(card.consiglio) && /Vento forte/.test(card.consiglio), card.consiglio);
    if (process.env.SCREEN_METEO) { await page.waitForTimeout(300); await page.screenshot({ path: process.env.SCREEN_METEO }); }
    await page.evaluate(() => chiudiRisorsaCard());

    await page.fill("#homeHeroCampo", "che tempo fa domani a Pisa");
    await page.click("#homeHeroSend");
    await page.waitForTimeout(500);
    verifica("con la città: si chiede per la città, niente posizione", meteo.at(-1).luogo === "pisa" && meteo.at(-1).giorno === "domani" && !meteo.at(-1).lat && (await page.textContent("#risorsaTitolo")) === "Meteo · Pisa", JSON.stringify(meteo.at(-1)));
    await page.evaluate(() => chiudiRisorsaCard());

    richiesteAI = 0;
    await page.fill("#homeHeroCampo", "Ci metto di più ad arrivare in viale Nicolò fieschi o Pisa ?");
    await page.click("#homeHeroSend");
    await page.waitForTimeout(300);
    const percorso = await page.evaluate(() => ({ titolo: document.getElementById("risorsaTitolo").textContent, link: [...document.querySelectorAll(".percorso-meta")].map((a) => a.getAttribute("href")) }));
    verifica("percorsi: una card con le due mete, che aprono le Mappe col traffico", percorso.titolo === "Quale strada è più veloce" && percorso.link.length === 2 && /destination=viale%20Nicol%C3%B2%20fieschi/.test(percorso.link[0]) && /destination=Pisa/.test(percorso.link[1]) && richiesteAI === 0, JSON.stringify(percorso));
    verifica("nessun errore nella pagina", errori.length === 0, errori.join(" | "));
  } finally {
    await browser.close();
    server.kill();
  }
  console.log(fallimenti ? `\n${fallimenti} controlli falliti.` : "\nTutti i controlli passati.");
  if (fallimenti) process.exitCode = 1;
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
