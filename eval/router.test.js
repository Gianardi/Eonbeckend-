/* EON BRAIN, punto 6 — parte AUTOMATICA della suite di valutazione
   (vedi eval/casi.json e eval/README.md per il quadro completo).

   Questo file copre solo lo strato DETERMINISTICO — router di
   navigazione, router di letture locali, nota di contesto per le
   correzioni veloci — che non ha bisogno dell'AI vera e quindi si può
   verificare qui, in automatico, senza un account Supabase né una
   chiave Anthropic. Le situazioni che dipendono dal giudizio del
   modello (intento, ambiguità, correzioni che richiedono l'AI, non
   invenzione) sono nel resto di eval/casi.json e si verificano con
   eval/live-check.js contro un vero deploy.

   Uso: NODE_PATH=/opt/node22/lib/node_modules node eval/router.test.js
   (in questo ambiente Playwright è preinstallato lì; su una macchina
   normale basta "npm install playwright" prima, o eseguirlo dentro una
   sessione con lo stesso setup di questa). Richiede un server statico
   sulla porta 8967 che serva la radice del repository — lo script lo
   avvia e lo ferma da solo. */

const { chromium } = require("playwright");
const { spawn } = require("child_process");
const path = require("path");

const PORT = 8967;
const ROOT = path.resolve(__dirname, "..");

let fallimenti = 0;
let totali = 0;

function verifica(nome, condizione, dettaglio) {
  totali++;
  if (condizione) {
    console.log(`  OK   ${nome}`);
  } else {
    fallimenti++;
    console.log(`  FAIL ${nome}${dettaglio ? " — " + dettaglio : ""}`);
  }
}

async function avviaServer() {
  const server = spawn("python3", ["-m", "http.server", String(PORT)], { cwd: ROOT, stdio: "ignore" });
  await new Promise((r) => setTimeout(r, 800));
  return server;
}

