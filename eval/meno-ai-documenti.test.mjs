/* Meno AI, punto 2 (27/09/2026): fatture e preventivi chiari li scrive il
   CODICE, senza AI — un tipo, un importo, il nome completo di un cliente già
   in anagrafica, e il lavoro. Tutto il resto va all'AI come prima.
   Frasi vere di Andrea prese dai registri di settembre.

   Gira senza rete e senza chiavi: vero handler, database e AI simulati.
   Uso:  node eval/meno-ai-documenti.test.mjs */

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
const documenti = () => tabelle.messages.filter((m) => m.event_type === "doc").map((m) => JSON.parse(m.file_name));

/* [frase, clienti in anagrafica, atteso] — atteso null = decide l'AI */
const casi = [
  ["Crea preventivo per Michele possa da 150 + IVA per camera da letto", ["Michele Possa"], { tipo: "preventivo", cliente: "Michele Possa", prezzo: 150, lavoro: "Camera da letto" }],
  ["Crea preventivo per bagno doccia liberano Piero da 35.090", ["Piero Liberano"], { tipo: "preventivo", cliente: "Piero Liberano", prezzo: 35090, lavoro: "Bagno doccia" }],
  ["Mi fai preventivo Lombardi per finestre 1200 €", ["Lombardi"], { tipo: "preventivo", cliente: "Lombardi", prezzo: 1200, lavoro: "Finestre" }],
  ["Preventivo per Raspadori da 3000 per pulizia scale e pitturazione", ["Raspadori"], { tipo: "preventivo", cliente: "Raspadori", prezzo: 3000, lavoro: "Pulizia scale e pitturazione" }],
  ["Mi crei preventivo per raspadori per pulizia scale e pitturazione da 3000 euro", ["Raspadori", "Tommaso Greti"], { tipo: "preventivo", cliente: "Raspadori", prezzo: 3000, lavoro: "Pulizia scale e pitturazione" }],
  ["Fattura da 1500 per Tommaso greti per fognatura", ["Tommaso Greti"], { tipo: "fattura", cliente: "Tommaso Greti", prezzo: 1500, lavoro: "Fognatura" }],
  ["Preventivo facciata e tetto da 150.000 per Walter tesi", ["Walter Tesi"], { tipo: "preventivo", cliente: "Walter Tesi", prezzo: 150000, lavoro: "Facciata e tetto" }],
  ["fammi una fattura per Testolina da 100 euro per una prova", ["Testolina"], { tipo: "fattura", cliente: "Testolina", prezzo: 100, lavoro: "Prova" }],
  ["Mi crei fattura per Grimaldi da 300 + iva per cambio porte", ["Grimaldi"], { tipo: "fattura", cliente: "Grimaldi", prezzo: 300, lavoro: "Cambio porte" }],
  ["Mi fai fattura Bellini da 59.999 per tetto e facciata", ["Bellini"], { tipo: "fattura", cliente: "Bellini", prezzo: 59999, lavoro: "Tetto e facciata" }],
  ["Fattura Dini Mirco da 3000 euro per pulizia, sgombero e stuccate", ["Mirco Dini"], { tipo: "fattura", cliente: "Mirco Dini", prezzo: 3000, lavoro: "Pulizia, sgombero e stuccate" }],
  ["Crea fattura Hannah trick da 259 più iva per pitturazione cucina", ["Hannah Trick"], { tipo: "fattura", cliente: "Hannah Trick", prezzo: 259, lavoro: "Pitturazione cucina" }],
  ["mi fai fattura da 500 + iva per bianchi per intervento pitturazioni muri", ["Bianchi"], { tipo: "fattura", cliente: "Bianchi", prezzo: 500, lavoro: "Intervento pitturazioni muri" }],
  ["Crea preventivo per lavori facciata al Linda Ferri 30.500", ["Linda Ferri"], { tipo: "preventivo", cliente: "Linda Ferri", prezzo: 30500, lavoro: "Lavori facciata" }],
  ["Crea preventivo a Linda ferri per facciata 30.500", ["Linda Ferri"], { tipo: "preventivo", cliente: "Linda Ferri", prezzo: 30500, lavoro: "Facciata" }],
  ["Mi crei preventivo da 200 euro per pitturazione bagno per spori Claudia?", ["Claudia Spori"], { tipo: "preventivo", cliente: "Claudia Spori", prezzo: 200, lavoro: "Pitturazione bagno" }],
  ["Mi crei fattura da 300 per pitturazioni dini Giampiero", ["Giampiero Dini"], { tipo: "fattura", cliente: "Giampiero Dini", prezzo: 300, lavoro: "Pitturazioni" }],
  ["Fattura a Rossi 1.250,50 per riparazione caldaia", ["Rossi"], { tipo: "fattura", cliente: "Rossi", prezzo: 1250.5, lavoro: "Riparazione caldaia" }],
  // Queste NO: decide l'AI, come prima
  ["Mi serve preventivo Piero Liberano", ["Piero Liberano"], null], // nessun importo
  ["Fattura da 300 + IVA per Michele soda studio progetto e pitturazione locali", [], null], // cliente nuovo: nome e lavoro non separabili dal codice
  ["Fattura Dini da 300 per pitturazione", ["Dini", "Giampiero Dini"], null], // "Dini" è anche parte di "Giampiero Dini"
  ["Fattura Dini da 300 per pitturazione", ["Sara Dini", "Giampiero Dini"], null], // nome a metà, due Dini
  ["Mi fai preventivo Lombardi per finestre 1200", ["Mario Lombardi"], null], // nome a metà
  ["Fattura a Rossi 300 euro iva inclusa per porta", ["Rossi"], null],
  ["Preventivo a Rossi per 2 porte a 300", ["Rossi"], null], // due numeri
  ["Fattura a Rossi da 300 per porta e mandala su whatsapp", ["Rossi"], null],
  ["Fattura di acconto 30% a Rossi per bagno", ["Rossi"], null],
  ["Preventivo e fattura per Rossi da 300 per porta", ["Rossi"], null],
  ["Fattura a Rossi e Bianchi da 300 per porta", ["Rossi", "Bianchi"], null],
  ["Fattura a Rossi da 3 mila per bagno", ["Rossi"], null],
  ["Fattura a Rossi da 300 per porta domani", ["Rossi"], null],
  ["Fattura a Rossi da 300", ["Rossi"], null], // manca il lavoro
  ["Fattura a Rossi 20 ore di lavoro", ["Rossi"], null],
  ["Modifica la fattura di Rossi a 300 per porta", ["Rossi"], null],
  ["Fattura a Rossi da 1.5 per bagno", ["Rossi"], null], // 1,5 o 1.500? decide l'AI
];

