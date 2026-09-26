/* Meno AI, punto 4 (27/09/2026): i clienti nuovi li legge il CODICE —
   nome (1-3 parole), telefono, lavoro — senza nessuna chiamata all'AI.
   Senza telefono solo con "aggiungi …" e un nome di 2-3 parole (o "aggiungi
   il cliente Rossi"). Nel dubbio: piccola AI o motore completo, come prima.
   Frasi vere dai registri di settembre.

   Gira senza rete e senza chiavi: vero handler, database e AI simulati.
   Uso:  node eval/meno-ai-clienti.test.mjs */

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
const CLIENTI = "Il professionista ha scritto o dettato questo, riguardo a un cliente: ";
const daHome = (f) => PREFISSO + `"${f}"`;
const daClienti = (f) => CLIENTI + `"${f}". Se sembra un cliente nuovo (un nome che non conosci ancora), crea la scheda con i dati che ha dato (crea_cliente).`;

/* [messaggio, clienti già in anagrafica, atteso] — atteso null = il codice non crea niente */
const casi = [
  [daHome("Aggiungi Andrea Gianardi 3476364421"), [], { nome: "Andrea Gianardi", telefono: "3476364421", lavoro: "" }],
  [daHome("Luca Ferretti 333 4455667 bagno"), [], { nome: "Luca Ferretti", telefono: "333 4455667", lavoro: "Bagno" }],
  [daHome("Aggiungi Luca Liverani"), [], { nome: "Luca Liverani", telefono: "", lavoro: "" }],
  [daHome("Aggiungi Liverani barbi"), [], { nome: "Liverani Barbi", telefono: "", lavoro: "" }],
  [daHome("aggiungi il cliente Rossi"), [], { nome: "Rossi", telefono: "", lavoro: "" }],
  [daHome("Nuovo cliente Marco De Luca 339 1234567 per rifacimento bagno"), [], { nome: "Marco De Luca", telefono: "339 1234567", lavoro: "Rifacimento bagno" }],
  [daHome("Aggiungi Mario Rossi tel 333 1234567"), [], { nome: "Mario Rossi", telefono: "333 1234567", lavoro: "" }],
  [daClienti("Franco Bake 33325 17133 impianto elettrico"), [], { nome: "Franco Bake", telefono: "33325 17133", lavoro: "Impianto elettrico" }],
  [daClienti("fABIO PRINI 34509102000 lavori tetto"), [], { nome: "Fabio Prini", telefono: "34509102000", lavoro: "Lavori tetto" }],
  [daClienti("Steve robs"), [], { nome: "Steve Robs", telefono: "", lavoro: "" }],
  // Queste NO
  [daHome("Aggiungi latte alla lista"), [], null],
  [daHome("Aggiungi pane"), [], null],
  [daHome("Chiama Rossi 333 1234567"), [], null],
  [daHome("Aggiungi Mario Rossi domani alle 10"), [], null],
  [daHome("aggiungi appunto comprare nastro"), [], null],
  [daHome("Aggiungi Luca Liverani"), ["Luca Liverani"], null], // c'è già: nessun doppione
  [daHome("Mario Rossi bagno"), [], null],
  [daClienti("Quello del tetto di via Roma"), [], null],
  [daClienti("Rossi 333 1234567 via Roma 5"), [], null],
];

for (const [messaggio, clienti, atteso] of casi) {
  databaseVuoto(); clienti.forEach(cliente); chiamateAI = [];
  const prima = tabelle.clients.length;
  const r = await chiama({ messaggio });
  const frase = messaggio.match(/"([^"]*)"/)[1];
  const nuovi = tabelle.clients.slice(prima);
  if (atteso) {
    const c = nuovi[0] || {};
    const ok = chiamateAI.length === 0 && r.corpo.stato === "concluso" && nuovi.length === 1 && c.name === atteso.nome
      && (c.phone || "") === atteso.telefono && (c.description || "") === atteso.lavoro;
    verifica(`codice: "${frase}" → ${atteso.nome}${atteso.telefono ? ", " + atteso.telefono : ""}${atteso.lavoro ? ", " + atteso.lavoro : ""}`, ok, JSON.stringify({ ai: chiamateAI.length, nuovi: nuovi.map((x) => [x.name, x.phone, x.description]) }));
  } else {
    verifica(`non dal codice: "${frase}" → decide l'AI, niente creato dal codice`, nuovi.length === 0 && chiamateAI.length >= 1, JSON.stringify({ ai: chiamateAI.length, nuovi: nuovi.map((x) => x.name) }));
  }
}

// "non Bake ma bike" subito dopo: corretto dal codice
databaseVuoto(); chiamateAI = [];
const r1 = await chiama({ messaggio: daClienti("Franco Bake 33325 17133 impianto elettrico") });
chiamateAI = [];
await chiama({ messaggio: daClienti("Non Bake ma bike"), ricordo: r1.corpo.azioni });
verifica("\"non Bake ma bike\": Franco Bike, dal codice, nessun doppione", chiamateAI.length === 0 && tabelle.clients.length === 1 && tabelle.clients[0].name === "Franco Bike", JSON.stringify({ ai: chiamateAI.length, c: tabelle.clients.map((x) => x.name) }));
// Registro
databaseVuoto(); chiamateAI = [];
await chiama({ messaggio: daHome("Aggiungi Andrea Gianardi 3476364421") });
const riga = tabelle.ai_request_log[0] || {};
verifica("registro: modello \"codice\", 0 giri, costo 0", riga.modello === "codice" && riga.giri === 0 && Number(riga.costo_usd) === 0, JSON.stringify(riga));

console.log(falliti ? `\n${falliti} controlli falliti.` : "\nTutti i controlli passati.");
if (falliti) process.exitCode = 1;
