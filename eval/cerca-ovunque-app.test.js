/* Cercare un documento chiamato col suo nome (1/10/2026, Gianardi: "se l'artigiano chiede una
   cosa EON gliela fa subito"): "trovami il computo del capannone Zanola", "cerca lo schema
   dell'impianto della masseria" li trova il codice (documenti dell'impresa, allegati dei
   clienti, foto); se non c'è lo dice subito ("Non lo trovo", con il tasto per caricarlo),
   senza passare dall'AI. Browser vero, Supabase finto.
   Uso: NODE_PATH=/opt/node22/lib/node_modules node eval/cerca-ovunque-app.test.js */

const { chromium } = require("playwright");
const { spawn } = require("child_process");
const path = require("path");

const PORT = 9037;
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
    await page.addInitScript(() => {
      window.__db = [];
      const catena = (tabella) => {
        const q = {
          select: () => q, not: () => q, is: () => q, eq: () => q, order: () => q, limit: () => q, in: () => q, gt: () => q,
          update: (patch) => ({
            eq: async (c, v) => { window.__db.push({ tabella, op: "update", ids: [v], patch }); return { error: null }; },
            in: async (c, v) => { window.__db.push({ tabella, op: "update", ids: v, patch }); return { error: null }; },
          }),
          delete: () => ({ eq: async () => ({ error: null }) }),
          insert: (riga) => { window.__db.push({ tabella, op: "insert", riga }); const r = { id: tabella + window.__db.length, created_at: new Date().toISOString(), ...riga }; return { select: () => ({ single: async () => ({ data: r, error: null }), then: (ok) => ok({ data: [r], error: null }) }) }; },
          maybeSingle: async () => ({ data: null, error: null }), single: async () => ({ data: null, error: null }),
          then: (ok) => ok({ data: [], error: null }),
        };
        return q;
      };
      window.supabase = { createClient: () => ({ from: catena, channel: () => ({ on() { return this; }, subscribe() { return this; } }),
        storage: { from: () => ({ upload: async () => ({ error: null }), getPublicUrl: (p) => ({ data: { publicUrl: "https://file.test/" + p } }) }) },
        auth: { getSession: async () => ({ data: { session: null } }), onAuthStateChange: () => ({}) } }) };
    });
    let chiamateServer = 0; const azioniServer = [];
    await page.route("**/api?action=*", (route) => { const a = new URL(route.request().url()).searchParams.get("action"); azioniServer.push(a); if (a === "assistant") chiamateServer++; return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ testo: "Ok.", azioni: [] }) }); });
    await page.goto(`http://localhost:${PORT}/index.html`, { waitUntil: "networkidle" });
    await page.evaluate(async () => {
      document.getElementById("onboardingScreen").style.display = "none";
      currentSession = { access_token: "t", user: { id: "u1", email: "a@b.it" } };
      loadUserDataFromDB = async () => {}; tokenValido = async () => "t"; descriviFoto = () => {};
      await applyProfession("edile", true);
      clients.length = 0;
      clients.push({ id: "c1", name: "Masseria Lu Pagghiaru", phone: "", status: "attivo", value: 0, desc: "", archived: false });
      clients.push({ id: "c2", name: "Zanola Metalli", phone: "", status: "attivo", value: 0, desc: "", archived: false });
      cantiereDocumenti.length = 0;
      cantiereDocumenti.push({ id: "d1", nome: "Computo capannone Zanola.pdf", url: "https://file.test/computo.pdf", tipo: "application/pdf", created: new Date().toISOString() });
      cantiereDocumenti.push({ id: "d2", nome: "DURC 2026.pdf", url: "https://file.test/durc.pdf", tipo: "application/pdf", created: new Date().toISOString() });
      chats.length = 0;
      chats.push({ name: "Masseria Lu Pagghiaru", messages: [{ id: "m1", fileUrl: "https://file.test/schema.pdf", fileName: "Schema impianto irrigazione masseria.pdf", time: "ieri" }] });
    });
    const scritte = (op, tab) => page.evaluate(([op, tab]) => window.__db.filter((x) => x.op === op && x.tabella === tab), [op, tab]);
    const toast = () => page.evaluate(() => document.getElementById("aiToastContainer").innerText);

    const scrivi = async (frase) => {
      await page.evaluate(() => { chiudiRisorsaCard(); navigateTo("home"); document.getElementById("aiToastContainer").innerHTML = ""; });
      await page.fill("#homeHeroCampo", frase);
      await page.evaluate(() => document.getElementById("homeHeroSend").click());
      await page.waitForTimeout(600);
    };
    const card = () => page.evaluate(() => ({ aperta: document.getElementById("risorsaOverlay").style.display === "flex", titolo: document.getElementById("risorsaTitolo").textContent, corpo: document.getElementById("risorsaCorpo").innerText }));

    // 1) Un documento dell'impresa chiamato col suo nome: si apre
    let s0 = chiamateServer;
    await scrivi("trovami il computo del capannone Zanola");
    let c = await card();
    verifica("\"trovami il computo del capannone Zanola\": apre il computo", c.aperta && /Computo capannone Zanola/.test(c.titolo), JSON.stringify(c));
    verifica("…senza AI", chiamateServer === s0, String(chiamateServer - s0));

    // 2) Un allegato nella conversazione di un cliente
    s0 = chiamateServer;
    await scrivi("cerca lo schema dell'impianto della masseria");
    c = await card();
    verifica("\"cerca lo schema dell'impianto della masseria\": trova l'allegato del cliente", c.aperta && /Schema impianto irrigazione masseria/.test(c.corpo), JSON.stringify(c));
    verifica("…senza AI", chiamateServer === s0);

    // 3) Non c'è: lo dice subito il codice, con il tasto per caricarlo
    s0 = chiamateServer;
    await scrivi("apri il pdf del permesso della cascina Bettoni");
    c = await card();
    verifica("documento che non c'è: \"Non lo trovo\" con \"Carica il documento\"", c.aperta && /Non lo trovo/.test(c.titolo) && /permesso della cascina Bettoni/.test(c.corpo) && /Carica il documento/.test(c.corpo), JSON.stringify(c));
    verifica("…senza AI (prima andava all'AI)", chiamateServer === s0);
    if (process.env.FOTO) await page.screenshot({ path: process.env.FOTO }); // FOTO=file.png: com'è la card
    await page.evaluate(() => [...document.querySelectorAll("#risorsaCorpo .scheda-scelta")].find((b) => b.textContent === "Carica il documento").click());
    await page.waitForTimeout(300);
    verifica("\"Carica il documento\" porta ai Documenti dell'impresa", await page.evaluate(() => paginaAttuale) === "documenti-impresa");

    // 4) In dialetto: "fammi vedé le foto della specchiera"
    await scrivi("fammi vedé le foto della specchiera prima del restauro");
    c = await card();
    verifica("\"fammi vedé le foto della specchiera\": cercata (non è \"fai una foto\")", c.aperta && /Non lo trovo/.test(c.titolo), JSON.stringify(c));

    // 5) Da non toccare: fare un documento, il DURC (lo trova la sua funzione), un preventivo
    await scrivi("fammi un documento per il permesso di costruire");
    c = await card();
    verifica("\"fammi un documento…\" non è una ricerca", !/Non lo trovo/.test(c.titolo), JSON.stringify(c));
    await scrivi("mostrami il DURC");
    c = await card();
    verifica("\"mostrami il DURC\": il DURC come prima", c.aperta && /DURC/.test(c.titolo), JSON.stringify(c));
    await scrivi("preventivo Zanola rifacimento tetto 4.000");
    c = await card();
    verifica("un preventivo da fare non è una ricerca", !/Non lo trovo/.test(c.titolo), JSON.stringify(c));
    verifica("nessun errore nella pagina", errori.length === 0, JSON.stringify(errori));
    console.log("  (chiamate al server: " + JSON.stringify(azioniServer) + ")");
  } finally {
    await browser.close();
    server.kill();
  }
  console.log(fallimenti ? `\n${fallimenti} controlli falliti` : "\nTutto ok");
  process.exit(fallimenti ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
