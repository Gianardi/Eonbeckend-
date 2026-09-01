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

    console.log(`\n${totali - fallimenti}/${totali} verifiche passate.`);
    if (fallimenti > 0) process.exitCode = 1;
  } finally {
    await browser.close();
    server.kill();
  }
}

main().catch((err) => { console.error(err); process.exitCode = 1; });
