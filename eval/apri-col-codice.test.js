/* "Apri …": tutto si apre con il codice, senza AI (29/09/2026, Andrea:
   "Apri appunti. Apri fornitori. CONTROLLA che tutto possa aprirsi tramite
   il codice e non tramite AI").
   Nel browser vero con Supabase finto: per ogni nome che si vede nell'app
   (menu in basso, Home e card del mestiere, Menu, Cresci, La tua azienda,
   Documenti, Impostazioni, cartelle di "Altra attività") si scrive
   "apri <nome>" e poi solo "<nome>" nella casella della Home: deve aprirsi
   la pagina o la card giusta e nessuna richiesta deve andare all'AI.
   Uso: NODE_PATH=/opt/node22/lib/node_modules node eval/apri-col-codice.test.js */

const { chromium } = require("playwright");
const { spawn } = require("child_process");
const path = require("path");

const PORT = 8999;
const ROOT = path.resolve(__dirname, "..");
let fallimenti = 0;
function verifica(nome, condizione, dettaglio) {
  console.log(`  ${condizione ? "OK  " : "FAIL"} ${nome}${condizione || !dettaglio ? "" : " — " + dettaglio}`);
  if (!condizione) fallimenti++;
}

/* [nome detto, pagina attesa, titolo della card attesa (o null)] */
const COMUNI = [
  ["home", "home"], ["clienti", "clienti"], ["cresci", "cresci"], ["menu", "gestisci-azienda"], ["calendario", "calendario"],
  ["messaggi", "chat"], ["chat", "chat"], ["oggi", "oggi"],
  ["la tua azienda", "azienda"], ["assegna compiti", "assegna-compiti"], ["chiamate", "chiamate"], ["cestino", "cestino"], ["impostazioni", "impostazioni"],
  ["lavori in corso", "cresci"], ["obiettivi", "cresci"],
  ["entrate", "entrate"], ["uscite", "pagamenti"], ["pagamenti", "pagamenti"],
  ["documenti", "cantiere-documenti"], ["documenti impresa", "documenti-impresa"], ["cartello fine lavori", "crea-cartello"], ["lettera", "crea-lettera"],
  ["carta intestata", "carta-intestata"], ["preventivi", "fatture-preventivi"], ["fatture", "fatture-preventivi"],
  ["account", "impostazioni"], ["profilo", "impostazioni"], ["sicurezza", "impostazioni", "Sicurezza"], ["aiuto", "impostazioni", "Aiuto"],
  ["privacy e dati", "impostazioni", "Privacy e dati"], ["registro ai", "ai-request-log"],
  ["feedback", null, "Manda un feedback"], ["manda un feedback", null, "Manda un feedback"],
  ["appunti", null, "Appunti"], ["gli appunti", null, "Appunti"], ["le cose da fare", null, "Appunti"],
];
const MESTIERI = {
  edile: [["cantieri", "cantiere-cliente"], ["durc e documenti impresa", "documenti-impresa"], ["foto cantiere", "cantiere-foto"]],
  idraulico: [["interventi", "cantiere-cliente"], ["preventivi e fatture", "fatture-preventivi"], ["foto impianti", "cantiere-foto"]],
  elettricista: [["impianti", "cantiere-cliente"], ["certificazioni e documenti", "cantiere-documenti"], ["certificazioni", "cantiere-documenti"], ["foto quadri", "cantiere-foto"]],
  amministratore: [["condomini", "cantiere-cliente"], ["assemblee", "assemblee"], ["foto", "cantiere-foto"]],
  artigiano: [["fornitori", null, "Fornitori"], ["la cartella fornitori", null, "Fornitori"], ["personale", null, "Personale"], ["scadenze", null, "Scadenze"],
    ["incassi", null, "Incassi"], ["clienti", null, "Clienti"], ["nuova cartella", "home", "Nuova cartella"], ["crea una cartella", "home", "Nuova cartella"], ["le cartelle", "home"]],
};

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
          select: () => q, not: () => q, is: () => q, eq: () => q, order: () => q, limit: () => q, in: () => q, gt: () => q,
          update: (patch) => ({ eq: async () => ({ error: null }) }),
          insert: (riga) => { window.__scritture.push({ tabella, riga }); const r = { id: "n" + window.__scritture.length, created_at: new Date().toISOString(), ...riga }; return { select: () => ({ single: async () => ({ data: r, error: null }), then: (ok) => ok({ data: [r], error: null }) }) }; },
          maybeSingle: async () => ({ data: null, error: null }),
          single: async () => ({ data: null, error: null }),
          then: (ok) => ok({ data: [], error: null }),
        };
        return q;
      };
      window.supabase = { createClient: () => ({
        from: catena,
        channel: () => ({ on() { return this; }, subscribe() { return this; } }),
        storage: { from: () => ({}) },
        auth: { getSession: async () => ({ data: { session: null } }), onAuthStateChange: () => ({}) },
      }) };
    });
    let richiesteAI = 0;
    await page.route("**/api?action=assistant", (route) => { richiesteAI++; route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ testo: "Ok.", azioni: [] }) }); });
    await page.goto(`http://localhost:${PORT}/index.html`, { waitUntil: "networkidle" });
    await page.evaluate(() => {
      document.getElementById("onboardingScreen").style.display = "none";
      currentSession = { access_token: "t", user: { id: "u1", email: "a@b.it" } };
      loadUserDataFromDB = async () => {};
    });

    const prova = async (frase, attesa, cardAttesa) => {
      await page.evaluate(() => {
        chiudiRisorsaCard(); navigateTo("home");
        document.querySelectorAll(".ai-landing-overlay").forEach((o) => { o.style.display = "none"; });
        document.getElementById("aiToastContainer").innerHTML = "";
      });
      const prima = richiesteAI;
      await page.fill("#homeHeroCampo", frase);
      await page.click("#homeHeroSend", { force: true });
      await page.waitForTimeout(200);
      const s = await page.evaluate(() => ({ pagina: paginaAttuale, card: document.getElementById("risorsaOverlay").style.display === "flex" ? document.getElementById("risorsaTitolo").textContent : null }));
      const ok = richiesteAI === prima && (attesa === null || s.pagina === attesa) && (cardAttesa ? s.card === cardAttesa : !s.card);
      return ok ? null : `${frase} → ${s.pagina}${s.card ? " [" + s.card + "]" : ""}${richiesteAI > prima ? " (AI)" : ""}`;
    };

    for (const [mestiere, propri] of Object.entries(MESTIERI)) {
      await page.evaluate(async (k) => {
        await applyProfession(k, true);
        if (k === "artigiano") {
          cartelle.length = 0;
          cartelle.push({ id: "k1", nome: "Fornitori" }, { id: "k2", nome: "Personale" }, { id: "k3", nome: "Scadenze" }, { id: "k4", nome: "Incassi" }, { id: "k5", nome: "Clienti" });
          renderCartelle();
        }
      }, mestiere);
      const lista = mestiere === "edile" ? COMUNI.concat(propri) : propri;
      const sbagliate = [];
      for (const [nome, pagina, card] of lista) {
        for (const frase of ["apri " + nome, nome]) {
          const errore = await prova(frase, pagina === undefined ? null : pagina, card || null);
          if (errore) sbagliate.push(errore);
        }
      }
      verifica(`${mestiere}: ${lista.length * 2} frasi "apri …" e solo il nome, tutte col codice`, sbagliate.length === 0, sbagliate.join(" | "));
    }

    /* La cartella si apre davvero con i suoi appunti; la card Appunti non è la vecchia pagina */
    const cartella = await page.evaluate(async () => {
      cantiereAppunti.splice(0, cantiereAppunti.length, { id: "a1", testo: "Chiamare la Peroni", created: new Date().toISOString(), daFare: true, fattoIl: null, cartellaId: "k1" });
      chiudiRisorsaCard(); navigateTo("home");
      provaNavigazioneDiretta("apri fornitori");
      const r = { righe: [...document.querySelectorAll("#apLista .ap-testo")].map((t) => t.textContent), azioni: !!document.querySelector(".ap-azioni") };
      chiudiRisorsaCard();
      provaNavigazioneDiretta("apri appunti");
      r.appunti = document.getElementById("risorsaTitolo").textContent === "Appunti" && !!document.getElementById("apCampo") && paginaAttuale !== "cantiere-appunti";
      return r;
    });
    verifica("\"apri Fornitori\" apre la cartella con i suoi appunti; \"apri appunti\" apre la card (non la vecchia pagina)", cartella.righe.join() === "Chiamare la Peroni" && cartella.azioni && cartella.appunti, JSON.stringify(cartella));

    /* Dentro una card aperta: il nome di una pagina chiude la card e va lì; una cartella apre l'altra */
    const dentro = await page.evaluate(async () => {
      const r = {};
      window.__scritture.length = 0;
      chiudiRisorsaCard(); apriCardAppunti(null);
      document.getElementById("apCampo").value = "calendario";
      document.querySelector(".ap-invia").click();
      await new Promise((ok) => setTimeout(ok, 100));
      r.calendario = paginaAttuale === "calendario" && document.getElementById("risorsaOverlay").style.display !== "flex" && window.__scritture.length === 0;
      navigateTo("home"); apriCardAppunti(null);
      document.getElementById("apCampo").value = "Scadenze";
      document.querySelector(".ap-invia").click();
      await new Promise((ok) => setTimeout(ok, 100));
      r.altraCartella = document.getElementById("risorsaTitolo").textContent === "Scadenze" && document.getElementById("risorsaOverlay").style.display === "flex";
      document.getElementById("apCampo").value = "fattura Peroni da pagare il 10";
      document.querySelector(".ap-invia").click();
      await new Promise((ok) => setTimeout(ok, 100));
      r.notaNormale = window.__scritture.length === 1 && window.__scritture[0].riga.cartella_id === "k3";
      chiudiRisorsaCard();
      return r;
    });
    verifica("nella card: \"calendario\" chiude e va al calendario, \"Scadenze\" apre quella cartella, il resto è un appunto", Object.values(dentro).every(Boolean), JSON.stringify(dentro));

    /* Le richieste vere non si fermano al nome: vanno avanti come prima */
    const vanno = await page.evaluate(() => ({
      nota: provaNavigazioneDiretta("appunti per Rossi: portare le chiavi"),
      fornitori: provaNavigazioneDiretta("chiama i fornitori"),
      cartella: provaNavigazioneDiretta("nuova cartella clienti vip"),
    }));
    verifica("frasi con qualcosa in più non vengono scambiate per \"apri\"", !vanno.nota && !vanno.fornitori && !vanno.cartella, JSON.stringify(vanno));
    const cartelleSoloAltra = await page.evaluate(async () => { await applyProfession("edile", true); chiudiRisorsaCard(); const r = provaNavigazioneDiretta("nuova cartella"); chiudiRisorsaCard(); return r; });
    verifica("\"nuova cartella\" solo in Altra attività (per gli artigiani non ci sono cartelle)", cartelleSoloAltra === false);

    verifica("nessun errore nella pagina", errori.length === 0, JSON.stringify(errori));
  } finally {
    await browser.close();
    server.kill();
  }
  console.log(fallimenti ? `\n${fallimenti} controlli falliti` : "\nTutto ok");
  process.exit(fallimenti ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
