/* Test del percorso rapido per gli appuntamenti — gira SENZA chiavi e
   senza rete, come percorso-documento.test.mjs: esegue il vero handler
   di api/index.js con database e AI simulati.

   Cosa controlla: che un appuntamento semplice ("Dini domani alle 10")
   si segni con UNA sola chiamata piccola all'AI; che "no alle 11" subito
   dopo sposti l'appuntamento senza pulsante di conferma; che con due
   clienti omonimi la domanda e la risposta le gestisca il codice; e
   soprattutto che OGNI caso dubbio passi al motore completo di sempre
   (orario vago, nome non nella frase, data strana, AI che non risponde,
   fatture, messaggi...), senza scrivere niente di sbagliato.

   Uso:  node eval/percorso-rapido.test.mjs
   Esce con codice 1 se anche un solo controllo fallisce. */

import { randomUUID } from "node:crypto";

process.env.SUPABASE_URL = "https://finto.supabase.co";
process.env.SUPABASE_ANON_KEY = "anon-finta";
process.env.SUPABASE_SERVICE_ROLE_KEY = "service-finta";
process.env.ANTHROPIC_API_KEY = "chiave-finta";

const UTENTE = { id: "11111111-1111-4111-8111-111111111111" };
const PREFISSO = "Il professionista ti ha appena raccontato cosa deve fare: ";

/* date relative ad adesso, nel formato che usa EON (ora locale, senza fuso) */
function giornoFra(n) {
  // Giorno italiano (il codice legge "domani" con l'ora di Roma, non quella del server)
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(Date.now() + n * 24 * 3600 * 1000));
}
const DOMANI = giornoFra(1);

/* ---------- database finto ---------- */
let tabelle;
function databaseVuoto() {
  tabelle = { clients: [], conversations: [], messages: [], tasks: [], incomes: [], profiles: [], ai_audit_log: [], ai_request_log: [], ai_runs: [] };
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
        /* come Postgres: con * è "contiene", senza è uguaglianza che ignora le maiuscole */
        const grezzo = v.slice(6);
        const cerca = grezzo.replace(/\\(.)/g, "$1").replace(/\*/g, "").toLowerCase();
        const valore = String(r[k] || "").toLowerCase();
        if (grezzo.includes("*") ? !valore.includes(cerca) : valore !== cerca) return false;
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
  const tabella = u.pathname.replace("/rest/v1/", "");
  if (tabella === "rpc/ai_check_rate_limit") return rispostaJson(true);
  if (!tabelle[tabella]) tabelle[tabella] = [];
  const params = [...u.searchParams.entries()];
  const metodo = (init && init.method) || "GET";
  if (metodo === "GET") return rispostaJson(filtra(tabelle[tabella], params));
  if (metodo === "POST") {
    const riga = { id: randomUUID(), created_at: new Date().toISOString(), deleted_at: null, ...JSON.parse(init.body) };
    tabelle[tabella].push(riga);
    return rispostaJson([riga], 201);
  }
  if (metodo === "PATCH") {
    const toccate = filtra(tabelle[tabella], params);
    toccate.forEach((r) => Object.assign(r, JSON.parse(init.body)));
    return rispostaJson(toccate);
  }
  return rispostaJson([], 200);
}

/* ---------- AI finta ---------- */
let copione, chiamateAI;
let window_esito = null; // ultimo tool_result visto dall'AI finta (scenari che lo ispezionano)
function anthropicFinto(init) {
  const corpo = JSON.parse(init.body);
  chiamateAI.push(corpo);
  const passo = copione[chiamateAI.length - 1];
  if (!passo) throw new Error(`Chiamata all'AI n. ${chiamateAI.length} non prevista dallo scenario`);
  const risposta = passo(corpo);
  if (risposta === "ERRORE_500") return rispostaJson({ error: { message: "sovraccarico" } }, 500);
  if (risposta === "CREDITO_FINITO") return rispostaJson({ type: "error", error: { type: "invalid_request_error", message: "Your credit balance is too low to access the Anthropic API. Please go to Plans & Billing to upgrade or purchase credits." } }, 400);
  return rispostaJson({ id: "msg_finto", type: "message", role: "assistant", model: corpo.model, usage: { input_tokens: 1, output_tokens: 1 }, ...risposta });
}
const usaStrumento = (name, input) => ({ content: [{ type: "tool_use", id: "toolu_" + randomUUID().slice(0, 8), name, input }], stop_reason: "tool_use" });
const rispondiTesto = (text) => ({ content: [{ type: "text", text }], stop_reason: "end_turn" });
const leggi = (input) => () => usaStrumento("leggi_impegno", input);
/* il motore completo, quando la richiesta gli viene passata: interpreta + una domanda */
const motore = [
  () => usaStrumento("interpreta_richiesta", { operazione: "crea", oggetto: "azione" }),
  () => rispondiTesto("A che ora te lo segno?"),
];

globalThis.fetch = async (url, init) => {
  const s = String(url);
  if (s.startsWith("https://api.anthropic.com/")) return anthropicFinto(init);
  if (s.startsWith(process.env.SUPABASE_URL + "/auth/v1/user")) return rispostaJson(UTENTE);
  if (s.startsWith(process.env.SUPABASE_URL + "/rest/v1/")) return postgrest(s, init);
  throw new Error("fetch non prevista nel test: " + s);
};

