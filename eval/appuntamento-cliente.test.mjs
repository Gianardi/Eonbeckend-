/* Appuntamento a casa di un cliente, letto dal codice (27/09/2026).
   Frasi di Andrea: "Domani casa Simone Massari per rubinetto ore 09:00
   portare attrezzi" = cliente Simone Massari (creato se non c'è),
   appuntamento domani alle 9 nella sua chat, titolo con il lavoro e la
   nota. Nessuna chiamata all'AI. Nel dubbio (nome senza maiuscole e non in
   anagrafica, omonimi, simili, senza ora, "casa mia"…) decide l'AI.
   Uso:  node eval/appuntamento-cliente.test.mjs */

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
const D1 = giornoFra(1), D2 = giornoFra(2);
const appuntamenti = () => tabelle.messages.filter((m) => m.event_type === "appt").map((m) => ({ titolo: m.title, quando: m.scheduled_at, chat: (tabelle.conversations.find((c) => c.id === m.conversation_id) || {}).contact_name }));

/* [frase, clienti già in anagrafica, atteso] — atteso null = decide l'AI */
const casi = [
  ["Domani casa Simone Massari per rubinetto ore 09:00 portare attrezzi", [], { cliente: "Simone Massari", nuovo: true, lavoro: "Rubinetto", titolo: "Da Simone Massari per rubinetto · portare attrezzi", quando: `${D1}T09:00:00` }],
  ["Domani casa Schiffini per vedere rubinetto ore 09. Portare attrezzi", [], { cliente: "Schiffini", nuovo: true, lavoro: "Vedere rubinetto", titolo: "Da Schiffini per vedere rubinetto · portare attrezzi", quando: `${D1}T09:00:00` }],
  ["Domani ore 11 Simone Massari per revisione caldaia", ["Simone Massari"], { cliente: "Simone Massari", nuovo: false, titolo: "Da Simone Massari per revisione caldaia", quando: `${D1}T11:00:00` }],
  ["Domani ore 11 Simone Massari per revisione caldaia", [], { cliente: "Simone Massari", nuovo: true, lavoro: "Revisione caldaia", titolo: "Da Simone Massari per revisione caldaia", quando: `${D1}T11:00:00` }],
  ["domani alle 10 da Rossi per la caldaia", ["Mario Rossi"], { cliente: "Mario Rossi", nuovo: false, titolo: "Da Mario Rossi per la caldaia", quando: `${D1}T10:00:00` }],
  ["Sopralluogo dopodomani alle 8:30 a casa di Luca Bianchi per il bagno", [], { cliente: "Luca Bianchi", nuovo: true, lavoro: "Il bagno", titolo: "Sopralluogo da Luca Bianchi per il bagno", quando: `${D2}T08:30:00` }],
  ["Domani alle 9 da Walter", [], { cliente: "Walter", nuovo: true, lavoro: "", titolo: "Da Walter", quando: `${D1}T09:00:00` }],
  // Queste NO: decide l'AI
  ["domani alle 10 casa rossi per rubinetto", [], null], // nome senza maiuscole e non in anagrafica
  ["Domani alle 10 casa mia per le chiavi", [], null],
  ["Domani casa Simone Massari per rubinetto", [], null], // senza ora
  ["Domani alle 10 da Dini per perdita", ["Sara Dini", "Giampiero Dini"], null], // due Dini
  ["Domani alle 10 da Fabri per perdita", ["Fabbri"], null], // simile
  ["Domani alle 10 da Rossi per bagno e poi da Verdi per cucina", [], null],
  ["Chiamare Walter domani alle 9", [], "vecchio"], // lo legge il percorso di sempre, senza cliente
];

for (const [frase, clienti, atteso] of casi) {
  databaseVuoto(); clienti.forEach(cliente); chiamateAI = [];
  const prima = tabelle.clients.length;
  const r = await chiama({ messaggio: PREFISSO + `"${frase}"` });
  const a = appuntamenti(), nuovi = tabelle.clients.slice(prima);
  if (atteso === "vecchio") {
    verifica(`"${frase}": come sempre (impegno "Chiamare Walter", nessun cliente creato)`, chiamateAI.length === 0 && nuovi.length === 0 && tabelle.tasks.some((t) => t.title === "Chiamare Walter"), JSON.stringify({ ai: chiamateAI.length, nuovi, t: tabelle.tasks.map((t) => t.title) }));
  } else if (atteso) {
    const c = nuovi[0] || {};
    const ok = chiamateAI.length === 0 && r.corpo.stato === "concluso" && a.length === 1 && a[0].titolo === atteso.titolo && a[0].quando === atteso.quando && a[0].chat === atteso.cliente
      && (atteso.nuovo ? nuovi.length === 1 && c.name === atteso.cliente && (c.description || "") === atteso.lavoro : nuovi.length === 0);
    verifica(`codice: "${frase}" → ${atteso.nuovo ? "cliente NUOVO " : "cliente "}${atteso.cliente}, "${atteso.titolo}", ${atteso.quando.replace("T", " ").slice(0, 16)}`, ok, JSON.stringify({ ai: chiamateAI.length, a, nuovi: nuovi.map((x) => [x.name, x.description]), testo: r.corpo && r.corpo.testo }));
    if (atteso.nuovo) verifica("  per l'app: cliente nato insieme all'appuntamento (una conferma sola)", JSON.stringify(r.corpo.azioni.map((x) => x.tool)) === '["trova_o_crea_cliente","crea_impegno"]' && r.corpo.azioni[0].esito.creato === true, JSON.stringify(r.corpo.azioni));
  } else {
    verifica(`AI: "${frase}" → niente scritto dal codice`, chiamateAI.length >= 1 && a.length === 0 && nuovi.length === 0, JSON.stringify({ ai: chiamateAI.length, a, nuovi: nuovi.map((x) => x.name) }));
  }
}
// Registro
databaseVuoto(); chiamateAI = [];
await chiama({ messaggio: PREFISSO + `"Domani casa Simone Massari per rubinetto ore 09:00 portare attrezzi"` });
const riga = tabelle.ai_request_log[0] || {};
verifica("registro: modello \"codice\", 0 giri, costo 0", riga.modello === "codice" && riga.giri === 0 && Number(riga.costo_usd) === 0, JSON.stringify(riga));

console.log(falliti ? `\n${falliti} controlli falliti.` : "\nTutti i controlli passati.");
if (falliti) process.exitCode = 1;
