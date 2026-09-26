/* Test (Meno AI, 27/09/2026): i saluti ("ciao", "grazie", "chi sei") hanno
   la risposta subito, senza AI; quando EON chiede "quale dei due?" con un
   elenco di clienti veri, sotto compaiono i pulsanti con i nomi e un tocco
   manda la risposta. Carica la vera index.html con Supabase e assistente
   simulati.

   Uso: NODE_PATH=/opt/node22/lib/node_modules node eval/saluti-scelte.test.js */

const { chromium } = require("playwright");
const { spawn } = require("child_process");
const path = require("path");

const PORT = 8993;
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
      const catena = () => { const q = { select: () => q, not: () => q, is: () => q, eq: () => q, order: () => q, limit: () => q, in: () => q, update: () => ({ eq: async () => ({ error: null }) }), single: async () => ({ data: null, error: null }), then: (ok) => ok({ data: [], error: null }) }; return q; };
      window.supabase = { createClient: () => ({ from: catena, channel: () => ({ on() { return this; }, subscribe() { return this; } }), auth: { getSession: async () => ({ data: { session: { access_token: "t", user: { id: "u1" } } } }), onAuthStateChange: () => ({}) } }) };
    });
    const richieste = [];
    let risposte = [];
    await page.route("https://eonbeckend.vercel.app/api?action=assistant", (route) => {
      richieste.push(JSON.parse(route.request().postData()));
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(risposte.shift() || { stato: "concluso", testo: "Ok.", azioni: [] }) });
    });
    await page.goto(`http://localhost:${PORT}/index.html`, { waitUntil: "networkidle" });
    await page.evaluate(() => {
      document.getElementById("onboardingScreen").style.display = "none";
      currentSession = { access_token: "t", user: { id: "u1" } };
      loadUserDataFromDB = async () => {};
      profiloUtente = { full_name: "Andrea Gianardi", business_name: "", profession: "edile", email: "" };
      clients.length = 0;
      clients.push({ id: "a", name: "Sara Dini", status: "attivo", value: 0, archived: false }, { id: "b", name: "Giampiero Dini", status: "attivo", value: 0, archived: false });
      navigateTo("home");
    });
    const chiedi = async (frase) => {
      await page.evaluate(() => chiudiRisorsaCard());
      await page.fill("#homeHeroCampo", frase);
      await page.click("#homeHeroSend");
      await page.waitForTimeout(300);
    };
    const card = () => page.evaluate(() => ({ titolo: document.getElementById("risorsaTitolo").textContent, testo: document.getElementById("risorsaCorpo").textContent, aperta: document.getElementById("risorsaOverlay").style.display === "flex" }));

    /* Saluti */
    for (const [frase, titolo] of [["Ciao", "Ciao, Andrea"], ["buongiorno eon", "Buongiorno, Andrea"], ["Ciao come stai?", "Ciao, Andrea"], ["grazie mille", "Figurati, Andrea!"], ["Chi sei ?", "Sono EON"]]) {
      richieste.length = 0;
      await chiedi(frase);
      const c = await card();
      verifica(`"${frase}": risposta subito, senza AI`, richieste.length === 0 && c.aperta && c.titolo === titolo, JSON.stringify({ ai: richieste.length, c }));
    }
    richieste.length = 0;
    await chiedi("Ciao come stai domani mattina ore 11 appuntamento con Fregoli");
    verifica("saluto con dentro un appuntamento: va avanti come sempre (non è solo un saluto)", richieste.length === 1);

    /* Pulsanti per scegliere tra omonimi */
    risposte = [
      { stato: "concluso", runId: "run-1", testo: "Ho trovato 2 clienti con il nome Dini:\n- Sara Dini\n- Giampiero Dini\n\nQuale dei due intendi?", azioni: [] },
      { stato: "concluso", testo: "Fatto.", azioni: [] },
    ];
    richieste.length = 0;
    await chiedi("Segna appuntamento Dini domani alle 10");
    const pulsanti = await page.evaluate(() => [...document.querySelectorAll("#risorsaCorpo .scheda-scelta")].map((b) => b.textContent));
    verifica("\"quale dei due?\": un pulsante per ogni Dini", JSON.stringify(pulsanti) === '["Sara Dini","Giampiero Dini"]', JSON.stringify(pulsanti));
    await page.click('#risorsaCorpo .scheda-scelta:text-is("Giampiero Dini")');
    await page.waitForTimeout(400);
    verifica("un tocco su \"Giampiero Dini\" manda la risposta a EON", richieste.length === 2 && /Giampiero Dini/.test(richieste[1].messaggio) && richieste[1].runId === "run-1", JSON.stringify(richieste.map((r) => [r.messaggio && r.messaggio.slice(0, 60), r.runId])));
    verifica("i pulsanti spariscono dopo la scelta", await page.evaluate(() => document.querySelectorAll("#risorsaCorpo .scheda-scelta").length === 0));

    /* Niente pulsanti se l'elenco non è di clienti veri */
    risposte = [{ stato: "concluso", runId: "run-2", testo: "Posso fare:\n- un preventivo\n- una fattura\n\nCosa preferisci?", azioni: [] }];
    await chiedi("Mi aiuti con Rossi");
    verifica("elenco che non è di clienti: nessun pulsante", await page.evaluate(() => document.querySelectorAll("#risorsaCorpo .scheda-scelta").length === 0));

    verifica("nessun errore nella pagina", errori.length === 0, JSON.stringify(errori));
  } finally {
    await browser.close();
    server.kill();
  }
  console.log(fallimenti ? `\n${fallimenti} controlli falliti` : "\nTutto ok");
  process.exit(fallimenti ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
