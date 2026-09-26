/* Test "annullare appuntamenti senza AI" (Meno AI, punto 3 — 27/09/2026):
   "annulla appuntamenti di domani", "cancella la chiamata a Walter"...
   EON cerca nel calendario in memoria, mostra la lista con la conferma e
   solo al tocco annulla (tasks → status "annullato"; appuntamenti dei
   clienti → titolo "❌ … (annullato)" e senza data, come fa l'AI), con
   "Annulla" per tornare indietro. Frasi vaghe o nomi che non trova → AI.
   Carica la vera index.html con Supabase e assistente simulati.

   Uso: NODE_PATH=/opt/node22/lib/node_modules node eval/annulla.test.js */

const { chromium } = require("playwright");
const { spawn } = require("child_process");
const path = require("path");

const PORT = 8992;
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
      const catena = (tabella) => {
        const q = {
          update: (patch) => ({ eq: async (col, id) => { window.__scritture.push({ tabella, id, patch }); return { error: null }; } }),
          select: () => q, not: () => q, is: () => q, eq: () => q, order: () => q, limit: () => q,
          in: (col, ids) => ({ then: (ok) => ok({ data: ids.map((id) => ({ id, title: "Sopralluogo bagno", scheduled_at: "2026-09-28T11:00:00" })), error: null }) }),
          single: async () => ({ data: null, error: null }),
          then: (ok) => ok({ data: [], error: null }),
        };
        return q;
      };
      window.supabase = { createClient: () => ({ from: catena, channel: () => ({ on() { return this; }, subscribe() { return this; } }), auth: { getSession: async () => ({ data: { session: { access_token: "t", user: { id: "u1" } } } }), onAuthStateChange: () => ({}) } }) };
    });
    const richiesteAI = [];
    await page.route("https://eonbeckend.vercel.app/api?action=assistant", (route) => {
      richiesteAI.push(JSON.parse(route.request().postData()).messaggio);
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ stato: "concluso", testo: "Ok.", azioni: [] }) });
    });
    await page.goto(`http://localhost:${PORT}/index.html`, { waitUntil: "networkidle" });

    const prepara = () => page.evaluate(() => {
      document.getElementById("onboardingScreen").style.display = "none";
      currentSession = { access_token: "t", user: { id: "u1" } };
      loadUserDataFromDB = async () => {};
      window.__scritture.length = 0;
      document.getElementById("aiToastContainer").innerHTML = "";
      chiudiRisorsaCard();
      const giorno = (n, ora) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toLocaleDateString("it-IT", { weekday: "short", day: "numeric", month: "short" }).replace(".", "") + ", " + ora; };
      tasks.length = 0;
      tasks.push(
        { id: "t-walter", title: "Chiamare Walter", owner: "user", status: "todo", time: giorno(1, "09:00") },
        { id: "t-bianchi", title: "Chiamare Bianchi", owner: "user", status: "todo", time: giorno(3, "10:00") },
        { id: "t-fatto", title: "Chiamare Verdi", owner: "user", status: "done", time: giorno(1, "08:00") },
      );
      clients.length = 0;
      clients.push({ id: "c-rossi", name: "Mario Rossi", status: "attivo", value: 0, archived: false });
      chats.length = 0;
      chats.push({ id: "v-rossi", name: "Mario Rossi", isClient: true, archived: false, unread: 0, messages: [
        { id: "m-sopr", from: "me", eventType: "appt", title: "Sopralluogo bagno", text: giorno(1, "11:00"), time: "10:00" },
      ] });
      activeChatIndex = null;
      navigateTo("home");
    });
    const chiedi = async (frase) => {
      await page.fill("#homeHeroCampo", frase);
      await page.click("#homeHeroSend");
      await page.waitForTimeout(250);
    };
    const card = () => page.evaluate(() => ({
      aperta: document.getElementById("risorsaOverlay").style.display === "flex",
      titolo: document.getElementById("risorsaTitolo").textContent,
      righe: [...document.querySelectorAll(".annulla-riga")].map((r) => r.textContent.trim().replace(/\s+/g, " ")),
      bottone: (document.getElementById("annullaConferma") || {}).textContent,
      testo: document.getElementById("risorsaCorpo").textContent.trim(),
    }));

    /* 1 — tutti gli impegni di domani */
    await prepara();
    richiesteAI.length = 0;
    await chiedi("Annulla appuntamenti di domani");
    let c = await card();
    verifica("\"Annulla appuntamenti di domani\": lista con conferma, senza AI", c.aperta && richiesteAI.length === 0 && c.righe.length === 2 && /Chiamare Walter/.test(c.righe[0]) && /Sopralluogo bagno — Mario Rossi/.test(c.righe[1]) && c.bottone === "Annulla 2 impegni", JSON.stringify({ c, ai: richiesteAI }));
    verifica("nulla annullato prima del tocco", await page.evaluate(() => window.__scritture.length === 0 && tasks[0].status === "todo"));
    await page.click("#annullaConferma");
    await page.waitForTimeout(250);
    let s = await page.evaluate(() => ({ scritture: window.__scritture.slice(), walter: tasks[0].status, sopr: chats[0].messages[0].annullato, toast: document.getElementById("aiToastContainer").textContent }));
    verifica("confermato: la chiamata segnata \"annullato\"", s.walter === "annullato" && s.scritture.some((w) => w.tabella === "tasks" && w.id === "t-walter" && w.patch.status === "annullato"), JSON.stringify(s.scritture));
    verifica("e l'appuntamento del cliente annullato come fa l'AI (❌, senza data)", s.sopr === true && s.scritture.some((w) => w.tabella === "messages" && w.id === "m-sopr" && w.patch.title === "❌ Sopralluogo bagno (annullato)" && w.patch.scheduled_at === null), JSON.stringify(s.scritture));
    verifica("avviso breve \"Ok, annullati 2 impegni\"", /Ok, annullati 2 impegni/.test(s.toast), s.toast);
    await page.click("#aiToastContainer .ai-toast-yes");
    await page.waitForTimeout(250);
    s = await page.evaluate(() => ({ scritture: window.__scritture.slice(), walter: tasks[0].status, sopr: chats[0].messages[0].annullato }));
    verifica("\"Annulla\" nell'avviso rimette tutto com'era", s.walter === "todo" && s.sopr === false && s.scritture.some((w) => w.id === "t-walter" && w.patch.status === "todo") && s.scritture.some((w) => w.id === "m-sopr" && w.patch.title === "Sopralluogo bagno" && w.patch.scheduled_at === "2026-09-28T11:00:00"), JSON.stringify(s.scritture));

    /* 2 — per nome, senza giorno */
    await prepara();
    await chiedi("cancella la chiamata a Walter");
    c = await card();
    verifica("\"cancella la chiamata a Walter\": solo quella", c.aperta && c.righe.length === 1 && /Chiamare Walter/.test(c.righe[0]) && c.titolo === "Annullo questo impegno?", JSON.stringify(c));
    await page.click(".annulla-no");
    verifica("\"No, lascia così\": niente toccato", await page.evaluate(() => window.__scritture.length === 0 && tasks[0].status === "todo"));

    /* 3 — tolgo la spunta a uno */
    await prepara();
    await chiedi("annulla gli impegni di domani");
    await page.click('.annulla-riga input[data-i="1"]');
    c = await card();
    verifica("tolta una spunta: \"Annulla 1 impegno\"", c.bottone === "Annulla 1 impegno", c.bottone);
    await page.click("#annullaConferma");
    await page.waitForTimeout(250);
    s = await page.evaluate(() => ({ walter: tasks[0].status, sopr: !!chats[0].messages[0].annullato }));
    verifica("annullato solo quello spuntato", s.walter === "annullato" && s.sopr === false, JSON.stringify(s));

    /* 4 — tipo e ora */
    await prepara();
    await chiedi("disdici il sopralluogo di domani alle 11");
    c = await card();
    verifica("\"disdici il sopralluogo di domani alle 11\": solo il sopralluogo", c.righe.length === 1 && /Sopralluogo bagno/.test(c.righe[0]), JSON.stringify(c));

    /* 5 — niente in programma */
    await prepara();
    richiesteAI.length = 0;
    await chiedi("annulla gli appuntamenti di dopodomani");
    c = await card();
    verifica("niente in programma: lo dice, senza AI", c.aperta && /Niente da annullare/.test(c.titolo) && richiesteAI.length === 0, JSON.stringify(c));

    /* 6 — queste NO: decide l'AI */
    for (const frase of ["annulla gli appuntamenti", "annulla l'appuntamento con Pinco", "annulla la fattura di Rossi", "annulla appuntamenti domani mattina", "cancella la chiamata a Walter e segna Rossi domani alle 10"]) {
      await prepara();
      richiesteAI.length = 0;
      await chiedi(frase);
      await page.waitForTimeout(300);
      const aperta = await page.evaluate(() => document.querySelectorAll(".annulla-riga").length > 0);
      verifica(`AI: "${frase}"`, richiesteAI.length === 1 && !aperta && (await page.evaluate(() => window.__scritture.length === 0)), JSON.stringify({ ai: richiesteAI.length, aperta }));
    }

    verifica("nessun errore nella pagina", errori.length === 0, JSON.stringify(errori));
  } finally {
    await browser.close();
    server.kill();
  }
  console.log(fallimenti ? `\n${fallimenti} controlli falliti` : "\nTutto ok");
  process.exit(fallimenti ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
