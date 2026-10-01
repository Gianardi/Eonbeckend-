/* "Non c'è? Lo facciamo adesso?" in tutta l'app (1/10/2026, Gianardi: "il meccanismo non lo
   applicherei solo ai preventivi, estendilo a ogni attività dove ha senso"). Quando quello che
   chiedi manca, EON lo dice e propone di farlo subito; con "Sì" lo fa:
   1. chiamare / scrivere senza numero o email → li chiede, li salva, chiama o prepara la mail;
   2. "il numero di X ce l'ho?" → no: me lo dici? lo salvo (anche aggiungendo il cliente);
   3. "il preventivo di X l'ho fatto?" / "mi serve la fattura di X" → no: lo facciamo adesso?;
   4. DiCo (elettricista) e SAL (edile) che non ci sono → li facciamo adesso?;
   5. "quando vedo X?" senza impegni → lo fissiamo?;
   6. "sposta l'appuntamento con X a giovedì" e in agenda non c'è → lo metto giovedì?;
   7. "apri la scheda di X" e X non è tra i clienti → lo aggiungo?
   Browser vero, server vero (api/index.js) con database e AI finti.
   Uso: NODE_PATH=/opt/node22/lib/node_modules node eval/non-ce-facciamolo-app.test.js */

const { chromium } = require("playwright");
const { spawn } = require("child_process");
const { randomUUID } = require("crypto");
const path = require("path");

const PORT = 9041;
const ROOT = path.resolve(__dirname, "..");
let fallimenti = 0;
function verifica(nome, condizione, dettaglio) {
  console.log(`  ${condizione ? "OK  " : "FAIL"} ${nome}${condizione || !dettaglio ? "" : " — " + dettaglio}`);
  if (!condizione) fallimenti++;
}

/* ---------- Il server vero, con database e AI finti ---------- */
process.env.SUPABASE_URL = "https://finto.supabase.co";
process.env.SUPABASE_ANON_KEY = "anon-finta";
process.env.SUPABASE_SERVICE_ROLE_KEY = "service-finta";
process.env.ANTHROPIC_API_KEY = "chiave-finta";
const UTENTE = { id: "11111111-1111-4111-8111-111111111111" };
let tabelle = {};
let chiamateAI = 0;
function vale(r, k, v) {
  if (v === "is.null") return r[k] == null;
  if (v === "not.is.null") return r[k] != null;
  if (v.startsWith("eq.")) return String(r[k]) === v.slice(3);
  if (v.startsWith("neq.")) return String(r[k]) !== v.slice(4);
  if (v.startsWith("gte.")) return String(r[k]) >= v.slice(4);
  if (v.startsWith("gt.")) return String(r[k]) > v.slice(3);
  if (v.startsWith("lte.")) return String(r[k]) <= v.slice(4);
  if (v.startsWith("lt.")) return String(r[k]) < v.slice(3);
  if (v.startsWith("ilike.")) return String(r[k] || "").toLowerCase().includes(v.slice(6).replace(/\*/g, "").toLowerCase());
  if (v.startsWith("in.(")) return v.slice(4, -1).split(",").map((x) => x.replace(/^"|"$/g, "")).includes(String(r[k]));
  return true;
}
function risposta(o, s = 200) { return new Response(o == null ? "" : JSON.stringify(o), { status: s, headers: { "content-type": "application/json" } }); }
function postgrest(url, init) {
  const u = new URL(url);
  const percorso = u.pathname.replace("/rest/v1/", "");
  if (percorso.startsWith("rpc/")) return risposta(percorso === "rpc/ai_check_rate_limit" ? true : null);
  const righe = tabelle[percorso] || (tabelle[percorso] = []);
  const params = [...u.searchParams.entries()].filter(([k]) => !["select", "limit", "order", "or", "on_conflict"].includes(k));
  const scelte = righe.filter((r) => params.every(([k, v]) => vale(r, k, v)));
  const metodo = (init && init.method) || "GET";
  if (metodo === "GET") return risposta(scelte);
  if (metodo === "POST") {
    const corpo = JSON.parse(init.body);
    const nuove = (Array.isArray(corpo) ? corpo : [corpo]).map((c) => ({ id: randomUUID(), created_at: new Date().toISOString(), deleted_at: null, owner_id: UTENTE.id, ...c }));
    righe.push(...nuove);
    return risposta(nuove, 201);
  }
  if (metodo === "PATCH") { const c = JSON.parse(init.body); scelte.forEach((r) => Object.assign(r, c)); return risposta(scelte); }
  if (metodo === "DELETE") { tabelle[percorso] = righe.filter((r) => !scelte.includes(r)); return risposta([]); }
  return risposta([]);
}
const fetchVero = globalThis.fetch;
globalThis.fetch = async (url, init) => {
  const s = String(url);
  if (s.startsWith("https://api.anthropic.com/")) {
    chiamateAI++;
    const corpo = JSON.parse(init.body);
    return risposta({ id: "msg", type: "message", role: "assistant", model: corpo.model, usage: { input_tokens: 5, output_tokens: 2 }, content: [{ type: "text", text: "Ok." }], stop_reason: "end_turn" });
  }
  if (s.startsWith(process.env.SUPABASE_URL + "/auth/v1/user")) return risposta(UTENTE);
  if (s.startsWith(process.env.SUPABASE_URL + "/rest/v1/")) return postgrest(s, init);
  return fetchVero(url, init);
};


