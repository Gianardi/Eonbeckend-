/* Appunto di un cliente (27/09/2026). Andrea: "Per la caldaia di Baudi
   ricordarsi sportello 12 e attrezzi" → l'appunto va nella scheda di Baudi
   e sul suo appuntamento in calendario, non negli appunti generali.
   Nessuna chiamata all'AI. Senza un cliente nominato (o con un giorno/ora,
   o con altre richieste) → come prima.
   Uso:  node eval/appunto-cliente.test.mjs */

import { randomUUID } from "node:crypto";

process.env.SUPABASE_URL = "https://finto.supabase.co";
process.env.SUPABASE_ANON_KEY = "anon-finta";
process.env.SUPABASE_SERVICE_ROLE_KEY = "service-finta";
process.env.ANTHROPIC_API_KEY = "chiave-finta";

const UTENTE = { id: "11111111-1111-4111-8111-111111111111" };
const PREFISSO = "Il professionista ti ha appena raccontato cosa deve fare: ";
const roma = (d) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
const giornoFra = (n) => roma(new Date(Date.now() + n * 86400000));
const settimanaOggi = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }[new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Rome", weekday: "short" }).format(new Date())];
function prossimo(giorno) { // 0=domenica ... null se è oggi (allora decide l'AI)
  const diff = (giorno - settimanaOggi + 7) % 7;
  return diff === 0 ? null : giornoFra(diff);
}

let tabelle, chiamateAI;
function databaseVuoto() {
  tabelle = { clients: [], conversations: [], messages: [], tasks: [], incomes: [], profiles: [], ai_audit_log: [], ai_request_log: [], ai_runs: [] };
}
function cliente(nome) { tabelle.clients.push({ id: randomUUID(), owner_id: UTENTE.id, name: nome, phone: null, status: "attivo", deleted_at: null }); }
function filtra(righe, params) {
  return righe.filter((r) => {
    for (const [k, v] of params) {
      if (["select", "limit", "order", "or"].includes(k)) continue;
      if (v === "is.null") { if (r[k] != null) return false; continue; }
      if (v === "not.is.null") { if (r[k] == null) return false; continue; }
      if (v.startsWith("eq.")) { if (String(r[k]) !== v.slice(3)) return false; continue; }
      if (v.startsWith("in.(")) { if (!v.slice(4, -1).split(",").includes(String(r[k]))) return false; continue; }
      if (v.startsWith("gte.")) { if (r[k] == null || String(r[k]) < v.slice(4)) return false; continue; }
      if (v.startsWith("ilike.")) {
        const grezzo = v.slice(6), cerca = grezzo.replace(/\\(.)/g, "$1").replace(/\*/g, "").toLowerCase(), valore = String(r[k] || "").toLowerCase();
        if (grezzo.includes("*") ? !valore.includes(cerca) : valore !== cerca) return false;
      }
    }
    return true;
  });
}
const json = (o, status = 200) => new Response(o === null ? "" : JSON.stringify(o), { status, headers: { "content-type": "application/json" } });
function postgrest(url, init) {
  const u = new URL(url), tabella = u.pathname.replace("/rest/v1/", "");
  if (tabella === "rpc/ai_check_rate_limit") return json(true);
  if (!tabelle[tabella]) tabelle[tabella] = [];
  const params = [...u.searchParams.entries()], metodo = (init && init.method) || "GET";
  if (metodo === "GET") return json(filtra(tabelle[tabella], params));
  if (metodo === "POST") { const riga = { id: randomUUID(), created_at: new Date().toISOString(), deleted_at: null, ...JSON.parse(init.body) }; tabelle[tabella].push(riga); return json([riga], 201); }
  if (metodo === "PATCH") { const t = filtra(tabelle[tabella], params); t.forEach((r) => Object.assign(r, JSON.parse(init.body))); return json(t); }
  return json([]);
}
// L'AI finta risponde sempre "altro" (piccola AI) e poi una domanda (motore): qui conta solo SE viene chiamata
globalThis.fetch = async (url, init) => {
  const s = String(url);
  if (s.startsWith("https://api.anthropic.com/")) {
    const corpo = JSON.parse(init.body);
    chiamateAI.push(corpo);
    const nome = corpo.tool_choice && corpo.tool_choice.name;
    const content = nome === "leggi_impegno" ? [{ type: "tool_use", id: "t1", name: "leggi_impegno", input: { azione: "altro" } }]
      : nome === "interpreta_richiesta" ? [{ type: "tool_use", id: "t2", name: "interpreta_richiesta", input: { operazione: "crea", oggetto: "azione" } }]
      : [{ type: "text", text: "Ok." }];
    return json({ id: "m", type: "message", role: "assistant", model: corpo.model, usage: { input_tokens: 10, output_tokens: 5 }, content, stop_reason: content[0].type === "tool_use" ? "tool_use" : "end_turn" });
  }
  if (s.startsWith(process.env.SUPABASE_URL + "/auth/v1/user")) return json(UTENTE);
  if (s.startsWith(process.env.SUPABASE_URL + "/rest/v1/")) return postgrest(s, init);
  throw new Error("fetch non prevista: " + s);
};
const { default: handler } = await import("../api/index.js");
async function chiama(body) {
  const req = { method: "POST", url: "/api?action=assistant", headers: { authorization: "Bearer t" }, body };
  let uscita = ""; const res = { statusCode: 0, setHeader() {}, end(d) { uscita = d || ""; } };
  await handler(req, res);
  return { status: res.statusCode, corpo: uscita ? JSON.parse(uscita) : null };
}

let falliti = 0;
function verifica(descrizione, condizione, dettaglio) {
  console.log(`  ${condizione ? "OK  " : "FAIL"} ${descrizione}${condizione || dettaglio === undefined ? "" : "  — " + dettaglio}`);
  if (!condizione) falliti++;
}
const D1 = giornoFra(1), D3 = giornoFra(3);
function conAppuntamento(nome, titolo, quando) {
  cliente(nome);
  const conv = { id: randomUUID(), owner_id: UTENTE.id, contact_name: nome, deleted_at: null };
  tabelle.conversations.push(conv);
  tabelle.messages.push({ id: randomUUID(), conversation_id: conv.id, event_type: "appt", title: titolo, scheduled_at: quando, deleted_at: null });
}
const appunti = () => (tabelle.cantiere_appunti || []);

// 1. La frase di Andrea: cliente con un appuntamento venerdì
databaseVuoto(); chiamateAI = [];
conAppuntamento("Baudi", "Da Baudi per caldaia", `${D3}T15:00:00`);
tabelle.messages.push({ id: randomUUID(), conversation_id: tabelle.conversations[0].id, event_type: "appt", title: "Vecchio", scheduled_at: "2020-01-01T09:00:00", deleted_at: null });
let r = await chiama({ messaggio: PREFISSO + '"Per la caldaia di Baudi ricordarsi sportello 12 e attrezzi"' });
const baudi = tabelle.clients[0];
let a = appunti()[0] || {};
const app = tabelle.messages.find((m) => m.title.startsWith("Da Baudi")) || {};
verifica("\"Per la caldaia di Baudi ricordarsi sportello 12 e attrezzi\": appunto nella scheda di Baudi, senza AI",
  chiamateAI.length === 0 && appunti().length === 1 && a.client_id === baudi.id && a.testo === "Per la caldaia di Baudi ricordarsi sportello 12 e attrezzi", JSON.stringify({ ai: chiamateAI.length, a }));
verifica("e sul suo prossimo appuntamento (non su quello vecchio): \"Da Baudi per caldaia · ricordarsi sportello 12 e attrezzi\"",
  app.title === "Da Baudi per caldaia · ricordarsi sportello 12 e attrezzi" && tabelle.messages.find((m) => m.title === "Vecchio"), app.title);
verifica("la risposta dice dove l'ha messo", /^Appunto su Baudi e sull'appuntamento di /.test(r.corpo.testo) && r.corpo.azioni[0].esito.client_id === baudi.id, r.corpo.testo);
const riga = tabelle.ai_request_log[0] || {};
verifica("registro: modello \"codice\", 0 giri", riga.modello === "codice" && riga.giri === 0, JSON.stringify(riga));

// 2. Cliente senza appuntamenti: solo nella scheda
databaseVuoto(); chiamateAI = [];
cliente("Simone Massari");
r = await chiama({ messaggio: PREFISSO + '"Simone Massari ricordarsi che vuole le piastrelle grigie"' });
a = appunti()[0] || {};
verifica("cliente senza appuntamenti: appunto nella sua scheda", chiamateAI.length === 0 && a.client_id === tabelle.clients[0].id && r.corpo.testo === "Appunto su Simone Massari.", JSON.stringify({ ai: chiamateAI.length, a, t: r.corpo.testo }));

// 3. Solo il cognome con la maiuscola, di un solo cliente
databaseVuoto(); chiamateAI = [];
cliente("Simone Massari"); cliente("Rita Ambrosini");
await chiama({ messaggio: PREFISSO + '"Da Massari portare la chiave inglese"' });
a = appunti()[0] || {};
verifica("\"Da Massari portare la chiave inglese\": è di Simone Massari", chiamateAI.length === 0 && a.client_id === tabelle.clients[0].id, JSON.stringify({ ai: chiamateAI.length, a }));

// 4. NON sono appunti di un cliente
for (const [frase, clienti] of [
  ["Ricordarsi di comprare il silicone", ["Baudi"]],        // nessun cliente → appunto generale (AI/app come prima)
  ["Per Baudi ricordarsi domani alle 9 lo sportello", ["Baudi"]], // giorno e ora → è un appuntamento
  ["Ricordami di chiamare Baudi", ["Baudi"]],                // chiamare → impegno
  ["Segna che Baudi ha pagato 500 euro", ["Baudi"]],         // incasso
  ["Per Rossi ricordarsi lo sportello", ["Mario Rossi", "Luca Rossi"]], // due Rossi
]) {
  databaseVuoto(); clienti.forEach(cliente); chiamateAI = [];
  await chiama({ messaggio: PREFISSO + `"${frase}"` });
  verifica(`non dal codice: "${frase}"`, !appunti().some((x) => x.client_id) && chiamateAI.length >= 1, JSON.stringify({ ai: chiamateAI.length, a: appunti() }));
}

/* "Di' a Rita Ambrosini che ci vediamo domani alle 11" (Andrea, 27/09/2026):
   appuntamento da confermare + messaggio a Rita, senza AI e senza "quale
   delle due" (due clienti con lo stesso nome sono la stessa persona). */
databaseVuoto(); chiamateAI = [];
tabelle.clients.push({ id: randomUUID(), owner_id: UTENTE.id, name: "Rita Ambrosini", status: "attivo", is_archived: false, deleted_at: null, created_at: "2026-08-04T19:12:16Z" });
tabelle.clients.push({ id: randomUUID(), owner_id: UTENTE.id, name: "Rita Ambrosini", status: "trattativa", is_archived: true, deleted_at: null, created_at: "2026-09-26T20:39:50Z" });
r = await chiama({ messaggio: PREFISSO + '"Di a Rita Ambrosini che ci vediamo domani alle 11"' });
const appRita = tabelle.messages.filter((m) => m.event_type === "appt");
const msgRita = tabelle.messages.filter((m) => !m.event_type && m.sender === "me");
verifica("\"Di a Rita Ambrosini che ci vediamo domani alle 11\": appuntamento da confermare, domani alle 11, senza AI e senza \"quale\"",
  chiamateAI.length === 0 && appRita.length === 1 && appRita[0].title === "Appuntamento con Rita Ambrosini (da confermare)" && String(appRita[0].scheduled_at).startsWith(`${D1}T11:00`) && !/quale/i.test(r.corpo.testo),
  JSON.stringify({ ai: chiamateAI.length, appRita, testo: r.corpo.testo }));
verifica("e il messaggio a Rita nella sua chat: \"Ciao Rita, ci vediamo domani alle 11 (…). Mi confermi?\"",
  msgRita.length === 1 && /^Ciao Rita, ci vediamo domani alle 11 \(.+\)\. Mi confermi\?$/.test(msgRita[0].body) && msgRita[0].conversation_id === appRita[0].conversation_id,
  JSON.stringify(msgRita));
verifica("la risposta spiega cosa succede dopo", /da confermare/.test(r.corpo.testo) && /Se risponde sì lo confermo, se dice no lo tolgo/.test(r.corpo.testo), r.corpo.testo);

databaseVuoto(); chiamateAI = [];
cliente("Mario Rossi");
r = await chiama({ messaggio: PREFISSO + '"Di a Mario Rossi che arrivo con 10 minuti di ritardo"' });
verifica("\"Di a Mario Rossi che arrivo con 10 minuti di ritardo\": solo il messaggio, nessun appuntamento",
  chiamateAI.length === 0 && !tabelle.messages.some((m) => m.event_type === "appt") && tabelle.messages.some((m) => m.body === "Ciao Mario, arrivo con 10 minuti di ritardo."),
  JSON.stringify({ ai: chiamateAI.length, m: tabelle.messages }));

databaseVuoto(); chiamateAI = [];
cliente("Mario Rossi");
await chiama({ messaggio: PREFISSO + '"Di a Giorgio che ci vediamo domani alle 11"' });
verifica("cliente che non c'è: decide l'AI, niente scritto dal codice", chiamateAI.length >= 1 && tabelle.messages.length === 0, JSON.stringify({ ai: chiamateAI.length }));

console.log(falliti ? `\n${falliti} controlli falliti.` : "\nTutti i controlli passati.");
if (falliti) process.exitCode = 1;
