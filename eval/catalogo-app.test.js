/* Catalogo dell'app (3/10/2026, Andrea: "Devo mettere EON sulla schermata home" → la sezione
   giusta, subito, senza AI). Il modello qui è finto (la sua lettura si decide nel test): si
   prova cosa fa il CODICE con la lettura "app": apre la sezione, chiede con 2-3 tasti se non è
   sicuro, "esci" chiede prima, una sezione di un altro mestiere non si apre, "Ho delle spese?"
   risponde dai dati. Che il modello vero legga bene le frasi lo provano i giri (prove-frasi).
   Uso: NODE_PATH=/opt/node22/lib/node_modules node eval/catalogo-app.test.js */

const { chromium } = require("playwright");
const { spawn } = require("child_process");
const path = require("path");

const PORT = 9043;
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
      window.__scritture = [];
      const catena = (tabella) => {
        const q = {
          update: (patch) => ({ eq: async (col, val) => { window.__scritture.push({ tabella, tipo: "update", patch, id: val }); return { error: null }; } }),
          insert: (riga) => ({ select: () => ({ single: async () => { window.__scritture.push({ tabella, tipo: "insert", riga }); return { data: { id: tabella + "-nuova-" + window.__scritture.length, created_at: new Date().toISOString(), ...riga }, error: null }; } }) }),
          select: () => q, not: () => q, is: () => q, eq: () => q, order: () => q, limit: () => q, in: () => q,
          single: async () => ({ data: null, error: null }),
          then: (ok) => ok({ data: [], error: null }),
        };
        return q;
      };
      window.supabase = { createClient: () => ({
        from: catena,
        channel: () => ({ on() { return this; }, subscribe() { return this; } }),
        storage: { from: () => ({ upload: async () => ({ error: null }), getPublicUrl: (p) => ({ data: { publicUrl: "https://file.test/" + p } }) }) },
        auth: { getSession: async () => ({ data: { session: { access_token: "t", user: { id: "u1" } } } }), onAuthStateChange: () => ({}) },
      }) };
    });
    let rispostaAI = { testo: "Ok.", azioni: [] };
    const richiesteAI = [];
    await page.route("https://eonbeckend.vercel.app/api?action=assistant", (route) => {
      richiesteAI.push(JSON.parse(route.request().postData()).messaggio);
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(rispostaAI) });
    });
    await page.goto(`http://localhost:${PORT}/index.html`, { waitUntil: "networkidle" });

    let lettura = null;
    const prepara = (l) => page.evaluate((l) => {
      document.getElementById("onboardingScreen").style.display = "none";
      currentSession = { access_token: "t", user: { id: "u1" } };
      loadUserDataFromDB = async () => {};
      letturaModello = () => l;
      chiudiRisorsaCard();
      document.getElementById("aiToastContainer").innerHTML = "";
      window.__installa = 0; mostraComeInstallare = () => { window.__installa++; };
      window.__esci = 0; esciDallAccount = async () => { window.__esci++; };
      navigateTo("home");
    }, l);
    const app = (dest, p = 0.97, pDest = 0.95, altre = []) => ({ intento: "app", p, dest, pDest, altreDest: altre, chi: [], pezzi: {}, testo: null });
    const scrivi = async (testo) => { await page.fill("#homeHeroCampo", testo); await page.click("#homeHeroSend"); await page.waitForTimeout(300); };
    const pagina = () => page.evaluate(() => paginaAttuale);

    await prepara(app("installa"));
    richiesteAI.length = 0;
    await scrivi("Devo mettere EON sulla schermata home");
    verifica("\"Devo mettere EON sulla schermata home\" → le istruzioni per metterla sulla Home, senza AI", (await page.evaluate(() => window.__installa)) === 1 && richiesteAI.length === 0);

    await prepara(app("migliora"));
    await scrivi("Voglio aiutare EON a crescere");
    const priv = await page.evaluate(() => ({ p: paginaAttuale, titolo: document.getElementById("risorsaTitolo").textContent, migliora: !!document.querySelector("#risorsaCorpo #impMigliora") }));
    verifica("\"Voglio aiutare EON a crescere\" → Privacy, con la parte \"aiuta EON\"", priv.p === "impostazioni" && priv.migliora && richiesteAI.length === 0, JSON.stringify(priv));

    for (const [dest, attesa] of [["calendario", "calendario"], ["uscite", "pagamenti"], ["fatture_preventivi", "fatture-preventivi"], ["documenti_impresa", "documenti-impresa"], ["cestino", "cestino"]]) {
      await prepara(app(dest));
      await scrivi("frase per " + dest);
      verifica(`sezione "${dest}" → pagina ${attesa}`, (await pagina()) === attesa && richiesteAI.length === 0, await pagina());
    }
    await prepara(app("promemoria"));
    await scrivi("voglio che mi avvisi un'ora prima");
    verifica("\"voglio che mi avvisi un'ora prima\" → la scheda Promemoria", (await page.evaluate(() => document.getElementById("risorsaTitolo").textContent)) === "Promemoria");

    await prepara(app("esci"));
    await scrivi("esco dall'account");
    const esci = await page.evaluate(() => ({ chiede: /Uscire da EON\?/.test(document.getElementById("aiToastContainer").innerText), uscito: window.__esci }));
    verifica("\"esci\": prima chiede, non esce da solo", esci.chiede && esci.uscito === 0, JSON.stringify(esci));
    await page.click(".ai-toast.decisione .ai-toast-yes");
    await page.waitForTimeout(100);
    verifica("…e con \"Esci\" esce", (await page.evaluate(() => window.__esci)) === 1);

    await prepara(app("cartello", 0.97, 0.95));
    await page.evaluate(() => { currentProfession = "idraulico"; });
    await scrivi("devo stampare il cartello del cantiere");
    verifica("una sezione di un altro mestiere (cartello, solo edili) non si apre: decide chi viene dopo", (await pagina()) !== "crea-cartello");
    await page.evaluate(() => { currentProfession = "edile"; });

    await prepara(app("documenti", 0.95, 0.45, [{ tema: "documenti_impresa", p: 0.4 }, { tema: "fatture_preventivi", p: 0.1 }]));
    await scrivi("dove sono le mie carte");
    const scelta = await page.evaluate(() => [...document.querySelectorAll("#risorsaCorpo .scheda-scelta")].map((b) => b.textContent));
    verifica("non sicuro di quale sezione: 3 tasti (Documenti, Documenti dell'impresa, Fatture e preventivi), niente AI", scelta.join("|") === "Documenti|Documenti dell'impresa|Fatture e preventivi" && richiesteAI.length === 0, JSON.stringify(scelta));
    await page.click("#risorsaCorpo .scheda-scelta >> nth=1");
    verifica("…tocco su \"Documenti dell'impresa\": si apre quella", (await pagina()) === "documenti-impresa");

    await prepara(app("profilo", 0.55, 0.2, [{ tema: "obiettivi", p: 0.15 }]));
    await scrivi("voglio provare quei tessuti idrorepellenti per le sedie da esterno");
    const nienteTasti = await page.evaluate(() => ({ aperta: document.getElementById("risorsaOverlay").style.display, titolo: document.getElementById("risorsaTitolo").textContent }));
    verifica("cassetto \"app\" poco sicuro e sezione incerta (giro 16): niente tasti \"Dove vuoi andare?\"", !(nienteTasti.aperta === "flex" && /Dove vuoi andare/.test(nienteTasti.titolo)), JSON.stringify(nienteTasti));

    await prepara(app("installa", 0.4));
    richiesteAI.length = 0;
    await scrivi("boh vediamo un po'");
    verifica("se il modello non è sicuro che sia una sezione: niente apertura", (await page.evaluate(() => window.__installa)) === 0);

    // "Ho delle spese?": dai dati, senza AI
    await prepara({ intento: "dati", p: 0.95, tema: "spese", pTema: 0.9, chi: [], pezzi: {}, quando: null, indirizzo: null });
    await page.evaluate(() => { payments.length = 0; payments.push({ supplier: "Edilfornitura", amount: 840, due: "05 ott 2026", status: "dapagare" }, { supplier: "Gasolio furgone", amount: 90, due: "01 ott 2026", status: "pagato" }); });
    richiesteAI.length = 0;
    await scrivi("Ho delle spese?");
    const spese = await page.evaluate(() => ({ p: paginaAttuale, titolo: document.getElementById("risorsaTitolo").textContent, testo: document.getElementById("risorsaCorpo").innerText }));
    verifica("\"Ho delle spese?\": da pagare €840 (Edilfornitura), pagina Uscite, senza AI", spese.p === "pagamenti" && /Spese/.test(spese.titolo) && /840/.test(spese.testo) && /Edilfornitura/.test(spese.testo) && !/Gasolio/.test(spese.testo.split("Questo mese")[0]) && richiesteAI.length === 0, JSON.stringify(spese));

    verifica("nessun errore nella pagina", errori.length === 0, errori.join(" | "));
  } finally {
    await browser.close();
    server.kill();
  }
  console.log(fallimenti ? `\n${fallimenti} controlli falliti.` : "\nTutti i controlli passati.");
  if (fallimenti) process.exitCode = 1;
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