async function main() {
  const server = await avviaServer();
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.addInitScript(() => {
      window.supabase = { createClient: () => ({ from: () => ({}), auth: {} }) };
    });
    await page.goto(`http://localhost:${PORT}/index.html`, { waitUntil: "networkidle" });
    await page.evaluate(() => { document.getElementById("onboardingScreen").style.display = "none"; });
    await page.waitForTimeout(300);

    console.log("\n--- Router: navigazione pura (fase 1a) ---");
    const navigazione = await page.evaluate(() => {
      const pure = [
        ["apri calendario", "calendario"], ["apri il calendario", "calendario"],
        ["vai ai clienti", "clienti"], ["mostrami le conversazioni", "chat"],
        ["apri cestino", "cestino"], ["vai al calendario", "calendario"],
        ["mostra i pagamenti", "pagamenti"], ["apri entrate", "entrate"],
        ["vai a oggi", "oggi"], ["apri la giornata", "oggi"],
        ["apri gli appuntamenti", "calendario"], ["apri i miei clienti", "clienti"],
        ["apri chat", "chat"], ["vai alla giornata", "oggi"],
      ];
      const risultatiPure = pure.map(([frase, paginaAttesa]) => {
        navigateTo("home");
        const gestito = provaNavigazioneDiretta(frase);
        const pagina = document.querySelector(".page.visible").id;
        return { frase, gestito, pagina, ok: gestito && pagina === "page-" + paginaAttesa };
      });

      const nonNavigazione = [
        "chiama Mario domani alle 17", "apri calendario e chiama Rossi",
        "apri il cliente Mario Rossi", "apri la scheda di Rossi", "vai", "apri", "ciao",
      ];
      const risultatiNonNav = nonNavigazione.map((frase) => ({ frase, gestito: provaNavigazioneDiretta(frase) }));

      return { risultatiPure, risultatiNonNav };
    });
    for (const r of navigazione.risultatiPure) verifica(`"${r.frase}" -> ${r.pagina}`, r.ok, JSON.stringify(r));
    for (const r of navigazione.risultatiNonNav) verifica(`"${r.frase}" NON deve essere navigazione`, r.gestito === false, JSON.stringify(r));

    console.log("\n--- Router: letture locali (fase 1b) ---");
    const letture = await page.evaluate(() => {
      function formattaComeIlServer(giorniDaOggi) {
        const d = new Date(); d.setDate(d.getDate() + giorniDaOggi);
        const giorno = d.toLocaleDateString("it-IT", { weekday: "short", day: "numeric", month: "short" }).replace(".", "");
        return `${giorno}, 15:00`;
      }
      tasks.length = 0;
      tasks.push(
        { id: "t1", title: "Chiamare Rossi", owner: "user", status: "todo", time: formattaComeIlServer(0) },
        { id: "t2", title: "Sopralluogo Verdi", owner: "user", status: "todo", time: formattaComeIlServer(1) }
      );
      clients.length = 0;
      clients.push(
        { id: "c1", name: "Mario Rossi", status: "attivo", value: 0, desc: "", last: "", phone: "", color: "", archived: false },
        { id: "c2", name: "Vecchio Cliente", status: "inattivo", value: 0, desc: "", last: "", phone: "", color: "", archived: true }
      );
      chats.length = 0;
      chats.push({ name: "Mario Rossi", online: true, unread: 2, isClient: true, isProspect: false, archived: false, toSeeToday: false, toCallToday: false, messages: [] });

      const oggi = provaLetturaLocale("appuntamenti di oggi");
      const clientiConta = provaLetturaLocale("quanti clienti ho");
      const chiScritto = provaLetturaLocale("chi mi ha scritto");
      const nonLettura = provaLetturaLocale("segna un appuntamento");

      return { oggi, clientiConta, chiScritto, nonLettura };
    });
    verifica("\"appuntamenti di oggi\" trova solo l'impegno di oggi", letture.oggi && letture.oggi.titolo.includes("1"), JSON.stringify(letture.oggi));
    verifica("\"quanti clienti ho\" esclude gli archiviati", letture.clientiConta && letture.clientiConta.testo.includes("1"), JSON.stringify(letture.clientiConta));
    verifica("\"chi mi ha scritto\" trova Mario Rossi", letture.chiScritto && letture.chiScritto.testo.includes("Mario Rossi"), JSON.stringify(letture.chiScritto));
    verifica("\"segna un appuntamento\" NON è una lettura locale", letture.nonLettura === null, JSON.stringify(letture.nonLettura));

    console.log("\n--- Router: risorse immediate (fase 1c) ---");
    const risorse = await page.evaluate(() => {
      clients.length = 0;
      clients.push(
        { id: "c1", name: "Mario Rossi", status: "attivo", value: 0, desc: "", last: "", phone: "", color: "", archived: false },
        { id: "c2", name: "Luca Bianchi", status: "attivo", value: 0, desc: "", last: "", phone: "", color: "", archived: false },
        { id: "c3", name: "Mario Bianchi", status: "attivo", value: 0, desc: "", last: "", phone: "", color: "", archived: false },
        { id: "c4", name: "Vecchio Cliente", status: "inattivo", value: 0, desc: "", last: "", phone: "", color: "", archived: true }
      );
      cantiereFoto.length = 0;
      cantiereFoto.push(
        { id: "f1", url: "https://example.com/tetto1.jpg", created: "2026-09-10T10:00:00Z", clientId: "c1" },
        { id: "f2", url: "https://example.com/tetto2.jpg", created: "2026-09-12T10:00:00Z", clientId: "c1" }
      );
      chats.length = 0;
      chats.push({
        name: "Mario Rossi", online: true, unread: 0, isClient: true, isProspect: false, archived: false, toSeeToday: false, toCallToday: false,
        messages: [
          { id: "m1", eventType: "doc", title: "Preventivo tetto", text: "Rifacimento tetto", amount: "3.200", time: "10 set, 09:00" },
          { id: "m2", fileUrl: "https://example.com/allegato.pdf", fileName: "Foto_prima.pdf", time: "11 set, 09:00" },
        ],
      });

      chiudiRisorsaCard();
      const fotoOk = provaRisorsaImmediata("mi serve la foto di rossi");
      const fotoApertaTesto = document.body.textContent.includes("Foto — Mario Rossi");
      chiudiRisorsaCard();

      const docOk = provaRisorsaImmediata("dammi il documento di rossi");
      const docApertoTesto = document.body.textContent.includes("Documenti — Mario Rossi");
      chiudiRisorsaCard();

      const nessunCliente = provaRisorsaImmediata("mi serve il documento di sconosciuto");
      const clienteAmbiguo = provaRisorsaImmediata("mi serve la foto di bianchi");
      const nonRisorsa = provaRisorsaImmediata("segna un appuntamento con rossi domani");
      const nonRisorsaChiamata = provaRisorsaImmediata("chiama rossi");

      return { fotoOk, fotoApertaTesto, docOk, docApertoTesto, nessunCliente, clienteAmbiguo, nonRisorsa, nonRisorsaChiamata };
    });
    verifica("\"mi serve la foto di rossi\" apre la card foto", risorse.fotoOk && risorse.fotoApertaTesto, JSON.stringify(risorse));
    verifica("\"dammi il documento di rossi\" apre la card documenti", risorse.docOk && risorse.docApertoTesto, JSON.stringify(risorse));
    verifica("cliente non trovato NON intercetta (falso negativo innocuo)", risorse.nessunCliente === false, JSON.stringify(risorse));
    verifica("cliente ambiguo (due Bianchi) NON intercetta", risorse.clienteAmbiguo === false, JSON.stringify(risorse));
    verifica("\"segna un appuntamento\" NON è una richiesta di risorsa", risorse.nonRisorsa === false, JSON.stringify(risorse));
    verifica("\"chiama rossi\" NON è una richiesta di risorsa", risorse.nonRisorsaChiamata === false, JSON.stringify(risorse));

    console.log("\n--- Riprova automatica per problemi di rete (17/09/2026) ---");
    const riprova = await page.evaluate(async () => {
      // sembraErroreDiRete: un errore vero di Postgres/PostgREST ha
      // sempre un "code" (permesso negato, vincolo violato, ecc.) — non
      // deve mai far scattare una riprova, che non risolverebbe nulla.
      const erroreDiRete = sembraErroreDiRete({ message: "Failed to fetch" });
      const erroreConCode = sembraErroreDiRete({ code: "23505", message: "duplicate key value" });
      const erroreMessaggioIgnoto = sembraErroreDiRete({ message: "colonna sconosciuta" });
      const nessunErrore = sembraErroreDiRete(null);

      // conRiprovaDiRete: riprova solo su un errore di rete, si ferma
      // subito su un errore vero, e rispetta il numero massimo di
      // tentativi restituendo l'ultimo errore quando non recupera mai.
      let chiamate1 = 0;
      const successoAlTerzoTentativo = await conRiprovaDiRete(() => {
        chiamate1++;
        if(chiamate1 < 3) return { data: null, error: { message: "Failed to fetch" } };
        return { data: { ok: true }, error: null };
      });

      let chiamate2 = 0;
      const erroreVeroNonRiprova = await conRiprovaDiRete(() => {
        chiamate2++;
        return { data: null, error: { code: "42501", message: "permission denied" } };
      });

      let chiamate3 = 0;
      const inizio = Date.now();
      const semprefallito = await conRiprovaDiRete(() => {
        chiamate3++;
        return { data: null, error: { message: "network timeout" } };
      });
      const durata = Date.now() - inizio;

      return {
        erroreDiRete, erroreConCode, erroreMessaggioIgnoto, nessunErrore,
        chiamate1, successoAlTerzoTentativo,
        chiamate2, erroreVeroNonRiprova,
        chiamate3, semprefallito, durata,
      };
    });
    verifica("un errore senza code e messaggio di rete è riconosciuto come tale", riprova.erroreDiRete, JSON.stringify(riprova));
    verifica("un errore CON code (vero errore Postgres) NON è di rete", riprova.erroreConCode === false, JSON.stringify(riprova));
    verifica("un messaggio ignoto senza code NON è considerato di rete", riprova.erroreMessaggioIgnoto === false, JSON.stringify(riprova));
    verifica("nessun errore -> non è un errore di rete", riprova.nessunErrore === false, JSON.stringify(riprova));
    verifica("riprova fino al successo (3 tentativi totali)", riprova.chiamate1 === 3 && riprova.successoAlTerzoTentativo.data && riprova.successoAlTerzoTentativo.data.ok, JSON.stringify(riprova));
    verifica("un errore vero (con code) si ferma al primo tentativo, mai riprovato", riprova.chiamate2 === 1 && riprova.erroreVeroNonRiprova.error.code === "42501", JSON.stringify(riprova));
    verifica("un errore di rete persistente si ferma dopo il massimo dei tentativi (3)", riprova.chiamate3 === 3 && riprova.semprefallito.error.message === "network timeout", JSON.stringify(riprova));
    verifica("il backoff tra i tentativi è crescente, non istantaneo (almeno 600ms+1200ms)", riprova.durata >= 1700, JSON.stringify(riprova));

    console.log("\n--- Router: appunti istantanei (fase 1d) ---");
    const appunti = await page.evaluate(async () => {
      // In questo ambiente di test non c'è un vero login Supabase, quindi
      // isDbReady() è false: provaAppuntoImmediato deve riconoscere
      // comunque la frase giusta ma fermarsi prima di scrivere, tornando
      // false senza mai lanciare un errore — esattamente il comportamento
      // sicuro atteso quando manca la connessione vera.
      const dbNonPronto = !isDbReady();

      const match1 = "segnami in appunti che devo vedere il costo del materiale".match(TRIGGER_APPUNTO);
      const match2 = "annotami una nota che il cliente vuole il preventivo scontato".match(TRIGGER_APPUNTO);
      const testoEstratto1 = match1 ? match1[1] : null;

      const nonAppunto1 = "segnami di chiamare Bianchi domani".match(TRIGGER_APPUNTO); // niente "appunti/nota" esplicito
      const nonAppunto2 = TRIGGER_APPUNTO.test("segnami in appunti che devo richiamare domani") && RIFERIMENTO_TEMPO.test("segnami in appunti che devo richiamare domani");

      let esitoSenzaDb = null, lanciatoErrore = false;
      try{
        esitoSenzaDb = await provaAppuntoImmediato("segnami in appunti che devo vedere il costo del materiale");
      }catch(e){ lanciatoErrore = true; }

      return { dbNonPronto, match1: !!match1, match2: !!match2, testoEstratto1, nonAppunto1: !!nonAppunto1, nonAppunto2, esitoSenzaDb, lanciatoErrore };
    });
    verifica("\"segnami in appunti che...\" riconosciuto dal trigger", appunti.match1, JSON.stringify(appunti));
    verifica("il testo estratto è quello dopo \"che\", non l'intera frase", appunti.testoEstratto1 === "devo vedere il costo del materiale", JSON.stringify(appunti));
    verifica("\"annotami una nota che...\" riconosciuto dal trigger", appunti.match2, JSON.stringify(appunti));
    verifica("\"segnami di chiamare... domani\" (nessun \"appunti/nota\" esplicito) NON è un appunto", appunti.nonAppunto1 === false, JSON.stringify(appunti));
    verifica("\"segnami in appunti che devo richiamare DOMANI\" ha comunque un riferimento di tempo (va escluso a valle)", appunti.nonAppunto2, JSON.stringify(appunti));
    verifica("senza connessione vera, provaAppuntoImmediato torna false senza errori (mai un crash)", appunti.dbNonPronto && appunti.esitoSenzaDb === false && !appunti.lanciatoErrore, JSON.stringify(appunti));

    console.log("\n--- Router: appunti istantanei, frasi vere dai registri (25/09/2026) ---");
    const appuntiVeri = await page.evaluate(() => ({
      chiavi: estraiAppunti("mi appunti chiavi portone Amalfi 2 e Amalfi 4 per Ratti"),
      riunioni: estraiAppunti("mi metti negli appunti convocare almeno tre riunioni"),
      due: estraiAppunti("mi aggiungi in appunti  via XXIV Maggio 152 e anche un altro Appunto parto tetto e finestra via XXIV Maggio 15"),
      vecchia: estraiAppunti("segnami in appunti che devo vedere il costo del materiale"),
      conOrario: estraiAppunti("Mi aggiungi venerdì mattina di fare un appunto a Roberto per lunedì 8:30 in via Picco 36"),
      appuntamento: estraiAppunti("appuntamento con Rossi per il bagno"),
      impegno: estraiAppunti("segnami di chiamare Bianchi"),
      avvisoAppuntamentoSaltato: sembraRichiestaAppuntamento("mi metti negli appunti convocare almeno tre riunioni"),
    }));
    verifica("\"mi appunti chiavi portone... per Ratti\" → un appunto con tutto il testo (\"e\" interno non spezza)", JSON.stringify(appuntiVeri.chiavi) === JSON.stringify(["Chiavi portone Amalfi 2 e Amalfi 4 per Ratti"]), JSON.stringify(appuntiVeri.chiavi));
    verifica("\"mi metti negli appunti convocare...\" → riconosciuto", JSON.stringify(appuntiVeri.riunioni) === JSON.stringify(["Convocare almeno tre riunioni"]), JSON.stringify(appuntiVeri.riunioni));
    verifica("\"...e anche un altro appunto...\" → DUE appunti separati", JSON.stringify(appuntiVeri.due) === JSON.stringify(["Via XXIV Maggio 152", "Parto tetto e finestra via XXIV Maggio 15"]), JSON.stringify(appuntiVeri.due));
    verifica("la frase di prima (\"segnami in appunti che...\") funziona ancora", JSON.stringify(appuntiVeri.vecchia) === JSON.stringify(["Devo vedere il costo del materiale"]), JSON.stringify(appuntiVeri.vecchia));
    verifica("con giorno/ora (\"venerdì... lunedì 8:30\") NON è un appunto istantaneo: decide l'AI", appuntiVeri.conOrario === null, JSON.stringify(appuntiVeri.conOrario));
    verifica("\"appuntamento con Rossi\" NON è un appunto", appuntiVeri.appuntamento === null, JSON.stringify(appuntiVeri.appuntamento));
    verifica("\"segnami di chiamare Bianchi\" NON è un appunto", appuntiVeri.impegno === null, JSON.stringify(appuntiVeri.impegno));
    verifica("un appunto non fa comparire l'avviso \"appuntamento in arrivo\"", appuntiVeri.avvisoAppuntamentoSaltato === false);

    // Salvataggio vero, con il database simulato: due appunti, poi un salvataggio che fallisce a metà.
    const salvataggi = await page.evaluate(async () => {
      const originali = { isDbReady, dbInsert, showAIToast };
      const scritti = [], avvisi = [];
      let falliscaDopo = Infinity;
      isDbReady = () => true;
      dbInsert = async (tabella, riga) => scritti.length >= falliscaDopo ? null : (scritti.push({ tabella, ...riga }), { id: "id" + scritti.length, testo: riga.testo, created_at: "" });
      showAIToast = (titolo, testo) => avvisi.push({ titolo, testo });
      const esito1 = await provaAppuntoImmediato("mi aggiungi in appunti via XXIV Maggio 152 e anche un altro appunto parto tetto e finestra");
      const scrittiPrima = scritti.slice();
      falliscaDopo = scritti.length + 1;
      const esito2 = await provaAppuntoImmediato("mi appunti comprare silicone e anche un altro appunto chiamare il vetraio");
      isDbReady = originali.isDbReady; dbInsert = originali.dbInsert; showAIToast = originali.showAIToast;
      return { esito1, scrittiPrima, esito2, scritti, avvisi };
    });
    verifica("due appunti salvati davvero, nella tabella giusta", salvataggi.esito1 === true && salvataggi.scrittiPrima.length === 2 && salvataggi.scrittiPrima.every((r) => r.tabella === "cantiere_appunti"), JSON.stringify(salvataggi.scrittiPrima));
    verifica("avviso \"2 appunti aggiunti\"", salvataggi.avvisi[0] && salvataggi.avvisi[0].titolo === "2 appunti aggiunti", JSON.stringify(salvataggi.avvisi[0]));
    verifica("salvataggio a metà: lo dice (mai un \"fatto\" finto) e non manda all'AI il resto", salvataggi.esito2 === true && salvataggi.scritti.length === 3 && /1 non salvato/.test(salvataggi.avvisi[1] && salvataggi.avvisi[1].testo), JSON.stringify(salvataggi.avvisi[1]));

    console.log("\n--- Router: stratagemma appuntamenti, avviso di ricezione (EON BRAIN 17/09/2026) ---");
    const stratagemma = await page.evaluate(() => {
      impegniInConferma.length = 0;

      const conRiferimento = sembraRichiestaAppuntamento("chiamare Rossi domani alle 10");
      const senzaRiferimento = sembraRichiestaAppuntamento("chiamare Rossi appena possibile");
      const cancellazione = sembraRichiestaAppuntamento("cancella l'appuntamento di domani");
      const spostamento = sembraRichiestaAppuntamento("sposta l'appuntamento di domani alle 15");
      const eGiaUnAppunto = sembraRichiestaAppuntamento("segnami in appunti che domani devo comprare il materiale");

      // Nota: si legge il testo del solo elenco (listUser), non
      // document.body — quest'ultimo include anche il tag <script> con
      // tutto il codice sorgente della pagina, che contiene esso stesso
      // (come stringa letterale) le frasi cercate qui: un confronto su
      // document.body.textContent risulterebbe sempre vero a prescindere
      // dal vero contenuto del DOM.
      const id = aggiungiImpegnoInConferma("chiamare Rossi domani alle 10");
      const testoVisibileSubito = listUser.textContent.includes("chiamare Rossi domani alle 10");
      const contieneAvvisoProvvisorio = listUser.textContent.includes("Ricevuto — sto confermando i dettagli…");
      const contatoreDopoAggiunta = impegniInConferma.length;

      rimuoviImpegniInConferma();
      const testoSparitoDopoRimozione = !listUser.textContent.includes("Ricevuto — sto confermando i dettagli…");
      const contatoreDopoRimozione = impegniInConferma.length;

      return {
        conRiferimento, senzaRiferimento, cancellazione, spostamento, eGiaUnAppunto,
        id, testoVisibileSubito, contieneAvvisoProvvisorio, contatoreDopoAggiunta,
        testoSparitoDopoRimozione, contatoreDopoRimozione,
      };
    });
    verifica("\"chiamare Rossi domani alle 10\" sembra un appuntamento da segnalare subito", stratagemma.conRiferimento, JSON.stringify(stratagemma));
    verifica("senza alcun riferimento di tempo NON scatta l'avviso", stratagemma.senzaRiferimento === false, JSON.stringify(stratagemma));
    verifica("una cancellazione NON scatta l'avviso (non è una nuova creazione)", stratagemma.cancellazione === false, JSON.stringify(stratagemma));
    verifica("uno spostamento NON scatta l'avviso (non è una nuova creazione)", stratagemma.spostamento === false, JSON.stringify(stratagemma));
    verifica("un appunto (fase 1d) NON scatta anche l'avviso da appuntamento", stratagemma.eGiaUnAppunto === false, JSON.stringify(stratagemma));
    verifica("l'avviso mostra il testo esatto detto dall'utente, subito", stratagemma.testoVisibileSubito, JSON.stringify(stratagemma));
    verifica("l'avviso è chiaramente provvisorio (mai un dato indovinato)", stratagemma.contieneAvvisoProvvisorio, JSON.stringify(stratagemma));
    verifica("un solo avviso presente dopo l'aggiunta", stratagemma.contatoreDopoAggiunta === 1, JSON.stringify(stratagemma));
    verifica("l'avviso sparisce da solo quando arriva il risultato vero", stratagemma.testoSparitoDopoRimozione && stratagemma.contatoreDopoRimozione === 0, JSON.stringify(stratagemma));

    console.log("\n--- Contesto delle correzioni veloci (EON BRAIN punto 5) ---");
    const contesto = await page.evaluate(async () => {
      currentSession = { user: { id: "test-user" } };
      const payloads = [];
      window.chiediAssistente = async (msg, runId) => {
        payloads.push({ msg, runId: runId || null });
        if (payloads.length === 1) {
          return { stato: "concluso", testo: "Fatto.", azioni: [{ tool: "crea_impegno", esito: { id: "imp1", titolo: "Mario", quando_visualizzato: "oggi, 9:00" } }] };
        }
        return { stato: "concluso", testo: "Fatto.", azioni: [] };
      };
      document.getElementById("homeHeroCampo").value = "segna Mario alle 9";
      document.getElementById("homeHeroSend").click();
      await new Promise((r) => setTimeout(r, 300));
      document.getElementById("homeHeroCampo").value = "no, alle 10";
      document.getElementById("homeHeroSend").click();
      await new Promise((r) => setTimeout(r, 300));
      return { turno1: payloads[0], turno2: payloads[1] };
    });
    verifica("il primo turno non ha nota di contesto (niente da correggere ancora)", contesto.turno1 && !contesto.turno1.msg.includes("Contesto:"));
    verifica("la correzione include il contesto dell'azione precedente", contesto.turno2 && contesto.turno2.msg.includes("Contesto:") && contesto.turno2.msg.includes("imp1"));

    /* Un turno con PIÙ azioni insieme deve ricordarle TUTTE, non solo
       l'ultima (vedi il commento in index.html accanto a
       ultimeAzioniVisibili, e il code review che ha trovato questo
       identico bug quando la funzione teneva solo l'ultima azione). */
    const contestoMultiAzione = await page.evaluate(async () => {
      currentSession = { user: { id: "test-user" } };
      const payloads = [];
      window.chiediAssistente = async (msg, runId) => {
        payloads.push({ msg, runId: runId || null });
        if (payloads.length === 1) {
          return {
            stato: "concluso", testo: "Fatto.",
            azioni: [
              { tool: "crea_impegno", esito: { id: "imp1", titolo: "Mario", quando_visualizzato: "oggi, 9:00" } },
              { tool: "crea_impegno", esito: { id: "imp2", titolo: "Luca", quando_visualizzato: "oggi, 10:00" } },
            ],
          };
        }
        return { stato: "concluso", testo: "Fatto.", azioni: [] };
      };
      document.getElementById("homeHeroCampo").value = "segna Mario alle 9 e Luca alle 10";
      document.getElementById("homeHeroSend").click();
      await new Promise((r) => setTimeout(r, 300));
      document.getElementById("homeHeroCampo").value = "no, Mario alle 11";
      document.getElementById("homeHeroSend").click();
      await new Promise((r) => setTimeout(r, 300));
      return payloads[1];
    });
    verifica(
      "la correzione dopo un turno multi-azione include ENTRAMBE le azioni, non solo l'ultima",
      contestoMultiAzione && contestoMultiAzione.msg.includes("imp1") && contestoMultiAzione.msg.includes("imp2"),
      JSON.stringify(contestoMultiAzione)
    );

    console.log("\n--- Current Focus senza scadenza a tempo (EON BRAIN punto 2) ---");
    const focus = await page.evaluate(async () => {
      currentSession = { user: { id: "test-user" } };
      const payloads = [];
      let prossimaRisposta = null;
      window.chiediAssistente = async (msg, runId) => {
        payloads.push({ msg, runId: runId || null });
        const r = prossimaRisposta || { stato: "concluso", testo: "Fatto.", azioni: [] };
        prossimaRisposta = null;
        return r;
      };
      async function invia(testo, rispostaSuccessiva) {
        prossimaRisposta = rispostaSuccessiva;
        document.getElementById("homeHeroCampo").value = testo;
        document.getElementById("homeHeroSend").click();
        await new Promise((r) => setTimeout(r, 300));
      }

      /* Turno 1: nessun focus dichiarato dal server -> nessuna nota
         nel messaggio successivo. */
      await invia("quanto ho incassato questo mese", { stato: "concluso", testo: "Non lo so.", azioni: [] });
      // Turno 2: il server dichiara un focus esplicito (foto del cantiere Trani).
      await invia("fammi vedere le foto del cantiere Trani", {
        stato: "concluso", testo: "Ecco le foto.", azioni: [],
        focus: { tipo: "foto", riferimento: "cantiere Trani" },
      });
      // Turno 3: nessun focus nella risposta -> deve restare quello del turno 2 (niente scadenza a tempo).
      // ("grazie" dal 27/09 ha la risposta senza AI: qui serve una frase che arrivi al server)
      await invia("e quelle di ieri", { stato: "concluso", testo: "Eccole.", azioni: [] });
      // Turno 4: un NUOVO focus esplicito e incompatibile -> sostituisce quello precedente.
      // Frase scelta apposta per NON iniziare con un verbo della fase 1c del
      // Router (provaRisorsaImmediata, es. "fammi vedere"/"dammi"): "Mario
      // Rossi" è un cliente vero e unico in questo fixture, quindi una frase
      // come "fammi vedere il documento di Rossi" verrebbe intercettata dal
      // Router (comportamento corretto e voluto) invece di arrivare qui,
      // dove si vuole invece testare la gestione del Focus lato AI.
      await invia("il cliente Rossi ha risposto sul documento", {
        stato: "concluso", testo: "Ecco il documento.", azioni: [],
        focus: { tipo: "documento", riferimento: "Rossi" },
      });
      // Turno 5: di nuovo nessun focus -> resta quello del turno 4, non quello del turno 2.
      await invia("mandalo", { stato: "concluso", testo: "Inviato.", azioni: [] });

      return payloads.map((p) => p.msg);
    });
    verifica("turno 1 (nessun focus dal server) non ha nota di focus", !focus[0].includes("Focus attuale"), focus[0]);
    verifica("turno 2 (primo focus) non ha ancora nota (il focus arriva CON la risposta di questo turno, si vede dal turno dopo)", !focus[1].includes("Focus attuale"), focus[1]);
    verifica("turno 3 mantiene il focus del turno 2 anche senza scadenza a tempo", focus[2].includes("Focus attuale") && focus[2].includes("cantiere Trani"), focus[2]);
    verifica("turno 4 non ha ancora la nota del NUOVO focus (arriva con la risposta di questo turno)", focus[3].includes("cantiere Trani"), focus[3]);
    verifica("turno 5 usa il focus sostituito (Rossi), non più quello vecchio (cantiere Trani)", focus[4].includes("Focus attuale") && focus[4].includes("Rossi") && !focus[4].includes("cantiere Trani"), focus[4]);

    console.log(`\n${totali - fallimenti}/${totali} verifiche passate.`);
    if (fallimenti > 0) process.exitCode = 1;
  } finally {
    await browser.close();
    server.kill();
  }
}

main().catch((err) => { console.error(err); process.exitCode = 1; });
