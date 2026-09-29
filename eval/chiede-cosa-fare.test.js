/* "Chiede invece di sbagliare" (30/09/2026). Quando le regole non capiscono
   e il modello ha solo un'idea (40-70%), EON propone le due cose più
   probabili con un tasto ciascuna, più "Lo chiedo a EON". Qui il modello è
   finto (risposta decisa dal test), l'app e il lettore sono veri.
   Uso: NODE_PATH=/opt/node22/lib/node_modules node eval/chiede-cosa-fare.test.js */

const { chromium } = require("playwright");
const { spawn } = require("child_process");
const path = require("path");

const PORT = 9027;
const ROOT = path.resolve(__dirname, "..");
let fallimenti = 0;
function verifica(nome, condizione, dettaglio) {
  console.log(`  ${condizione ? "OK  " : "FAIL"} ${nome}${condizione || !dettaglio ? "" : " — " + dettaglio}`);
  if (!condizione) fallimenti++;
}

function preparaPagina() {
  const catena = () => {
    const q = { select: () => q, not: () => q, is: () => q, eq: () => q, order: () => q, limit: () => q, in: () => q, gt: () => q,
      insert: (riga) => ({ select: () => ({ single: async () => ({ data: { id: "n1", created_at: new Date().toISOString(), ...riga }, error: null }) }) }),
      update: () => ({ eq: async () => ({ error: null }) }), then: (ok) => ok({ data: [], error: null }), maybeSingle: async () => ({ data: null }), single: async () => ({ data: null }) };
    return q;
  };
  window.supabase = { createClient: () => ({ from: catena, channel: () => ({ on() { return this; }, subscribe() { return this; } }), storage: { from: () => ({}) }, auth: { getSession: async () => ({ data: { session: null } }), onAuthStateChange: () => ({}) } }) };
}

async function main() {
  const server = spawn("python3", ["-m", "http.server", String(PORT)], { cwd: ROOT, stdio: "ignore" });
  await new Promise((r) => setTimeout(r, 800));
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const errori = [];
    page.on("pageerror", (e) => errori.push(e.message));
    await page.addInitScript(preparaPagina);
    await page.route("**/api?action=*", (route) => route.fulfill({ status: 200, contentType: "application/json", body: "{}" }));
    await page.goto(`http://localhost:${PORT}/index.html`, { waitUntil: "networkidle" });
    await page.evaluate(async () => {
      document.getElementById("onboardingScreen").style.display = "none";
      currentSession = { access_token: "t", user: { id: "u1", email: "a@b.it" } };
      loadUserDataFromDB = async () => {}; tokenValido = async () => "t";
      await applyProfession("edile", true);
      clients.length = 0; clients.push({ id: "c1", name: "Mario Rossi", status: "attivo", archived: false });
      window.__rifatto = [];
      window.__modello = null;
      const vero = EonLettore.classifica;
      EonLettore.classifica = (t, c) => window.__modello || vero(t, c);
    });
    const prova = (frase, modello) => page.evaluate(([frase, modello]) => {
      chiudiRisorsaCard(); window.__rifatto.length = 0; window.__modello = modello;
      const fatto = chiediCosaFare(frase, false, (x, p) => window.__rifatto.push([x, p]));
      const aperta = document.getElementById("risorsaOverlay").style.display === "flex";
      return { fatto, aperta, titolo: aperta ? document.getElementById("risorsaTitolo").textContent : "", tasti: [...document.querySelectorAll("#risorsaCorpo .scheda-scelta")].map((b) => b.textContent) };
    }, [frase, modello]);

    // 1. Idea al 55% (messaggio) e al 30% (chiamata): due tasti + "Lo chiedo a EON"
    let r = await prova("Mario Rossi quella cosa del cantiere di ieri", { intento: "messaggio", p: 0.55, secondo: "chiamata", p2: 0.3 });
    verifica("non sicuro (55%): «Cosa faccio?» con le due azioni e «Lo chiedo a EON»", r.fatto && r.titolo === "Cosa faccio?" && r.tasti.length === 3 && /Scrivo un messaggio a Mario Rossi/.test(r.tasti[0]) && /^Chiamo Mario Rossi/.test(r.tasti[1]) && r.tasti[2] === "Lo chiedo a EON", JSON.stringify(r));
    await page.waitForTimeout(700); await page.screenshot({ path: path.join(process.env.SCREEN_DIR || "/tmp", "chiede-cosa-fare.png") });
    await page.locator("#risorsaCorpo .scheda-scelta", { hasText: "Chiamo" }).click();
    let rifatto = await page.evaluate(() => window.__rifatto.slice());
    verifica("tocco su «Chiamo Mario Rossi» → EON rifà «chiama Mario Rossi» col codice", rifatto.length === 1 && rifatto[0][0] === "chiama Mario Rossi" && rifatto[0][1].daModello, JSON.stringify(rifatto));

    r = await prova("Mario Rossi quella cosa del cantiere di ieri", { intento: "messaggio", p: 0.55, secondo: "chiamata", p2: 0.3 });
    await page.locator("#risorsaCorpo .scheda-scelta", { hasText: "Lo chiedo a EON" }).click();
    rifatto = await page.evaluate(() => window.__rifatto.slice());
    verifica("tocco su «Lo chiedo a EON» → va all'AI come prima", rifatto.length === 1 && rifatto[0][1].soloServer, JSON.stringify(rifatto));

    // 2. Troppo incerto (30%) o una domanda vera: niente tasti, come prima
    r = await prova("Mario Rossi quella cosa del cantiere di ieri", { intento: "messaggio", p: 0.3, secondo: "chiamata", p2: 0.2 });
    verifica("idea troppo debole (30%): niente domanda, decide l'AI come prima", !r.fatto && !r.aperta, JSON.stringify(r));
    r = await prova("secondo te conviene il cappotto da 10 centimetri", { intento: "domanda", p: 0.6, secondo: "mente", p2: 0.2 });
    verifica("una domanda vera (consiglio): niente tasti, va all'AI", !r.fatto, JSON.stringify(r));
    // 3. Una frase che le regole capiscono (nuovo cliente): mai la domanda
    r = await prova("Luca Ferrero 333 1234567 bagno", { intento: "cliente", p: 0.5, secondo: "chiamata", p2: 0.3 });
    verifica("le regole l'hanno capita (cliente nuovo): niente domanda", !r.fatto, JSON.stringify(r));
    verifica("nessun errore nella pagina", errori.length === 0, JSON.stringify(errori));
  } finally {
    await browser.close();
    server.kill();
  }
  console.log(fallimenti ? `\n${fallimenti} controlli falliti` : "\nTutto ok");
  process.exit(fallimenti ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
