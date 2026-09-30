/* Frasi vere per allenare i modelli, col consenso (30/09/2026):
   - spento (come per tutti all'inizio): non parte niente;
   - Impostazioni → Privacy e dati → "Aiuta a migliorare EON" → Accendi: salvato nel profilo;
   - acceso: ogni richiesta manda la frase SENZA dati personali (cliente, telefono,
     indirizzo tolti), con cosa ha capito il modello e cosa ha fatto EON;
   - "Annulla" subito dopo: una riga "annullato";
   - "Cancella le frasi date" e "Spegni".
   Browser vero, Supabase finto. Uso: NODE_PATH=/opt/node22/lib/node_modules node eval/frasi-addestramento-app.test.js */

const { chromium } = require("playwright");
const { spawn } = require("child_process");
const path = require("path");

const PORT = 9023;
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
          update: (dati) => ({ eq: async () => { window.__db.push({ tabella, op: "update", dati }); return { error: null }; } }),
          delete: () => ({ eq: async (c, v) => { window.__db.push({ tabella, op: "delete", c, v }); return { error: null }; } }),
          insert: (riga) => { window.__db.push({ tabella, op: "insert", riga }); const r = { id: "n" + window.__db.length, created_at: new Date().toISOString(), ...riga }; return { select: () => ({ single: async () => ({ data: r, error: null }) }) }; },
          maybeSingle: async () => ({ data: null, error: null }), single: async () => ({ data: null, error: null }),
          then: (ok) => ok({ data: [], error: null }),
        };
        return q;
      };
      window.supabase = { createClient: () => ({ from: catena, channel: () => ({ on() { return this; }, subscribe() { return this; } }), storage: { from: () => ({}) }, auth: { getSession: async () => ({ data: { session: null } }), onAuthStateChange: () => ({}) } }) };
    });
    await page.route("**/api?action=*", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ stato: "concluso", testo: "Fatto.", azioni: [] }) }));
    await page.goto(`http://localhost:${PORT}/index.html`, { waitUntil: "networkidle" });
    await page.evaluate(async () => {
      document.getElementById("onboardingScreen").style.display = "none";
      currentSession = { access_token: "t", user: { id: "u1", email: "a@b.it" } };
      loadUserDataFromDB = async () => {}; tokenValido = async () => "t";
      profiloUtente = { id: "u1", full_name: "Simone", business_name: "Prova", profession: "edile", aiuta_migliorare: false };
      await applyProfession("edile", true);
      clients.length = 0;
      clients.push({ id: "c1", name: "Giuseppe Brambilla", phone: "3330000001", status: "attivo", value: 0, desc: "", archived: false });
    });
    const scrivi = async (frase) => {
      await page.evaluate(() => { chiudiRisorsaCard(); navigateTo("home"); document.getElementById("aiToastContainer").innerHTML = ""; });
      await page.fill("#homeHeroCampo", frase);
      await page.evaluate(() => document.getElementById("homeHeroSend").click());
      await page.waitForTimeout(500);
    };
    const frasi = () => page.evaluate(() => window.__db.filter((x) => x.tabella === "frasi_addestramento"));

    await scrivi("domani alle 9 sopralluogo da Brambilla in via Garibaldi 22, il suo numero è 339 1234567");
    verifica("spento (come per tutti all'inizio): non manda niente", (await frasi()).length === 0, JSON.stringify(await frasi()));

    // Accendi
    await page.evaluate(() => { chiudiRisorsaCard(); navigateTo("impostazioni"); });
    await page.click("#impVocePrivacy");
    const prima = await page.evaluate(() => document.getElementById("impMigliora").innerText);
    verifica("in Privacy e dati c'è \"Aiuta a migliorare EON\", spento, spiegato", /Aiuta a migliorare EON/.test(prima) && /Spento/.test(prima) && /senza nomi, telefoni e indirizzi/.test(prima), prima);
    await page.click("#impMiglioraCambia");
    await page.waitForTimeout(300);
    const acceso = await page.evaluate(() => ({ db: window.__db.filter((x) => x.tabella === "profiles" && x.op === "update"), p: profiloUtente.aiuta_migliorare, testo: document.getElementById("impMigliora").innerText }));
    const up = acceso.db[acceso.db.length - 1] || {};
    verifica("\"Accendi\": salvato nel profilo con la data", acceso.p === true && up.dati && up.dati.aiuta_migliorare === true && !!up.dati.aiuta_migliorare_dal && /Acceso/.test(acceso.testo), JSON.stringify(acceso));

    // Riaprendo l'app il profilo arriva dal server: l'interruttore resta acceso (bug trovato da Andrea il 30/09)
    const riaperto = await page.evaluate(() => { ricordaProfilo({ full_name: "Simone", business_name: "Prova", profession: "edile", aiuta_migliorare: true, aiuta_migliorare_dal: "2026-09-30T20:28:11Z" }, "a@b.it"); chiudiRisorsaCard(); navigateTo("impostazioni"); return profiloUtente.aiuta_migliorare; });
    await page.click("#impVocePrivacy");
    const dopoRiapertura = await page.evaluate(() => document.getElementById("impMigliora").innerText);
    verifica("riaprendo l'app (profilo dal server) resta acceso", riaperto === true && /Acceso/.test(dopoRiapertura), dopoRiapertura);

    // Acceso: la frase parte senza dati personali (un appunto: lo fa il codice, con "Annulla")
    await scrivi("appunto: il cancello di Brambilla in via Garibaldi 22 va riverniciato, il suo numero è 339 1234567");
    let f = await frasi();
    const riga = (f[0] || {}).riga || {};
    verifica("acceso: manda la frase", f.length === 1 && f[0].op === "insert", JSON.stringify(f));
    verifica("senza il cliente, il telefono e l'indirizzo", !!riga.frase && !/Brambilla|Garibaldi|339|1234567/.test(riga.frase) && /Cliente/.test(riga.frase), riga.frase);
    verifica("con cosa ha capito il modello, cosa ha fatto EON e il mestiere", !!riga.esito && riga.mestiere === "edile" && "cassetto" in riga, JSON.stringify(riga));

    // Annulla subito dopo = EON aveva capito male (un appunto senza cliente: avviso con "Annulla")
    await scrivi("appunto: comprare il silicone per il bagno");
    const annulla = await page.evaluate(() => { const b = [...document.querySelectorAll("#aiToastContainer .ai-toast-yes")].find((x) => /Annulla/.test(x.textContent)); if (b) b.click(); return !!b; });
    await page.waitForTimeout(300);
    f = await frasi();
    const ultime = f.slice(-2).map((x) => x.riga || {});
    verifica("\"Annulla\" subito dopo: una riga \"annullato\" con la stessa frase", annulla && f.length === 3 && ultime[1].esito === "annullato" && ultime[1].frase === ultime[0].frase, JSON.stringify(f.map((x) => x.riga && x.riga.esito)));

    // Cancella e spegni
    await page.evaluate(() => { chiudiRisorsaCard(); navigateTo("impostazioni"); });
    await page.click("#impVocePrivacy");
    await page.click("#impMiglioraCancella");
    await page.waitForTimeout(200);
    const canc = await page.evaluate(() => window.__db.filter((x) => x.tabella === "frasi_addestramento" && x.op === "delete"));
    verifica("\"Cancella le frasi date\": cancella le sue", canc.length === 1 && canc[0].v === "u1", JSON.stringify(canc));
    await page.click("#impMiglioraCambia");
    await page.waitForTimeout(300);
    const n = (await frasi()).length;
    await scrivi("fattura a Brambilla 500 euro");
    verifica("\"Spegni\": da lì non manda più niente", (await frasi()).length === n, JSON.stringify(await frasi()));
    verifica("nessun errore nella pagina", errori.length === 0, JSON.stringify(errori));
  } finally {
    await browser.close();
    server.kill();
  }
  console.log(fallimenti ? `\n${fallimenti} controlli falliti` : "\nTutto ok");
  process.exit(fallimenti ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
