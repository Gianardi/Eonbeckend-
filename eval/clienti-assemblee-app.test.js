/* Pacchetto del 28/09/2026 sera, nel browser vero con Supabase finto:
   - assemblee vere (amministratore): lista, "+ Nuova assemblea", scheda con
     stato, note ("cosa si è detto"), a voce "apri l'assemblea di …";
   - "Com'è andato?" dopo un appuntamento con un cliente (orologio alle 19:08);
   - più comandi in una frase: un solo avviso con il riepilogo e Annulla;
   - "Intendi Alessio Machi?" con Sì / No; fino a 8 omonimi da toccare;
   - indietro torna da dove sei venuto; icone delle card nel colore del
     mestiere; in "Prova come…" niente cartelle di "Altra attività".
   Uso: NODE_PATH=/opt/node22/lib/node_modules node eval/clienti-assemblee-app.test.js */

const { chromium } = require("playwright");
const { spawn } = require("child_process");
const path = require("path");

const PORT = 9008;
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
    const oggi = new Date();
    await page.clock.install({ time: new Date(oggi.getFullYear(), oggi.getMonth(), oggi.getDate(), 19, 8) });
    await page.addInitScript(() => {
      window.__scritture = [];
      const catena = (tabella) => {
        const q = {
          select: () => q, not: () => q, is: () => q, eq: () => q, order: () => q, limit: () => q, in: () => q, gt: () => q,
          update: (patch) => ({ eq: async (c, v) => { window.__scritture.push({ tipo: "update", tabella, id: v, patch }); return { error: null }; } }),
          insert: (riga) => {
            window.__scritture.push({ tipo: "insert", tabella, riga });
            const r = { id: tabella + "-" + window.__scritture.length, created_at: new Date().toISOString(), ...riga };
            return { select: () => ({ single: async () => ({ data: r, error: null }), then: (ok) => ok({ data: [r], error: null }) }) };
          },
          maybeSingle: async () => ({ data: null, error: null }),
          single: async () => ({ data: null, error: null }),
          then: (ok) => ok({ data: [], error: null }),
        };
        return q;
      };
      window.supabase = { createClient: () => ({
        from: catena,
        channel: () => ({ on() { return this; }, subscribe() { return this; } }),
        storage: { from: () => ({ upload: async () => ({ error: null }), getPublicUrl: (p) => ({ data: { publicUrl: "https://file.test/" + p } }) }) },
        auth: { getSession: async () => ({ data: { session: null } }), onAuthStateChange: () => ({}) },
      }) };
    });
    let risposte = [];
    // Playwright prova per prima l'ultima regola registrata: quella generica va prima
    await page.route("**/api?action=*", (route) => route.fulfill({ status: 200, contentType: "application/json", body: "{}" }));
    await page.route("**/api?action=assistant", (route) => {
      const r = risposte.shift() || { stato: "concluso", testo: "Ok.", azioni: [] };
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(r) });
    });
    await page.goto(`http://localhost:${PORT}/index.html`, { waitUntil: "networkidle" });
    await page.evaluate(() => {
      document.getElementById("onboardingScreen").style.display = "none";
      currentSession = { access_token: "t", user: { id: "u1", email: "a@b.it" } };
      loadUserDataFromDB = async () => {};
      ricaricaTuttoERidisegna = async () => {};
    });

    /* ---- Assemblee vere ---- */
    const vuota = await page.evaluate(async () => {
      await applyProfession("amministratore", true);
      assemblee.length = 0; navigateTo("assemblee");
      return { righe: document.querySelectorAll("#assembleeList .list-row").length, testo: document.getElementById("assembleeList").textContent };
    });
    verifica("con l'account, niente assemblee di esempio: lista vuota con l'invito", vuota.righe === 0 && /Nessuna assemblea/.test(vuota.testo), JSON.stringify(vuota));
    await page.click("#assembleaNuova");
    await page.fill("#asNome", "via Roma 12");
    const domani = new Date(oggi.getFullYear(), oggi.getMonth(), oggi.getDate() + 1);
    const giornoIso = `${domani.getFullYear()}-${String(domani.getMonth() + 1).padStart(2, "0")}-${String(domani.getDate()).padStart(2, "0")}`;
    await page.fill("#asGiorno", giornoIso);
    await page.fill("#asOra", "21:00");
    await page.click("#asSalva");
    await page.waitForTimeout(200);
    const creata = await page.evaluate(() => ({
      riga: window.__scritture.filter((w) => w.tabella === "assemblee" && w.tipo === "insert").map((w) => w.riga),
      titolo: document.getElementById("risorsaTitolo").textContent,
      stati: [...document.querySelectorAll(".as-stati button")].map((b) => b.textContent + (b.classList.contains("on") ? "*" : "")),
      lista: [...document.querySelectorAll("#assembleeList .row-name")].map((x) => x.textContent),
    }));
    verifica("+ Nuova assemblea: salvata e si apre la sua scheda con lo stato", creata.riga.length === 1 && creata.riga[0].condominio === "Via Roma 12" && creata.riga[0].quando === `${giornoIso}T21:00:00` && creata.titolo === "Via Roma 12" && creata.stati.join() === "Da convocare*,Convocata,Fatta,Verbale da redigere" && creata.lista.join() === "Via Roma 12", JSON.stringify(creata));
    await page.click(".as-stati button:nth-child(2)");
    await page.fill("#asCampo", "presenti 12 su 20, approvato il rifacimento del tetto");
    await page.keyboard.press("Enter");
    await page.waitForTimeout(200);
    const scheda = await page.evaluate(() => ({
      stato: window.__scritture.filter((w) => w.tabella === "assemblee" && w.tipo === "update").map((w) => w.patch.stato),
      nota: window.__scritture.filter((w) => w.tabella === "cantiere_appunti").map((w) => w.riga),
      righe: [...document.querySelectorAll("#asNote .ap-testo")].map((x) => x.textContent),
      tasto: document.getElementById("homeAppuntiSub").textContent,
    }));
    verifica("nella scheda: stato \"Convocata\" salvato; quello che si dice va in \"Cosa si è detto\" (legato all'assemblea, non nella Mente)",
      scheda.stato.join() === "convocata" && scheda.nota.length === 1 && String(scheda.nota[0].assemblea_id || "").startsWith("assemblee-") && scheda.righe[0] === "Presenti 12 su 20, approvato il rifacimento del tetto" && !/Presenti/.test(scheda.tasto), JSON.stringify(scheda));
    const voce = await page.evaluate(() => { chiudiRisorsaCard(); navigateTo("home"); return provaNavigazioneDiretta("apri l'assemblea di via roma 12") && document.getElementById("risorsaTitolo").textContent; });
    verifica("a voce \"apri l'assemblea di via Roma 12\" apre la scheda", voce === "Via Roma 12", String(voce));
    const nelCalendario = await page.evaluate(() => { chiudiRisorsaCard(); renderCalendar(); return [...document.querySelectorAll("#calendarList .cal-nome")].map((x) => x.textContent); });
    verifica("l'assemblea è anche in calendario", nelCalendario.some((t) => t === "Assemblea — Via Roma 12"), JSON.stringify(nelCalendario));
    risposte = [{ stato: "concluso", testo: "Assemblea segnata: Parco Verde, gio 1 ott, 21:00", azioni: [{ tool: "crea_assemblea", esito: { id: "as2", condominio: "Parco Verde", quando: `${giornoIso}T18:00:00+00:00`, tipo: "straordinaria", stato: "da convocare", quando_visualizzato: "domani, 18:00" } }] }];
    await page.evaluate(() => { chiudiRisorsaCard(); navigateTo("home"); document.getElementById("aiToastContainer").innerHTML = ""; });
    await page.fill("#homeHeroCampo", "assemblea straordinaria Parco Verde domani ore 18");
    await page.click("#homeHeroSend", { force: true });
    await page.waitForTimeout(400);
    const aVoce = await page.evaluate(() => ({ lista: assemblee.map((a) => a.condominio + "|" + a.quando), avviso: document.getElementById("aiToastContainer").innerText.replace(/\s+/g, " ") }));
    verifica("detta a voce (fatta dal server): compare nella lista con l'avviso", aVoce.lista.includes(`Parco Verde|${giornoIso}T18:00`) && /Assemblea segnata/.test(aVoce.avviso), JSON.stringify(aVoce));

    /* ---- Com'è andato? ---- */
    const ca = await page.evaluate(async () => {
      await applyProfession("edile", true);
      clients.length = 0; clients.push({ id: "c1", name: "Mario Rossi", status: "attivo", value: 0, archived: false });
      chats.length = 0; tasks.length = 0;
      tasks.push({ id: "t1", title: "Sopralluogo Rossi", status: "todo", time: "Oggi, 15:00", clienteCollegato: "Mario Rossi" }, { id: "t2", title: "Chiamare il commercialista", status: "todo", time: "Oggi, 16:00" });
      window.__scritture.length = 0;
      renderCalendar(); navigateTo("home");
      const box = document.getElementById("comeAndatoBox");
      return { visibile: box && !box.hidden, cosa: box && box.querySelector(".ca-cosa").textContent };
    });
    verifica("alle 19:08, dopo il sopralluogo delle 15 da Mario Rossi: \"Com'è andato?\" (solo per l'appuntamento col cliente)", ca.visibile && ca.cosa === "15:00 · Sopralluogo Rossi", JSON.stringify(ca));
    await page.click('#comeAndatoBox [data-ca="fatto"]');
    await page.waitForTimeout(200);
    const dopoFatto = await page.evaluate(() => ({
      nota: window.__scritture.filter((w) => w.tabella === "cantiere_appunti").map((w) => w.riga),
      task: window.__scritture.filter((w) => w.tabella === "tasks").map((w) => w.patch.status),
      nascosto: document.getElementById("comeAndatoBox").hidden,
    }));
    verifica("\"Fatto\": nella scheda di Mario Rossi, impegno fatto, la domanda sparisce", dopoFatto.nota.length === 1 && dopoFatto.nota[0].client_id === "c1" && dopoFatto.nota[0].testo === "Fatto: Sopralluogo Rossi" && dopoFatto.task.join() === "done" && dopoFatto.nascosto, JSON.stringify(dopoFatto));

    /* ---- Più comandi: un solo avviso ---- */
    risposte = [{ stato: "concluso", testo: "…", riepilogo: ["a", "b", "c"], azioni: [
      { tool: "crea_impegno", esito: { id: "n1", titolo: "Chiamare Alessio Machi", quando_visualizzato: "Domani, 10:00", tipo: "chiamata" } },
      { tool: "crea_impegno", esito: { id: "n2", titolo: "Appuntamento con Spruzzo", quando_visualizzato: "Domani, 17:00", tipo: "incontro", cliente: "Spruzzo" } },
      { tool: "elimina_impegno", esito: { id: "t9", titolo: "Appuntamento con Pierini", tabella: "tasks" } },
    ] }];
    await page.evaluate(() => { document.getElementById("aiToastContainer").innerHTML = ""; window.__scritture.length = 0; });
    await page.fill("#homeHeroCampo", "Sentire Machi alle 10:00 e vai da Spruzzo alle 17. Ah e cancella appuntamento di domani alle 11:30 con Pierini");
    await page.click("#homeHeroSend", { force: true });
    await page.waitForTimeout(400);
    const riepilogo = await page.evaluate(() => ({ n: document.querySelectorAll("#aiToastContainer .ai-toast").length, testo: document.getElementById("aiToastContainer").innerText.replace(/\s+/g, " ") }));
    verifica("più comandi: UN solo avviso con le 3 cose e Annulla", riepilogo.n === 1 && /Segnato domani ore 10:00 · Chiamare Alessio Machi/.test(riepilogo.testo) && /Spruzzo/.test(riepilogo.testo) && /Cancellato · Appuntamento con Pierini/.test(riepilogo.testo) && /Annulla/.test(riepilogo.testo), JSON.stringify(riepilogo));
    await page.click("#aiToastContainer .ai-toast button:has-text('Annulla')");
    await page.waitForTimeout(200);
    const annullato = await page.evaluate(() => window.__scritture.filter((w) => w.tipo === "update").map((w) => w.tabella + ":" + w.id + ":" + Object.keys(w.patch).join()));
    verifica("Annulla toglie i due impegni nuovi e rimette Pierini", annullato.includes("tasks:n1:deleted_at") && annullato.includes("messages:n2:deleted_at") && annullato.includes("tasks:t9:deleted_at"), JSON.stringify(annullato));

    /* ---- Scelte da toccare ---- */
    const scelte = await page.evaluate(() => {
      clients.push({ id: "m1", name: "Alessio Machi", status: "attivo", value: 0, archived: false });
      const nomi = ["Alessio Rossi", "Alessio Bianchi", "Alessio Verdi", "Alessio Neri", "Alessio Gialli", "Alessio Blu"];
      nomi.forEach((n, i) => clients.push({ id: "x" + i, name: n, status: "attivo", value: 0, archived: false }));
      return {
        intendi: sceltaTraClienti("Intendi Alessio Machi?"),
        sei: sceltaTraClienti("Ho trovato 6 clienti con il nome Alessio:\n" + nomi.map((n) => "- " + n).join("\n") + "\n\nQuale intendi?").length,
      };
    });
    verifica("\"Intendi Alessio Machi?\" → Sì / No; 6 omonimi → 6 nomi da toccare", scelte.intendi.join() === "Sì,No" && scelte.sei === 6, JSON.stringify(scelte));

    /* ---- Indietro, colori ---- */
    const indietro = await page.evaluate(() => {
      const r = {};
      navigateTo("home"); navigateTo("documenti-impresa"); document.getElementById("topbarIndietro").click(); r.daHome = paginaAttuale;
      navigateTo("cantiere-documenti"); navigateTo("documenti-impresa"); document.getElementById("topbarIndietro").click(); r.daDocumenti = paginaAttuale;
      const icona = document.querySelector('#page-cantiere-documenti .cantiere-card-icon');
      r.colore = getComputedStyle(icona).backgroundColor;
      r.accento = getComputedStyle(document.body).getPropertyValue("--acc").trim();
      navigateTo("home");
      return r;
    });
    verifica("indietro: da DURC aperto dalla Home si torna in Home; aperto da Documenti si torna a Documenti", indietro.daHome === "home" && indietro.daDocumenti === "cantiere-documenti", JSON.stringify(indietro));
    verifica("le icone delle card di Documenti hanno il colore del mestiere (edile arancio), non il nero", indietro.colore === "rgb(232, 116, 42)", JSON.stringify(indietro));

    /* ---- Prova come…: niente cartelle di Altra attività ---- */
    const prova = await page.evaluate(async () => {
      eonAdmin = true;
      await applyProfession("artigiano", true);
      cartelle.length = 0; cartelle.push({ id: "k1", nome: "Clienti" }, { id: "k2", nome: "Fornitori" });
      renderCartelle();
      const prima = document.querySelectorAll("#cartelleGriglia .cartella").length;
      await entraInProva("edile");
      const inProva = document.querySelectorAll("#cartelleGriglia .cartella").length;
      const nuova = !!document.getElementById("cartellaNuova");
      await esciDallaProva();
      const dopo = document.querySelectorAll("#cartelleGriglia .cartella").length;
      return { prima, inProva, nuova, dopo };
    });
    verifica("in prova come edile: solo le 4 card base e \"+ Nuova cartella\"; tornando al tuo account le cartelle ricompaiono", prova.prima === 2 && prova.inProva === 0 && prova.nuova && prova.dopo === 2, JSON.stringify(prova));

    verifica("nessun errore nella pagina", errori.length === 0, JSON.stringify(errori));
  } finally {
    await browser.close();
    server.kill();
  }
  console.log(fallimenti ? `\n${fallimenti} controlli falliti` : "\nTutto ok");
  process.exit(fallimenti ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
