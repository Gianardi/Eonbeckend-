/* Meno AI, fase 1 (26/09/2026): gli appuntamenti chiari li legge il CODICE,
   senza nessuna chiamata all'AI; tutto il resto passa alla piccola AI
   esattamente come prima. Frasi vere di Andrea prese dai registri di
   settembre. Per ogni frase: letta dal codice (0 chiamate, titolo, tipo,
   giorno e ora giusti) oppure lasciata all'AI (prima chiamata = la piccola
   AI con leggi_impegno, niente scritto dal codice).

   Gira senza rete e senza chiavi: vero handler, database e AI simulati.
   Uso:  node eval/meno-ai.test.mjs */

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
const scritti = () => [...tabelle.tasks.map((t) => ({ titolo: t.title, quando: t.scheduled_at, tipo: t.type || t.tipo })), ...tabelle.messages.filter((m) => m.event_type === "appt").map((m) => ({ titolo: m.title, quando: m.scheduled_at }))];

const D1 = giornoFra(1), D0 = giornoFra(0), D2 = giornoFra(2), LUN = prossimo(1), VEN = prossimo(5);

/* [frase, clienti in anagrafica, atteso] — atteso null = decide la piccola AI */
const casi = [
  ["Chiamata Valter lunedì 10:00", [], LUN && { titolo: "Chiamare Valter", quando: `${LUN}T10:00:00` }],
  ["Chiamata Valter lunedì alle 9", [], LUN && { titolo: "Chiamare Valter", quando: `${LUN}T09:00:00` }],
  ["Segna Dini domani alle 10", ["Giampiero Dini"], { titolo: "Appuntamento con Dini", quando: `${D1}T10:00:00` }],
  ["Segna appuntamento Dini domani alle 10", ["Giampiero Dini"], { titolo: "Appuntamento con Dini", quando: `${D1}T10:00:00` }],
  ["Segna appuntamento con Claudia Spori domani alle 10", ["Claudia Spori"], { titolo: "Appuntamento con Claudia Spori", quando: `${D1}T10:00:00` }],
  ["Chiamare Pippo domani alle 9", [], { titolo: "Chiamare Pippo", quando: `${D1}T09:00:00` }],
  ["domani mattina ore 11 appuntamento con Fregoli", [], { titolo: "Appuntamento con Fregoli", quando: `${D1}T11:00:00` }],
  ["Domattina ore 9 hunter", [], { titolo: "Appuntamento con Hunter", quando: `${D1}T09:00:00` }],
  ["sopralluogo Rossi dopodomani alle 8:30", [], { titolo: "Sopralluogo con Rossi", quando: `${D2}T08:30:00` }],
  ["stasera alle 8 cena con Giulia", [], { titolo: "Cena con Giulia", quando: `${D0}T20:00:00` }],
  ["venerdì pomeriggio alle 3 chiamare Bianchi", [], VEN && { titolo: "Chiamare Bianchi", quando: `${VEN}T15:00:00` }],
  // Queste NO: decide la piccola AI, come prima
  ["Fissa appuntamento domani con Alberto Zacco Hootie alle 15", [], null], // nome di 3 parole non in anagrafica
  ["lunedì alle ore 16:30 a Portovenere con Barberis", [], null], // un luogo
  ["Mi segni venerdì prossimo incontro con giudice belle ore 17", [], null], // "prossimo"
  ["Ciao come stai domani mattina ore 11:00 appuntamento con Fregoli", [], null], // parole in più
  ["giovedì alle 11 di aggiornamento ha la sede gestikon", [], null],
  ["Domani mattina chiamo Rossi", [], null], // senza ora
  ["chiamare Rossi domani alle 3", [], null], // alle 3 di notte o di pomeriggio?
  ["Appuntamento con Raspadori domani alle 10 per il bagno", [], null], // "per il bagno"
  ["Appuntamento Raspadori bagno domani alle 10", ["Raspadori"], null], // "Raspadori bagno" non è un cliente
  ["domani alle 10 e alle 12 riunione", [], null], // due orari
  ["Fra un ora incontro con Giulia", [], null],
];

for (const [frase, clienti, atteso] of casi) {
  databaseVuoto(); clienti.forEach(cliente); chiamateAI = [];
  const r = await chiama({ messaggio: PREFISSO + `"${frase}"` });
  const s = scritti();
  if (atteso) {
    const ok = chiamateAI.length === 0 && r.corpo.stato === "concluso" && s.length === 1 && s[0].titolo === atteso.titolo && s[0].quando === atteso.quando;
    verifica(`codice: "${frase}" → ${atteso.titolo}, ${atteso.quando.replace("T", " ").slice(0, 16)}`, ok, JSON.stringify({ ai: chiamateAI.length, s, r: r.corpo && r.corpo.testo }));
  } else {
    const primo = chiamateAI[0] && chiamateAI[0].tool_choice && chiamateAI[0].tool_choice.name;
    const ok = primo === "leggi_impegno" || primo === "interpreta_richiesta";
    verifica(`AI: "${frase}" → decide l'AI, niente scritto dal codice`, ok && s.length === 0, JSON.stringify({ primo, s }));
  }
}

/* Correzioni subito dopo: "no alle 11", "anzi no fai alle 10", "no domani alle 9" */
for (const [correzione, attesoOra, attesoGiorno] of [["No alle 11", "11:00", D1], ["Anzi no fai alle 10", "10:00", D1], ["no dopodomani alle 9", "09:00", D2], ["meglio alle 18:30", "18:30", D1]]) {
  databaseVuoto(); chiamateAI = [];
  const r1 = await chiama({ messaggio: PREFISSO + `"Chiamare Valter domani alle 16"` });
  const ricordo = r1.corpo.azioni.map((a) => ({ tool: a.tool, esito: a.esito }));
  chiamateAI = [];
  const r2 = await chiama({ messaggio: PREFISSO + `"${correzione}"`, ricordo });
  const s = scritti();
  verifica(`correzione dal codice: "${correzione}" → ${attesoGiorno} ${attesoOra}, stesso impegno`, chiamateAI.length === 0 && r2.corpo.stato === "concluso" && s.length === 1 && s[0].quando === `${attesoGiorno}T${attesoOra}:00`, JSON.stringify({ ai: chiamateAI.length, s }));
}
// "No Rossi alle 11" nomina un altro: non è una correzione dell'ultimo
databaseVuoto(); chiamateAI = [];
const r1 = await chiama({ messaggio: PREFISSO + `"Chiamare Valter domani alle 16"` });
chiamateAI = [];
await chiama({ messaggio: PREFISSO + `"No Rossi alle 11"`, ricordo: r1.corpo.azioni });
verifica("\"No Rossi alle 11\": il codice non lo tratta come correzione (decide l'AI), impegno invariato", chiamateAI.length >= 1 && scritti()[0].quando === `${D1}T16:00:00`);
// Registro: letto dal codice = modello "codice", 0 giri, costo 0
verifica("registro: modello \"codice\", 0 giri, costo 0", tabelle.ai_request_log[0].modello === "codice" && tabelle.ai_request_log[0].giri === 0 && Number(tabelle.ai_request_log[0].costo_usd) === 0, JSON.stringify(tabelle.ai_request_log[0]));

console.log(falliti ? `\n${falliti} controlli falliti.` : "\nTutti i controlli passati.");
if (falliti) process.exitCode = 1;
