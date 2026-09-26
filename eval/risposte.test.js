/* Test delle risposte di EON nella card bianca (25/09/2026): titolo = la
   domanda, orari in colonna, niente asterischi del markdown, domanda di
   EON con la barra per rispondere dentro la card. Carica la vera
   index.html con Supabase e assistente simulati.

   Uso: NODE_PATH=/opt/node22/lib/node_modules node eval/risposte.test.js */

const { chromium } = require("playwright");
const { spawn } = require("child_process");
const path = require("path");

const PORT = 8982;
const ROOT = path.resolve(__dirname, "..");
let fallimenti = 0;
function verifica(nome, condizione, dettaglio) {
  console.log(`  ${condizione ? "OK  " : "FAIL"} ${nome}${condizione || !dettaglio ? "" : " — " + dettaglio}`);
  if (!condizione) fallimenti++;
}

const RISPOSTA_DOMANI = "Domani (sabato) hai:\n\n- **08:00** – Inviare fattura n. 3/2026 al cliente Fabbri\n- **09:00** – Colazione con Chilosi\n- **10:00** – Appuntamento con Dini\n- **11:00** – Giampiero Dini\n- **12:00** – Riunione e sopralluogo - lavori alla pianta\n- **15:00** – Ristrutturazione stadio - Lerici\n\nPiuttosto pieno — è una giornata intensa. 👍";

