/* Preventivo lungo dettato, dall'app al database, SENZA AI (29/09/2026,
   Andrea: "doveva funzionare con il codice e non con l'AI").
   L'artigiano detta un preventivo di un minuto, voce per voce: l'app mostra
   le voci lette (quantità × prezzo, IVA, totale), un tocco su "Crea" e il
   server VERO (api/index.js, database finto) salva il documento con tutte
   le voci. L'AI finta conta le chiamate: devono restare 0.
   Uso: NODE_PATH=/opt/node22/lib/node_modules node eval/preventivo-voci-app.test.js */

const { chromium } = require("playwright");
const { spawn } = require("child_process");
const { randomUUID } = require("crypto");
const path = require("path");

const PORT = 9023;
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


const CLIENTI = ["Mario Rossi", "Rita Ambrosini", "Condominio Parco Verde"];
const documenti = () => (tabelle.messages || []).filter((m) => m.event_type === "doc").map((m) => JSON.parse(m.file_name));

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
      window.__scritture = [];
      const catena = (tabella) => {
        const q = {
          select: () => q, not: () => q, is: () => q, eq: () => q, order: () => q, limit: () => q, in: () => q, gt: () => q,
          update: () => ({ eq: async () => ({ error: null }) }), delete: () => ({ eq: async () => ({ error: null }) }), upsert: async () => ({ error: null }),
          insert: (riga) => { window.__scritture.push({ tabella, riga }); const r = { id: "n" + window.__scritture.length, created_at: new Date().toISOString(), ...riga }; return { select: () => ({ single: async () => ({ data: r, error: null }), then: (ok) => ok({ data: [r], error: null }) }) }; },
          maybeSingle: async () => ({ data: null, error: null }), single: async () => ({ data: null, error: null }),
          then: (ok) => ok({ data: [], error: null }),
        };
        return q;
      };
      window.supabase = { createClient: () => ({ from: catena, channel: () => ({ on() { return this; }, subscribe() { return this; } }), storage: { from: () => ({}) }, auth: { getSession: async () => ({ data: { session: null } }), onAuthStateChange: () => ({}) } }) };
    });
    await page.route("**/api?action=*", (route) => route.fulfill({ status: 200, contentType: "application/json", body: "{}" }));
    await page.route("**/api?action=assistant", async (route) => {
      const req = { method: "POST", url: "/api?action=assistant", headers: { authorization: "Bearer t" }, body: JSON.parse(route.request().postData() || "{}") };
      let uscita = "", stato = 200;
      const res = { statusCode: 0, setHeader() {}, end(d) { uscita = d || ""; } };
      try { await handler(req, res); stato = res.statusCode || 200; } catch (e) { stato = 500; uscita = JSON.stringify({ error: e.message }); }
      route.fulfill({ status: stato, contentType: "application/json", body: uscita || "{}" });
    });
    await page.goto(`http://localhost:${PORT}/index.html`, { waitUntil: "networkidle" });
    const clienti = CLIENTI.map((name) => ({ id: randomUUID(), owner_id: UTENTE.id, name, phone: "3331234567", email: "", status: "attivo", value: 0, deleted_at: null }));
    tabelle = { clients: clienti.map((c) => ({ ...c })), profiles: [{ id: UTENTE.id, profession: "edile" }], conversations: [], messages: [], tasks: [], incomes: [], cartelle: [], cantiere_appunti: [], ai_request_log: [], ai_audit_log: [], ai_runs: [], eon_admin: [], app_errori: [] };
    await page.evaluate(async (clienti) => {
      document.getElementById("onboardingScreen").style.display = "none";
      currentSession = { access_token: "t", user: { id: "11111111-1111-4111-8111-111111111111", email: "a@b.it" } };
      loadUserDataFromDB = async () => {}; tokenValido = async () => "t";
      await applyProfession("edile", true);
      clients.length = 0; clienti.forEach((c) => clients.push({ id: c.id, name: c.name, phone: c.phone, email: "", status: "attivo", value: 0, desc: "", archived: false }));
      try { localStorage.setItem("eon-promemoria-proposto", "1"); } catch (e) {}
    }, clienti);

    const detta = async (frase) => page.evaluate(async (frase) => {
      chiudiRisorsaCard(); navigateTo("home");
      document.getElementById("aiToastContainer").innerHTML = "";
      await eonInviaHome(frase);
      await new Promise((r) => setTimeout(r, 50));
      const aperta = document.getElementById("risorsaOverlay").style.display === "flex";
      return {
        titolo: aperta ? document.getElementById("risorsaTitolo").textContent : null,
        righe: [...document.querySelectorAll("#vociDocumento .voci-riga")].map((r) => r.textContent.replace(/\s+/g, " ").trim()),
        somme: (document.querySelector("#vociDocumento .voci-somme") || {}).textContent || "",
        bolla: (document.querySelector("#risorsaCorpo .scheda-bolla") || {}).textContent || "",
        avviso: (document.getElementById("vociAvviso") || {}).textContent || "",
      };
    }, frase);
    const crea = async () => { await page.click("#vociCrea"); await page.waitForTimeout(300); };

    /* 1. Il preventivo lungo dell'edile */
    const aiPrima = chiamateAI;
    const frase1 = "allora eon fammi il preventivo per Mario Rossi rifacimento bagno demolizione piastrelle e sanitari 800 euro fornitura e posa pavimento 30 metri quadri a 45 euro al metro quadro rivestimento pareti 25 mq a 50 euro al mq smaltimento macerie 350 euro manodopera muratore 1200 euro iva al 10%";
    let st = await detta(frase1);
    verifica("dettato lungo → card \"Nuovo preventivo\" con le 5 voci lette", st.titolo === "Nuovo preventivo" && st.righe.length === 5, JSON.stringify(st));
    verifica("quantità × prezzo scritti sotto la voce (30 mq × € 45,00 = € 1.350,00)", st.righe.some((r) => /Posa pavimento/i.test(r) && /30 mq × € 45,00/.test(r) && /1\.350,00/.test(r)), JSON.stringify(st.righe));
    verifica("imponibile, IVA 10% e totale giusti (4.950 + 495 = 5.445)", /Imponibile€ 4\.950,00/.test(st.somme) && /IVA 10%€ 495,00/.test(st.somme) && /Totale€ 5\.445,00/.test(st.somme), st.somme);
    await crea();
    let docs = documenti();
    const d1 = docs[docs.length - 1] || {};
    verifica("\"Crea il preventivo\": salvato sul server con tutte le voci", docs.length === 1 && d1.voci && d1.voci.length === 5 && d1.voci[1].qta === 30 && d1.voci[1].prezzo === 45 && d1.aliquota === 10 && Math.abs(d1.totale - 5445) < 0.01, JSON.stringify(d1).slice(0, 400));
    verifica("per il cliente giusto (Mario Rossi)", d1.cliente === "Mario Rossi", d1.cliente);

    /* 2. Totale detto che non torna: avviso */
    st = await detta("preventivo Condominio Parco Verde ponteggio 3.500 euro idrolavaggio facciata 1.200 euro ripristino intonaci 80 metri quadri a 35 euro totale 9.000 euro");
    verifica("totale detto diverso dalle voci → avviso \"controlla\"", st.righe.length === 3 && /9\.000,00/.test(st.avviso) && /7\.500,00/.test(st.avviso), JSON.stringify(st));
    await page.click("#risorsaCorpo .scheda-scelta:nth-child(2)"); // Annulla
    await page.waitForTimeout(150);
    verifica("\"Annulla\": niente salvato", documenti().length === 1, String(documenti().length));

    /* 3. Cliente nuovo, idraulico, prezzo al pezzo e l'ora */
    st = await detta("preventivo per Giorgio Verdi 6 radiatori in alluminio a 110 euro cadauno valvole termostatiche 6 a 45 euro installazione 16 ore a 35 euro l'ora");
    verifica("cliente nuovo: la card lo dice", /Giorgio Verdi \(cliente nuovo\)/.test(st.bolla) && st.righe.length === 3, JSON.stringify(st));
    await crea();
    docs = documenti();
    const d3 = docs[docs.length - 1] || {};
    verifica("creato il cliente e il preventivo (660 + 270 + 560 = 1.490 + IVA 22%)", (tabelle.clients || []).some((c) => c.name === "Giorgio Verdi") && d3.cliente === "Giorgio Verdi" && Math.abs(d3.imponibile - 1490) < 0.01 && d3.aliquota === 22, JSON.stringify(d3).slice(0, 300));

    /* 4. Una fattura con numeri detti in lettere */
    st = await detta("fattura Rita Ambrosini ottocento euro di demolizione e milleduecento di sanitari");
    verifica("numeri in lettere: \"Nuova fattura\" con 2 voci (800 + 1.200)", st.titolo === "Nuova fattura" && st.righe.length === 2 && /Imponibile€ 2\.000,00/.test(st.somme), JSON.stringify(st));
    await crea();
    docs = documenti();
    verifica("fattura salvata", (docs[docs.length - 1] || {}).tipo === "fattura", JSON.stringify(docs[docs.length - 1] || {}).slice(0, 200));

    /* 5. Correggere a voce il preventivo appena fatto (le frasi vere di Andrea del 25-29/09) */
    const msgDoc = (tabelle.messages || []).find((m) => m.event_type === "doc" && JSON.parse(m.file_name).cliente === "Mario Rossi");
    const correggi = async (frase) => {
      const dati = JSON.parse((tabelle.messages || []).find((m) => m.id === msgDoc.id).file_name);
      await page.evaluate(([dati, id]) => { chiudiRisorsaCard(); mostraAnteprimaDocumento(dati, id, "Mario Rossi"); }, [dati, msgDoc.id]);
      await page.fill("#risorsaPiede .scheda-campo", frase);
      await page.click("#risorsaPiede .scheda-invia");
      await page.waitForTimeout(400);
      const ultima = await page.evaluate(() => [...document.querySelectorAll("#risorsaCorpo .scheda-bolla.eon")].map((b) => b.textContent).pop());
      return { dati: JSON.parse((tabelle.messages || []).find((m) => m.id === msgDoc.id).file_name), ultima };
    };
    let c = await correggi("fammela da 9.900");
    verifica('"fammela da 9.900" (5 voci): tutte in proporzione, imponibile 9.900', Math.abs(c.dati.imponibile - 9900) < 0.01 && c.dati.voci.length === 5 && /Fatto\. Totale/.test(c.ultima), JSON.stringify([c.dati.imponibile, c.ultima]));
    c = await correggi("5000 di bagno e 5000 manodopera");
    verifica('"5000 di bagno e 5000 manodopera": due voci nuove', c.dati.voci.length === 2 && c.dati.voci[0].desc === "Bagno" && c.dati.voci[1].desc === "Manodopera" && c.dati.imponibile === 10000, JSON.stringify(c.dati.voci));
    c = await correggi("Non 10000 ma 15000");
    verifica('"Non 10000 ma 15000": imponibile 15.000', Math.abs(c.dati.imponibile - 15000) < 0.01, String(c.dati.imponibile));
    c = await correggi("aggiungi smaltimento 300");
    verifica('"aggiungi smaltimento 300": una voce in più', c.dati.voci.length === 3 && c.dati.voci[2].desc === "Smaltimento" && c.dati.voci[2].prezzo === 300, JSON.stringify(c.dati.voci));
    c = await correggi("la manodopera 8000");
    verifica('"la manodopera 8000": cambia solo quella voce', c.dati.voci[1].prezzo === 8000 && c.dati.voci.length === 3, JSON.stringify(c.dati.voci));
    c = await correggi("Metti la data però al 27 settembre");
    verifica('"metti la data al 27 settembre": data 27/09/2026', c.dati.data === "27/09/2026" && /data 27\/09\/2026/.test(c.ultima), JSON.stringify([c.dati.data, c.ultima]));
    c = await correggi("iva al 10%");
    verifica('"iva al 10%": aliquota 10', c.dati.aliquota === 10, String(c.dati.aliquota));

    await page.evaluate(() => chiudiRisorsaCard());
    await detta(frase1);
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(process.env.SCREEN_DIR || "/tmp", "preventivo-voci.png") });
    await page.evaluate(() => chiudiRisorsaCard());

    verifica("mai usata l'AI: tutto col codice", chiamateAI === aiPrima, `${chiamateAI - aiPrima} chiamate`);
    verifica("nessun errore nella pagina", errori.length === 0, JSON.stringify(errori));
  } finally {
    await browser.close();
    server.kill();
  }
  console.log(fallimenti ? `\n${fallimenti} controlli falliti` : "\nTutto ok");
  process.exit(fallimenti ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
