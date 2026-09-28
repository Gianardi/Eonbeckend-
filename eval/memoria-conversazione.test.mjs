/* Memoria della giornata e tono (27/09/2026): un messaggio nuovo arriva
   all'AI con le frasi di oggi (dal registro e quelle a cui ha risposto il
   codice nell'app), e due chiacchiere non vengono rifatte con Sonnet.
   Gira SENZA chiavi e senza rete: vero handler di api/index.js, database
   e AI simulati (stesso schema di percorso-documento.test.mjs).
   Uso:  node eval/memoria-conversazione.test.mjs */

import { randomUUID } from "node:crypto";

process.env.SUPABASE_URL = "https://finto.supabase.co";
process.env.SUPABASE_ANON_KEY = "anon-finta";
process.env.SUPABASE_SERVICE_ROLE_KEY = "service-finta";
process.env.ANTHROPIC_API_KEY = "chiave-finta";

const UTENTE = { id: "11111111-1111-4111-8111-111111111111" };
const HAIKU = "claude-haiku-4-5";

/* ---------- database finto (solo quello che usano questi percorsi) ---------- */
let tabelle;
function databaseVuoto() {
  tabelle = { clients: [], conversations: [], messages: [], incomes: [], profiles: [], ai_audit_log: [], ai_request_log: [], ai_runs: [] };
}
function aggiungiCliente(nome) {
  const c = { id: randomUUID(), owner_id: UTENTE.id, name: nome, phone: null, status: "attivo", deleted_at: null };
  tabelle.clients.push(c);
  return c;
}
function filtra(righe, params) {
  return righe.filter((r) => {
    for (const [k, v] of params) {
      if (["select", "limit", "order", "or"].includes(k)) continue;
      if (v === "is.null") { if (r[k] != null) return false; continue; }
      if (v === "not.is.null") { if (r[k] == null) return false; continue; }
      if (v.startsWith("eq.")) { if (String(r[k]) !== v.slice(3)) return false; continue; }
      if (v.startsWith("gte.")) { if (!(String(r[k]) >= v.slice(4))) return false; continue; }
      if (v.startsWith("ilike.")) {
        const cerca = v.slice(6).replace(/\*/g, "").toLowerCase();
        if (!String(r[k] || "").toLowerCase().includes(cerca)) return false;
        continue;
      }
    }
    return true;
  });
}
function rispostaJson(obj, status = 200) {
  return new Response(obj === null ? "" : JSON.stringify(obj), { status, headers: { "content-type": "application/json" } });
}
function postgrest(url, init) {
  const u = new URL(url);
  const percorso = u.pathname.replace("/rest/v1/", "");
  if (percorso === "rpc/ai_check_rate_limit") return rispostaJson(true);
  const tabella = percorso;
  if (!tabelle[tabella]) tabelle[tabella] = [];
  const params = [...u.searchParams.entries()];
  const metodo = (init && init.method) || "GET";
  if (metodo === "GET") return rispostaJson(filtra(tabelle[tabella], params));
  if (metodo === "POST") {
    const corpo = JSON.parse(init.body);
    const riga = { id: randomUUID(), created_at: new Date().toISOString(), deleted_at: null, ...corpo };
    tabelle[tabella].push(riga);
    return rispostaJson([riga], 201);
  }
  if (metodo === "PATCH") {
    const corpo = JSON.parse(init.body);
    const toccate = filtra(tabelle[tabella], params);
    toccate.forEach((r) => Object.assign(r, corpo));
    return rispostaJson(toccate);
  }
  return rispostaJson([], 200);
}

/* ---------- AI finta: ogni scenario dà una funzione per ogni chiamata ---------- */
let copione;
let chiamateAI;
function anthropicFinto(init) {
  const corpo = JSON.parse(init.body);
  chiamateAI.push(corpo);
  const passo = copione[chiamateAI.length - 1];
  if (!passo) throw new Error(`Chiamata all'AI n. ${chiamateAI.length} non prevista dallo scenario`);
  const risposta = passo(corpo);
  return rispostaJson({ id: "msg_finto", type: "message", role: "assistant", model: corpo.model, usage: { input_tokens: 1000, output_tokens: 200, cache_read_input_tokens: 18000 }, ...risposta });
}
const usaStrumento = (name, input) => ({ content: [{ type: "tool_use", id: "toolu_" + randomUUID().slice(0, 8), name, input }], stop_reason: "tool_use" });
const rispondiTesto = (text) => ({ content: [{ type: "text", text }], stop_reason: "end_turn" });
/* Legge dall'ultimo tool_result mandato all'AI il cliente risolto: così
   lo scenario "percorso libero" usa l'id vero, come farebbe il modello. */