async function main() {
  const { default: handler } = await import("../api/index.js");
  const server = spawn("python3", ["-m", "http.server", String(PORT)], { cwd: ROOT, stdio: "ignore" });
  await new Promise((r) => setTimeout(r, 800));
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const errori = [];
    page.on("pageerror", (e) => errori.push(e.message));
    await page.addInitScript(() => {
      window.__db = [];
      const catena = (tabella) => {
        const q = {
          select: () => q, not: () => q, is: () => q, eq: () => q, order: () => q, limit: () => q, in: () => q, gt: () => q,
          update: (patch) => ({
            eq: async (c, v) => { window.__db.push({ tabella, op: "update", id: v, patch }); return { error: null }; },
            in: async () => ({ error: null }),
          }),
          delete: () => ({ eq: async () => ({ error: null }) }), upsert: async () => ({ error: null }),
          insert: (riga) => { window.__db.push({ tabella, op: "insert", riga }); const r = { id: tabella + window.__db.length, created_at: new Date().toISOString(), ...riga }; return { select: () => ({ single: async () => ({ data: r, error: null }), then: (ok) => ok({ data: [r], error: null }) }) }; },
          maybeSingle: async () => ({ data: null, error: null }), single: async () => ({ data: null, error: null }),
          then: (ok) => ok({ data: [], error: null }),
        };
        return q;
      };
      window.supabase = { createClient: () => ({ from: catena, channel: () => ({ on() { return this; }, subscribe() { return this; } }), storage: { from: () => ({}) },
        auth: { getSession: async () => ({ data: { session: null } }), onAuthStateChange: () => ({}) } }) };
      window.__aperti = [];
      window.open = (u) => { window.__aperti.push(u); return {}; };
    });
    const richieste = [], risposteServer = [];
    await page.route("**/api?action=*", (route) => route.fulfill({ status: 200, contentType: "application/json", body: "{}" }));
    await page.route("**/api?action=assistant", async (route) => {
      const body = JSON.parse(route.request().postData() || "{}");
      richieste.push(body);
      const req = { method: "POST", url: "/api?action=assistant", headers: { authorization: "Bearer t" }, body };
      let uscita = "", stato = 200;
      const res = { statusCode: 0, setHeader() {}, end(d) { uscita = d || ""; } };
      try { await handler(req, res); stato = res.statusCode || 200; } catch (e) { stato = 500; uscita = JSON.stringify({ error: e.message }); }
      risposteServer.push(stato + " " + String(uscita).slice(0, 300));
      route.fulfill({ status: stato, contentType: "application/json", body: uscita || "{}" });
    });
    tabelle = { clients: [["aaaaaaaa-0000-4000-8000-000000000001", "Bar Aurora", ""], ["aaaaaaaa-0000-4000-8000-000000000002", "Mario Rossi", "3331234567"], ["aaaaaaaa-0000-4000-8000-000000000003", "Cantiere Ferraro", ""], ["aaaaaaaa-0000-4000-8000-000000000004", "Villa Le Querce", ""]].map(([id, name, phone]) => ({ id, owner_id: UTENTE.id, name, phone, email: "", status: "attivo", value: 0, deleted_at: null })),
      profiles: [{ id: UTENTE.id, profession: "edile" }], conversations: [], messages: [], tasks: [], incomes: [], cartelle: [], cantiere_appunti: [], ai_request_log: [], ai_audit_log: [], ai_runs: [], eon_admin: [], app_errori: [] };
    await page.goto(`http://localhost:${PORT}/index.html`, { waitUntil: "networkidle" });
    await page.evaluate(async () => {
      document.getElementById("onboardingScreen").style.display = "none";
      currentSession = { access_token: "t", user: { id: "11111111-1111-4111-8111-111111111111", email: "a@b.it" } };
      loadUserDataFromDB = async () => {}; tokenValido = async () => "t";
      apriLinkEsterno = (u) => window.__aperti.push(u);
      await applyProfession("edile", true);
      clients.length = 0;
      clients.push({ id: "aaaaaaaa-0000-4000-8000-000000000001", name: "Bar Aurora", phone: "", email: "", status: "attivo", value: 0, desc: "", archived: false });
      clients.push({ id: "aaaaaaaa-0000-4000-8000-000000000002", name: "Mario Rossi", phone: "3331234567", email: "", status: "attivo", value: 0, desc: "", archived: false });
      clients.push({ id: "aaaaaaaa-0000-4000-8000-000000000003", name: "Cantiere Ferraro", phone: "", email: "", status: "attivo", value: 0, desc: "", archived: false });
      clients.push({ id: "aaaaaaaa-0000-4000-8000-000000000004", name: "Villa Le Querce", phone: "", email: "", status: "attivo", value: 0, desc: "", archived: false });
      chats.length = 0;
      try { localStorage.setItem("eon-promemoria-proposto", "1"); } catch (e) {}
    });

    const scrivi = async (frase) => {
      await page.evaluate(() => { chiudiRisorsaCard(); navigateTo("home"); document.getElementById("aiToastContainer").innerHTML = ""; window.__aperti.length = 0; });
      await page.fill("#homeHeroCampo", frase);
      await page.evaluate(() => document.getElementById("homeHeroSend").click());
      await page.waitForTimeout(700);
    };
    const card = () => page.evaluate(() => ({ aperta: document.getElementById("risorsaOverlay").style.display === "flex", titolo: document.getElementById("risorsaTitolo").textContent, corpo: document.getElementById("risorsaCorpo").innerText.replace(/\s+/g, " ") }));
    const tocca = async (testo) => { await page.evaluate((t) => [...document.querySelectorAll("#risorsaCorpo .scheda-scelta")].find((b) => b.textContent === t).click(), testo); await page.waitForTimeout(500); };
    const rispondi = async (t) => { await page.fill("#domandaCodiceCampo", t); await page.click("#domandaCodiceInvia"); await page.waitForTimeout(700); };
    const db = (tab, op) => page.evaluate(([tab, op]) => window.__db.filter((x) => x.tabella === tab && x.op === op), [tab, op]);
    const aperti = () => page.evaluate(() => window.__aperti.slice());
    const ultimaAI = () => richieste[richieste.length - 1] || {};
    let c, n0;

    // 1) Chiamare senza numero: lo chiede, lo salva, chiama
    n0 = richieste.length;
    await scrivi("chiama il Bar Aurora");
    c = await card();
    verifica("1. \"chiama il Bar Aurora\" senza numero: \"Me lo dici? Lo salvo e lo chiamo\"", /Non ho il numero di Bar Aurora\. Me lo dici\? Lo salvo e lo chiamo\./.test(c.corpo), JSON.stringify(c));
    if (process.env.FOTO) await page.screenshot({ path: process.env.FOTO });
    await rispondi("333 555 1212");
    const salvati = (await db("clients", "update")).filter((x) => x.id === "aaaaaaaa-0000-4000-8000-000000000001" && x.patch.phone);
    verifica("…numero salvato nella scheda e chiamata partita", salvati.length === 1 && salvati[0].patch.phone === "3335551212" && (await aperti()).some((u) => /^tel:.*3335551212/.test(u)), JSON.stringify({ salvati, a: await aperti() }));
    verifica("…senza AI", richieste.length === n0);

    // 1b) Email senza indirizzo
    await scrivi("manda una mail al Bar Aurora che il lavoro è finito");
    c = await card();
    verifica("1b. mail senza indirizzo: \"Me la dici? La salvo e preparo la mail\" (o \"La scrivo io\")", /Non ho l'email di Bar Aurora\. Me la dici\? La salvo e preparo la mail\./.test(c.corpo) && /La scrivo io nella Mail/.test(c.corpo), JSON.stringify(c));
    await rispondi("info@baraurora.it");
    c = await card();
    verifica("…email salvata e mail pronta per quell'indirizzo", (await db("clients", "update")).some((x) => x.id === "aaaaaaaa-0000-4000-8000-000000000001" && x.patch.email === "info@baraurora.it") && /Apri l'email per Bar Aurora/.test(c.corpo), JSON.stringify(c));

    // 2) "Il numero di X ce l'ho?" quando non è tra i clienti
    await scrivi("il numero di Gino Pace ce l'ho?");
    c = await card();
    verifica("2. \"il numero di Gino Pace ce l'ho?\": no, me lo dici? lo aggiungo", /Non hai il numero di Gino Pace.*Me lo dici\?/.test(c.corpo), JSON.stringify(c));
    await rispondi("340 1112222");
    const nuovi = (await db("clients", "insert")).filter((x) => x.riga.name === "Gino Pace");
    verifica("…Gino Pace aggiunto ai clienti con il numero", nuovi.length === 1 && (await page.evaluate(() => (clients.find((x) => x.name === "Gino Pace") || {}).phone)) === "3401112222");

    // 3) "Il preventivo di X l'ho fatto?" → no → lo facciamo adesso → chiede il lavoro e l'importo
    n0 = richieste.length;
    await scrivi("il preventivo del Bar Aurora l'ho fatto?");
    c = await card();
    verifica("3. \"il preventivo del Bar Aurora l'ho fatto?\": \"Con EON non abbiamo ancora fatto preventivi… Lo facciamo adesso?\"", /Con EON non abbiamo ancora fatto preventivi per Bar Aurora\. Lo facciamo adesso\?/.test(c.corpo), JSON.stringify(c));
    await tocca("Sì, facciamolo");
    c = await card();
    verifica("…\"Sì\": per quale lavoro?", /Per quale lavoro\?/.test(c.corpo), JSON.stringify(c));
    await rispondi("vetrina");
    await rispondi("2.400");
    const cmd = ultimaAI().comando || {};
    verifica("…il preventivo parte: Bar Aurora, vetrina, 2.400", richieste.length === n0 + 1 && cmd.azione === "documento" && cmd.cliente_id === "aaaaaaaa-0000-4000-8000-000000000001" && /vetrina/i.test(cmd.lavoro || "") && cmd.importo === 2400, JSON.stringify(ultimaAI()).slice(0, 300));
    await scrivi("mi serve la fattura di Mario Rossi");
    c = await card();
    verifica("3b. \"mi serve la fattura di Mario Rossi\" (non c'è): \"La facciamo adesso?\"", /fatture per Mario Rossi\. La facciamo adesso\?/.test(c.corpo), JSON.stringify(c));

    // 4) SAL che non c'è (edile)
    await scrivi("mandami il SAL di Cantiere Ferraro");
    c = await card();
    verifica("4. SAL che non c'è: \"Lo facciamo adesso?\"", /Il SAL per Cantiere Ferraro non l'abbiamo ancora fatto\. Lo facciamo adesso\?/.test(c.corpo), JSON.stringify(c));
    await tocca("Sì, facciamolo");
    c = await card();
    verifica("…\"Sì\": a che punto sono i lavori?", /A che punto sono i lavori\?/.test(c.corpo), JSON.stringify(c));
    await rispondi("40%");
    const sal = await db("sal", "insert");
    verifica("…SAL al 40% segnato per Cantiere Ferraro", sal.length === 1 && Number(sal[0].riga.percentuale) === 40 && sal[0].riga.client_id === "aaaaaaaa-0000-4000-8000-000000000003", JSON.stringify(sal));

    // 5) "Quando vedo X?" senza impegni → lo fissiamo
    const ai0 = chiamateAI;
    await scrivi("quando vedo il Bar Aurora?");
    c = await card();
    verifica("5. \"quando vedo il Bar Aurora?\": nessun impegno, \"Lo fissiamo?\"", /Non hai impegni in programma con Bar Aurora\. Lo fissiamo\?/.test(c.corpo), JSON.stringify(c));
    await tocca("Sì, fissiamolo");
    await rispondi("giovedì alle 9");
    await page.waitForTimeout(500);
    // l'impegno lo crea il server col codice (crea_impegno), senza AI
    const impegnoCreato = (quando) => risposteServer.slice(-1).some((r) => /"tool":"crea_impegno"/.test(r) && /Bar Aurora/.test(r) && r.includes(quando));
    verifica("…appuntamento con il Bar Aurora giovedì alle 9 in agenda, senza AI", impegnoCreato("gio 8 ott, 09:00") && chiamateAI === ai0, risposteServer.slice(-1) + " / AI: " + (chiamateAI - ai0));

    // 6) Spostare un impegno che non c'è → lo metto?
    await scrivi("sposta l'appuntamento con Mario Rossi a lunedì alle 15");
    c = await card();
    verifica("6. sposta un impegno che non c'è: \"Lo metto lunedì 5 ottobre alle 15:00?\"", /Non trovo in agenda l'impegno con Mario Rossi.*Lo metto lunedì 5 ottobre alle 15:00\?/.test(c.corpo), JSON.stringify(c));
    const nServer0 = risposteServer.length;
    await tocca("No");
    const nServer = risposteServer.length;
    verifica("…\"No\": niente in agenda", !(await card()).aperta && nServer === nServer0);
    await scrivi("sposta il sopralluogo del Bar Aurora a venerdì alle 10");
    await tocca("Sì, mettilo");
    await page.waitForTimeout(500);
    verifica("…\"Sì, mettilo\": sopralluogo con il Bar Aurora venerdì alle 10 in agenda, senza AI", impegnoCreato("ven 2 ott, 10:00") && /[Ss]opralluogo/.test(risposteServer.slice(-1)[0] || "") && chiamateAI === ai0, risposteServer.slice(-1) + " / AI: " + (chiamateAI - ai0));

    // 7) "Apri la scheda di X" e X non è tra i clienti → lo aggiungo
    await scrivi("apri la scheda di Ugo Neri");
    c = await card();
    verifica("7. \"apri la scheda di Ugo Neri\": \"non è tra i tuoi clienti. Lo aggiungo?\"", /Ugo Neri non è tra i tuoi clienti\. Lo aggiungo\?/.test(c.corpo), JSON.stringify(c));
    await tocca("Sì, aggiungilo");
    c = await card();
    verifica("…aggiunto e scheda aperta", (await db("clients", "insert")).some((x) => x.riga.name === "Ugo Neri") && /Ugo Neri/.test(c.titolo) && /Chiama/.test(c.corpo), JSON.stringify(c));

    // 4b) DiCo che non c'è (elettricista)
    await page.evaluate(async () => { await applyProfession("elettricista", true); });
    await scrivi("mandami la dichiarazione di conformità di Villa Le Querce");
    c = await card();
    verifica("4b. DiCo che non c'è: \"La facciamo adesso?\"", /La dichiarazione di conformità per Villa Le Querce non l'abbiamo ancora fatta\. La facciamo adesso\?/.test(c.corpo), JSON.stringify(c));
    await tocca("Sì, facciamola");
    verifica("…\"Sì\": si apre la DiCo con Villa Le Querce come committente", await page.evaluate(() => (document.getElementById("dicoCommittente") || {}).value === "Villa Le Querce"));

    // Da non toccare: chi ha il numero si chiama subito; il cliente che c'è si apre
    await page.evaluate(async () => { await applyProfession("edile", true); });
    await scrivi("chiama Mario Rossi");
    verifica("chi ha il numero: chiamata subito, come prima", (await aperti()).some((u) => /^tel:.*3331234567/.test(u)), JSON.stringify(await aperti()));
    await scrivi("apri la scheda di Mario Rossi");
    c = await card();
    verifica("scheda di un cliente che c'è: si apre come prima", /Mario Rossi/.test(c.titolo) && !/Lo aggiungo/.test(c.corpo), JSON.stringify(c));
    verifica("nessun errore nella pagina", errori.length === 0, JSON.stringify(errori));
  } finally {
    await browser.close();
    server.kill();
  }
  console.log(fallimenti ? `\n${fallimenti} controlli falliti` : "\nTutto ok");
  process.exit(fallimenti ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