for (const [frase, clienti, atteso] of casi) {
  databaseVuoto(); clienti.forEach(cliente); chiamateAI = [];
  const r = await chiama({ messaggio: PREFISSO + `"${frase}"` });
  const d = documenti();
  if (atteso) {
    const doc = d[0] || {};
    const voce = (doc.voci || [])[0] || {};
    const entrata = tabelle.incomes[0];
    const ok = chiamateAI.length === 0 && r.corpo.stato === "concluso" && d.length === 1 && doc.tipo === atteso.tipo && doc.cliente === atteso.cliente
      && voce.desc === atteso.lavoro && voce.prezzo === atteso.prezzo && voce.qta === 1
      && new RegExp("^" + (atteso.tipo === "fattura" ? "Fattura" : "Preventivo") + " n\\. 1/\\d{4} per " + atteso.cliente + ": €").test(r.corpo.testo)
      && (atteso.tipo === "fattura" ? tabelle.incomes.length === 1 && entrata.status === "attesa" : tabelle.incomes.length === 0);
    verifica(`codice: "${frase}" → ${atteso.tipo} ${atteso.cliente}, ${atteso.prezzo} €, "${atteso.lavoro}"`, ok, JSON.stringify({ ai: chiamateAI.length, doc: { tipo: doc.tipo, cliente: doc.cliente, voci: doc.voci }, testo: r.corpo && r.corpo.testo }));
  } else {
    const ok = chiamateAI.length >= 1 && d.length === 0;
    verifica(`AI: "${frase}" → decide l'AI, niente scritto dal codice`, ok, JSON.stringify({ ai: chiamateAI.length, d }));
  }
}

// Registro: letto dal codice = modello "codice", 0 giri, costo 0
databaseVuoto(); cliente("Tommaso Greti"); chiamateAI = [];
await chiama({ messaggio: PREFISSO + `"Fattura da 1500 per Tommaso greti per fognatura"` });
const riga = tabelle.ai_request_log[0] || {};
verifica("registro: modello \"codice\", 0 giri, costo 0", riga.modello === "codice" && riga.giri === 0 && Number(riga.costo_usd) === 0, JSON.stringify(riga));
// Senza il prefisso della Home (es. correzione a voce di un documento aperto) il codice non tocca niente
databaseVuoto(); cliente("Rossi"); chiamateAI = [];
await chiama({ messaggio: "Il professionista sta guardando la fattura n. 3/2026 per Rossi e ha detto: \"fattura a Rossi da 300 per porta\"" });
verifica("fuori dalla Home: decide l'AI", chiamateAI.length >= 1 && documenti().length === 0);

console.log(falliti ? `\n${falliti} controlli falliti.` : "\nTutti i controlli passati.");
if (falliti) process.exitCode = 1;
