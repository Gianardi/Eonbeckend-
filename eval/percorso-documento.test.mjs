/* Test del percorso fisso per fatture/preventivi — gira SENZA chiavi e
   senza rete: esegue il vero handler di api/index.js, con il database
   (PostgREST di Supabase) e le risposte dell'AI (Anthropic) simulati.

   Perché serve: il 25/09/2026 la creazione di fatture/preventivi a voce
   falliva in modi diversi (silenzio, giri a vuoto, falso "non riesco").
   Causa vera trovata in ai_audit_log: la regola "risorsa" di
   REGOLE_GUARDRAIL_AZIONE bloccava in silenzio crea_preventivo_o_fattura.
   Qui ogni scenario riproduce una situazione reale e controlla sia il
   risultato (documento creato o no, cliente giusto, tipo giusto) sia
   COSA viene chiesto all'AI (quante chiamate, quale strumento forzato,
   quale modello, niente ragionamento esteso con uno strumento forzato —
   combinazione che Anthropic rifiuta con un errore 400).

   Uso:  node eval/percorso-documento.test.mjs
   Esce con codice 1 se anche un solo controllo fallisce. */

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
  return rispostaJson({ id: "msg_finto", type: "message", role: "assistant", model: corpo.model, usage: { input_tokens: 1, output_tokens: 1 }, ...risposta });
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