function clienteRisoltoDa(corpo) {
  for (let i = corpo.messages.length - 1; i >= 0; i--) {
    const m = corpo.messages[i];
    if (m.role !== "user" || !Array.isArray(m.content)) continue;
    for (const b of m.content) {
      try { const j = JSON.parse(b.content); if (j.cliente_risolto) return j.cliente_risolto; } catch { /* non JSON */ }
    }
  }
  return null;
}

globalThis.fetch = async (url, init) => {
  const s = String(url);
  if (s.startsWith("https://api.anthropic.com/")) return anthropicFinto(init);
  if (s.startsWith(process.env.SUPABASE_URL + "/auth/v1/user")) return rispostaJson(UTENTE);
  if (s.startsWith(process.env.SUPABASE_URL + "/rest/v1/")) return postgrest(s, init);
  throw new Error("fetch non prevista nel test: " + s);
};

const { default: handler } = await import("../api/index.js");

/* frase: stringa, oppure { frase, ricordo } dove ricordo è il testo delle
   note di contesto/focus che il frontend aggiunge dopo la frase (vedi
   notaContestoRecente/notaFocusCorrente in index.html). */
async function chiedi(frase, extra) {
  const testo = typeof frase === "string" ? frase : frase.frase;
  const ricordo = typeof frase === "string" ? "" : frase.ricordo;
  const req = {
    method: "POST",
    url: "/api?action=assistant",
    headers: { authorization: "Bearer token-finto" },
    body: { messaggio: `Il professionista ti ha appena raccontato cosa deve fare: "${testo}"${ricordo}`, ...(extra || {}) },
  };
  let uscita = "";
  const res = { statusCode: 0, setHeader() {}, end(d) { uscita = d || ""; } };
  await handler(req, res);
  return { status: res.statusCode, corpo: uscita ? JSON.parse(uscita) : null };
}

/* ---------- controlli ---------- */
let falliti = 0;
function verifica(descrizione, condizione, dettaglio) {
  console.log(`  ${condizione ? "OK  " : "FAIL"} ${descrizione}${condizione || dettaglio === undefined ? "" : "  — " + dettaglio}`);
  if (!condizione) falliti++;
}
const testoDi = (m) => (typeof m.content === "string" ? m.content : m.content.map((b) => b.text || "").join(""));
const fa = (minuti) => new Date(Date.now() - minuti * 60000).toISOString();

