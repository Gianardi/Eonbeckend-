/* Funzioni vere dei mestieri (28/09/2026, Andrea: "Ok falle tutte e tre").
   La Home non cambia: le funzioni stanno dentro le card che ci sono già, si
   chiamano a voce e in Home compare al massimo un avviso quando serve.
   - Urgenze (idraulico, ma per tutti): "perdita urgente da Bianchi" va in
     cima a Oggi con il segno rosso "Urgente", legata al cliente; odore di
     gas = prima la sicurezza; "le urgenze" apre l'elenco.
   - SAL (edile): "SAL 30% cantiere Rossi" = rata dal valore del lavoro,
     nella scheda del cliente; in Home "SAL da fatturare" con "Crea fattura".
   - Dichiarazione di conformità (elettricista, DM 37/2008): "fai la DiCo
     per l'impianto Verdi" = modulo già compilato, salvato, documento da
     stampare; nella scheda e in "Certificazioni e documenti".
   Nel browser vero con Supabase finto, tutto col codice (nessuna AI).
   Uso: NODE_PATH=/opt/node22/lib/node_modules node eval/funzioni-mestieri.test.js */

const { chromium } = require("playwright");
const { spawn } = require("child_process");
const path = require("path");

const PORT = 9013;
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
      window.__aggiornamenti = [];
      window.__finestre = [];
      window.open = () => { const w = { html: "", closed: false, document: { write: (h) => { w.html += h; }, close: () => {} }, close: () => { w.closed = true; } }; window.__finestre.push(w); return w; };
      const catena = (tabella) => {
        const q = {
          select: () => q, not: () => q, is: () => q, eq: () => q, order: () => q, limit: () => q, in: () => q, gt: () => q,
          update: (patch) => ({ eq: async (_c, id) => { window.__aggiornamenti.push({ tabella, id, patch }); return { error: null }; } }),
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
    const richieste = [];
    let richiesteAI = 0;
    // Prima la rotta generica, poi quella specifica (Playwright prova per prima l'ultima)
    await page.route("**/api?action=*", (route) => { richieste.push({ url: route.request().url(), body: route.request().postData() || "" }); route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ testo: "Ok.", azioni: [] }) }); });
    await page.route("**/api?action=assistant", (route) => { richiesteAI++; richieste.push({ url: route.request().url(), body: route.request().postData() || "" }); route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ testo: "Ok.", azioni: [] }) }); });
    await page.goto(`http://localhost:${PORT}/index.html`, { waitUntil: "networkidle" });
    await page.evaluate(() => {
      document.getElementById("onboardingScreen").style.display = "none";
      currentSession = { access_token: "t", user: { id: "u1", email: "a@b.it" } };
      loadUserDataFromDB = async () => {};
      try { localStorage.removeItem("eon-avviso-sal-chiuso"); } catch (e) {}
    });

    const mestiere = (k, lista) => page.evaluate(async ([k, lista]) => {
      await applyProfession(k, true);
      clients.length = 0; lista.forEach((c) => clients.push({ status: "attivo", desc: "", phone: "", email: "", color: null, archived: false, value: 0, address: "", ...c }));
      tasks.length = 0; salLista.length = 0; dichiarazioni.length = 0;
      window.__scritture.length = 0; window.__aggiornamenti.length = 0; window.__finestre.length = 0;
      chiudiRisorsaCard(); navigateTo("home"); renderCalendar();
      document.querySelectorAll(".ai-landing-overlay").forEach((o) => { o.style.display = "none"; });
    }, [k, lista]);
    const scrivi = async (frase) => {
      await page.evaluate(() => { document.getElementById("aiToastContainer").innerHTML = ""; });
      await page.fill("#homeHeroCampo", frase);
      await page.evaluate(() => document.getElementById("homeHeroSend").click());
      await page.waitForTimeout(250);
    };

    /* ===== URGENZE (idraulico) ===== */
    await mestiere("idraulico", [{ id: "c1", name: "Luca Bianchi" }, { id: "c2", name: "Paolo Neri" }]);
    await page.evaluate(() => {
      // Un impegno normale più tardi oggi: l'urgenza deve andargli davanti
      const oggi = new Date(); const g = oggi.toLocaleDateString("it-IT", { weekday: "short", day: "numeric", month: "short" }).replace(".", "");
      tasks.push({ id: "t0", title: "Sopralluogo caldaia", owner: "user", status: "todo", time: g + ", 23:50", urgente: false, clientId: null });
      renderCalendar();
    });
    const aiPrima = richiesteAI;
    await scrivi("Perdita urgente da Bianchi");
    const urg = await page.evaluate(() => {
      const w = window.__scritture.find((s) => s.tabella === "tasks");
      const righe = [...document.querySelectorAll("#homeHeroOggiLista > *")].map((r) => r.textContent.replace(/\s+/g, " ").trim()).filter((t) => !/già passat/.test(t));
      return { w: w && w.riga, righe, badge: !!document.querySelector("#homeHeroOggiLista .home-oggi-urgente"), toast: document.getElementById("aiToastContainer").textContent };
    });
    verifica("\"Perdita urgente da Bianchi\": impegno urgente di oggi legato a Bianchi, col codice",
      urg.w && urg.w.urgente === true && urg.w.client_id === "c1" && urg.w.title === "Perdita da Bianchi" && urg.w.status === "todo" && richiesteAI === aiPrima, JSON.stringify(urg.w));
    verifica("in Home è in cima a Oggi, con il segno \"Urgente\"", urg.badge && /Urgente/.test(urg.righe[0] || "") && /Perdita da Bianchi/.test(urg.righe[0] || ""), JSON.stringify(urg.righe));
    verifica("l'avviso dice \"Urgente, in cima a oggi\" (con Annulla)", /Urgente, in cima a oggi/.test(urg.toast) && /Annulla/.test(urg.toast), urg.toast);

    await scrivi("emergenza allagamento cantina Neri alle 15");
    const urg2 = await page.evaluate(() => { const w = window.__scritture.filter((s) => s.tabella === "tasks")[1]; return w && w.riga; });
    verifica("\"emergenza allagamento cantina Neri alle 15\": urgente alle 15, cliente Neri",
      urg2 && urg2.urgente && urg2.client_id === "c2" && /T15:00:00$/.test(urg2.scheduled_at) && /15:00/.test(urg2.time) && /^Allagamento cantina Neri$/.test(urg2.title), JSON.stringify(urg2));

    const nonUrg = await page.evaluate(() => ({
      domani: capisciUrgenza("perdita urgente da Bianchi domani"),
      domanda: capisciUrgenza("è urgente la perdita di Bianchi?"),
      normale: capisciUrgenza("perdita da Bianchi"),
    }));
    verifica("con un altro giorno, una domanda o senza \"urgente\" non è un'urgenza del codice", !nonUrg.domani && !nonUrg.domanda && !nonUrg.normale, JSON.stringify(nonUrg));

    const scrittePrima = await page.evaluate(() => window.__scritture.length);
    await scrivi("c'è odore di gas da Bianchi");
    const gas = await page.evaluate(() => ({ titolo: document.getElementById("risorsaTitolo").textContent, aperta: document.getElementById("risorsaOverlay").style.display === "flex", testo: document.getElementById("risorsaOverlay").textContent, scritte: window.__scritture.length }));
    verifica("odore di gas: card di sicurezza (rubinetto, finestre, 112), niente impegno", gas.aperta && gas.titolo === "Odore di gas" && /rubinetto del gas/.test(gas.testo) && /112/.test(gas.testo) && gas.scritte === scrittePrima, JSON.stringify(gas).slice(0, 200));

    await page.evaluate(() => chiudiRisorsaCard());
    await scrivi("le urgenze");
    const elenco = await page.evaluate(() => ({ titolo: document.getElementById("risorsaTitolo").textContent, righe: document.querySelectorAll("#risorsaOverlay .home-oggi-urgente").length }));
    verifica("\"le urgenze\" apre l'elenco delle urgenze aperte", elenco.titolo === "Urgenze" && elenco.righe === 2, JSON.stringify(elenco));

    const salIdraulico = await page.evaluate(async () => provaSal("SAL 30% Bianchi"));
    verifica("il SAL è solo dell'edile", salIdraulico === false);

    /* ===== SAL (edile) ===== */
    await mestiere("edile", [{ id: "r1", name: "Mario Rossi", value: 12000 }, { id: "r2", name: "Anna Gialli" }]);
    const avvisoVuoto = await page.evaluate(() => { const b = document.getElementById("avvisoMestiere"); return !b || b.hidden; });
    verifica("senza SAL da fatturare, in Home nessun avviso", avvisoVuoto);
    await scrivi("SAL 30% cantiere Rossi");
    const sal1 = await page.evaluate(() => ({ w: (window.__scritture.find((s) => s.tabella === "sal") || {}).riga, toast: document.getElementById("aiToastContainer").textContent, avviso: (() => { const b = document.getElementById("avvisoMestiere"); return b && !b.hidden ? b.textContent.replace(/\s+/g, " ") : null; })() }));
    verifica("\"SAL 30% cantiere Rossi\": SAL 1 al 30%, rata 3.600 € dal valore del lavoro (12.000 €)",
      sal1.w && sal1.w.client_id === "r1" && sal1.w.numero === 1 && sal1.w.percentuale === 30 && sal1.w.importo === 3600, JSON.stringify(sal1.w));
    verifica("avviso \"SAL 1 · Mario Rossi\" con Annulla", /SAL 1 · Mario Rossi/.test(sal1.toast) && /Annulla/.test(sal1.toast), sal1.toast);
    verifica("in Home compare \"SAL da fatturare\" con \"Crea fattura\"", sal1.avviso && /SAL da fatturare/.test(sal1.avviso) && /Mario Rossi/.test(sal1.avviso) && /3\.600/.test(sal1.avviso) && /Crea fattura/.test(sal1.avviso), sal1.avviso);

    await scrivi("SAL 50% Rossi 2.000 euro");
    const sal2 = await page.evaluate(() => (window.__scritture.filter((s) => s.tabella === "sal")[1] || {}).riga);
    verifica("\"SAL 50% Rossi 2.000 euro\": SAL 2 con l'importo detto", sal2 && sal2.numero === 2 && sal2.percentuale === 50 && sal2.importo === 2000, JSON.stringify(sal2));

    await scrivi("SAL 40% Gialli");
    const sal3 = await page.evaluate(() => (window.__scritture.filter((s) => s.tabella === "sal")[2] || {}).riga);
    verifica("senza valore del lavoro il SAL si salva senza importo (da mettere nella scheda)", sal3 && sal3.client_id === "r2" && sal3.importo === undefined, JSON.stringify(sal3));

    const scheda = await page.evaluate(() => {
      mostraSchedaCliente(clients.find((c) => c.id === "r1"));
      const righe = [...document.querySelectorAll("#scSal .sc-sal")].map((r) => r.textContent.replace(/\s+/g, " "));
      return { righe, fatture: document.querySelectorAll("#scSal .sc-sal-fattura").length, nuovo: !!document.querySelector("#scSal .sc-sal-nuovo") };
    });
    verifica("nella scheda di Rossi la sezione SAL: 2 righe, \"Crea fattura\" e \"+ Nuovo SAL\"", scheda.righe.length === 2 && /SAL 1 · 30%/.test(scheda.righe[0]) && /da fatturare/.test(scheda.righe[0]) && scheda.fatture === 2 && scheda.nuovo, JSON.stringify(scheda));

    // "+ Nuovo SAL" dalla scheda: 80% → rata (80 − 50)% di 12.000 = 3.600
    await page.click('.sc4-voce[data-sezione="sal"]');
    await page.click("#scSal .sc-sal-nuovo");
    await page.fill("#salPerc", "80");
    await page.fill("#salNota", "fatto il tetto");
    await page.click("#salSalva");
    await page.waitForTimeout(150);
    const sal4 = await page.evaluate(() => ({ w: (window.__scritture.filter((s) => s.tabella === "sal")[3] || {}).riga, righe: document.querySelectorAll("#scSal .sc-sal").length }));
    verifica("dalla scheda \"+ Nuovo SAL\" 80%: SAL 3, rata dal SAL precedente (30% di 12.000 = 3.600), la scheda si aggiorna", sal4.w && sal4.w.numero === 3 && sal4.w.importo === 3600 && sal4.w.note === "fatto il tetto" && sal4.righe === 3, JSON.stringify(sal4));

    await page.evaluate(() => { chiudiRisorsaCard(); navigateTo("home"); renderCalendar(); });
    const primaRichieste = richieste.length;
    await page.click('#avvisoMestiere [data-ca="fatto"]');
    await page.waitForTimeout(400);
    const fatt = await page.evaluate(() => ({ card: document.getElementById("risorsaOverlay").style.display === "flex" ? document.getElementById("risorsaTitolo").textContent + " | " + document.getElementById("risorsaOverlay").textContent.replace(/\s+/g, " ").slice(0, 200) : null, agg: window.__aggiornamenti.filter((a) => a.tabella === "sal"), avviso: (() => { const b = document.getElementById("avvisoMestiere"); return b && !b.hidden ? b.textContent.replace(/\s+/g, " ") : null; })() }));
    const inviata = richieste.slice(primaRichieste).map((r) => r.body).join(" ");
    verifica("\"Crea fattura\" manda \"fattura Mario Rossi SAL avanzamento lavori 3600 euro\"", /fattura Mario Rossi SAL avanzamento lavori 3600 euro/.test(inviata), inviata.slice(0, 300));
    verifica("il SAL diventa fatturato e l'avviso passa al successivo", fatt.agg.length === 1 && fatt.agg[0].patch.fatturato === true && fatt.avviso && /SAL 2/.test(fatt.avviso), JSON.stringify(fatt));

    await page.evaluate(() => chiudiRisorsaCard());
    await page.click("#avvisoMestiere .ca-chiudi");
    const chiuso = await page.evaluate(() => { const b = document.getElementById("avvisoMestiere"); return b.hidden ? "nascosto" : b.textContent.replace(/\s+/g, " "); });
    verifica("✕ sull'avviso: \"non ora\", passa al SAL dopo (uno alla volta)", /SAL 3/.test(chiuso), chiuso);

    const cardDicoEdile = await page.evaluate(() => { navigateTo("cantiere-documenti"); const c = document.getElementById("cardDico"); return c.hidden || getComputedStyle(c).display === "none"; });
    verifica("l'edile non vede la card \"Dichiarazione di conformità\"", cardDicoEdile);
    const dicoEdile = await page.evaluate(async () => provaDico("fai la DiCo per Rossi"));
    verifica("la DiCo è solo dell'elettricista", dicoEdile === false);

    /* ===== DICHIARAZIONE DI CONFORMITÀ (elettricista) ===== */
    await mestiere("elettricista", [{ id: "e1", name: "Anna Verdi", address: "Via Roma 12, Pisa (PI)" }]);
    const aiPrimaDico = richiesteAI;
    await scrivi("fai la DiCo per l'impianto Verdi");
    const modulo = await page.evaluate(() => ({
      titolo: document.getElementById("risorsaOverlay").style.display === "flex" ? document.getElementById("risorsaTitolo").textContent : null,
      committente: (document.getElementById("dicoCommittente") || {}).value,
      indirizzo: (document.getElementById("dicoIndirizzo") || {}).value,
      norma: (document.getElementById("dicoNorma") || {}).value,
      nota: (document.querySelector(".dico-nota") || {}).textContent || "",
    }));
    verifica("\"fai la DiCo per l'impianto Verdi\": modulo con committente e indirizzo di Anna Verdi, norma CEI 64-8, col codice",
      modulo.titolo === "Dichiarazione di conformità" && modulo.committente === "Anna Verdi" && modulo.indirizzo === "Via Roma 12, Pisa (PI)" && modulo.norma === "CEI 64-8" && /controlla i dati/.test(modulo.nota) && richiesteAI === aiPrimaDico, JSON.stringify(modulo));

    await page.fill("#dicoDescrizione", "Rifacimento impianto appartamento: quadro, 12 punti luce, 20 prese");
    await page.check('input[name="dicoTipo"][value="trasformazione"]');
    await page.fill("#dicoTitolare", "Marco Bruni");
    await page.fill("#dicoRagione", "Bruni Impianti");
    await page.fill("#dicoPiva", "01234567890");
    await page.fill("#dicoCciaa", "Pisa n. PI-123456");
    await page.check('#dicoDichiaro input[value="verifiche"]');
    await page.click("#dicoSalva");
    await page.waitForTimeout(200);
    const salvata = await page.evaluate(() => ({ w: (window.__scritture.find((s) => s.tabella === "dichiarazioni_conformita") || {}).riga, html: (window.__finestre[0] || {}).html || "", card: document.getElementById("risorsaOverlay").style.display === "flex", toast: document.getElementById("aiToastContainer").textContent }));
    const anno = new Date().getFullYear();
    verifica("salvata con numero 1/" + anno + ", legata ad Anna Verdi, con i dati del modulo",
      salvata.w && salvata.w.numero === "1/" + anno && salvata.w.client_id === "e1" && salvata.w.dati.committente === "Anna Verdi" && salvata.w.dati.tipo === "trasformazione" && salvata.w.dati.impresa.ragione === "Bruni Impianti", JSON.stringify(salvata.w));
    verifica("il documento si apre: modello DM 37/2008 con i dati, le spunte solo se messe da lui, e l'avvertenza di verificarlo",
      /DICHIARAZIONE DI CONFORMITÀ DELL'IMPIANTO ALLA REGOLA DELL'ARTE/.test(salvata.html) && /22 gennaio 2008, n. 37/.test(salvata.html) && /Anna Verdi/.test(salvata.html) && /Bruni Impianti/.test(salvata.html)
      && /&#9746; trasformazione/.test(salvata.html) && /CEI 64-8/.test(salvata.html) && /verificare i dati prima della firma/.test(salvata.html) && /Salva come PDF/.test(salvata.html)
      && /&#9746; controllato l'impianto/.test(salvata.html) && /&#9744; installato componenti/.test(salvata.html), salvata.html.slice(0, 200));
    verifica("dopo il salvataggio: card chiusa e avviso \"Dichiarazione n. 1/" + anno + "\"", !salvata.card && new RegExp("Dichiarazione n. 1/" + anno).test(salvata.toast), salvata.toast);

    // La seconda riprende i dati dell'impresa e ha il numero dopo
    const seconda = await page.evaluate(() => { chiudiRisorsaCard(); apriDico(null, "Carlo Blu"); return { committente: document.getElementById("dicoCommittente").value, ragione: document.getElementById("dicoRagione").value, cciaa: document.getElementById("dicoCciaa").value, numero: prossimoNumeroDico(), impresaChiusa: !document.querySelector(".dico-impresa").open }; });
    verifica("la dichiarazione dopo riprende i dati dell'impresa (chiusi) e ha il numero 2", seconda.committente === "Carlo Blu" && seconda.ragione === "Bruni Impianti" && seconda.cciaa === "Pisa n. PI-123456" && seconda.numero === "2/" + anno && seconda.impresaChiusa, JSON.stringify(seconda));

    const schedaE = await page.evaluate(() => {
      chiudiRisorsaCard();
      mostraSchedaCliente(clients.find((c) => c.id === "e1"));
      const r = { righe: [...document.querySelectorAll("#scDico .sc-dico")].map((x) => x.textContent.replace(/\s+/g, " ")), nuova: !!document.querySelector("#scDico .sc-sal-nuovo") };
      window.__finestre.length = 0;
      document.querySelector("#scDico .sc-dico").click();
      r.riaperta = /Anna Verdi/.test((window.__finestre[0] || {}).html || "");
      return r;
    });
    verifica("nella scheda di Anna Verdi: la dichiarazione (si riapre toccandola) e \"+ Nuova dichiarazione\"", schedaE.righe.length === 1 && new RegExp("n. 1/" + anno).test(schedaE.righe[0]) && schedaE.nuova && schedaE.riaperta, JSON.stringify(schedaE));

    const hub = await page.evaluate(async () => {
      chiudiRisorsaCard(); navigateTo("cantiere-documenti");
      const c = document.getElementById("cardDico");
      const visibile = !c.hidden && getComputedStyle(c).display !== "none";
      c.click();
      return { visibile, titolo: document.getElementById("risorsaTitolo").textContent, righe: document.querySelectorAll("#risorsaOverlay .sc-dico").length };
    });
    verifica("in \"Certificazioni e documenti\" c'è la card: apre l'elenco delle dichiarazioni", hub.visibile && hub.titolo === "Dichiarazioni di conformità" && hub.righe === 1, JSON.stringify(hub));

    await page.evaluate(() => { chiudiRisorsaCard(); navigateTo("home"); });
    await scrivi("dichiarazioni di conformità");
    const aVoce = await page.evaluate(() => ({ titolo: document.getElementById("risorsaTitolo").textContent, pagina: paginaAttuale }));
    verifica("\"dichiarazioni di conformità\" a voce apre l'elenco", aVoce.titolo === "Dichiarazioni di conformità" && aVoce.pagina === "cantiere-documenti", JSON.stringify(aVoce));

    verifica("nessun errore nella pagina", errori.length === 0, JSON.stringify(errori));
  } finally {
    await browser.close();
    server.kill();
  }
  console.log(fallimenti ? `\n${fallimenti} controlli falliti` : "\nTutto ok");
  process.exit(fallimenti ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