async function chiedi(frase) {
  const req = {
    method: "POST",
    url: "/api?action=assistant",
    headers: { authorization: "Bearer token-finto" },
    body: { messaggio: `Il professionista ti ha appena raccontato cosa deve fare: "${frase}"` },
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
const documenti = () => tabelle.messages.filter((m) => m.event_type === "doc");
const datiDoc = (m) => JSON.parse(m.file_name);
const forzato = (corpo) => corpo.tool_choice && corpo.tool_choice.name;
const strumentiAzioni = (r) => (r.corpo.azioni || []).map((a) => a.tool);

async function scenario(titolo, prepara, frase, passi, controlli) {
  console.log(`\n=== ${titolo} ===`);
  databaseVuoto();
  chiamateAI = [];
  copione = passi;
  const ctxScenario = prepara ? prepara() : {};
  let r;
  try {
    r = await chiedi(frase);
  } catch (err) {
    verifica("il turno non deve lanciare eccezioni", false, err.message);
    return;
  }
  try {
    controlli(r, ctxScenario);
  } catch (err) {
    verifica("i controlli dello scenario devono poter leggere la risposta", false, err.message);
  }
}

const interpreta = (extra) => () => usaStrumento("interpreta_richiesta", { operazione: "crea", oggetto: "risorsa", cardinalita: "singolare", ...extra });

/* 1 — il caso di oggi: cliente nuovo, tutto detto in una frase */
await scenario(
  "Cliente nuovo, richiesta completa (\"Michele Soda\")",
  null,
  "Fattura da 300 + IVA per Michele Soda studio progetto e pitturazione locali",
  [
    interpreta({ entita: { tipo: "fattura", cliente_di_riferimento: "Michele Soda" }, documento_completo: true }),
    // il modello prova apposta a sbagliare cliente e tipo: il codice deve imporre quelli giusti
    () => usaStrumento("crea_preventivo_o_fattura", { cliente_id: "id-sbagliato", tipo: "preventivo", voci: [{ descrizione: "Studio progetto e pitturazione locali", prezzo: 300 }] }),
  ],
  (r) => {
    const doc = documenti()[0];
    const cliente = tabelle.clients.find((c) => c.name === "Michele Soda");
    verifica("risposta 200 e stato concluso", r.status === 200 && r.corpo.stato === "concluso", JSON.stringify(r.corpo));
    verifica("esattamente 2 chiamate all'AI (prima ne servivano 6-8)", chiamateAI.length === 2, chiamateAI.length);
    verifica("giro 0 forzato su interpreta_richiesta", forzato(chiamateAI[0]) === "interpreta_richiesta");
    verifica("giro 1 forzato su crea_preventivo_o_fattura", forzato(chiamateAI[1]) === "crea_preventivo_o_fattura");
    verifica("giro 1 con una sola chiamata possibile (disable_parallel_tool_use)", chiamateAI[1].tool_choice && chiamateAI[1].tool_choice.disable_parallel_tool_use === true);
    verifica("giro 1 sul modello economico (Haiku)", chiamateAI[1].model === HAIKU, chiamateAI[1].model);
    verifica("nessun ragionamento esteso insieme a uno strumento forzato", chiamateAI.every((c) => !(c.thinking && c.tool_choice)));
    verifica("cliente creato dal codice", !!cliente);
    verifica("un solo documento creato", documenti().length === 1, documenti().length);
    verifica("documento sul cliente giusto (non su quello inventato dal modello)", doc && datiDoc(doc).cliente === "Michele Soda");
    verifica("tipo imposto dal codice: fattura, non preventivo", doc && datiDoc(doc).tipo === "fattura", doc && datiDoc(doc).tipo);
    verifica("totale 366 (300 + IVA 22%)", doc && Number(doc.amount) === 366, doc && doc.amount);
    verifica("azioni per il frontend: cliente + documento", JSON.stringify(strumentiAzioni(r)) === JSON.stringify(["trova_o_crea_cliente", "crea_preventivo_o_fattura"]), JSON.stringify(strumentiAzioni(r)));
    verifica("dati completi del documento restituiti (per l'anteprima)", r.corpo.azioni.at(-1).esito.dati && Array.isArray(r.corpo.azioni.at(-1).esito.dati.voci));
    verifica("fattura segnata tra le entrate attese", tabelle.incomes.length === 1 && Number(tabelle.incomes[0].amount) === 366);
    verifica("turno registrato in ai_request_log", tabelle.ai_request_log.length === 1 && tabelle.ai_request_log[0].stato === "concluso");
  }
);

/* 2 — cliente già in anagrafica */
await scenario(
  "Cliente già esistente (\"Claudia Spori\")",
  () => ({ cliente: aggiungiCliente("Claudia Spori") }),
  "Mi crei preventivo da 200 per Claudia Spori per pitturazione bagno",
  [
    interpreta({ entita: { tipo: "preventivo", cliente_di_riferimento: "Claudia Spori" }, documento_completo: true }),
    () => usaStrumento("crea_preventivo_o_fattura", { cliente_id: "x", tipo: "preventivo", voci: [{ descrizione: "Pitturazione bagno", prezzo: 200 }] }),
  ],
  (r, { cliente }) => {
    verifica("stato concluso con 2 chiamate", r.corpo.stato === "concluso" && chiamateAI.length === 2, `${r.corpo.stato}, ${chiamateAI.length} chiamate`);
    verifica("nessun cliente doppione creato", tabelle.clients.length === 1);
    verifica("documento sul cliente esistente", documenti().length === 1 && datiDoc(documenti()[0]).cliente === "Claudia Spori");
    verifica("è un preventivo, e non genera entrate attese", datiDoc(documenti()[0]).tipo === "preventivo" && tabelle.incomes.length === 0);
    verifica("azioni: solo il documento (cliente già c'era)", JSON.stringify(strumentiAzioni(r)) === JSON.stringify(["crea_preventivo_o_fattura"]), JSON.stringify(strumentiAzioni(r)));
    verifica("id cliente imposto dal codice", tabelle.messages.length && tabelle.conversations[0].contact_name === cliente.name);
  }
);

/* 3 — manca il prezzo: il modello dice "completo" ma nella frase non c'è nessuna cifra */
await scenario(
  "Prezzo mai detto (il modello sbaglia a dire 'completo')",
  () => ({ cliente: aggiungiCliente("Neri Giordano") }),
  "Fammi un preventivo per Neri Giordano per il rifacimento del tetto",
  [
    interpreta({ entita: { tipo: "preventivo", cliente_di_riferimento: "Neri Giordano" }, documento_completo: true }),
    () => rispondiTesto("Ok, te lo preparo: quanto costa il rifacimento del tetto?"),
  ],
  (r) => {
    verifica("nessun giro forzato su crea (niente prezzi inventati)", !chiamateAI.slice(1).some((c) => forzato(c) === "crea_preventivo_o_fattura"));
    verifica("nessun documento creato", documenti().length === 0);
    verifica("risponde con la domanda sul prezzo", /\?\s*$/.test(r.corpo.testo || ""), r.corpo.testo);
  }
);

/* 4 — nome simile a un cliente esistente: va chiesto, niente percorso fisso */
await scenario(
  "Nome simile a un cliente esistente (\"Tabri\" / \"Fabbri\")",
  () => ({ cliente: aggiungiCliente("Fabbri") }),
  "Fattura per Tabri da 800 euro per pulizia grondaie",
  [
    interpreta({ entita: { tipo: "fattura", cliente_di_riferimento: "Tabri" }, documento_completo: true }),
    () => rispondiTesto("Intendi Fabbri, che hai già in anagrafica, o è un cliente nuovo?"),
  ],
  (r) => {
    verifica("nessun giro forzato: prima va chiarito il cliente", !chiamateAI.slice(1).some((c) => forzato(c)));
    verifica("nessun cliente creato e nessun documento", tabelle.clients.length === 1 && documenti().length === 0);
    verifica("chiede quale cliente", /\?\s*$/.test(r.corpo.testo || ""), r.corpo.testo);
  }
);

/* 5 — la causa vera: percorso libero con oggetto "risorsa" (prima bloccato in silenzio) */
await scenario(
  "Percorso libero con oggetto 'risorsa': crea_preventivo_o_fattura non deve più essere bloccato",
  () => ({ cliente: aggiungiCliente("Walter Tesi") }),
  "Preventivo facciata e tetto da 150.000 per Walter Tesi",
  [
    interpreta({ entita: { tipo: "preventivo", cliente_di_riferimento: "Walter Tesi" } }), // documento_completo non dichiarato → percorso libero
    (corpo) => usaStrumento("crea_preventivo_o_fattura", { cliente_id: clienteRisoltoDa(corpo).id, tipo: "preventivo", voci: [{ descrizione: "Facciata e tetto", prezzo: 150000 }] }),
    () => rispondiTesto("Fatto, preventivo per Walter Tesi da 150.000 € + IVA."),
  ],
  (r) => {
    verifica("giro 1 NON forzato (percorso libero)", !forzato(chiamateAI[1]));
    verifica("documento creato al primo tentativo (prima: bloccato dalla regola 'risorsa')", documenti().length === 1);
    verifica("nessun errore 'mostra/recupera una risorsa' mandato all'AI", !JSON.stringify(chiamateAI).includes("mostra/recupera una risorsa"));
    verifica("stato concluso", r.corpo.stato === "concluso", r.corpo.stato);
  }
);

/* 6 — la compilazione forzata fallisce: si torna al percorso libero, mai un secondo tentativo forzato */
await scenario(
  "Compilazione forzata non valida → ritorno al percorso libero",
  () => ({ cliente: aggiungiCliente("Bianchi") }),
  "Fattura a Bianchi da 500 per pitturazione muri",
  [
    interpreta({ entita: { tipo: "fattura", cliente_di_riferimento: "Bianchi" }, documento_completo: true }),
    () => usaStrumento("crea_preventivo_o_fattura", { cliente_id: "x", tipo: "fattura", voci: [] }), // non valido: nessuna voce
    () => rispondiTesto("Non sono riuscita a compilare le voci: mi confermi 500 € per pitturazione muri?"),
  ],
  (r) => {
    verifica("giro 2 NON forzato dopo il fallimento", chiamateAI.length === 3 && !forzato(chiamateAI[2]), `${chiamateAI.length} chiamate`);
    verifica("nessun documento creato", documenti().length === 0);
    verifica("il turno arriva in fondo con una risposta", !!(r.corpo && r.corpo.testo), JSON.stringify(r.corpo));
  }
);

/* 7 — più richieste nello stesso messaggio: niente percorso fisso (non deve perderne una) */
await scenario(
  "Due richieste nello stesso messaggio → percorso libero",
  () => ({ cliente: aggiungiCliente("Rossi") }),
  "Fattura a Rossi da 400 per porte e segnami di chiamarlo domani alle 9",
  [
    interpreta({ entita: { tipo: "fattura", cliente_di_riferimento: "Rossi" }, documento_completo: false }),
    () => rispondiTesto("Ti preparo la fattura e segno la chiamata: confermi?"),
  ],
  () => {
    verifica("nessun giro forzato su crea", !chiamateAI.slice(1).some((c) => forzato(c)));
  }
);

/* 8 — "mostrami il preventivo": la protezione originale deve restare */
await scenario(
  "Richiesta di VEDERE un preventivo: mai crearne uno nuovo al suo posto",
  () => ({ cliente: aggiungiCliente("Rossi") }),
  "Mostrami il preventivo di Rossi",
  [
    () => usaStrumento("interpreta_richiesta", { operazione: "mostra", oggetto: "risorsa", entita: { tipo: "preventivo", cliente_di_riferimento: "Rossi" } }),
    (corpo) => usaStrumento("crea_preventivo_o_fattura", { cliente_id: clienteRisoltoDa(corpo).id, tipo: "preventivo", voci: [{ descrizione: "inventato", prezzo: 1 }] }),
    () => rispondiTesto("Non trovo preventivi per Rossi."),
  ],
  () => {
    verifica("nessun documento creato (bloccato dalla regola 'risorsa')", documenti().length === 0);
    verifica("il blocco è stato spiegato all'AI", JSON.stringify(chiamateAI[2].messages).includes("mostra/recupera una risorsa"));
  }
);

console.log(falliti ? `\n${falliti} controlli FALLITI.` : "\nTutti i controlli passati.");
if (falliti) process.exitCode = 1;