console.log("\n=== Memoria: le frasi di oggi arrivano all'AI, in ordine ===");
databaseVuoto();
tabelle.ai_request_log.push(
  { owner_id: UTENTE.id, created_at: fa(60 * 20), tipo: "nuovo", messaggio: 'Il professionista ti ha appena raccontato cosa deve fare: "frase di ieri"', risposta: "vecchia", strumenti: [] },
  { owner_id: "22222222-2222-4222-8222-222222222222", created_at: fa(5), tipo: "nuovo", messaggio: 'Il professionista ti ha appena raccontato cosa deve fare: "frase di un altro"', risposta: "no", strumenti: [] },
  { owner_id: UTENTE.id, created_at: fa(30), tipo: "nuovo", messaggio: 'Il professionista ti ha appena raccontato cosa deve fare: "Domattina ore 9 con Montecchi in UniCredit"\n\n[Contesto: pochi istanti fa hai usato "crea_impegno"]', risposta: "", strumenti: ["interpreta_richiesta", "crea_impegno"] },
  { owner_id: UTENTE.id, created_at: fa(20), tipo: "conferma", messaggio: null, risposta: "Fatto.", strumenti: ["manda_messaggio"] },
);
chiamateAI = [];
copione = [
  () => usaStrumento("interpreta_richiesta", { operazione: "consulta", oggetto: "azione" }),
  () => rispondiTesto("Sì: dopo Montecchi alle 9 non hai altro."),
  () => rispondiTesto("Sì: dopo Montecchi alle 9 non hai altro."), // risposta con numeri senza strumenti: ricontrollata da Sonnet
];
let r = await chiedi("Poi giornata libera?", { recentiLocali: [
  { domanda: "Domani alle 15 sono libero?", risposta: "Sì, sei libero: Sì, domani alle 15:00 sei libero.", quando: fa(10) },
  { domanda: "vecchissima", risposta: "x", quando: fa(60 * 30) },
] });
const primo = chiamateAI[0];
const msg = primo ? primo.messages : [];
const testi = msg.map((m) => m.role + ": " + testoDi(m));
verifica("turno riuscito", r.status === 200, JSON.stringify(r));
verifica("4 messaggi di memoria + la frase nuova", msg.length === 5, JSON.stringify(testi, null, 1));
verifica("in ordine: Montecchi (registro, 30 min fa), poi \"sono libero?\" (codice, 10 min fa)", /Domattina ore 9 con Montecchi/.test(testi[0] || "") && /Domani alle 15 sono libero/.test(testi[2] || ""), JSON.stringify(testi));
verifica("dal registro solo la frase detta, senza le note di contesto", !/Contesto:|Il professionista/.test(testi[0] || ""), testi[0]);
verifica("azioni già fatte segnate nella risposta (senza interpreta_richiesta)", /azioni già fatte: crea_impegno\]/.test(testi[1] || "") && !/interpreta_richiesta/.test(testi[1] || ""), testi[1]);
verifica("ruoli alternati, ultima è la frase nuova dell'utente", msg.every((m, i) => m.role === (i % 2 ? "assistant" : "user")) && /Poi giornata libera/.test(testi[4] || ""), JSON.stringify(msg.map((m) => m.role)));
verifica("niente frasi di ieri, di altri utenti o troppo vecchie", !testi.some((t) => /ieri|un altro|vecchissima/.test(t)), JSON.stringify(testi));
const sistema = primo ? JSON.stringify(primo.system) : "";
verifica("il prompt spiega la memoria (azioni già fatte, non rifarle) e il tono", /MEMORIA DELLA GIORNATA/.test(sistema) && /non rifarle mai/.test(sistema) && /COME PARLI/.test(sistema));

console.log("\n=== Memoria vuota: la frase va da sola, come prima ===");
databaseVuoto();
chiamateAI = [];
copione = [
  () => usaStrumento("interpreta_richiesta", { operazione: "consulta", oggetto: "nessuno" }),
  () => rispondiTesto("Ciao! Dimmi pure."),
];
r = await chiedi("ehi come butta");
verifica("un solo messaggio all'AI", chiamateAI[0] && chiamateAI[0].messages.length === 1, chiamateAI[0] && JSON.stringify(chiamateAI[0].messages));

console.log("\n=== Due chiacchiere: basta Haiku, niente secondo tentativo con Sonnet ===");
databaseVuoto();
chiamateAI = [];
copione = [
  () => usaStrumento("interpreta_richiesta", { operazione: "consulta", oggetto: "nessuno" }),
  () => rispondiTesto("Giornata pesante, eh. Riposati: domani ci pensiamo insieme."),
];
r = await chiedi("sono stanco morto oggi");
verifica("due chiamate, tutte Haiku", chiamateAI.length === 2 && chiamateAI.every((c) => c.model === HAIKU), JSON.stringify(chiamateAI.map((c) => c.model)));
verifica("risposta di conversazione arrivata", r.corpo && /Riposati/.test(r.corpo.testo || ""), JSON.stringify(r.corpo));

console.log("\n=== Chiacchiera con un numero dentro: per sicurezza si ricontrolla con Sonnet ===");
databaseVuoto();
chiamateAI = [];
copione = [
  () => usaStrumento("interpreta_richiesta", { operazione: "consulta", oggetto: "nessuno" }),
  () => rispondiTesto("Hai 3 lavori questa settimana."),
  () => rispondiTesto("Non ho abbastanza dati per dirlo."),
];
r = await chiedi("come sto messo");
verifica("terza chiamata con Sonnet", chiamateAI.length === 3 && chiamateAI[2].model !== HAIKU, JSON.stringify(chiamateAI.map((c) => c.model)));

console.log("\n=== Una richiesta di azione senza strumenti: resta il ripiego su Sonnet ===");
databaseVuoto();
chiamateAI = [];
copione = [
  () => usaStrumento("interpreta_richiesta", { operazione: "crea", oggetto: "azione" }),
  () => rispondiTesto("Ok."),
  () => rispondiTesto("Ok, fatto."),
];
r = await chiedi("segnami di comprare il silicone");
verifica("ripiego su Sonnet come prima", chiamateAI.length === 3 && chiamateAI[2].model !== HAIKU, JSON.stringify(chiamateAI.map((c) => c.model)));

