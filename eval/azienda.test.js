/* Test di "La tua azienda" (27/09/2026): la voce del Menu apre una
   pagina vera; entrate, uscite, tasse (stima) e "ti resta" calcolati dai
   dati veri, per il mese o per l'anno; i clienti si contano da soli
   (aggiungi → sale, togli → scende); la percentuale delle tasse si cambia.
   Connessione totale (26/09/2026): togliere o rinominare un cliente toglie
   o rinomina anche le sue entrate e i suoi appunti, subito.
   Carica la vera index.html con Supabase finto.

   Uso: NODE_PATH=/opt/node22/lib/node_modules node eval/azienda.test.js */

const { chromium } = require("playwright");
const { spawn } = require("child_process");
const path = require("path");

const PORT = 8991;
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
    const erroriPagina = [];
    page.on("pageerror", (e) => erroriPagina.push(e.message));
    await page.addInitScript(() => {
      const catena = () => { const q = {
        update: () => ({ eq: async () => ({ error: null }) }),
        insert: () => ({ select: () => ({ single: async () => ({ data: {}, error: null }) }) }),
        select: () => q, not: () => q, is: () => q, eq: () => q, order: () => q, limit: () => q,
        then: (ok) => ok({ data: [], error: null }) }; return q; };
      window.supabase = { createClient: () => ({ from: catena, channel: () => ({ on(){ return this; }, subscribe(){ return this; } }),
        storage: { from: () => ({}) }, auth: { getSession: async () => ({ data: { session: null } }), onAuthStateChange: () => ({}) } }) };
    });
    await page.goto(`http://localhost:${PORT}/index.html`, { waitUntil: "networkidle" });

    await page.evaluate(() => {
      document.getElementById("onboardingScreen").style.display = "none";
      try { localStorage.removeItem("eon-tasse-percentuale"); } catch (e) {}
      const oggi = new Date();
      const iso = (d) => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
      // un giorno di un altro mese dello stesso anno
      const altroMese = new Date(oggi.getFullYear(), oggi.getMonth() === 0 ? 1 : 0, 10);
      clients.length = 0;
      clients.push(
        { id: "a", name: "Rita", status: "attivo", value: 0, archived: false },
        { id: "b", name: "Dini", status: "trattativa", value: 0, archived: false },
        { id: "c", name: "Conti", status: "trattativa", value: 0, archived: false },
        { id: "d", name: "Vecchio", status: "attivo", value: 0, archived: true },
      );
      incomes.length = 0;
      incomes.push(
        { client: "Rita", desc: "Fattura 1", amount: 5000, due: iso(oggi), status: "incassato" },
        { client: "Dini", desc: "Fattura 2", amount: 3000, due: null, created: oggi.toISOString(), status: "attesa" }, // fattura di EON: senza scadenza
        { client: "Conti", desc: "Fattura vecchia", amount: 2000, due: iso(altroMese), status: "incassato" },
        { client: "Anno scorso", desc: "x", amount: 9999, due: (oggi.getFullYear() - 1) + "-06-01", status: "incassato" },
      );
      payments.length = 0;
      payments.push(
        { supplier: "Edilfornitura", desc: "Materiali", amount: 1500, due: iso(oggi), status: "pagato" },
        { supplier: "Leasing", desc: "Rata", amount: 500, due: iso(oggi), status: "dapagare" },
        { supplier: "Vecchia", desc: "x", amount: 1000, due: iso(altroMese), status: "pagato" },
      );
      navigateTo("gestisci-azienda");
    });

    await page.click("#laTuaAziendaCard");
    await page.waitForTimeout(200);
    const leggi = () => page.evaluate(() => ({
      visibile: document.getElementById("page-azienda").classList.contains("visible"),
      titolo: document.getElementById("pageTitle").textContent,
      resta: document.getElementById("azResta").textContent,
      entrate: document.getElementById("azEntrate").textContent,
      entrateSotto: document.getElementById("azEntrateSotto").textContent,
      uscite: document.getElementById("azUscite").textContent,
      usciteSotto: document.getElementById("azUsciteSotto").textContent,
      tasse: document.getElementById("azTasse").textContent,
      tasseSotto: document.getElementById("azTasseSotto").textContent,
      clienti: document.getElementById("azClientiTitolo").textContent,
      corso: document.getElementById("azClientiCorso").textContent,
      trattativa: document.getElementById("azClientiTrattativa").textContent,
      archiviati: document.getElementById("azClientiArchiviati").textContent,
    }));
    let v = await leggi();
    verifica("\"La tua azienda\" apre una pagina vera", v.visibile && v.titolo === "La tua azienda", JSON.stringify(v));
    // mese: entrate 5000+3000 = 8000 (incassati 5000), uscite 2000 (pagate 1500), tasse 30% di 6000 = 1800, resta 4200
    verifica("entrate del mese (con la fattura di EON senza scadenza)", v.entrate === "€8.000" && v.entrateSotto === "Incassati €5.000 · da incassare €3.000", JSON.stringify(v));
    verifica("uscite del mese", v.uscite === "€2.000" && v.usciteSotto === "Pagate €1.500 · da pagare €500", JSON.stringify(v));
    verifica("tasse: stima al 30% di entrate − uscite", v.tasse === "€1.800" && /^30%/.test(v.tasseSotto), JSON.stringify(v));
    verifica("ti resta = entrate − uscite − tasse", v.resta === "€4.200", v.resta);
    verifica("clienti: 3 (l'archiviato a parte), 1 in corso, 2 in trattativa, 1 archiviato", v.clienti === "Clienti · 3" && v.corso === "1" && v.trattativa === "2" && v.archiviati === "1", JSON.stringify(v));

    await page.click("#azPeriodoAnno");
    v = await leggi();
    const gennaio = await page.evaluate(() => new Date().getMonth() === 0);
    if (!gennaio) {
      // anno: entrate 10000, uscite 3000, tasse 30% di 7000 = 2100, resta 4900 (l'anno scorso escluso)
      verifica("anno: si sommano tutti i mesi, non l'anno scorso", v.entrate === "€10.000" && v.uscite === "€3.000" && v.tasse === "€2.100" && v.resta === "€4.900", JSON.stringify(v));
    }
    await page.click("#azPeriodoMese");

    // Aggiungo e tolgo clienti: i numeri cambiano da soli
    await page.evaluate(() => {
      for (let i = 0; i < 10; i++) clients.push({ id: "n" + i, name: "Nuovo " + i, status: "trattativa", value: 0, archived: false });
      renderClientStats();
    });
    v = await leggi();
    verifica("aggiungo 10 clienti: diventano 13", v.clienti === "Clienti · 13" && v.trattativa === "12", JSON.stringify(v));
    await page.evaluate(() => { clients.splice(clients.findIndex((c) => c.id === "n0"), 10); renderClientStats(); });
    v = await leggi();
    verifica("li tolgo: tornano 3", v.clienti === "Clienti · 3", v.clienti);

    // Connessione totale: tolgo un cliente → spariscono anche le sue entrate
    await page.evaluate(async () => {
      cantiereAppunti.push({ id: "ap1", testo: "misure bagno", clientId: "b" });
      await cestinaClienteEChat(clients.find((c) => c.id === "b"), null);
      ridisegnaClientiEChat(); navigateTo("azienda");
    });
    v = await leggi();
    const restoDini = await page.evaluate(() => ({ entrate: incomes.filter((x) => x.client === "Dini").length, appunti: cantiereAppunti.filter((a) => a.clientId === "b").length }));
    verifica("tolgo il cliente Dini: via anche la sua entrata e i suoi appunti (entrate €5.000, clienti 2)", v.entrate === "€5.000" && v.clienti === "Clienti · 2" && restoDini.entrate === 0 && restoDini.appunti === 0, JSON.stringify({ v, restoDini }));
    // Rinomino un cliente: le sue entrate seguono il nome
    const rinominata = await page.evaluate(async () => { const c = clients.find((x) => x.id === "a"); c.name = "Rita Bianchi"; await rinominaChatDelCliente("Rita", "Rita Bianchi"); return incomes.filter((x) => x.client === "Rita Bianchi").length; });
    verifica("rinomino Rita in Rita Bianchi: la sua entrata segue il nuovo nome", rinominata === 1, String(rinominata));
    // Omonimi: due "Conti", ne tolgo uno → l'entrata resta (non si sa di chi è)
    const omonimo = await page.evaluate(async () => { clients.push({ id: "c2", name: "conti", status: "attivo", value: 0, archived: false }); await cestinaClienteEChat(clients.find((c) => c.id === "c2"), null); return incomes.filter((x) => x.client === "Conti").length; });
    verifica("due clienti con lo stesso nome: toglierne uno non tocca le entrate", omonimo === 1, String(omonimo));
    // rimetto Dini com'era per i conti che seguono
    await page.evaluate(() => {
      clients.push({ id: "b", name: "Dini", status: "trattativa", value: 0, archived: false });
      incomes.push({ client: "Dini", desc: "Fattura 2", amount: 3000, due: null, created: new Date().toISOString(), status: "attesa" });
      renderClientStats(); navigateTo("azienda");
    });

    // Una nuova entrata o uscita aggiorna subito
    await page.evaluate(() => { payments.push({ supplier: "Benzina", desc: "", amount: 1000, due: new Date().toISOString().slice(0, 10), status: "pagato" }); renderPayments(); navigateTo("azienda"); });
    v = await leggi();
    verifica("nuova uscita: uscite €3.000, ti resta scende a €3.500", v.uscite === "€3.000" && v.resta === "€3.500", JSON.stringify(v));

    // Percentuale delle tasse
    await page.click("#azRigaTasse");
    await page.fill("#azTassePerc", "20");
    await page.click("#azTasseSalva");
    v = await leggi();
    verifica("tasse al 20%: €1.000, ti resta €4.000", v.tasse === "€1.000" && v.resta === "€4.000" && /^20%/.test(v.tasseSotto), JSON.stringify(v));

    // Tocchi Entrate / Uscite / Clienti
    await page.click("#azRigaEntrate");
    verifica("Entrate apre l'elenco delle entrate", await page.evaluate(() => document.getElementById("page-entrate").classList.contains("visible")));
    await page.click('#page-entrate .back-link');
    verifica("e \"Torna a La tua azienda\" riporta qui", await page.evaluate(() => document.getElementById("page-azienda").classList.contains("visible")));
    await page.click("#azRigaUscite");
    verifica("Uscite apre l'elenco delle uscite", await page.evaluate(() => document.getElementById("page-pagamenti").classList.contains("visible") && document.getElementById("pageTitle").textContent === "Uscite"));
    await page.click('#page-pagamenti .back-link');
    await page.click("#azClienti");
    verifica("Clienti apre l'elenco clienti", await page.evaluate(() => document.getElementById("page-clienti").classList.contains("visible")));

    // Niente dati: nessun numero inventato
    await page.evaluate(() => { incomes.length = 0; payments.length = 0; navigateTo("azienda"); });
    v = await leggi();
    verifica("senza entrate né uscite: tutto a €0", v.resta === "€0" && v.entrate === "€0" && v.tasse === "€0" && /Nessuna entrata/.test(v.entrateSotto), JSON.stringify(v));

    // A voce / scritto
    await page.evaluate(() => navigateTo("home"));
    const aVoce = await page.evaluate(() => { const ok = provaNavigazioneDiretta("apri la mia azienda"); return ok && document.getElementById("page-azienda").classList.contains("visible"); });
    verifica("\"apri la mia azienda\" apre la pagina senza AI", aVoce);

    verifica("nessun errore nella pagina", erroriPagina.length === 0, JSON.stringify(erroriPagina));
  } finally {
    await browser.close();
    server.kill();
  }
  console.log(fallimenti ? `\n${fallimenti} controlli falliti` : "\nTutto ok");
  process.exit(fallimenti ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