const { default: handler } = await import("../api/index.js");

async function chiama(bodyReq) {
  const req = { method: "POST", url: "/api?action=assistant", headers: { authorization: "Bearer token-finto" }, body: bodyReq };
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
const forzato = (corpo) => corpo.tool_choice && corpo.tool_choice.name;
const appuntamenti = () => tabelle.messages.filter((m) => m.event_type === "appt");
const strumentiAzioni = (r) => ((r.corpo && r.corpo.azioni) || []).map((a) => a.tool);
const eMotoreCompleto = (corpo) => forzato(corpo) === "interpreta_richiesta";

/* passi: [{ body, copione }] eseguiti in sequenza sullo stesso database */
async function scenario(titolo, prepara, passi, controlli) {
  console.log(`\n=== ${titolo} ===`);
  databaseVuoto();
  const ctx = prepara ? prepara() : {};
  const risultati = [];
  const chiamatePerPasso = [];
  for (const passo of passi) {
    chiamateAI = [];
    copione = passo.copione;
    try {
      const body = typeof passo.body === "function" ? passo.body(risultati, ctx) : passo.body;
      risultati.push(await chiama(body));
    } catch (err) {
      verifica("il turno non deve lanciare eccezioni", false, err.message);
      return;
    }
    chiamatePerPasso.push(chiamateAI);
  }
  try {
    controlli(risultati, chiamatePerPasso, ctx);
  } catch (err) {
    verifica("i controlli dello scenario devono poter leggere la risposta", false, err.message);
  }
}
const nuovo = (frase, extra) => ({ messaggio: PREFISSO + `"${frase}"`, ...(extra || {}) });

/* 1 — il caso base */
await scenario(
  "\"Segna appuntamento con Claudia Spori domani alle 10\" → letto dal codice, ZERO chiamate all'AI",
  () => ({ spori: aggiungiCliente("Claudia Spori") }),
  [{ body: nuovo("Segna appuntamento con Claudia Spori domani alle 10"), copione: [] }],
  ([r], [ai]) => {
    verifica("risposta 200, concluso", r.status === 200 && r.corpo.stato === "concluso", JSON.stringify(r.corpo));
    verifica("nessuna chiamata all'AI", ai.length === 0, ai.length);
    verifica("titolo come lo scriveva la piccola AI", appuntamenti()[0] && /Appuntamento con Claudia Spori/.test(JSON.stringify(appuntamenti()[0])), JSON.stringify(appuntamenti()[0]));
    verifica("appuntamento segnato sul cliente, alle 10 di domani", appuntamenti().length === 1 && appuntamenti()[0].scheduled_at === `${DOMANI}T10:00:00` && tabelle.conversations[0].contact_name === "Claudia Spori");
    verifica("azioni per l'app: crea_impegno", JSON.stringify(strumentiAzioni(r)) === '["crea_impegno"]', JSON.stringify(strumentiAzioni(r)));
    verifica("focus sul cliente", r.corpo.focus && r.corpo.focus.riferimento === "Claudia Spori");
    verifica("registrato in ai_audit_log e ai_request_log (modello \"codice\", 0 giri, costo 0)", tabelle.ai_audit_log.some((a) => a.tool === "crea_impegno") && tabelle.ai_request_log[0].giri === 0 && tabelle.ai_request_log[0].modello === "codice" && Number(tabelle.ai_request_log[0].costo_usd) === 0, JSON.stringify(tabelle.ai_request_log[0]));
  }
);

/* 2 — gli esempi di Andrea: "segna Dini domani alle 10", poi "no alle 11" */
await scenario(
  "Andrea: \"Segna appuntamento Dini domani alle 10\" e poi \"no alle 11\" → spostato subito, senza conferma",
  () => ({ dini: aggiungiCliente("Giampiero Dini") }),
  [
    { body: nuovo("Segna appuntamento Dini domani alle 10"), copione: [] },
    { body: (prec) => nuovo("No alle 11", { ricordo: prec[0].corpo.azioni.map((a) => ({ tool: a.tool, esito: a.esito })) }), copione: [] },
  ],
  ([r1, r2], [ai1, ai2]) => {
    verifica("primo: appuntamento alle 10 con Giampiero Dini, senza AI", r1.corpo.stato === "concluso" && appuntamenti().length === 1 && ai1.length === 0);
    verifica("secondo: nessuna chiamata all'AI", ai2.length === 0, ai2.length);
    verifica("secondo: NESSUNA richiesta di conferma", r2.corpo.stato === "concluso", r2.corpo.stato);
    verifica("spostato alle 11, stesso appuntamento (nessun doppione)", appuntamenti().length === 1 && appuntamenti()[0].scheduled_at === `${DOMANI}T11:00:00`, appuntamenti().map((a) => a.scheduled_at).join(","));
    verifica("azioni per l'app: sposta_impegno", JSON.stringify(strumentiAzioni(r2)) === '["sposta_impegno"]');
  }
);

/* 3 — due omonimi: domanda e risposta gestite dal codice */
await scenario(
  "Due clienti Dini → \"quale dei due?\" e la risposta \"Giampiero\" risolta dal codice",
  () => ({ sara: aggiungiCliente("Sara Dini"), gp: aggiungiCliente("Giampiero Dini") }),
  [
    { body: nuovo("Appuntamento Dini domani alle 10"), copione: [] },
    { body: (prec) => ({ runId: prec[0].corpo.runId, messaggio: "Giampiero" }), copione: [] },
  ],
  ([r1, r2], [ai1, ai2]) => {
    verifica("domanda con i due nomi, che finisce con '?'", /Sara Dini/.test(r1.corpo.testo) && /Giampiero Dini/.test(r1.corpo.testo) && /\?\s*$/.test(r1.corpo.testo), r1.corpo.testo);
    verifica("conversazione aperta (runId)", !!r1.corpo.runId);
    verifica("domanda senza nessuna chiamata all'AI", ai1.length === 0, ai1.length);
    verifica("risposta risolta SENZA nessuna chiamata all'AI", ai2.length === 0, ai2.length);
    verifica("appuntamento su Giampiero Dini alle 10", appuntamenti().length === 1 && tabelle.conversations[0].contact_name === "Giampiero Dini" && appuntamenti()[0].scheduled_at === `${DOMANI}T10:00:00`);
    verifica("conversazione chiusa", tabelle.ai_runs[0].stato === "concluso");
  }
);

/* 4 — "il secondo" */
await scenario(
  "Due omonimi, risposta \"il secondo\"",
  () => ({ sara: aggiungiCliente("Sara Dini"), gp: aggiungiCliente("Giampiero Dini") }),
  [
    { body: nuovo("Chiamare Dini domani alle 9"), copione: [] },
    { body: (prec) => ({ runId: prec[0].corpo.runId, messaggio: "il secondo" }), copione: [] },
  ],
  ([r1, r2]) => {
    verifica("impegno creato", r2.corpo.stato === "concluso" && strumentiAzioni(r2)[0] === "crea_impegno", JSON.stringify(r2.corpo));
  }
);

/* 5 — risposta non chiara all'omonimia: passa al motore completo con la cronologia */
await scenario(
  "Due omonimi, risposta non chiara (\"boh quello di Firenze\") → motore completo",
  () => ({ sara: aggiungiCliente("Sara Dini"), gp: aggiungiCliente("Giampiero Dini") }),
  [
    { body: nuovo("Appuntamento Dini domani alle 10"), copione: [] },
    { body: (prec) => ({ runId: prec[0].corpo.runId, messaggio: "boh quello di Firenze" }),
      copione: [(corpo) => {
        if (!JSON.stringify(corpo.messages).includes("Quale dei due intendi")) throw new Error("cronologia non passata al motore");
        return rispondiTesto("Non ho la città dei clienti: mi dici il nome?");
      }] },
  ],
  ([r1, r2], [ai1, ai2]) => {
    verifica("il motore completo riceve la cronologia e risponde", r2.status === 200 && ai2.length === 1, `${r2.status} ${ai2.length}`);
    verifica("nessun appuntamento creato a caso", appuntamenti().length === 0);
  }
);

/* 6 — nome nuovo: impegno senza cliente, nessuna domanda */
await scenario(
  "Nome non in anagrafica (\"chiamare Pippo domani alle 9\") → segnato subito",
  null,
  [{ body: nuovo("Chiamare Pippo domani alle 9"), copione: [] }],
  ([r], [ai]) => {
    verifica("nessuna chiamata all'AI, concluso", ai.length === 0 && r.corpo.stato === "concluso");
    verifica("titolo \"Chiamare Pippo\", tipo chiamata", tabelle.tasks[0] && tabelle.tasks[0].title === "Chiamare Pippo", JSON.stringify(tabelle.tasks[0]));
    verifica("impegno tra le cose da fare, alle 9", tabelle.tasks.length === 1 && tabelle.tasks[0].scheduled_at === `${DOMANI}T09:00:00`);
    verifica("nessun cliente creato", tabelle.clients.length === 0);
  }
);

/* ----- casi che DEVONO passare al motore completo ----- */

await scenario(
  "Orario vago → l'AI dice 'altro' → motore completo",
  () => ({ c: aggiungiCliente("Rossi") }),
  [{ body: nuovo("Domani mattina chiamo Rossi"), copione: [leggi({ azione: "altro" }), ...motore] }],
  ([r], [ai]) => {
    verifica("dopo la chiamata piccola, motore completo", ai.length === 3 && eMotoreCompleto(ai[1]), ai.length);
    verifica("niente scritto dal percorso rapido", tabelle.tasks.length === 0 && appuntamenti().length === 0);
    verifica("risposta del motore", r.corpo.testo === "A che ora te lo segno?", r.corpo.testo);
  }
);

await scenario(
  "L'AI mette un nome che NON è nella frase (preso chissà dove) → motore completo",
  () => ({ c: aggiungiCliente("Tommaso Greti") }),
  [{ body: nuovo("Appuntamento con Raspadori domani alle 10 per il bagno"),
     copione: [leggi({ azione: "nuovo", titolo: "Appuntamento", tipo: "incontro", quando_iso: `${DOMANI}T10:00:00`, nome_nella_frase: "Tommaso Greti" }), ...motore] }],
  ([r], [ai]) => {
    verifica("motore completo, niente scritto", ai.length === 3 && appuntamenti().length === 0 && tabelle.tasks.length === 0);
  }
);

await scenario(
  "Data non valida o nel passato → motore completo",
  null,
  [{ body: nuovo("Chiamare Pippo lunedì alle 9 per il preventivo"),
     copione: [leggi({ azione: "nuovo", titolo: "Chiamare Pippo", tipo: "chiamata", quando_iso: "2020-01-06T09:00:00", nome_nella_frase: "Pippo" }), ...motore] }],
  ([r], [ai]) => {
    verifica("motore completo, niente scritto", ai.length === 3 && tabelle.tasks.length === 0);
  }
);

await scenario(
  "Nome simile a un cliente (\"Tabri\" / \"Fabbri\") → motore completo, che chiede",
  () => ({ c: aggiungiCliente("Fabbri") }),
  [{ body: nuovo("Appuntamento Tabri domani alle 10"), copione: [...motore] }],
  ([r], [ai]) => {
    verifica("letto dal codice, poi motore completo (niente scritto)", ai.length === 2 && eMotoreCompleto(ai[0]) && appuntamenti().length === 0 && tabelle.tasks.length === 0, ai.length);
  }
);

await scenario(
  "\"no alle 11\" ma nomina un'altra persona → non è una correzione, motore completo",
  () => ({ dini: aggiungiCliente("Giampiero Dini"), rossi: aggiungiCliente("Rossi") }),
  [
    { body: nuovo("Segna Dini domani alle 10"), copione: [] },
    { body: (prec) => nuovo("No Rossi alle 11", { ricordo: prec[0].corpo.azioni }),
      copione: [leggi({ azione: "correggi_ultimo", quando_iso: `${DOMANI}T11:00:00`, nome_nella_frase: "Rossi" }), ...motore] },
  ],
  ([r1, r2], [ai1, ai2]) => {
    verifica("appuntamento di Dini NON spostato", appuntamenti()[0].scheduled_at === `${DOMANI}T10:00:00`);
    verifica("motore completo", ai2.length === 3 && eMotoreCompleto(ai2[1]), ai2.length);
  }
);

await scenario(
  "L'AI piccola non risponde (errore 500) → motore completo, nessun blocco",
  null,
  [{ body: nuovo("Chiamare Pippo domani alle 9 per il bagno"), copione: [() => "ERRORE_500", ...motore] }],
  ([r], [ai]) => {
    verifica("risposta 200 dal motore completo", r.status === 200 && ai.length === 3 && eMotoreCompleto(ai[1]), `${r.status} ${ai.length}`);
  }
);

await scenario(
  "Fattura con una data dentro → mai il percorso rapido",
  () => ({ c: aggiungiCliente("Rossi") }),
  [{ body: nuovo("Fattura a Rossi da 300 per domani alle 10"), copione: [...motore] }],
  ([r], [ai]) => {
    verifica("prima chiamata già del motore completo", eMotoreCompleto(ai[0]));
  }
);

await scenario(
  "Messaggio da un'altra schermata (non la Home) → mai il percorso rapido",
  () => ({ c: aggiungiCliente("Rossi") }),
  [{ body: { messaggio: 'Il professionista ha scritto o dettato questo, riguardo a un cliente: "Rossi domani alle 10"' }, copione: [...motore] }],
  ([r], [ai]) => {
    verifica("prima chiamata già del motore completo", eMotoreCompleto(ai[0]));
  }
);


/* ======== Clienti nuovi ======== */
const PAGINA_CLIENTI = 'Il professionista ha scritto o dettato questo, riguardo a un cliente: ';
const daClienti = (frase, extra) => ({ messaggio: PAGINA_CLIENTI + `"${frase}". Se sembra un cliente nuovo (un nome che non conosci ancora), crea la scheda con i dati che ha dato (crea_cliente).`, ...(extra || {}) });
const leggiC = (input) => () => usaStrumento("leggi_cliente", input);

await scenario(
  "Pagina Clienti: \"Franco Bake 33325 17133 impianto elettrico\" e poi \"non Bake ma bike\" (caso reale del 19/09)",
  () => ({ altro: aggiungiCliente("Mario Rossi") }),
  [
    { body: daClienti("Franco Bake 33325 17133 impianto elettrico"),
      copione: [leggiC({ azione: "nuovo", nome: "Franco Bake", telefono: "33325 17133", lavoro: "impianto elettrico" })] },
    { body: (prec) => daClienti("Non Bake ma bike", { ricordo: prec[0].corpo.azioni }),
      copione: [(corpo) => {
        if (!JSON.stringify(corpo.messages).includes("Franco Bake")) throw new Error("cliente appena aggiunto non passato all'AI");
        return usaStrumento("leggi_cliente", { azione: "correggi_nome_ultimo", nome: "Franco Bike" });
      }] },
  ],
  ([r1, r2], [ai1, ai2]) => {
    const franco = tabelle.clients.find((c) => c.phone === "33325 17133");
    verifica("creato con una sola chiamata piccola", ai1.length === 1 && ai1[0].tools.length === 1 && r1.corpo.stato === "concluso", `${ai1.length} ${r1.corpo.stato}`);
    verifica("telefono e lavoro salvati", franco && franco.description === "Impianto elettrico", JSON.stringify(franco));
    verifica("azioni per l'app: crea_cliente", JSON.stringify(strumentiAzioni(r1)) === '["crea_cliente"]');
    verifica("un cliente, una chat: la chat c'è ed è stata rinominata con lui", tabelle.conversations.length === 1 && tabelle.conversations[0].contact_name === "Franco Bike", tabelle.conversations.map((c) => c.contact_name).join(", "));
    verifica("correzione con una sola chiamata", ai2.length === 1 && r2.corpo.stato === "concluso");
    verifica("nome corretto in Franco Bike, nessun doppione", franco && franco.name === "Franco Bike" && tabelle.clients.length === 2, tabelle.clients.map((c) => c.name).join(", "));
    verifica("azioni per l'app: aggiorna_cliente", JSON.stringify(strumentiAzioni(r2)) === '["aggiorna_cliente"]');
  }
);

await scenario(
  "Home: \"aggiungi cliente Trani Valerio lavori facciata\" → creato subito",
  null,
  [{ body: nuovo("Aggiungi cliente Trani Valerio lavori facciata"),
     copione: [leggiC({ azione: "nuovo", nome: "Trani Valerio", lavoro: "lavori facciata" })] }],
  ([r], [ai]) => {
    verifica("una chiamata, cliente creato", ai.length === 1 && tabelle.clients.length === 1 && tabelle.clients[0].name === "Trani Valerio", tabelle.clients.map((c) => c.name).join(","));
    verifica("stato 'trattativa' come nel motore completo", tabelle.clients[0].status === "trattativa");
    verifica("la sua chat nasce insieme a lui", tabelle.conversations.length === 1 && tabelle.conversations[0].contact_name === "Trani Valerio");
  }
);

await scenario(
  "Cliente con lo stesso nome già in anagrafica → motore completo, nessun doppione",
  () => ({ c: aggiungiCliente("Mario Rossi") }),
  [{ body: daClienti("Mario Rossi 345 9012394"), copione: [leggiC({ azione: "nuovo", nome: "Mario Rossi", telefono: "345 9012394" }), ...motore] }],
  ([r], [ai]) => {
    verifica("motore completo, nessun cliente creato", ai.length === 3 && eMotoreCompleto(ai[1]) && tabelle.clients.length === 1, `${ai.length} ${tabelle.clients.length}`);
  }
);

await scenario(
  "Nome simile a un cliente (\"Fabri\" / \"Fabbri\") → motore completo",
  () => ({ c: aggiungiCliente("Fabbri") }),
  [{ body: daClienti("Fabri 333 1234567"), copione: [leggiC({ azione: "nuovo", nome: "Fabri", telefono: "333 1234567" }), ...motore] }],
  ([r], [ai]) => {
    verifica("motore completo, nessun cliente creato", ai.length === 3 && tabelle.clients.length === 1);
  }
);

await scenario(
  "Telefono con cifre mai dette → motore completo",
  null,
  [{ body: daClienti("Luca Neri 333 12"), copione: [leggiC({ azione: "nuovo", nome: "Luca Neri", telefono: "333 1299999" }), ...motore] }],
  ([r], [ai]) => {
    verifica("motore completo, nessun cliente creato", ai.length === 3 && tabelle.clients.length === 0);
  }
);

await scenario(
  "Nome che non è nella frase → motore completo",
  null,
  [{ body: daClienti("Quello del tetto di via Roma"), copione: [leggiC({ azione: "nuovo", nome: "Mario Bianchi" }), ...motore] }],
  ([r], [ai]) => {
    verifica("motore completo, nessun cliente creato", ai.length === 3 && tabelle.clients.length === 0);
  }
);

await scenario(
  "Correzione con un nome che non viene dalla frase → motore completo, nome invariato",
  null,
  [
    { body: daClienti("Franco Bake 333 2517133"), copione: [leggiC({ azione: "nuovo", nome: "Franco Bake", telefono: "333 2517133" })] },
    { body: (prec) => daClienti("Non Bake ma bike", { ricordo: prec[0].corpo.azioni }),
      copione: [leggiC({ azione: "correggi_nome_ultimo", nome: "Luca Verdi" }), ...motore] },
  ],
  ([r1, r2], [ai1, ai2]) => {
    verifica("nome rimasto Franco Bake", tabelle.clients[0].name === "Franco Bake");
    verifica("motore completo", ai2.length === 3 && eMotoreCompleto(ai2[1]));
  }
);

await scenario(
  "Pagina Clienti con anche un appuntamento (\"sopralluogo domani alle 10\") → mai il percorso rapido",
  null,
  [{ body: daClienti("Rossi 333 1234567 sopralluogo domani alle 10"), copione: [...motore] }],
  ([r], [ai]) => {
    verifica("prima chiamata già del motore completo", eMotoreCompleto(ai[0]));
  }
);

await scenario(
  "Home, nome + telefono + lavoro senza la parola 'cliente' (\"Luca Ferretti 333 4455667 bagno\", caso reale del 25/09)",
  null,
  [{ body: nuovo("Luca Ferretti 333 4455667 bagno"), copione: [leggiC({ azione: "nuovo", nome: "Luca Ferretti", telefono: "333 4455667", lavoro: "bagno" })] }],
  ([r], [ai]) => {
    verifica("una chiamata piccola, cliente creato", ai.length === 1 && forzato(ai[0]) === "leggi_cliente" && tabelle.clients.length === 1 && tabelle.clients[0].name === "Luca Ferretti", `${ai.length} ${tabelle.clients.map((c) => c.name)}`);
    verifica("telefono e lavoro salvati", tabelle.clients[0] && tabelle.clients[0].phone === "333 4455667" && tabelle.clients[0].description === "Bagno");
    verifica("nessun appuntamento inventato", tabelle.tasks.length === 0 && appuntamenti().length === 0);
  }
);

await scenario(
  "Home, telefono ma è una chiamata da fare (l'AI dice 'altro') → motore completo",
  null,
  [{ body: nuovo("Chiama Rossi al 333 1234567 per il bagno"), copione: [leggiC({ azione: "altro" }), ...motore] }],
  ([r], [ai]) => {
    verifica("motore completo, nessun cliente creato", ai.length === 3 && eMotoreCompleto(ai[1]) && tabelle.clients.length === 0);
  }
);

await scenario(
  "Home senza parole da cliente né telefono (\"Mario Rossi bagno\") → mai il percorso rapido",
  null,
  [{ body: nuovo("Mario Rossi bagno"), copione: [...motore] }],
  ([r], [ai]) => {
    verifica("prima chiamata già del motore completo", eMotoreCompleto(ai[0]));
  }
);

/* ======== Appunti: mai sovrascritti se non lo chiedi (25/09/2026) ======== */
const usaStrumenti = (...lista) => ({ content: lista.map(([name, input]) => ({ type: "tool_use", id: "toolu_" + randomUUID().slice(0, 8), name, input })), stop_reason: "tool_use" });
const appunto = (testo) => ({ id: randomUUID(), owner_id: UTENTE.id, testo, created_at: new Date().toISOString(), deleted_at: null });
const erroriMandatiAllAI = (corpo) => corpo.messages.flatMap((m) => Array.isArray(m.content) ? m.content.filter((b) => b.type === "tool_result" && b.is_error).map((b) => b.content) : []);

await scenario(
  "Caso reale: due appunti NUOVI detti subito dopo altri due → l'AI prova a correggerli, il codice lo impedisce",
  () => { tabelle.cantiere_appunti = [appunto("comprare silicone"), appunto("chiamare il vetraio")]; return {}; },
  [{ body: nuovo("mi appunti comprare nastro e anche un altro appunto chiamare il fabbro"),
     copione: [
       () => usaStrumento("interpreta_richiesta", { operazione: "modifica", oggetto: "azione", cardinalita: "insieme", entita: { tipo: "appunto" } }),
       // l'errore visto in produzione: correggi_appunto sui due appunti di prima
       () => usaStrumenti(["correggi_appunto", { cerca: "silicone", testo_nuovo: "comprare nastro" }], ["correggi_appunto", { cerca: "vetraio", testo_nuovo: "chiamare il fabbro" }]),
       (corpo) => {
         const errori = erroriMandatiAllAI(corpo);
         if (errori.length !== 2 || !errori.every((e) => e.includes("crea_appunto"))) throw new Error("blocco non spiegato all'AI: " + JSON.stringify(errori));
         return usaStrumenti(["crea_appunto", { testo: "comprare nastro" }], ["crea_appunto", { testo: "chiamare il fabbro" }]);
       },
       () => rispondiTesto("Fatto, due appunti aggiunti."),
     ] }],
  ([r]) => {
    const testi = tabelle.cantiere_appunti.map((a) => a.testo).sort();
    verifica("i due appunti di prima sono intatti", testi.includes("comprare silicone") && testi.includes("chiamare il vetraio"), JSON.stringify(testi));
    verifica("i due appunti nuovi ci sono", testi.includes("comprare nastro") && testi.includes("chiamare il fabbro") && testi.length === 4, JSON.stringify(testi));
    verifica("turno concluso", r.status === 200 && r.corpo.stato === "concluso", JSON.stringify(r.corpo));
  }
);

await scenario(
  "\"Correggi l'appunto del silicone: comprare nastro\" → la correzione è permessa",
  () => { tabelle.cantiere_appunti = [appunto("comprare silicone")]; return {}; },
  [{ body: nuovo("Correggi l'appunto del silicone: comprare nastro"),
     copione: [
       () => usaStrumento("interpreta_richiesta", { operazione: "modifica", oggetto: "azione", entita: { tipo: "appunto" } }),
       () => usaStrumento("correggi_appunto", { cerca: "silicone", testo_nuovo: "comprare nastro" }),
       () => rispondiTesto("Fatto."),
     ] }],
  () => {
    verifica("appunto corretto", tabelle.cantiere_appunti.length === 1 && tabelle.cantiere_appunti[0].testo === "comprare nastro", JSON.stringify(tabelle.cantiere_appunti.map((a) => a.testo)));
  }
);

await scenario(
  "\"Non silicone ma nastro\" → anche questa è una correzione permessa",
  () => { tabelle.cantiere_appunti = [appunto("comprare silicone")]; return {}; },
  [{ body: nuovo("Non silicone ma nastro"),
     copione: [
       () => usaStrumento("interpreta_richiesta", { operazione: "modifica", oggetto: "azione", entita: { tipo: "appunto" } }),
       () => usaStrumento("correggi_appunto", { cerca: "silicone", testo_nuovo: "comprare nastro" }),
       () => rispondiTesto("Fatto."),
     ] }],
  () => {
    verifica("appunto corretto", tabelle.cantiere_appunti[0].testo === "comprare nastro", tabelle.cantiere_appunti[0].testo);
  }
);

/* ======== Formato dalla foto di una fattura (25/09/2026) ======== */
async function leggiFoto(testoAI) {
  chiamateAI = [];
  copione = [() => ({ content: [{ type: "text", text: testoAI }], stop_reason: "end_turn" })];
  const req = { method: "POST", url: "/api?action=leggi_intestazione_da_foto", headers: { authorization: "Bearer token-finto" },
    body: { immagine_base64: "iVBORw0KGgo=", media_type: "image/png" } };
  let uscita = "";
  const res = { statusCode: 0, setHeader() {}, end(d) { uscita = d || ""; } };
  await handler(req, res);
  return { status: res.statusCode, corpo: JSON.parse(uscita) };
}
{
  console.log("\n=== Foto di una fattura: colore e disposizione → modello proposto ===");
  const a = await leggiFoto('{"nome_azienda":"Bianchi","indirizzo":null,"piva":"IT1","telefono":null,"email":null,"colore_principale":"#0f766e","disposizione":"fascia"}');
  verifica("fascia colorata in alto → Moderno, colore normalizzato", a.status === 200 && a.corpo.modello === "moderno" && a.corpo.colore === "#0F766E" && a.corpo.nome_azienda === "Bianchi", JSON.stringify(a.corpo));
  const b = await leggiFoto('```json\n{"nome_azienda":null,"colore_principale":"rosso scuro","disposizione":"boh"}\n```');
  verifica("colore non valido → nessun colore; disposizione sconosciuta → Classico", b.status === 200 && b.corpo.colore === null && b.corpo.modello === "classico", JSON.stringify(b.corpo));
  const c = await leggiFoto('{"colore_principale":null,"disposizione":"centrata"}');
  verifica("intestazione centrata → Elegante", c.corpo.modello === "elegante", JSON.stringify(c.corpo));
  verifica("alla foto si chiede anche colore e disposizione", /colore_principale/.test(JSON.stringify(chiamateAI[0])) && /disposizione/.test(JSON.stringify(chiamateAI[0])));
}

/* ======== Foto ritrovate dalla nota (25/09/2026) ======== */
await scenario(
  "EON cerca \"la foto della crepa\": recupera_foto_cantiere filtra per nota e la restituisce",
  () => {
    tabelle.cantiere_foto = [
      { id: "f1", owner_id: UTENTE.id, url: "https://file.test/1.jpg", client_id: null, nota: "Crepa sul muro della cucina", created_at: "2026-09-25T10:00:00Z", deleted_at: null },
      { id: "f2", owner_id: UTENTE.id, url: "https://file.test/2.jpg", client_id: null, nota: null, created_at: "2026-09-25T11:00:00Z", deleted_at: null },
    ];
    return {};
  },
  [{ body: nuovo("Fammi vedere la foto dove c'era la crepa"),
     copione: [
       () => usaStrumento("interpreta_richiesta", { operazione: "mostra", oggetto: "risorsa", entita: { tipo: "foto" } }),
       () => usaStrumento("recupera_foto_cantiere", { cerca: "crepa" }),
       (corpo) => {
         const esiti = corpo.messages.flatMap((m) => Array.isArray(m.content) ? m.content.filter((b) => b.type === "tool_result").map((b) => b.content) : []);
         window_esito = esiti.at(-1);
         return rispondiTesto("Ecco la foto della crepa.");
       },
     ] }],
  ([r]) => {
    const esito = JSON.parse(window_esito);
    verifica("solo la foto con la crepa nella nota, con la sua nota", esito.foto.length === 1 && esito.foto[0].id === "f1" && /Crepa/.test(esito.foto[0].nota), window_esito);
    verifica("la foto arriva all'app per essere mostrata", (r.corpo.azioni || []).some((a) => a.tool === "recupera_foto_cantiere"), JSON.stringify(r.corpo));
  }
);

/* ======== Descrizione automatica delle foto (25/09/2026) ======== */
async function descrivi(fotoId, testoAI) {
  chiamateAI = [];
  copione = testoAI === null ? [] : [() => ({ content: [{ type: "text", text: testoAI }], stop_reason: "end_turn" })];
  const req = { method: "POST", url: "/api?action=descrivi_foto", headers: { authorization: "Bearer token-finto" }, body: { foto_id: fotoId } };
  let uscita = "";
  const res = { statusCode: 0, setHeader() {}, end(d) { uscita = d || ""; } };
  await handler(req, res);
  return { status: res.statusCode, corpo: JSON.parse(uscita) };
}
{
  console.log("\n=== Descrizione automatica di una foto ===");
  databaseVuoto();
  const base = process.env.SUPABASE_URL + "/storage/v1/object/public/eon-files/u/cantiere/foto/";
  tabelle.cantiere_foto = [
    { id: "11111111-1111-4111-8111-000000000001", owner_id: UTENTE.id, url: base + "porta.jpg", nota: null, descrizione: null, deleted_at: null },
    { id: "11111111-1111-4111-8111-000000000002", owner_id: UTENTE.id, url: base + "vecchia.jpg", nota: null, descrizione: "Lavandino in ceramica bianca", deleted_at: null },
    { id: "11111111-1111-4111-8111-000000000003", owner_id: UTENTE.id, url: "https://sito-esterno.test/x.jpg", nota: null, descrizione: null, deleted_at: null },
  ];
  const a = await descrivi("11111111-1111-4111-8111-000000000001", "  «porta scorrevole in vetro satinato, telaio in alluminio, maniglia incassata.»  ");
  verifica("descrizione pulita e salvata sulla foto", a.status === 200 && a.corpo.descrizione === "Porta scorrevole in vetro satinato, telaio in alluminio, maniglia incassata" && tabelle.cantiere_foto[0].descrizione === a.corpo.descrizione, JSON.stringify(a.corpo));
  verifica("una sola chiamata piccola: modello economico, foto letta dal link di EON", chiamateAI.length === 1 && chiamateAI[0].model === "claude-haiku-4-5" && JSON.stringify(chiamateAI[0]).includes('"type":"url"') && JSON.stringify(chiamateAI[0]).includes("porta.jpg"), JSON.stringify(chiamateAI[0] && chiamateAI[0].model));
  const b = await descrivi("11111111-1111-4111-8111-000000000002", null);
  verifica("foto già descritta: nessuna nuova chiamata all'AI", b.status === 200 && b.corpo.descrizione === "Lavandino in ceramica bianca" && chiamateAI.length === 0, JSON.stringify(b));
  const c = await descrivi("11111111-1111-4111-8111-000000000003", null);
  verifica("foto fuori dallo spazio di EON: rifiutata, nessuna chiamata", c.status === 400 && chiamateAI.length === 0, JSON.stringify(c));
  const d = await descrivi("11111111-1111-4111-8111-000000000009", null);
  verifica("foto inesistente (o di un altro utente): non trovata", d.status === 404, JSON.stringify(d));
}

await scenario(
  "EON cerca \"la foto della porta\": trovata dalla descrizione automatica, anche se la nota non dice \"porta\"",
  () => {
    tabelle.cantiere_foto = [
      { id: "f1", owner_id: UTENTE.id, url: "https://file.test/1.jpg", nota: "Da cambiare, trovare modello uguale", descrizione: "Porta scorrevole in vetro satinato", created_at: "2026-09-25T10:00:00Z", deleted_at: null },
      { id: "f2", owner_id: UTENTE.id, url: "https://file.test/2.jpg", nota: null, descrizione: "Contatore del gas", created_at: "2026-09-25T11:00:00Z", deleted_at: null },
    ];
    return {};
  },
  [{ body: nuovo("Fammi vedere la foto della porta"),
     copione: [
       () => usaStrumento("interpreta_richiesta", { operazione: "mostra", oggetto: "risorsa", entita: { tipo: "foto" } }),
       () => usaStrumento("recupera_foto_cantiere", { cerca: "porta" }),
       (corpo) => { window_esito = corpo.messages.flatMap((m) => Array.isArray(m.content) ? m.content.filter((b) => b.type === "tool_result").map((b) => b.content) : []).at(-1); return rispondiTesto("Ecco."); },
     ] }],
  () => {
    const esito = JSON.parse(window_esito);
    verifica("solo la foto della porta, con nota e descrizione", esito.foto.length === 1 && esito.foto[0].id === "f1" && /Porta/.test(esito.foto[0].descrizione) && /modello uguale/.test(esito.foto[0].nota), window_esito);
  }
);

/* ======== Errori leggibili ======== */
await scenario(
  "Credito dell'AI finito (24/09/2026) → messaggio chiaro in italiano, non l'errore in inglese",
  null,
  [{ body: nuovo("Mi prepari un riepilogo della settimana"), copione: [() => "CREDITO_FINITO", () => "CREDITO_FINITO"] }],
  ([r]) => {
    verifica("errore che dice cosa fare", r.status === 502 && /Credito dell'AI esaurito/.test(r.corpo.error) && !/credit balance/.test(r.corpo.error), JSON.stringify(r.corpo));
  }
);

console.log(falliti ? `\n${falliti} controlli FALLITI.` : "\nTutti i controlli passati.");
if (falliti) process.exitCode = 1;
