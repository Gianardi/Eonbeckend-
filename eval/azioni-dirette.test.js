/* Azioni dirette senza AI (27/09/2026). Andrea: "andare direttamente alla
   cosa da fare deve valere per tutto: cambiamo email → subito lì; assegna
   un compito, manda un feedback, dovreste aggiungere questo".
   Carica la vera index.html con Supabase finto: la frase scritta nel campo
   di EON apre la schermata giusta, e l'AI non viene mai chiamata.
   Le frasi che NON sono queste azioni (es. l'email di un cliente) devono
   continuare ad andare all'AI.

   Uso: NODE_PATH=/opt/node22/lib/node_modules node eval/azioni-dirette.test.js */

const { chromium } = require("playwright");
const { spawn } = require("child_process");
const path = require("path");

const PORT = 8996;
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
      window.__chiamateAI = 0;
      window.__updateUser = [];
      const sessione = { access_token: "tok", user: { id: "u1", email: "andrea@esempio.it" } };
      const catena = (tabella) => { const q = {
        update: () => ({ eq: async () => ({ error: null }) }),
        insert: () => ({ select: () => ({ single: async () => ({ data: {}, error: null }) }) }),
        select: () => q, not: () => q, is: () => q, eq: () => q, order: () => q, limit: () => q, in: () => q, maybeSingle: async () => ({ data: null, error: null }),
        single: async () => (tabella === "profiles" ? { data: { id: "u1", full_name: "Andrea Gianardi", business_name: "", profession: "edile" }, error: null } : { data: null, error: null }),
        then: (ok) => ok({ data: [], error: null }) }; return q; };
      window.supabase = { createClient: () => ({ from: catena, channel: () => ({ on(){ return this; }, subscribe(){ return this; } }),
        storage: { from: () => ({}) }, auth: {
          getSession: async () => ({ data: { session: sessione } }), onAuthStateChange: () => ({}),
          updateUser: async (dati) => { window.__updateUser.push(dati); return { data: {}, error: null }; },
        } }) };
      const fetchVero = window.fetch;
      window.fetch = async (url, init) => {
        if (String(url).includes("action=assistant")) { window.__chiamateAI++; return new Response(JSON.stringify({ risposta: "ok", azioni: [] }), { headers: { "content-type": "application/json" } }); }
        if (String(url).includes("/api?")) return new Response("{}", { headers: { "content-type": "application/json" } });
        return fetchVero(url, init);
      };
    });
    await page.goto(`http://localhost:${PORT}/index.html`, { waitUntil: "networkidle" });
    await page.waitForTimeout(600);

    /* 1 — riconoscimento: cosa è un'azione diretta e cosa no */
    const casi = await page.evaluate(() => {
      const c = (t) => { const a = capisciAzioneDiretta(t); return a ? a.tipo : null; };
      return {
        "Voglio cambiare password": c("Voglio cambiare password"),
        "cambia la password": c("cambia la password"),
        "Ho dimenticato la password": c("Ho dimenticato la password"),
        "Cambiamo email": c("Cambiamo email"),
        "voglio cambiare la mia email": c("voglio cambiare la mia email"),
        "cambia l'email di Rossi": c("cambia l'email di Rossi"),
        "manda una mail a Rossi": c("manda una mail a Rossi"),
        "cambia il nome dell'attività": c("cambia il nome dell'attività"),
        "attiva face id": c("attiva face id"),
        "metti EON sulla home": c("metti EON sulla home"),
        "manda un feedback": c("manda un feedback"),
        "Dovreste aggiungere le fatture elettroniche": c("Dovreste aggiungere le fatture elettroniche"),
        "sarebbe bello avere il meteo della settimana": c("sarebbe bello avere il meteo della settimana"),
        "assegna un compito": c("assegna un compito"),
        "assegna a Marco di comprare il silicone": c("assegna a Marco di comprare il silicone"),
        "manda un messaggio a Rossi": c("manda un messaggio a Rossi"),
        "Rita Ambrosini aggiungi clienti": c("Rita Ambrosini aggiungi clienti"),
        "domani alle 9 cambiare rubinetto da Rossi": c("domani alle 9 cambiare rubinetto da Rossi"),
        "esci": c("esci"),
      };
    });
    const attesi = {
      "Voglio cambiare password": "password", "cambia la password": "password", "Ho dimenticato la password": "password",
      "Cambiamo email": "email", "voglio cambiare la mia email": "email",
      "cambia l'email di Rossi": null, "manda una mail a Rossi": null,
      "cambia il nome dell'attività": "profilo", "attiva face id": "faceid", "metti EON sulla home": "installa",
      "manda un feedback": "feedback", "Dovreste aggiungere le fatture elettroniche": "feedback", "sarebbe bello avere il meteo della settimana": "feedback",
      "assegna un compito": "compito", "assegna a Marco di comprare il silicone": "compito",
      "manda un messaggio a Rossi": null, "Rita Ambrosini aggiungi clienti": null, "domani alle 9 cambiare rubinetto da Rossi": null,
      "esci": "esci",
    };
    for (const frase of Object.keys(attesi)) {
      verifica(`"${frase}" → ${attesi[frase] || "AI (come prima)"}`, casi[frase] === attesi[frase], String(casi[frase]));
    }

    /* 2 — dal campo di EON: si apre la schermata giusta, niente AI */
    const scrivi = async (frase) => {
      await page.evaluate(() => { chiudiRisorsaCard(); navigateTo("home"); document.getElementById("onboardingScreen").classList.add("hidden"); });
      await page.fill("#homeHeroCampo", frase);
      await page.click("#homeHeroSend");
      await page.waitForTimeout(300);
    };
    const titoloCard = () => page.evaluate(() => ({ titolo: document.getElementById("risorsaTitolo").textContent, aperta: document.getElementById("risorsaOverlay").style.display === "flex" }));

    await scrivi("Voglio cambiare password");
    let t = await titoloCard();
    verifica("\"Voglio cambiare password\": si apre Sicurezza con il campo della nuova password", t.aperta && t.titolo === "Sicurezza" && (await page.isVisible("#impCampoPassword")), JSON.stringify(t));

    await scrivi("Cambiamo email");
    t = await titoloCard();
    verifica("\"Cambiamo email\": si apre Account con il campo della nuova email", t.aperta && t.titolo === "Account" && (await page.isVisible("#impCampoEmail")), JSON.stringify(t));
    await page.fill("#impCampoEmail", "nuova@esempio.it");
    await page.click("#impCambiaEmail");
    await page.waitForTimeout(200);
    const email = await page.evaluate(() => ({ chiamate: window.__updateUser, esito: document.getElementById("impEsitoEmail").textContent }));
    verifica("Cambia email: chiede la conferma a Supabase e spiega cosa fare", email.chiamate.length === 1 && email.chiamate[0].email === "nuova@esempio.it" && /tocca il link di conferma/.test(email.esito), JSON.stringify(email));

    await scrivi("Dovreste aggiungere le fatture elettroniche");
    t = await titoloCard();
    const testoFeedback = await page.inputValue("#feedbackCampo").catch(() => "");
    verifica("\"Dovreste aggiungere…\": si apre il feedback già scritto", t.titolo === "Manda un feedback" && testoFeedback === "Dovreste aggiungere le fatture elettroniche", JSON.stringify({ t, testoFeedback }));

    await scrivi("manda un feedback: il calendario è lento");
    verifica("\"manda un feedback: …\": il testo dopo i due punti è già nel campo", (await page.inputValue("#feedbackCampo")) === "Il calendario è lento", await page.inputValue("#feedbackCampo"));

    await page.evaluate(() => { employees.length = 0; employees.push({ name: "Marco Neri", role: "Operaio", color: "#333" }); selectedEmployees.length = 0; });
    await scrivi("assegna a Marco di comprare il silicone");
    const compito = await page.evaluate(() => ({ pagina: document.getElementById("page-assegna-compiti").classList.contains("visible"), scelti: selectedEmployees.slice(), testo: document.getElementById("taskAssignTitle").value }));
    verifica("\"assegna a Marco di comprare il silicone\": Assegna Compiti con Marco scelto e il compito scritto", compito.pagina && compito.scelti.join() === "Marco Neri" && compito.testo === "Comprare il silicone", JSON.stringify(compito));

    verifica("nessuna chiamata all'AI", (await page.evaluate(() => window.__chiamateAI)) === 0);
    verifica("nessun errore nella pagina", erroriPagina.length === 0, JSON.stringify(erroriPagina));
  } finally {
    await browser.close();
    server.kill();
  }
  console.log(fallimenti ? `\n${fallimenti} controlli falliti` : "\nTutto ok");
  process.exit(fallimenti ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
