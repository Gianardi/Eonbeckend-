/* Cartelle dentro la scheda del cliente (30/09/2026, tester Simone: "dentro il
   cliente viale Italia 171 poter fare una cartella «foto sinistro Del Santo» dove
   metto solo quelle foto"): foto e appunti della cartella stanno anche nella scheda
   del cliente; la cartella non compare nella Mente.
   Browser vero, Supabase finto. Uso: NODE_PATH=/opt/node22/lib/node_modules node eval/cartelle-cliente-app.test.js */

const { chromium } = require("playwright");
const { spawn } = require("child_process");
const path = require("path");

const PORT = 9025;
const ROOT = path.resolve(__dirname, "..");
let fallimenti = 0;
function verifica(nome, condizione, dettaglio) {
  console.log(`  ${condizione ? "OK  " : "FAIL"} ${nome}${condizione || !dettaglio ? "" : " — " + dettaglio}`);
  if (!condizione) fallimenti++;
}
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==", "base64");
const foto = (n) => Array.from({ length: n }, (_, i) => ({ name: "foto" + i + ".png", mimeType: "image/png", buffer: PNG }));

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
    await page.route("**/api?action=*", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ testo: "Ok.", azioni: [] }) }));
    await page.goto(`http://localhost:${PORT}/index.html`, { waitUntil: "networkidle" });
    await page.evaluate(async () => {
      document.getElementById("onboardingScreen").style.display = "none";
      currentSession = { access_token: "t", user: { id: "u1", email: "a@b.it" } };
      loadUserDataFromDB = async () => {}; tokenValido = async () => "t"; descriviFoto = () => {};
      await applyProfession("amministratore", true);
      clients.length = 0;
      clients.push({ id: "c1", name: "Condominio Viale Italia 171", phone: "", status: "attivo", value: 0, desc: "", archived: false });
    });
    const scritte = (op, tab) => page.evaluate(([op, tab]) => window.__db.filter((x) => x.op === op && x.tabella === tab), [op, tab]);
    const toast = () => page.evaluate(() => document.getElementById("aiToastContainer").innerText);
    const pulisci = () => page.evaluate(() => { window.__db.length = 0; document.getElementById("aiToastContainer").innerHTML = ""; });

    // 1) Nella scheda del cliente la sezione "Cartelle" con "+ Cartella"
    await pulisci();
    await page.evaluate(() => mostraSchedaCliente(clients[0]));
    const sez = await page.evaluate(() => ({ titoli: [...document.querySelectorAll("#risorsaCorpo .risorsa-sezione")].map((x) => x.textContent), nuova: !!document.getElementById("scCartellaNuova") }));
    verifica("scheda del cliente: sezione \"Cartelle\" con \"+ Cartella\"", sez.titoli.includes("Cartelle") && sez.nuova, JSON.stringify(sez));
    await page.click("#scCartellaNuova");
    await page.fill("#cartellaNome", "foto sinistro Del Santo");
    await page.click("#cartellaNomeSalva");
    await page.waitForTimeout(300);
    const creata = (await scritte("insert", "cartelle"))[0] || {};
    verifica("creata la cartella del cliente (col cliente)", creata.riga && creata.riga.nome === "Foto sinistro Del Santo" && creata.riga.client_id === "c1", JSON.stringify(creata));
    const card = await page.evaluate(() => ({ titolo: document.getElementById("risorsaTitolo").textContent, indietro: document.querySelector('.ap-azioni [data-az="mente"]').textContent }));
    verifica("si apre la cartella, col tasto per tornare al cliente", card.titolo === "Foto sinistro Del Santo" && card.indietro === "‹ Condominio Viale Italia 171", JSON.stringify(card));

    // 2) Foto dalla galleria nella cartella: stanno nella cartella E nelle foto del cliente
    await pulisci();
    await page.evaluate(() => document.querySelector('.ap-azioni button[data-az="galleria"]').click());
    await page.setInputFiles("#galleriaFotoInput", foto(2));
    await page.waitForTimeout(700);
    const ins = await scritte("insert", "cantiere_foto");
    verifica("2 foto nella cartella del cliente, anche tra le foto del cliente", ins.length === 2 && ins.every((x) => x.riga.cartella_id && x.riga.client_id === "c1"), JSON.stringify(ins.map((x) => x.riga)));

    // 3) Un appunto scritto nella cartella: anche nella scheda del cliente
    await pulisci();
    await page.fill("#apCampo", "il perito passa giovedì");
    await page.click(".ap-invia");
    await page.waitForTimeout(300);
    const ap = (await scritte("insert", "cantiere_appunti"))[0] || {};
    verifica("appunto nella cartella e nella scheda del cliente", ap.riga && ap.riga.cartella_id && ap.riga.client_id === "c1", JSON.stringify(ap));

    // 4) Nella Mente non compare; dalla scheda del cliente sì, con quante cose ha
    const mente = await page.evaluate(() => { apriCardAppunti(null); return [...document.querySelectorAll("#apCartelle .cl-filtro")].map((b) => b.textContent); });
    verifica("la cartella del cliente non compare tra le cartelle della Mente", !mente.some((t) => /sinistro/.test(t)), JSON.stringify(mente));
    const nella = await page.evaluate(() => { mostraSchedaCliente(clients[0]); return [...document.querySelectorAll("#scCartelle .cl-filtro")].map((b) => b.textContent); });
    verifica("nella scheda del cliente c'è, con 3 cose dentro", nella.includes("Foto sinistro Del Santo3"), JSON.stringify(nella));
    await page.evaluate(() => apriCardAppunti(cartelle.find((c) => c.clientId === "c1")));
    await page.click('.ap-azioni [data-az="mente"]');
    const tornato = await page.evaluate(() => document.getElementById("risorsaTitolo").textContent);
    verifica("\"‹ cliente\" torna alla sua scheda", tornato === "Condominio Viale Italia 171", tornato);
    verifica("nessun errore nella pagina", errori.length === 0, JSON.stringify(errori));
  } finally {
    await browser.close();
    server.kill();
  }
  console.log(fallimenti ? `\n${fallimenti} controlli falliti` : "\nTutto ok");
  process.exit(fallimenti ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