console.log("\n=== Cache di 1 ora per le istruzioni, e costo giusto nel registro (28/09/2026) ===");
databaseVuoto();
chiamateAI = [];
copione = [
  () => ({ ...usaStrumento("interpreta_richiesta", { operazione: "consulta", oggetto: "nessuno" }), usage: { input_tokens: 100, output_tokens: 50, cache_creation_input_tokens: 24000, cache_creation: { ephemeral_1h_input_tokens: 24000, ephemeral_5m_input_tokens: 0 }, cache_read_input_tokens: 0 } }),
  () => ({ ...rispondiTesto("Buona serata!"), usage: { input_tokens: 100, output_tokens: 50, cache_creation_input_tokens: 0, cache_read_input_tokens: 24000 } }),
];
r = await chiedi("vado a casa");
const sistemaPrimo = chiamateAI[0] && chiamateAI[0].system;
verifica("istruzioni in cache per 1 ora; data e ora fuori dalla cache", Array.isArray(sistemaPrimo) && sistemaPrimo[0].cache_control && sistemaPrimo[0].cache_control.type === "ephemeral" && sistemaPrimo[0].cache_control.ttl === "1h" && !sistemaPrimo[1].cache_control, JSON.stringify(sistemaPrimo && sistemaPrimo.map((b) => b.cache_control || null)));
verifica("stessa cache anche al secondo giro (nessun cambio alle istruzioni)", chiamateAI[1] && JSON.stringify(chiamateAI[1].system[0]) === JSON.stringify(sistemaPrimo[0]));
const rigaCosto = tabelle.ai_request_log[tabelle.ai_request_log.length - 1];
// Haiku: 100×1 + 50×5 + 24000×2 (scrittura 1 ora) + poi 100×1 + 50×5 + 24000×0,1 = 0,0511 $
verifica("costo nel registro: scrittura di 1 ora contata 2×, lettura 0,1× ($0,0511)", rigaCosto && Number(rigaCosto.costo_usd) === 0.0511, rigaCosto && rigaCosto.costo_usd);

console.log("\n=== \"Ricordami di chiamare Pedro\" senza quando: appunto da fare, non calendario (28/09/2026) ===");
databaseVuoto();
chiamateAI = [];
copione = [
  () => usaStrumento("interpreta_richiesta", { operazione: "crea", oggetto: "azione" }),
  () => usaStrumento("crea_appunto", { testo: "Chiamare Pedro", da_fare: true }),
  () => rispondiTesto("Segnato negli appunti da fare."),
];
r = await chiedi("ricordami di chiamare Pedro");
const istruzioni = JSON.stringify(chiamateAI[0] && chiamateAI[0].system);
const strumentiAI = (chiamateAI[0] && chiamateAI[0].tools) || [];
const schemaAppunto = strumentiAI.find((t) => t.name === "crea_appunto");
verifica("regola nelle istruzioni: senza giorno né ora → crea_appunto da_fare, in calendario solo con un giorno o un'ora", /crea_appunto e da_fare: true/.test(istruzioni) && /In calendario va solo quello che ha un giorno o un'ora/.test(istruzioni) && !/primo giorno utile, alle 08:00 — non lasciare mai/.test(istruzioni));
verifica("crea_appunto ha il campo da_fare", schemaAppunto && schemaAppunto.input_schema.properties.da_fare && schemaAppunto.input_schema.properties.da_fare.type === "boolean");
const appunto = (tabelle.cantiere_appunti || [])[0];
verifica("salvato negli appunti con da_fare, nessun impegno in calendario", appunto && appunto.da_fare === true && appunto.testo === "Chiamare Pedro" && !(tabelle.tasks || []).length && !(tabelle.messages || []).length, JSON.stringify({ appunto, tasks: tabelle.tasks }));
const azioneAppunto = (r.corpo.azioni || []).find((x) => x.tool === "crea_appunto");
verifica("l'app riceve da_fare nell'esito (per la lista in Home)", azioneAppunto && azioneAppunto.esito.da_fare === true, JSON.stringify(r.corpo));

console.log(falliti ? `\n${falliti} controlli FALLITI.` : "\nTutti i controlli passati.");
if (falliti) process.exitCode = 1;