async function main() {
  const server = spawn("python3", ["-m", "http.server", String(PORT)], { cwd: ROOT, stdio: "ignore" });
  await new Promise((r) => setTimeout(r, 800));
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const errori = [];
    page.on("pageerror", (e) => errori.push(e.message));
    await page.addInitScript(() => {
      const catena = () => {
        const q = { select: () => q, not: () => q, is: () => q, eq: () => q, order: () => q, limit: () => q, in: () => q, update: () => q, single: async () => ({ data: null, error: null }), then: (ok) => ok({ data: [], error: null }) };
        return q;
      };
      window.supabase = { createClient: () => ({ from: catena, auth: { getSession: async () => ({ data: { session: { access_token: "t", user: { id: "u1" } } } }), onAuthStateChange: () => ({}) } }) };
    });
    const richieste = [];
    let risposte = [];
    await page.route("https://eonbeckend.vercel.app/api?action=assistant", (route) => {
      richieste.push(JSON.parse(route.request().postData()));
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(risposte.shift()) });
    });
    await page.goto(`http://localhost:${PORT}/index.html`, { waitUntil: "networkidle" });
    await page.evaluate(() => {
      document.getElementById("onboardingScreen").style.display = "none";
      currentSession = { access_token: "t", user: { id: "u1" } };
      loadUserDataFromDB = async () => {};
      navigateTo("home");
    });
    const chiedi = async (frase) => {
      await page.fill("#homeHeroCampo", frase);
      await page.click("#homeHeroSend");
      await page.waitForFunction(() => document.getElementById("risorsaOverlay").style.display === "flex", null, { timeout: 4000 });
    };
    const leggiCard = () => page.evaluate(() => ({
      titolo: document.getElementById("risorsaTitolo").textContent,
      testo: document.getElementById("risorsaCorpo").innerText,
      ore: [...document.querySelectorAll("#risorsaCorpo .eon-ora")].map((e) => e.textContent),
      voci: [...document.querySelectorAll("#risorsaCorpo .eon-voce-testo")].map((e) => e.textContent),
      paragrafi: [...document.querySelectorAll("#risorsaCorpo .eon-risposta > p")].map((e) => e.textContent),
      barra: !!document.querySelector("#risorsaPiede .scheda-campo") && document.getElementById("risorsaPiede").style.display !== "none",
      toast: document.getElementById("aiToastContainer").innerText,
    }));

    // La risposta della foto di Gianardi
    risposte = [{ stato: "concluso", runId: "r1", testo: RISPOSTA_DOMANI, azioni: [{ tool: "elenca_appuntamenti", esito: {} }] }];
    // (una risposta dell'AI: "cosa ho da fare domani" da solo ora lo legge il codice, vedi sotto)
    await chiedi("com'è la mia giornata domani, è pesante?");
    const c1 = await leggiCard();
    verifica("si apre la card bianca, titolo = la domanda", c1.titolo === "Com'è la mia giornata domani, è pesante?", c1.titolo);
    verifica("niente asterischi del markdown", !c1.testo.includes("*"), c1.testo);
    verifica("gli orari in colonna, nell'ordine", JSON.stringify(c1.ore) === '["08:00","09:00","10:00","11:00","12:00","15:00"]', JSON.stringify(c1.ore));
    verifica("accanto all'ora solo l'impegno (senza trattino davanti)", c1.voci[0] === "Inviare fattura n. 3/2026 al cliente Fabbri" && c1.voci[4] === "Riunione e sopralluogo - lavori alla pianta", JSON.stringify(c1.voci));
    verifica("frase iniziale e finale come paragrafi", c1.paragrafi[0] === "Domani (sabato) hai:" && /giornata intensa/.test(c1.paragrafi.at(-1)), JSON.stringify(c1.paragrafi));
    verifica("niente riquadro \"Fatto\" e niente barra per rispondere", !/Fatto/.test(c1.toast) && !c1.barra, JSON.stringify(c1));
    if (process.env.SCREEN_RISPOSTE) { await page.waitForTimeout(600); await page.screenshot({ path: process.env.SCREEN_RISPOSTE }); }
    await page.click("#risorsaChiudi");

    // EON fa una domanda: si risponde dentro la card
    risposte = [
      { stato: "in_attesa_risposta", runId: "r2", testo: "Ci sono due Dini: Giampiero Dini e Sara Dini. Quale intendi?", azioni: [] },
      { stato: "concluso", runId: "r2", testo: "Ok, segnato con Giampiero Dini alle 10.", azioni: [] },
    ];
    await chiedi("appuntamento con dini domani alle 10");
    const c2 = await leggiCard();
    verifica("domanda di EON: nella card, con la barra per rispondere", /Quale intendi\?/.test(c2.testo) && c2.barra, JSON.stringify(c2));
    await page.fill("#risorsaPiede .scheda-campo", "giampiero");
    await page.press("#risorsaPiede .scheda-campo", "Enter");
    await page.waitForFunction(() => /segnato con Giampiero/.test(document.getElementById("risorsaCorpo").innerText), null, { timeout: 4000 });
    const ultima = richieste.at(-1);
    verifica("la risposta scritta nella card continua la stessa conversazione", ultima.runId === "r2" && ultima.messaggio === "giampiero", JSON.stringify(ultima));
    const conv = await page.evaluate(() => ({ titolo: document.getElementById("risorsaTitolo").textContent, bolle: [...document.querySelectorAll("#risorsaCorpo .scheda-bolla")].map((b) => b.className.replace("scheda-bolla ", "") + ":" + b.innerText.trim()) }));
    verifica("la conversazione resta nella STESSA card: richiesta, domanda, risposta, esito", conv.titolo === "Appuntamento con dini domani alle 10" && JSON.stringify(conv.bolle) === JSON.stringify(["me:appuntamento con dini domani alle 10", "eon:Ci sono due Dini: Giampiero Dini e Sara Dini. Quale intendi?", "me:giampiero", "eon:Ok, segnato con Giampiero Dini alle 10."]), JSON.stringify(conv));
    await page.click("#risorsaChiudi");

    // Conferma breve (26/09, Andrea: "deve dire ok segnato a lunedì ore 09")
    risposte = [{ stato: "concluso", runId: "r5", testo: "Fatto.", azioni: [{ tool: "crea_impegno", esito: { id: "t5", titolo: "Chiamare Walter", tipo: "chiamata", quando_visualizzato: "Domani, 09:00" } }] }];
    await page.evaluate(() => { document.getElementById("aiToastContainer").innerHTML = ""; });
    await page.fill("#homeHeroCampo", "chiamata walter domani ore 9 per il preventivo");
    await page.click("#homeHeroSend");
    await page.waitForTimeout(500);
    const breve = await page.evaluate(() => document.getElementById("aiToastContainer").innerText.replace(/\s+/g, " ").trim());
    verifica("appuntamento segnato: solo \"Ok, segnato domani ore 09:00\"", /Ok, segnato domani ore 09:00/.test(breve) && !/Chiamata ·|Segnato in calendario/.test(breve), breve);

    // Preventivo: EON chiede le voci, si risponde nella card, il preventivo si apre lì
    risposte = [
      { stato: "in_attesa_risposta", runId: "r3", testo: "Ok, te lo preparo: mi dai le voci e i prezzi del preventivo?", azioni: [] },
      { stato: "in_attesa_risposta", runId: "r3", testo: "IVA al 22%?", azioni: [] },
      { stato: "concluso", runId: "r3", testo: "", azioni: [{ tool: "crea_preventivo_o_fattura", esito: { id: "m9", titolo: "Preventivo n. 7", totale: 366, cliente: "Lorenzo Guaschina", dati: { tipo: "preventivo", numero: "7", cliente: "Lorenzo Guaschina", voci: [{ desc: "Porta", qta: 1, prezzo: 300 }], aliquota: 22, imponibile: 300, iva: 66, totale: 366 } } }] },
    ];
    await chiedi("mi crei preventivo a LORENZO GUASCHINA");
    const p1 = await leggiCard();
    verifica("preventivo: la domanda sulle voci è nella card, con la barra", /voci e i prezzi/.test(p1.testo) && p1.barra, JSON.stringify(p1));
    await page.fill("#risorsaPiede .scheda-campo", "porta 300 euro");
    await page.press("#risorsaPiede .scheda-campo", "Enter");
    await page.waitForFunction(() => /IVA al 22%/.test(document.getElementById("risorsaCorpo").innerText), null, { timeout: 4000 });
    await page.fill("#risorsaPiede .scheda-campo", "sì");
    await page.press("#risorsaPiede .scheda-campo", "Enter");
    await page.waitForFunction(() => /Preventivo n\. 7/.test(document.getElementById("risorsaCorpo").innerText), null, { timeout: 4000 });
    verifica("\"sì\" (2 lettere) vale come risposta, e alla fine il preventivo si apre nella card", richieste.at(-1).messaggio === "sì" && richieste.at(-1).runId === "r3");
    await page.click("#risorsaChiudi");

    // Domanda letta dai dati già in memoria (senza AI): stessa card
    const primaLocale = richieste.length;
    await page.evaluate(() => { tasks.length = 0; tasks.push({ id: "t1", title: "Sopralluogo Rossi", status: "todo", time: "Oggi, 17:30" }, { id: "t2", title: "Chiamare Valter", status: "todo", time: "Oggi, 18:00" }); navigateTo("home"); });
    await chiedi("appuntamenti di oggi");
    const c3 = await leggiCard();
    verifica("\"appuntamenti di oggi\": card bianca, senza chiamare l'AI", c3.titolo === "2 impegni oggi" && c3.voci.length === 2 && richieste.length === primaLocale, JSON.stringify(c3));
    await page.click("#risorsaChiudi");

    // Meno AI (26/09): "cosa ho da fare domani" e il programma di un giorno, dal calendario in memoria
    await page.evaluate(() => {
      tasks.length = 0;
      tasks.push({ id: "t3", title: "Chiamare Valter", status: "todo", time: "Domani, 16:00" }, { id: "t4", title: "Fatto già", status: "done", time: "Domani, 11:00" });
      chats.length = 0;
      chats.push({ id: "v1", name: "Giampiero Dini", isClient: true, archived: false, unread: 0, messages: [{ id: "m1", eventType: "appt", title: "Appuntamento con Dini", text: "Domani, 09:00" }] });
      navigateTo("home");
    });
    const primaDomani = richieste.length;
    await chiedi("Cosa ho da fare domani?");
    const c4 = await leggiCard();
    verifica("\"Cosa ho da fare domani?\": impegni e appuntamenti dei clienti, in ordine di ora, senza AI", c4.titolo === "2 impegni domani" && JSON.stringify(c4.ore) === '["09:00","16:00"]' && /Dini/.test(c4.voci[0]) && c4.voci[1] === "Chiamare Valter" && richieste.length === primaDomani, JSON.stringify(c4));
    await page.click("#risorsaChiudi");
    await page.evaluate(() => navigateTo("home"));
    await chiedi("Mi dici programma di domani?");
    verifica("\"Mi dici programma di domani?\": stessa lettura, senza AI", (await leggiCard()).titolo === "2 impegni domani" && richieste.length === primaDomani);
    await page.click("#risorsaChiudi");
    await page.evaluate(() => navigateTo("home"));
    risposte = [{ stato: "concluso", runId: "r9", testo: "Inizia dal sopralluogo.", azioni: [] }];
    await chiedi("cosa mi consigli di fare domani");
    verifica("\"cosa mi consigli di fare domani\": è un parere, decide l'AI", richieste.length === primaDomani + 1);
    verifica("nessun errore nella pagina", errori.length === 0, errori.join(" | "));
  } finally {
    await browser.close();
    server.kill();
  }
  console.log(fallimenti ? `\n${fallimenti} controlli falliti.` : "\nTutti i controlli passati.");
  if (fallimenti) process.exitCode = 1;
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
