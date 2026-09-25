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
    await chiedi("cosa ho da fare domani");
    const c1 = await leggiCard();
    verifica("si apre la card bianca, titolo = la domanda", c1.titolo === "Cosa ho da fare domani?", c1.titolo);
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
    verifica("la seconda card ha titolo EON (non \"Giampiero\")", (await leggiCard()).titolo === "EON");
    await page.click("#risorsaChiudi");

    // Domanda letta dai dati già in memoria (senza AI): stessa card
    const primaLocale = richieste.length;
    await page.evaluate(() => { tasks.length = 0; tasks.push({ id: "t1", title: "Sopralluogo Rossi", status: "todo", time: "Oggi, 17:30" }, { id: "t2", title: "Chiamare Valter", status: "todo", time: "Oggi, 18:00" }); navigateTo("home"); });
    await chiedi("appuntamenti di oggi");
    const c3 = await leggiCard();
    verifica("\"appuntamenti di oggi\": card bianca, senza chiamare l'AI", c3.titolo === "2 impegni oggi" && c3.voci.length === 2 && richieste.length === primaLocale, JSON.stringify(c3));
    verifica("nessun errore nella pagina", errori.length === 0, errori.join(" | "));
  } finally {
    await browser.close();
    server.kill();
  }
  console.log(fallimenti ? `\n${fallimenti} controlli falliti.` : "\nTutti i controlli passati.");
  if (fallimenti) process.exitCode = 1;
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
