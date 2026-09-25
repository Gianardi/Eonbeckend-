/**
 * ============================================================
 * EON — Backend completo (file unico)
 * ============================================================
 * Percorso richiesto nel repository:  api/index.js
 *
 * Nessuna dipendenza da installare: usa solo fetch, gia' incluso in Node 20+.
 * Non serve package.json, non serve vercel.json, non serve npm install.
 *
 * ------------------------------------------------------------
 * VARIABILI D'AMBIENTE da impostare su Vercel
 * (Project -> Settings -> Environment Variables)
 * ------------------------------------------------------------
 *   SUPABASE_URL                 es. https://abcdefgh.supabase.co
 *   SUPABASE_ANON_KEY            chiave "anon public"
 *   SUPABASE_SERVICE_ROLE_KEY    chiave "service_role"  (segreta)
 *   ANTHROPIC_API_KEY            chiave da console.anthropic.com
 *
 *   Opzionali, SOLO per l'ambiente di staging (mai da impostare in
 *   produzione — cambiano il limite di richieste per utente). Servono
 *   TUTTE E TRE insieme, non bastano le prime due da sole:
 *   AI_RATE_LIMIT                    default 20 richieste
 *   AI_RATE_WINDOW_SECONDS           default 600 (10 minuti)
 *   AI_RATE_LIMIT_STAGING_CONFERMATO deve valere "si"
 *
 * ------------------------------------------------------------
 * ENDPOINT DISPONIBILI
 * ------------------------------------------------------------
 *   GET    /api                          -> stato del servizio
 *   POST   /api?action=ai                -> genera testo con Claude
 *   POST   /api?action=assistant         -> assistente con tool calling (legge/scrive i dati da solo)
 *   POST   /api?action=analizza_messaggio        -> legge la chat e decide appuntamenti/attività
 *   POST   /api?action=rispondi_richiesta_cliente -> il professionista decide su una richiesta del cliente
 *   POST   /api?action=seed              -> crea i dati iniziali dell'utente
 *
 *   GET    /api?resource=clients         -> elenco
 *   POST   /api?resource=clients         -> crea (body = oggetto o array)
 *   PATCH  /api?resource=clients&id=UUID -> modifica
 *   DELETE /api?resource=clients&id=UUID -> elimina
 *
 *   resource ammessi: profiles, clients, opportunities, employees, tasks,
 *   assigned_tasks, payments, incomes, goals, conversations, messages, documents,
 *   ai_audit_log, ai_request_log (questi ultimi due di sola lettura: GET soltanto)
 *
 * Tutte le chiamate (tranne GET /api) richiedono l'header:
 *   Authorization: Bearer <access_token dell'utente loggato>
 * ============================================================
 */

/* L'indirizzo del progetto Supabase deve essere solo il dominio.
   Se su Vercel è stato inserito con una coda (es. .../rest/v1/ oppure
   una barra finale), qui viene ripulito: così l'app funziona comunque
   invece di dare "Invalid path specified in request URL". */
function pulisciUrlSupabase(url){
  if(!url) return url;
  let u = url.trim();
  u = u.replace(/\/(rest|auth|storage|realtime)\/v\d+\/?$/i, ""); // toglie /rest/v1/ e simili
  u = u.replace(/\/+$/, "");                                      // toglie le barre finali
  return u;
}

const SUPABASE_URL = pulisciUrlSupabase(process.env.SUPABASE_URL);
const ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

/* Tabelle che l'app puo' leggere e scrivere. Qualsiasi altro nome viene
   rifiutato: evita che una richiesta manipolata tocchi tabelle di sistema. */
const ALLOWED_RESOURCES = new Set([
  "profiles",
  "clients",
  "opportunities",
  "employees",
  "tasks",
  "assigned_tasks",
  "payments",
  "incomes",
  "goals",
  "conversations",
  "messages",
  "documents",
  "ai_audit_log",
  "ai_request_log",
]);

/* Tabelle che hanno la colonna owner_id: compilata dal server, mai dal client,
   cosi' nessuno puo' scrivere dati fingendosi un altro utente. */
const OWNED_RESOURCES = new Set([
  "clients",
  "opportunities",
  "employees",
  "tasks",
  "assigned_tasks",
  "payments",
  "incomes",
  "goals",
  "conversations",
  "documents",
  "ai_audit_log",
  "ai_request_log",
]);

/* Tabelle leggibili ma non scrivibili dal client: il registro delle
   operazioni dell'AI (e il registro per turno) li scrive solo il
   backend, mai una richiesta esterna. */
const READ_ONLY_RESOURCES = new Set(["ai_audit_log", "ai_request_log"]);

/* Tabelle con il cestino: "eliminare" non cancella subito la riga, la
   marca con deleted_at. Da lì si può ripristinare o eliminare per
   sempre. profiles, documents (non usata), ai_audit_log e
   ai_request_log restano fuori: non sono liste di cose che un utente
   "cestina". */
const TRASHABLE_RESOURCES = new Set([
  "clients",
  "opportunities",
  "employees",
  "tasks",
  "assigned_tasks",
  "payments",
  "incomes",
  "goals",
  "conversations",
  "messages",
]);

/* ============================================================
   Utility
   ============================================================ */

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Cache-Control", "no-store");
}

function send(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
  return payload; // ogni "return send(...)" propaga così la risposta finale a chi ha chiamato, senza doverla ricostruire
}

function fail(message, status) {
  return Object.assign(new Error(message), { status: status || 400 });
}

/* Come fail(), ma marcata come guasto REALE della query (colonna/
   tabella mancante, database irraggiungibile) — mai un errore di
   validazione applicativa lanciato prima di arrivare a db(), né un
   "non trovato" legittimo lanciato dopo un risultato vuoto ma valido.
   Usata solo dentro db(): un unico punto, così la distinzione non può
   scollegarsi silenziosamente fra i due punti in cui serve. */
function dbFail(message, status) {
  return Object.assign(fail(message, status), { db_error: true });
}

async function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string" && req.body.length) {
    try { return JSON.parse(req.body); } catch { return {}; }
  }
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (!chunks.length) return {};
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); } catch { return {}; }
}

function checkEnv() {
  const missing = [];
  if (!SUPABASE_URL) missing.push("SUPABASE_URL");
  if (!ANON_KEY) missing.push("SUPABASE_ANON_KEY");
  if (!SERVICE_ROLE_KEY) missing.push("SUPABASE_SERVICE_ROLE_KEY");
  if (missing.length) {
    throw fail("Variabili d'ambiente mancanti su Vercel: " + missing.join(", "), 500);
  }
}

/* ============================================================
   Autenticazione: verifica che il token appartenga a un utente vero
   ============================================================ */

async function requireUser(req) {
  checkEnv();
  const header = req.headers.authorization || req.headers.Authorization || "";
  if (!header.startsWith("Bearer ")) throw fail("Token mancante", 401);

  const accessToken = header.slice(7).trim();
  if (!accessToken) throw fail("Token vuoto", 401);

  let r;
  try {
    /* La verifica del biglietto d'ingresso si fa con la chiave di servizio:
       e' quella pensata per il server ed e' sempre valida, a differenza
       della chiave pubblica che puo' esistere in formati diversi. */
    r = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${accessToken}` },
    });
  } catch (netErr) {
    console.error("Supabase irraggiungibile:", netErr);
    throw fail("Impossibile contattare il database: controlla SUPABASE_URL o riprova tra poco", 503);
  }

  if (!r.ok) {
    let dettaglio = "";
    try {
      const errBody = await r.json();
      dettaglio = errBody.msg || errBody.message || errBody.error_description || "";
    } catch (e) { /* corpo non leggibile */ }
    console.error("Verifica utente rifiutata da Supabase:", r.status, dettaglio);
    throw fail(
      "Sessione non valida o scaduta" + (dettaglio ? " (" + dettaglio + ")" : ""),
      401
    );
  }
  const user = await r.json();
  if (!user || !user.id) throw fail("Utente non riconosciuto", 401);

  return { user, accessToken };
}

/* ============================================================
   Accesso ai dati (PostgREST di Supabase)
   Il token dell'utente viene inoltrato: le regole di sicurezza del
   database (RLS) restano attive, quindi ognuno tocca solo i propri dati.
   ============================================================ */

async function db(path, options, accessToken) {
  let r;
  try {
    r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
      ...options,
      headers: {
        apikey: ANON_KEY,
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        ...(options && options.headers ? options.headers : {}),
      },
    });
  } catch (netErr) {
    console.error("Database irraggiungibile:", netErr);
    throw dbFail("Impossibile contattare il database, riprova tra poco", 503);
  }

  const text = await r.text();
  let parsed = null;
  if (text) { try { parsed = JSON.parse(text); } catch { parsed = text; } }

  if (!r.ok) {
    const msg = parsed && parsed.message ? parsed.message : "Errore database";
    throw dbFail(msg, r.status);
  }
  return parsed;
}

/* ============================================================
   CRUD generico su una tabella
   ============================================================ */

async function handleResource(req, res, resource, user, accessToken) {
  if (!ALLOWED_RESOURCES.has(resource)) {
    throw fail(`Risorsa non ammessa: ${resource}`, 400);
  }
  if (READ_ONLY_RESOURCES.has(resource) && req.method !== "GET") {
    throw fail(`Risorsa di sola lettura: ${resource}`, 405);
  }

  const url = new URL(req.url, "http://localhost");
  const id = url.searchParams.get("id");
  const trashable = TRASHABLE_RESOURCES.has(resource);

  if (req.method === "GET") {
    const filtroConversazione = resource === "messages" && url.searchParams.get("conversation_id")
      ? `conversation_id=eq.${url.searchParams.get("conversation_id")}&`
      : "";
    /* Senza ?cestino=1: solo le righe non eliminate (il comportamento
       normale). Con ?cestino=1: solo quelle nel cestino, per la
       schermata Cestino. */
    const filtroCestino = trashable
      ? (url.searchParams.get("cestino") === "1" ? "deleted_at=not.is.null&" : "deleted_at=is.null&")
      : "";
    const rows = await db(`${resource}?select=*&${filtroConversazione}${filtroCestino}order=created_at.asc`, { method: "GET" }, accessToken);
    return send(res, 200, { data: rows });
  }

  if (req.method === "POST") {
    const body = await readBody(req);
    const rows = Array.isArray(body) ? body : [body];
    if (!rows.length) throw fail("Nessun dato da inserire");

    const payload = rows.map((row) => {
      const clean = { ...row };
      delete clean.id;
      delete clean.created_at;
      if (OWNED_RESOURCES.has(resource)) clean.owner_id = user.id;
      return clean;
    });

    const created = await db(
      resource,
      { method: "POST", body: JSON.stringify(payload), headers: { Prefer: "return=representation" } },
      accessToken
    );
    return send(res, 201, { data: created });
  }

  if (req.method === "PATCH") {
    if (!id) throw fail("Parametro 'id' mancante");
    const body = await readBody(req);
    const patch = { ...body };
    delete patch.id;
    delete patch.owner_id;
    delete patch.created_at;

    const updated = await db(
      `${resource}?id=eq.${id}`,
      { method: "PATCH", body: JSON.stringify(patch), headers: { Prefer: "return=representation" } },
      accessToken
    );
    return send(res, 200, { data: updated });
  }

  if (req.method === "DELETE") {
    if (!id) throw fail("Parametro 'id' mancante");

    if (!trashable) {
      await db(`${resource}?id=eq.${id}`, { method: "DELETE" }, accessToken);
      return send(res, 200, { ok: true });
    }

    const permanente = url.searchParams.get("permanente") === "true";
    if (!permanente) {
      await db(
        `${resource}?id=eq.${id}`,
        { method: "PATCH", body: JSON.stringify({ deleted_at: new Date().toISOString() }) },
        accessToken
      );
      return send(res, 200, { ok: true, cestinato: true });
    }

    /* Eliminazione vera: solo su una riga già nel cestino. Impedisce
       di scavalcare il cestino per errore da una chiamata diretta. */
    const righe = await db(`${resource}?id=eq.${id}&select=deleted_at`, { method: "GET" }, accessToken);
    const riga = Array.isArray(righe) && righe[0];
    if (!riga) throw fail("Non trovato", 404);
    if (!riga.deleted_at) throw fail("Si può eliminare per sempre solo ciò che è già nel cestino", 400);

    await db(`${resource}?id=eq.${id}`, { method: "DELETE" }, accessToken);
    return send(res, 200, { ok: true, eliminato_per_sempre: true });
  }

  throw fail("Metodo non consentito", 405);
}

/* ============================================================
   Chiamata all'AI (Claude). La chiave resta sul server: l'app
   non la vede mai, quindi nessuno puo' rubarla dal telefono.
   ============================================================ */

async function handleAI(req, res) {
  if (req.method !== "POST") throw fail("Usa POST per questo endpoint", 405);
  if (!ANTHROPIC_API_KEY) throw fail("ANTHROPIC_API_KEY non impostata su Vercel", 500);

  const body = await readBody(req);
  const prompt = body.prompt;
  if (!prompt || typeof prompt !== "string") throw fail("Campo 'prompt' mancante");

  const maxTokens = Number(body.maxTokens) > 0 ? Math.min(Number(body.maxTokens), 2000) : 400;
  const model = typeof body.model === "string" && body.model ? body.model : "claude-sonnet-4-5";

  let r;
  try {
    r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        messages: [{ role: "user", content: prompt }],
      }),
    });
  } catch (netErr) {
    console.error("Anthropic irraggiungibile:", netErr);
    throw fail("Non riesco a contattare l'AI: " + netErr.message, 502);
  }

  if (!r.ok) {
    /* Diciamo il motivo vero (modello sbagliato, credito esaurito,
       chiave non valida...) invece di un generico "non ha risposto". */
    let motivo = "";
    try {
      const errJson = await r.json();
      motivo = (errJson.error && (errJson.error.message || errJson.error.type)) || "";
    } catch (e) {
      try { motivo = (await r.text()).slice(0, 200); } catch (e2) { /* niente */ }
    }
    console.error("Errore Anthropic:", r.status, motivo);
    throw fail(
      "L'AI ha rifiutato la richiesta (" + r.status + ")" + (motivo ? ": " + motivo : ""),
      502
    );
  }

  const data = await r.json();
  const text = (data.content || []).map((b) => b.text || "").join("").trim();
  if (!text) throw fail("Risposta AI vuota", 502);

  return send(res, 200, { text });
}

/* ============================================================
   ASSISTENTE AI — tool calling
   ------------------------------------------------------------
   L'AI non tocca mai il database direttamente. Riceve un elenco di
   funzioni che può chiedere di eseguire (i "tool"); questo file le
   esegue davvero, dopo aver controllato che l'utente sia autenticato,
   che il dato sia suo, che i parametri siano validi e che il record
   esista. Per le operazioni delicate (mandare un messaggio, annullare
   un impegno, spostarlo) l'esecuzione si ferma e aspetta una conferma
   esplicita dal professionista prima di procedere.
   ============================================================ */

const TOOL_MAX_ROUNDS = 8;
/* Valori di default pensati per un professionista vero. Sovrascrivibili da
   variabile d'ambiente SOLO per l'ambiente di staging (mai in produzione):
   la suite di valutazione (eval/live-check.js) manda molte più richieste
   in pochi minuti di quante ne farebbe mai una persona, e senza questa
   valvola sbatte sempre contro il limite prima di finire i casi.
   Richiede ANCHE AI_RATE_LIMIT_STAGING_CONFERMATO=si, non solo il numero:
   un progetto Vercel di produzione con una sola variabile copiata per
   sbaglio da staging non basta a cambiare il limite, serve la coppia
   intera — stesso principio del CONFIRM_STAGING di eval/reset-staging.js. */
const puoSovrascrivereRateLimit = process.env.AI_RATE_LIMIT_STAGING_CONFERMATO === "si";
const AI_RATE_LIMIT = (puoSovrascrivereRateLimit && Number(process.env.AI_RATE_LIMIT)) || 20; // richieste
const AI_RATE_WINDOW_SECONDS = (puoSovrascrivereRateLimit && Number(process.env.AI_RATE_WINDOW_SECONDS)) || 600; // 10 minuti

const TIPI_IMPEGNO = new Set(["incontro", "chiamata", "commissione"]);
const TIPI_DOCUMENTO = new Set(["preventivo", "fattura"]);
const STATI_CLIENTE = new Set(["attivo", "trattativa", "inattivo"]);

function eStringaNonVuota(v) { return typeof v === "string" && v.trim().length > 0; }

/* Il frontend incornicia la frase vera dell'utente tra virgolette
   ('...cosa deve fare: "fattura da 300 per Rossi"') e ci aggiunge dopo
   note di contesto con id e importi di documenti precedenti. Per
   controllare cosa ha detto DAVVERO l'utente (es. se c'è una cifra) serve
   solo la parte tra le prime virgolette; senza virgolette, tutto il testo. */
function testoDettoDallUtente(messaggio) {
  if (!eStringaNonVuota(messaggio)) return "";
  const m = messaggio.match(/"([^"]*)"/);
  return m ? m[1] : messaggio;
}
/* Parole di un nome o di una frase, per confronti: minuscole, senza
   accenti né punteggiatura ("Pietà, Raspadori!" -> ["pieta", "raspadori"]). */
function paroleNormalizzate(testo) {
  if (!eStringaNonVuota(testo)) return [];
  return testo.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(Boolean);
}

/* Regola del ricordo (25/09/2026, caso "preventivo per Raspadori" finito
   su Tommaso Greti, il cliente della richiesta precedente): se nella
   frase l'utente NOMINA qualcuno, vale quel nome — il ricordo delle
   richieste precedenti (note di contesto/focus) si usa solo quando la
   frase non nomina nessuno ("no, alle 11", "spostalo", "aggiungi 200").
   Lo decide il codice, non il modello: il modello si limita a copiare
   le parole del nome così come compaiono nella frase (nome_nella_frase),
   e qui si verifica che ci siano davvero. Restituisce il nome da cercare
   in anagrafica, oppure null se va bene quello dichiarato dal modello. */
const PAROLE_NON_NOME = new Set(["per", "a", "al", "alla", "di", "del", "della", "da", "dal", "dalla", "il", "la", "lo", "signor", "signora", "sig"]);
/* Il nome detto nella frase, ripulito ("per raspadori" -> "Raspadori"):
   "" se l'AI non ne ha copiato nessuno, null se le parole copiate NON
   sono davvero nella frase (inventate o prese dal contesto). */
function nomeDettoNellaFrase(nomeNellaFrase, testoUtente) {
  // l'AI a volte copia anche la preposizione: "per raspadori"
  const paroleOriginali = eStringaNonVuota(nomeNellaFrase)
    ? nomeNellaFrase.trim().split(/\s+/).filter((p) => !PAROLE_NON_NOME.has(paroleNormalizzate(p)[0]))
    : [];
  const paroleNome = paroleNormalizzate(paroleOriginali.join(" "));
  if (!paroleNome.length) return "";
  const paroleTesto = new Set(paroleNormalizzate(testoUtente));
  if (!paroleNome.every((p) => paroleTesto.has(p))) return null;
  return paroleOriginali.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(" ");
}
function nomeClienteDallaFrase(nomeNellaFrase, clienteDichiarato, testoUtente) {
  const detto = nomeDettoNellaFrase(nomeNellaFrase, testoUtente);
  // "" = nessun nome detto: vale il ricordo. null = parole non nella frase:
  // non le usiamo per decidere niente.
  if (!detto) return null;
  // Il nome dichiarato contiene già tutte le parole dette ("Dini" ->
  // "Mirco Dini"): è una precisazione del modello, va bene così.
  const paroleDichiarate = new Set(paroleNormalizzate(clienteDichiarato));
  if (paroleNormalizzate(detto).every((p) => paroleDichiarate.has(p))) return null;
  return detto;
}
function eNumero(v) { return typeof v === "number" && isFinite(v); }
function eUuid(v) { return typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v); }
function eIso(v) { return typeof v === "string" && !isNaN(new Date(v).getTime()); }

/* Distanza di Levenshtein tra due parole: quante lettere bisogna
   cambiare/aggiungere/togliere per passare dall'una all'altra. */
function distanzaLevenshtein(a, b) {
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    const curr = [i];
    for (let j = 1; j <= n; j++) {
      const costo = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + costo);
    }
    prev = curr;
  }
  return prev[n];
}

/* Due parole si considerano "quasi uguali" se la distanza tra loro è
   piccola rispetto alla lunghezza: tollera un paio di lettere diverse
   o mancanti (dettatura imprecisa: "Fabri"/"Fabris"/"Tabri" per
   "Fabbri"), ma non confonde parole davvero diverse tra loro. */
function paroleSimili(a, b) {
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 2) return false;
  const soglia = a.length <= 4 ? 1 : 2;
  return distanzaLevenshtein(a, b) <= soglia;
}

/* Gianardi, 23/09/2026: "Fabio Prini" è stato segnalato come "simile"
   a un cliente "Mario Bini" già in anagrafica — nomi in realtà del
   tutto diversi. Causa: confrontare OGNI parola del nome cercato
   contro OGNI parola del candidato, ciascuna con la propria soglia di
   tolleranza INDIPENDENTE (paroleSimili sopra), permette di sommare
   più "quasi uguale" separati (qui: "fabio"~"mario", 2 lettere diverse
   su 5, e "prini"~"bini", 2 lettere diverse su 5 — ciascuno da solo
   sotto soglia) fino a un nome finale completamente diverso nel suo
   insieme. Corretto: la tolleranza è UN budget unico di due lettere
   per l'INTERO nome (non due lettere per ogni singola parola), esatto
   quanto basta per una vera dettatura imprecisa su una singola parola
   ("Tabri" per "Fabbri", "Rossi" per "Rosi") ma non per due parole
   entrambe leggermente diverse insieme. Stesso numero di parole
   richiesto: un nome con una parola in più o in meno non passa più da
   qui (lo gestiscono già i livelli "esatto"/"per parola" prima di
   arrivare a questo, meno prudente, terzo tentativo). */
function nomeSomigliaA(paroleCercate, paroleCandidato) {
  if (paroleCercate.length !== paroleCandidato.length) return false;
  const usate = new Set();
  let totale = 0;
  for (const p of paroleCercate) {
    let migliore = Infinity, migliorIdx = -1;
    paroleCandidato.forEach((pc, i) => {
      if (usate.has(i)) return;
      const d = distanzaLevenshtein(p, pc);
      if (d < migliore) { migliore = d; migliorIdx = i; }
    });
    if (migliorIdx === -1) return false;
    usate.add(migliorIdx);
    totale += migliore;
  }
  return totale <= 2;
}

/* EON BRAIN, Entity Resolution uniforme (punto 3): stessa logica a tre
   livelli già usata da trova_o_crea_cliente (esatto -> substring per
   parola -> fuzzy, mai una corrispondenza fuzzy trattata come certa),
   ma qui è un puro lookup, mai una creazione. La chiama SEMPRE
   interpreta_richiesta quando l'entità dichiarata è di tipo "cliente"
   — non è mai il modello a decidere se cercarla o con quale tool: così
   un cliente ambiguo, inesistente o solo "simile" viene segnalato allo
   stesso modo qualunque sia il tool che il turno userà poi
   (crea_impegno, manda_messaggio, aggiorna_cliente, ...), invece di
   dipendere dal fatto che il modello si ricordi di chiamare
   cerca_cliente prima. Duplica volutamente parte della ricerca già
   presente in cerca_cliente/trova_o_crea_cliente invece di
   condividerla, per non rischiare di alterare il comportamento di due
   tool già in uso solo per introdurne uno nuovo. */
async function risolviClienteDaNome(nomeCercato, ctx) {
  const nome = nomeCercato.trim();
  const parole = nome.toLowerCase().split(/\s+/).filter(Boolean);
  const tutti = await db(`clients?select=id,name,phone&deleted_at=is.null&limit=500`, { method: "GET" }, ctx.accessToken);
  const lista = Array.isArray(tutti) ? tutti : [];

  let candidati = lista.filter((c) => c.name.trim().toLowerCase() === nome.toLowerCase());
  if (candidati.length === 0) {
    candidati = lista.filter((c) => {
      const basso = c.name.toLowerCase();
      return parole.every((p) => basso.includes(p));
    });
  }
  if (candidati.length === 1) return { stato: "trovato", id: candidati[0].id, nome: candidati[0].name, telefono: candidati[0].phone || null };
  if (candidati.length > 1) return { stato: "ambiguo", candidati: candidati.map((c) => ({ id: c.id, nome: c.name, telefono: c.phone || null })) };

  /* Nessuna corrispondenza esatta/per parola: un'unica corrispondenza
     "simile" (dettatura imprecisa) non è mai trattata come certa —
     stato distinto da "trovato", perché chi la riceve deve chiedere
     conferma invece di usarla direttamente. */
  const simili = lista.filter((c) => {
    const paroleCliente = c.name.toLowerCase().split(/\s+/).filter(Boolean);
    return nomeSomigliaA(parole, paroleCliente);
  });
  if (simili.length === 1) return { stato: "simile", id: simili[0].id, nome: simili[0].name, telefono: simili[0].phone || null };
  if (simili.length > 1) return { stato: "ambiguo", candidati: simili.map((c) => ({ id: c.id, nome: c.name, telefono: c.phone || null })) };

  return { stato: "non_trovato", nome_cercato: nome };
}

/* "2026-09-01T08:00:00" -> "mar 1 set, 08:00": lo stesso formato che
   l'app già usa per mostrare gli impegni. Lo decide sempre il server,
   mai il modello, così il formato resta coerente in tutta l'app. */
function formattaQuando(iso) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const giorno = d.toLocaleDateString("it-IT", { weekday: "short", day: "numeric", month: "short" }).replace(".", "");
  const ore = String(d.getHours()).padStart(2, "0");
  const minuti = String(d.getMinutes()).padStart(2, "0");
  return `${giorno}, ${ore}:${minuti}`;
}

/* Legge un record e lo restituisce solo se esiste ed è dell'utente:
   grazie a RLS, una riga di un altro professionista non torna proprio,
   quindi "non trovato" e "non tuo" sono indistinguibili per chi chiama
   (non riveliamo mai che un dato altrui esiste). */
async function trovaProprio(resource, id, ctx) {
  if (!eUuid(id)) return null;
  const filtroCestino = TRASHABLE_RESOURCES.has(resource) ? "&deleted_at=is.null" : "";
  const righe = await db(`${resource}?id=eq.${id}&select=*${filtroCestino}`, { method: "GET" }, ctx.accessToken);
  return Array.isArray(righe) && righe.length ? righe[0] : null;
}

/* Un "impegno" (per sposta_impegno/annulla_impegno/elimina_impegno) è o
   un appuntamento dentro messages, o un task: si cerca nell'uno, poi
   nell'altro. Usato sia per descrivere la conferma sia per eseguire
   l'azione, così i due posti non possono disallinearsi su dove si
   trova il record. */
async function trovaImpegno(id, ctx) {
  if (eUuid(id)) {
    const messaggio = await trovaProprio("messages", id, ctx);
    if (messaggio) return { tabella: "messages", record: messaggio };
    const task = await trovaProprio("tasks", id, ctx);
    if (task) return { tabella: "tasks", record: task };
    return null;
  }

  /* Nonostante le istruzioni di cercare prima con cerca_impegno, l'AI
     a volte passa qui il titolo invece di un id vero: proviamo a
     risolverlo noi stessi cercandolo per titolo, così un'imprecisione
     del modello non si traduce in un banale "non trovato" per
     l'utente. Se il titolo è ambiguo, rinunciamo: meglio segnalarlo
     che agire sul record sbagliato. */
  if (!eStringaNonVuota(id)) return null;
  /* "*" e "_" sono caratteri jolly per ilike (il primo lo usiamo noi
     stessi per il "contiene"; il secondo è jolly nativo di LIKE) — se
     comparissero dentro id (es. un titolo con un trattino basso, o un
     asterisco rimasto da una formattazione) allargherebbero la ricerca
     ben oltre il previsto, con il rischio concreto di far sembrare
     "unico" un risultato trovato per un motivo sbagliato, su un
     percorso che poi scrive/cancella davvero. Li rendiamo letterali. */
  const q = encodeURIComponent(id.trim().replace(/[\\%_*]/g, (c) => "\\" + c));
  /* Gli annullati vanno esclusi DENTRO la query, non dopo: un limite
     applicato prima di scartarli potrebbe tagliare via proprio i
     risultati ancora vivi (es. venti righe con lo stesso titolo, quasi
     tutte annullate: se il limite arrivasse prima del filtro, i pochi
     vivi potrebbero restare fuori dalle prime venti). Il limite resta
     comunque, come rete di sicurezza finale contro un titolo così
     ricorrente da avere decine di impegni ancora attivi. */
  const [messaggi, task] = await Promise.all([
    db(`messages?select=*&event_type=eq.appt&title=ilike.*${q}*&title=not.ilike.${encodeURIComponent("❌")}*&deleted_at=is.null&limit=20`, { method: "GET" }, ctx.accessToken),
    db(`tasks?select=*&title=ilike.*${q}*&status=neq.done&status=neq.annullato&deleted_at=is.null&limit=20`, { method: "GET" }, ctx.accessToken),
  ]);
  const candidati = [
    ...(messaggi || []).map((m) => ({ tabella: "messages", record: m })),
    ...(task || []).map((t) => ({ tabella: "tasks", record: t })),
  ];
  if (candidati.length > 1) {
    throw fail(`Più di un impegno corrisponde a "${id.trim()}": trova prima l'id giusto con cerca_impegno.`, 409);
  }
  return candidati.length === 1 ? candidati[0] : null;
}

/* Se trovaImpegno ha dovuto risolvere un titolo (perché l'AI non ha
   passato un id vero), fissiamo qui l'id trovato dentro l'input: così
   describe() ed esecuzione operano di sicuro sullo stesso record,
   anche se qualcosa cambia nel frattempo (un impegno con lo stesso
   titolo creato o cancellato tra la conferma richiesta e quella
   ricevuta). Senza questo, la ricerca per titolo verrebbe ripetuta due
   volte, con il rischio di risolversi in modo diverso le due volte. */
function fissaIdRisoltoImpegno(input, trovato) {
  if (trovato && !eUuid(input.id)) input.id = trovato.record.id;
}

async function trovaOCreaConversazione(cliente, ctx) {
  const nome = encodeURIComponent(cliente.name);
  const trovate = await db(`conversations?select=*&contact_name=eq.${nome}&deleted_at=is.null&limit=1`, { method: "GET" }, ctx.accessToken);
  if (Array.isArray(trovate) && trovate.length) return trovate[0];

  /* Se la conversazione esiste ma è nel cestino, la ripristiniamo
     invece di crearne una seconda: sono la stessa conversazione, e
     due copie separerebbero la cronologia dei messaggi del cliente. */
  const cestinate = await db(`conversations?select=*&contact_name=eq.${nome}&deleted_at=not.is.null&order=deleted_at.desc&limit=1`, { method: "GET" }, ctx.accessToken);
  if (Array.isArray(cestinate) && cestinate.length) {
    const ripristinata = await db(
      `conversations?id=eq.${cestinate[0].id}`,
      { method: "PATCH", body: JSON.stringify({ deleted_at: null }), headers: { Prefer: "return=representation" } },
      ctx.accessToken
    );
    return Array.isArray(ripristinata) ? ripristinata[0] : cestinate[0];
  }

  const creata = await db(
    "conversations",
    {
      method: "POST",
      body: JSON.stringify({
        owner_id: ctx.user.id,
        contact_name: cliente.name,
        is_client: true,
        is_prospect: cliente.status === "trattativa",
        is_archived: false,
        to_see_today: false,
        to_call_today: false,
      }),
      headers: { Prefer: "return=representation" },
    },
    ctx.accessToken
  );
  return Array.isArray(creata) ? creata[0] : creata;
}

/* Whitelist DELIBERATAMENTE STRETTA di strumenti "conclusivi": quelli
   il cui risultato non serve MAI a un altro strumento chiamato più
   avanti nello stesso turno (nessun id che qualcos'altro potrebbe
   aspettarsi). Usata solo per decidere se si può evitare un giro in
   più con Claude a fine turno (vedi il controllo più sotto). Una
   blacklist ("quali escludere") si è dimostrata fragile in fase di
   revisione — trova_o_crea_cliente e crea_cliente producono un id
   quasi sempre destinato a un tool successivo (es. manda_messaggio,
   crea_impegno con cliente_id) e sono stati scoperti solo dopo due
   giri di controllo mirato. Con una whitelist invece uno strumento
   nuovo o non ancora verificato resta escluso per prudenza di default,
   invece di rischiare di essere incluso per errore: se in futuro se ne
   aggiunge uno, va confermato con cura che il suo risultato non sia
   mai il parametro obbligatorio di un altro tool prima di metterlo
   qui. */
const STRUMENTI_SEMPRE_CONCLUSIVI = new Set(["crea_impegno", "crea_appunto", "correggi_appunto", "aggiorna_cliente"]);

/* ------------------------------------------------------------
   Elenco dei tool. Ognuno ha:
   - schema: la definizione che vede Claude (nome, descrizione, parametri)
   - risk: quanto è delicato lo strumento —
       "read"         legge soltanto, nessuna scrittura
       "low_write"    scrive, ma è un'azione ordinaria e reversibile
                       (creare/correggere un appunto, un impegno, un
                       cliente, aggiornarne i dati)
       "high_impact"  scrive qualcosa di difficile da annullare per
                       l'utente (eliminare, spostare, annullare, svuotare)
       "external"     l'effetto è visibile a qualcuno fuori dall'app
                       (mandare un messaggio a un cliente)
     Solo "high_impact" ed "external" richiedono la conferma
     dell'utente prima di eseguire — vedi richiedeConferma() più sotto.
   - annullabileSubito: (17/09/2026, richiesto da Gianardi — "Fatto,
     annulla" invece di "sei sicuro?", come Gmail/Trello/Notion) per un
     tool "high_impact" che è GIÀ reversibile di suo (va nel Cestino):
     esegue subito, SENZA fermarsi a chiedere conferma prima — il
     frontend mostra un avviso con la possibilità di annullare per
     pochi secondi invece del blocco preventivo. Non cambia `risk`
     (resta "high_impact": l'impatto reale non è diminuito, cambia solo
     COME lo si protegge — prima o dopo l'esecuzione), vedi
     richiedeConferma() più sotto. Usarlo solo quando l'azione è
     davvero recuperabile subito (un ripristino dal Cestino, non una
     cancellazione per sempre) — mai su svuota_cestino o manda_messaggio,
     dove "prima" resta l'unico momento sicuro per fermarsi.
   - categoria: la NATURA di ciò su cui il tool opera, non quanto è
     delicato (quello è "risk", sopra: i due campi sono ortogonali) —
       "risorsa"       mostra/recupera qualcosa che esiste o va
                       prodotto (un dato, un elenco, un documento)
       "azione"        crea/modifica/cancella qualcosa nel sistema
                       operativo (impegni, appunti, anagrafica)
       "comunicazione" manda qualcosa a un destinatario
       "supporto"      strumento interno che aiuta a risolvere
                       un'entità o l'intento, non è mai la risposta
                       finale a una richiesta dell'utente
     Usata dall'orchestratore in proseguiAssistente() per impedire che
     un tool "azione" (es. crea_impegno) venga usato come ripiego per
     soddisfare una richiesta che l'IntentFrame ha classificato come
     "risorsa" — vedi interpreta_richiesta più sotto e il controllo
     subito prima dell'esecuzione dei tool nel loop principale.
   - describe: (solo per high_impact/external) genera la domanda da
     mostrare per la conferma
   - run: la funzione vera, eseguita solo lato server
   ------------------------------------------------------------ */
function richiedeConferma(tool) {
  if (tool.annullabileSubito) return false;
  return tool.risk === "high_impact" || tool.risk === "external";
}

/* Tool interni (mai il vero risultato finale per l'utente): non
   finiscono in azioniEseguite/risposta.azioni, per non far credere al
   frontend che sia stata fatta un'azione visibile. Restano comunque
   loggati in ai_audit_log come ogni altro tool, tramite registraOperazione. */
const STRUMENTI_INTERNI = new Set(["interpreta_richiesta", "capacita_non_disponibile"]);

/* Regole che bloccano un tool di categoria "azione" quando l'IntentFrame
   dichiarato con interpreta_richiesta dice che l'utente voleva altro —
   un tool "azione" non può fare da ripiego silenzioso. Tabella invece
   di un if per regola perché la checklist di composizione (TODO.md,
   "EON BRAIN, roadmap operativa verso la beta") prevede esplicitamente
   che se ne aggiungano altre nel tempo: aggiungere una voce qui, non
   duplicare il blocco che la applica (vedi il ciclo in
   proseguiAssistente() che itera questa tabella).

   - "risorsa": l'utente voleva vedere/recuperare qualcosa che esiste o
     dovrebbe esistere, non far registrare un'azione. Ha uno scarico
     esplicito in estraiIntentoDaMessaggi (torna null quando l'ultima
     dichiarazione è capacita_non_disponibile), quindi si applica anche
     alle continuazioni: il limite dichiarato onestamente sblocca da
     solo l'azione di ripiego che l'utente accetta subito dopo.
   - "consulta": una domanda di parere non è mai, di per sé, un impegno
     (EON BRAIN, roadmap 1.2, correzione Test 1 — prima di questa
     regola il codice non aveva NESSUN argine per questo scenario,
     solo il testo del prompt, dimostratosi insufficiente da solo in
     produzione). A differenza di "risorsa", un parere dato in puro
     testo NON lascia traccia in estraiIntentoDaMessaggi (che scarta i
     messaggi senza tool_use e continua a risalire) — quindi qui serve
     !runId: senza, il turno in cui l'utente accetta l'offerta del
     parere ("ok, segnamelo", una continuazione) troverebbe ancora
     l'intento "consulta" originale e bloccherebbe esattamente il
     crea_impegno che il prompt chiede di eseguire in quel caso. Il
     rischio che questa regola previene (saltare il parere e chiamare
     subito un'azione) può avvenire solo nel giro deciso del messaggio
     nuovo comunque — una continuazione non passa mai da qui senza che
     l'utente abbia già risposto nel frattempo.

   Eccezione "produceRisorsa" (25/09/2026, causa vera di giorni di bug
   su fatture/preventivi): crea_preventivo_o_fattura e
   modifica_preventivo_o_fattura sono di categoria "azione" ma PRODUCONO
   proprio la risorsa chiesta — e per un preventivo/una fattura il
   modello dichiara quasi sempre oggetto "risorsa" (la descrizione di
   interpreta_richiesta lo suggerisce apertamente). La regola "risorsa"
   li bloccava in silenzio (un blocco non passa da registraOperazione,
   quindi non restava nemmeno in ai_audit_log), con un messaggio che
   diceva al modello di chiamare capacita_non_disponibile: ecco i giri a
   vuoto (ridichiarazioni per aggirare il blocco), il silenzio per tempo
   scaduto e il falso "non riesco a creare il preventivo". Verificato su
   ai_audit_log: ogni creazione riuscita è arrivata solo dopo che il
   modello aveva ridichiarato oggetto "azione". */
const REGOLE_GUARDRAIL_AZIONE = [
  {
    /* L'eccezione vale solo se l'utente vuole davvero creare/correggere il
       documento: per "mostrami il preventivo di Rossi" (operazione
       "mostra") il blocco resta, mai un documento nuovo al posto di
       recuperare quello che c'è. */
    condizione: (intento, runId, tool) => intento && intento.oggetto === "risorsa"
      && !(tool && tool.produceRisorsa && (intento.operazione === "crea" || intento.operazione === "modifica")),
    messaggio: (nomeTool) => `Questa richiesta è stata classificata come "mostra/recupera una risorsa", non come un'azione da registrare: ${nomeTool} non è lo strumento giusto. Se non hai un tool che recuperi davvero questa risorsa, chiama capacita_non_disponibile invece di creare un impegno o un appunto.`,
  },
  {
    condizione: (intento, runId) => !runId && intento && intento.operazione === "consulta",
    messaggio: (nomeTool) => `Questa richiesta è stata classificata come "consulta" (una domanda di parere/confronto, nessuna azione sui dati): ${nomeTool} non è lo strumento giusto per rispondere. Rispondi con un parere reale in testo — chiama crea_impegno/crea_appunto solo se l'utente, DOPO aver sentito il tuo parere, te lo chiede esplicitamente.`,
  },
];

const TOOLS = {

  cerca_cliente: {
    risk: "read",
    categoria: "risorsa",
    schema: {
      name: "cerca_cliente",
      description: "Trova clienti in anagrafica per nome, anche parziale. Usalo per ottenere l'id di un cliente prima di collegargli un impegno o un messaggio.",
      input_schema: {
        type: "object",
        properties: { nome: { type: "string", description: "Nome o parte del nome del cliente da cercare" } },
        required: ["nome"],
      },
    },
    async run(input, ctx) {
      if (!eStringaNonVuota(input.nome)) throw fail("Parametro 'nome' mancante o vuoto");
      const nome = input.nome.trim();
      const q = encodeURIComponent(nome);
      let righe = await db(`clients?select=id,name,phone,value,status&name=ilike.*${q}*&deleted_at=is.null&limit=5`, { method: "GET" }, ctx.accessToken);
      righe = Array.isArray(righe) ? righe : [];

      /* Se la ricerca esatta non trova nulla, proviamo a tollerare
         piccoli errori di dettatura (es. "Fabri" per "Fabbri") prima
         di dire che il cliente non esiste — altrimenti l'assistente
         rischia di crearne uno nuovo per un cliente che c'è già. */
      if (righe.length === 0) {
        const parole = nome.toLowerCase().split(/\s+/).filter(Boolean);
        const tutti = await db(`clients?select=id,name,phone,value,status&deleted_at=is.null&limit=500`, { method: "GET" }, ctx.accessToken);
        righe = (Array.isArray(tutti) ? tutti : [])
          .filter((c) => {
            const paroleCliente = c.name.toLowerCase().split(/\s+/).filter(Boolean);
            return nomeSomigliaA(parole, paroleCliente);
          })
          .slice(0, 5);
      }

      return {
        risultati: righe.map((r) => ({
          id: r.id, nome: r.name, telefono: r.phone || null, valore: r.value || null, stato: r.status || null,
        })),
      };
    },
  },

  elenca_appuntamenti: {
    risk: "read",
    categoria: "risorsa",
    schema: {
      name: "elenca_appuntamenti",
      description: "Elenca gli impegni già segnati in un intervallo di date (appuntamenti e task). Usalo SEMPRE — non solo prima di aggiungerne altri — ogni volta che l'utente chiede cosa ha in programma/che impegni ha/il riepilogo della giornata per oggi, domani o un altro periodo: mai rispondere che non conosci il suo programma, o chiedergli di ripeterlo, senza aver prima chiamato questo strumento per il periodo richiesto.",
      input_schema: {
        type: "object",
        properties: {
          da: { type: "string", description: "Inizio intervallo, data/ora in formato ISO 8601" },
          a: { type: "string", description: "Fine intervallo, data/ora in formato ISO 8601" },
        },
        required: ["da", "a"],
      },
    },
    async run(input, ctx) {
      if (!eIso(input.da) || !eIso(input.a)) throw fail("Parametri 'da'/'a' non validi: usa il formato ISO 8601");
      const filtro = `scheduled_at=gte.${encodeURIComponent(input.da)}&scheduled_at=lte.${encodeURIComponent(input.a)}&deleted_at=is.null`;
      const [appuntamenti, impegni] = await Promise.all([
        db(`messages?select=id,title,scheduled_at&event_type=eq.appt&${filtro}&order=scheduled_at.asc`, { method: "GET" }, ctx.accessToken),
        db(`tasks?select=id,title,scheduled_at,status&${filtro}&order=scheduled_at.asc`, { method: "GET" }, ctx.accessToken),
      ]);
      return {
        appuntamenti: (appuntamenti || []).map((m) => ({ id: m.id, titolo: m.title, quando: m.scheduled_at })),
        impegni: (impegni || [])
          .filter((t) => t.status !== "done" && t.status !== "annullato")
          .map((t) => ({ id: t.id, titolo: t.title, quando: t.scheduled_at })),
      };
    },
  },

  cerca_impegno: {
    risk: "read",
    categoria: "risorsa",
    schema: {
      name: "cerca_impegno",
      description: "Trova appuntamenti e impegni già segnati cercando nel titolo, anche solo con una parola (es. 'Rossi', 'sopralluogo'). Usalo per ottenere l'id di un impegno quando l'utente lo nomina invece di darti direttamente l'id o un intervallo di date — es. prima di sposta_impegno, annulla_impegno o elimina_impegno.",
      input_schema: {
        type: "object",
        properties: { testo: { type: "string", description: "Parola o frase da cercare nel titolo dell'impegno" } },
        required: ["testo"],
      },
    },
    async run(input, ctx) {
      if (!eStringaNonVuota(input.testo)) throw fail("Parametro 'testo' mancante o vuoto");
      const testoCercato = input.testo.trim();
      const q = encodeURIComponent(testoCercato);
      const [appuntamenti, impegni] = await Promise.all([
        db(`messages?select=id,title,scheduled_at&event_type=eq.appt&title=ilike.*${q}*&deleted_at=is.null&order=scheduled_at.asc&limit=10`, { method: "GET" }, ctx.accessToken),
        db(`tasks?select=id,title,scheduled_at,status&title=ilike.*${q}*&deleted_at=is.null&order=scheduled_at.asc&limit=10`, { method: "GET" }, ctx.accessToken),
      ]);
      let risultati = [
        ...(appuntamenti || [])
          .filter((m) => !m.title.startsWith("❌"))
          .map((m) => ({ id: m.id, titolo: m.title, quando: m.scheduled_at, tipo: "appuntamento" })),
        ...(impegni || [])
          .filter((t) => t.status !== "done" && t.status !== "annullato")
          .map((t) => ({ id: t.id, titolo: t.title, quando: t.scheduled_at, tipo: "impegno" })),
      ];

      /* Gianardi, 23/09/2026: "mi sposti il dottore alle 17" non trovava
         nessun impegno perché il titolo salvato era "Dottor Righi" —
         "dottore" non è una sottostringa letterale di "Dottor Righi"
         (manca la "e" finale), quindi il semplice ilike sopra fallisce
         anche quando il significato è ovvio. Stesso principio già usato
         per i clienti (paroleSimili/risolviClienteDaNome): quando la
         sottostringa esatta non trova nulla, riprova sulle singole
         parole con lo stesso confronto "quasi uguali", su un insieme
         più ampio di impegni non ancora conclusi. */
      if (risultati.length === 0) {
        const paroleCercate = testoCercato.toLowerCase().split(/\s+/).filter(Boolean);
        const corrisponde = (titolo) => {
          const paroleTitolo = titolo.toLowerCase().split(/\s+/).filter(Boolean);
          return paroleCercate.some((p) => paroleTitolo.some((pt) => paroleSimili(p, pt) || pt.startsWith(p) || p.startsWith(pt)));
        };
        const [tuttiAppuntamenti, tuttiImpegni] = await Promise.all([
          db(`messages?select=id,title,scheduled_at&event_type=eq.appt&deleted_at=is.null&order=scheduled_at.asc&limit=200`, { method: "GET" }, ctx.accessToken),
          db(`tasks?select=id,title,scheduled_at,status&deleted_at=is.null&order=scheduled_at.asc&limit=200`, { method: "GET" }, ctx.accessToken),
        ]);
        risultati = [
          ...(tuttiAppuntamenti || [])
            .filter((m) => !m.title.startsWith("❌") && corrisponde(m.title))
            .map((m) => ({ id: m.id, titolo: m.title, quando: m.scheduled_at, tipo: "appuntamento" })),
          ...(tuttiImpegni || [])
            .filter((t) => t.status !== "done" && t.status !== "annullato" && corrisponde(t.title))
            .map((t) => ({ id: t.id, titolo: t.title, quando: t.scheduled_at, tipo: "impegno" })),
        ].slice(0, 10);
      }

      return { risultati };
    },
  },

  storico_cliente: {
    risk: "read",
    categoria: "risorsa",
    schema: {
      name: "storico_cliente",
      description: "Riassunto di un cliente: dati anagrafici, ultimi messaggi e documenti.",
      input_schema: {
        type: "object",
        properties: { cliente_id: { type: "string", description: "Id del cliente (uuid), trovato con cerca_cliente" } },
        required: ["cliente_id"],
      },
    },
    async run(input, ctx) {
      const cliente = await trovaProprio("clients", input.cliente_id, ctx);
      if (!cliente) throw fail("Cliente non trovato", 404);

      const conv = await db(`conversations?select=id&contact_name=eq.${encodeURIComponent(cliente.name)}&deleted_at=is.null&limit=1`, { method: "GET" }, ctx.accessToken);
      const conversazione = Array.isArray(conv) && conv[0];

      let messaggi = [], documenti = [];
      if (conversazione) {
        [messaggi, documenti] = await Promise.all([
          db(`messages?select=sender,body,title,event_type,created_at&conversation_id=eq.${conversazione.id}&deleted_at=is.null&order=created_at.desc&limit=10`, { method: "GET" }, ctx.accessToken),
          db(`messages?select=id,title,created_at&conversation_id=eq.${conversazione.id}&event_type=eq.doc&deleted_at=is.null&order=created_at.desc&limit=10`, { method: "GET" }, ctx.accessToken),
        ]);
      }

      return {
        cliente: { id: cliente.id, nome: cliente.name, telefono: cliente.phone || null, valore: cliente.value || null, stato: cliente.status || null },
        ultimi_messaggi: (messaggi || []).reverse().map((m) => ({
          da: m.sender === "me" ? "professionista" : "cliente",
          testo: m.body || m.title || "",
          quando: m.created_at,
        })),
        documenti: (documenti || []).map((d) => ({ id: d.id, titolo: d.title, quando: d.created_at })),
      };
    },
  },

  leggi_conversazione: {
    risk: "read",
    categoria: "risorsa",
    schema: {
      name: "leggi_conversazione",
      description: "Legge gli ultimi messaggi scambiati con un cliente.",
      input_schema: {
        type: "object",
        properties: {
          cliente_id: { type: "string", description: "Id del cliente (uuid)" },
          limite: { type: "integer", description: "Quanti messaggi leggere, default 20" },
        },
        required: ["cliente_id"],
      },
    },
    async run(input, ctx) {
      const cliente = await trovaProprio("clients", input.cliente_id, ctx);
      if (!cliente) throw fail("Cliente non trovato", 404);
      const limite = eNumero(input.limite) ? Math.max(1, Math.min(input.limite, 50)) : 20;

      const conv = await db(`conversations?select=id&contact_name=eq.${encodeURIComponent(cliente.name)}&deleted_at=is.null&limit=1`, { method: "GET" }, ctx.accessToken);
      const conversazione = Array.isArray(conv) && conv[0];
      if (!conversazione) return { messaggi: [] };

      const messaggi = await db(
        `messages?select=sender,body,title,event_type,created_at&conversation_id=eq.${conversazione.id}&deleted_at=is.null&order=created_at.desc&limit=${limite}`,
        { method: "GET" },
        ctx.accessToken
      );
      return {
        messaggi: (messaggi || []).reverse().map((m) => ({
          da: m.sender === "me" ? "professionista" : "cliente",
          testo: m.body || m.title || "",
          quando: m.created_at,
        })),
      };
    },
  },

  trova_o_crea_cliente: {
    risk: "low_write",
    categoria: "supporto",
    schema: {
      name: "trova_o_crea_cliente",
      description: "Trova il cliente che corrisponde al nome dato, o lo crea se non esiste ancora. A differenza di cerca_cliente (che restituisce un elenco di possibili corrispondenze tra cui scegliere), questo restituisce SEMPRE un solo cliente con un id preciso: usalo quando serve collegare qualcosa (es. una foto appena scattata) a un cliente e ti serve un id certo, non un elenco. Passa il nome nell'ordine naturale italiano se lo conosci (es. \"Mario Rossi\", non \"Rossi Mario\") — funziona comunque anche nell'altro ordine. Se il nome è ambiguo (più clienti simili) lo strumento fallisce con un errore invece di indovinare: in quel caso chiedi tu all'utente il nome e cognome completi. Se cerca_impegno o cerca_cliente hanno già trovato più corrispondenze ambigue per lo stesso nome, chiedi prima all'utente quale intende invece di chiamare questo strumento a caso.",
      input_schema: {
        type: "object",
        properties: {
          nome: { type: "string", description: "Nome del cliente, come detto o scritto dal professionista" },
          telefono: { type: "string", description: "Telefono, solo se menzionato" },
        },
        required: ["nome"],
      },
    },
    async run(input, ctx) {
      if (!eStringaNonVuota(input.nome)) throw fail("Parametro 'nome' mancante o vuoto");
      const nome = input.nome.trim();
      const parole = nome.toLowerCase().split(/\s+/).filter(Boolean);

      /* Confrontiamo in JS, non con un filtro ilike sul server: un
         filtro sul solo nome esatto scritto (o una singola parola)
         avrebbe mancato "Mario Rossi" quando l'utente detta "Rossi
         Mario" — capita spesso, l'anagrafica lo salva in ordine
         naturale ma chi parla spesso dice prima il cognome. */
      const tutti = await db(`clients?select=id,name&deleted_at=is.null&limit=500`, { method: "GET" }, ctx.accessToken);
      const lista = Array.isArray(tutti) ? tutti : [];

      let candidati = lista.filter((c) => c.name.trim().toLowerCase() === nome.toLowerCase());
      if (candidati.length === 0) {
        candidati = lista.filter((c) => {
          const basso = c.name.toLowerCase();
          return parole.every((p) => basso.includes(p));
        });
      }

      /* Terzo tentativo: tollera piccoli errori di dettatura (es.
         "Fabri" o "Tabri" detto per "Fabbri") prima di arrenderci e
         creare un cliente nuovo — è il caso più costoso da sbagliare,
         perché crea un doppione invece di riusare quello giusto. A
         differenza dei primi due tentativi, però, una somiglianza non
         è mai certezza (cognomi brevi come "Conti"/"Conte" sono vicini
         quanto "Fabbri"/"Fabri"): non restituiamo mai una corrispondenza
         trovata solo per somiglianza come se fosse sicura, la segnaliamo
         con un errore così l'assistente può chiedere conferma invece di
         mischiare per sbaglio due clienti diversi. */
      if (candidati.length === 0) {
        const simili = lista.filter((c) => {
          const paroleCliente = c.name.toLowerCase().split(/\s+/).filter(Boolean);
          return nomeSomigliaA(parole, paroleCliente);
        });
        if (simili.length === 1) {
          throw fail(`Non ho trovato "${nome}" esatto, ma c'è un cliente simile già in anagrafica: "${simili[0].name}". Potrebbe essere una dettatura imprecisa dello stesso nome, oppure un cliente diverso: chiedi all'utente di confermare prima di procedere.`);
        }
        if (simili.length > 1) {
          throw fail(`Ci sono più clienti che assomigliano a "${nome}": chiedi all'utente il nome e cognome completi per essere sicuri di quale sia.`);
        }
      }

      if (candidati.length === 1) {
        return { id: candidati[0].id, nome: candidati[0].name, creato: false };
      }
      if (candidati.length > 1) {
        /* Meglio fermarsi con un errore chiaro (che l'assistente può
           girare all'utente in una domanda) che collegare qualcosa
           al cliente sbagliato senza che nessuno se ne accorga. */
        throw fail(`Ci sono più clienti che assomigliano a "${nome}": chiedi all'utente il nome e cognome completi per essere sicuri di quale sia.`);
      }

      const payload = { owner_id: ctx.user.id, name: nome, status: "trattativa" };
      if (eStringaNonVuota(input.telefono)) payload.phone = input.telefono.trim();
      const creati = await db("clients", { method: "POST", body: JSON.stringify(payload), headers: { Prefer: "return=representation" } }, ctx.accessToken);
      const c = Array.isArray(creati) ? creati[0] : creati;
      return { id: c.id, nome: c.name, creato: true };
    },
  },

  crea_appunto: {
    risk: "low_write",
    categoria: "azione",
    schema: {
      name: "crea_appunto",
      description: "Aggiunge un appunto libero del cantiere: una nota rapida senza data né scadenza. Usalo quando l'utente dice esplicitamente di segnargli/annotargli qualcosa negli appunti (es. \"segnami in appunti che devo vedere il costo del materiale\"). Non usarlo per cose con un orario o una scadenza: quelle sono impegni, usa crea_impegno.",
      input_schema: {
        type: "object",
        properties: { testo: { type: "string", description: "Il testo dell'appunto, come lo direbbe l'utente" } },
        required: ["testo"],
      },
    },
    async run(input, ctx) {
      if (!eStringaNonVuota(input.testo)) throw fail("Parametro 'testo' mancante o vuoto");
      const testo = input.testo.trim();
      const creati = await db(
        "cantiere_appunti",
        { method: "POST", body: JSON.stringify({ owner_id: ctx.user.id, testo }), headers: { Prefer: "return=representation" } },
        ctx.accessToken
      );
      const a = Array.isArray(creati) ? creati[0] : creati;
      return { id: a.id, testo: a.testo };
    },
  },

  correggi_appunto: {
    risk: "low_write",
    categoria: "azione",
    schema: {
      name: "correggi_appunto",
      description: "Corregge il testo di un appunto già esistente, senza crearne uno nuovo. Usalo quando l'utente dice \"correggi\", \"non è X ma Y\", \"ho sbagliato a dirti...\" riferendosi a un appunto. Se non specifica quale, correggi il più recente creato.",
      input_schema: {
        type: "object",
        properties: {
          cerca: { type: "string", description: "Una parola o frase per riconoscere quale appunto correggere tra quelli esistenti (es. una parola del testo sbagliato). Lascia vuoto per correggere semplicemente l'ultimo appunto creato." },
          testo_nuovo: { type: "string", description: "Il testo corretto e completo dell'appunto (non solo la parte cambiata)" },
        },
        required: ["testo_nuovo"],
      },
    },
    async run(input, ctx) {
      if (!eStringaNonVuota(input.testo_nuovo)) throw fail("Parametro 'testo_nuovo' mancante o vuoto");

      const recenti = await db(
        `cantiere_appunti?select=id,testo,created_at&deleted_at=is.null&order=created_at.desc&limit=20`,
        { method: "GET" },
        ctx.accessToken
      );
      const lista = Array.isArray(recenti) ? recenti : [];
      if (!lista.length) throw fail("Non ci sono ancora appunti da correggere");

      let bersaglio;
      if (eStringaNonVuota(input.cerca)) {
        /* Se l'utente ha indicato una parola per riconoscere l'appunto,
           deve trovarla davvero: altrimenti, invece di correggere in
           silenzio quello sbagliato (l'ultimo creato, magari su tutt'altro
           argomento), meglio fermarsi con un errore chiaro. */
        const q = input.cerca.trim().toLowerCase();
        const trovato = lista.find((a) => a.testo.toLowerCase().includes(q));
        if (!trovato) throw fail(`Non ho trovato nessun appunto recente che parli di "${input.cerca.trim()}": chiedi all'utente a quale appunto si riferisce.`);
        bersaglio = trovato;
      } else {
        bersaglio = lista[0];
      }

      const testoNuovo = input.testo_nuovo.trim();
      await db(
        `cantiere_appunti?id=eq.${bersaglio.id}`,
        { method: "PATCH", body: JSON.stringify({ testo: testoNuovo }), headers: { Prefer: "return=representation" } },
        ctx.accessToken
      );
      return { id: bersaglio.id, testo_precedente: bersaglio.testo, testo: testoNuovo };
    },
  },

  crea_cliente: {
    risk: "low_write",
    categoria: "azione",
    schema: {
      name: "crea_cliente",
      description: "Aggiunge un nuovo cliente in anagrafica. Usalo solo quando l'utente chiede esplicitamente di aggiungere un cliente, non per un normale impegno che nomina una persona.",
      input_schema: {
        type: "object",
        properties: {
          nome: { type: "string" },
          telefono: { type: "string" },
          valore: { type: "number", description: "Valore economico stimato del cliente, in euro" },
          note: { type: "string" },
        },
        required: ["nome"],
      },
    },
    async run(input, ctx) {
      if (!eStringaNonVuota(input.nome)) throw fail("Parametro 'nome' mancante o vuoto");
      const payload = { owner_id: ctx.user.id, name: input.nome.trim(), status: "trattativa" };
      if (eStringaNonVuota(input.telefono)) payload.phone = input.telefono.trim();
      if (eNumero(input.valore)) payload.value = input.valore;
      if (eStringaNonVuota(input.note)) payload.description = input.note.trim();

      const creati = await db("clients", { method: "POST", body: JSON.stringify(payload), headers: { Prefer: "return=representation" } }, ctx.accessToken);
      const c = Array.isArray(creati) ? creati[0] : creati;
      return { id: c.id, nome: c.name };
    },
  },

  aggiorna_cliente: {
    risk: "low_write",
    categoria: "azione",
    schema: {
      name: "aggiorna_cliente",
      description: "Modifica i dati di un cliente già esistente. Passa solo i campi che vuoi cambiare. Usalo solo quando l'utente chiede esplicitamente di modificare un cliente, non per un normale impegno.",
      input_schema: {
        type: "object",
        properties: {
          id: { type: "string", description: "Id del cliente (uuid)" },
          nome: { type: "string" },
          telefono: { type: "string" },
          valore: { type: "number" },
          stato: { type: "string", enum: ["attivo", "trattativa", "inattivo"] },
          note: { type: "string" },
        },
        required: ["id"],
      },
    },
    async run(input, ctx) {
      const cliente = await trovaProprio("clients", input.id, ctx);
      if (!cliente) throw fail("Cliente non trovato", 404);

      const patch = {};
      const cambiati = [];
      if (eStringaNonVuota(input.nome)) { patch.name = input.nome.trim(); cambiati.push("nome"); }
      if (eStringaNonVuota(input.telefono)) { patch.phone = input.telefono.trim(); cambiati.push("telefono"); }
      if (eNumero(input.valore)) { patch.value = input.valore; cambiati.push("valore"); }
      if (eStringaNonVuota(input.note)) { patch.description = input.note.trim(); cambiati.push("note"); }
      if (input.stato) {
        if (!STATI_CLIENTE.has(input.stato)) throw fail("Stato non valido: usa attivo, trattativa o inattivo");
        patch.status = input.stato; cambiati.push("stato");
      }
      if (!cambiati.length) throw fail("Nessun campo da aggiornare");

      await db(`clients?id=eq.${cliente.id}`, { method: "PATCH", body: JSON.stringify(patch), headers: { Prefer: "return=representation" } }, ctx.accessToken);
      return { id: cliente.id, aggiornato: cambiati };
    },
  },

  elimina_cliente: {
    risk: "high_impact",
    annullabileSubito: true,
    categoria: "azione",
    schema: {
      name: "elimina_cliente",
      description: "Sposta subito un cliente nel cestino (e la sua conversazione, se esiste): non lo cancella per sempre, l'utente vede un avviso con la possibilità di annullare per pochi secondi. Non serve chiedere conferma prima di chiamarlo: è già reversibile.",
      input_schema: {
        type: "object",
        properties: { id: { type: "string", description: "Id del cliente da eliminare, trovato prima con cerca_cliente" } },
        required: ["id"],
      },
    },
    async run(input, ctx) {
      const cliente = await trovaProprio("clients", input.id, ctx);
      if (!cliente) throw fail("Cliente non trovato", 404);

      await db(`clients?id=eq.${cliente.id}`, { method: "PATCH", body: JSON.stringify({ deleted_at: new Date().toISOString() }) }, ctx.accessToken);

      /* Il cliente è già cestinato a questo punto: se la conversazione
         fallisce, non deve sembrare che l'intera operazione sia fallita
         (l'utente crederebbe che nulla sia successo, mentre il cliente
         è già stato spostato) — la segnaliamo solo nell'esito. */
      let conversazioneEliminata = false;
      let conversationId = null;
      try {
        const conv = await db(`conversations?select=id&contact_name=eq.${encodeURIComponent(cliente.name)}&deleted_at=is.null&limit=1`, { method: "GET" }, ctx.accessToken);
        if (Array.isArray(conv) && conv.length) {
          await db(`conversations?id=eq.${conv[0].id}`, { method: "PATCH", body: JSON.stringify({ deleted_at: new Date().toISOString() }) }, ctx.accessToken);
          conversazioneEliminata = true;
          conversationId = conv[0].id;
        }
      } catch (err) {
        console.warn("Cliente eliminato ma la conversazione collegata no:", err.message);
      }

      /* conversation_id serve al frontend per poter ripristinare ANCHE
         la conversazione se l'utente tocca "Annulla" (vedi
         annullabileSubito sopra) — senza saperne l'id non potrebbe. */
      return { id: cliente.id, nome: cliente.name, conversazione_eliminata: conversazioneEliminata, conversation_id: conversationId };
    },
  },

  mostra_incassi: {
    risk: "read",
    categoria: "risorsa",
    schema: {
      name: "mostra_incassi",
      description: "Elenca gli incassi (pagamenti da clienti): chi deve ancora pagare e chi ha già pagato. Per default mostra solo quelli in sospeso (in attesa o scaduti); passa 'tutti':true per includere anche quelli già incassati. Puoi filtrare per nome cliente.",
      input_schema: {
        type: "object",
        properties: {
          cliente: { type: "string", description: "Nome del cliente su cui filtrare, se la richiesta riguarda una persona precisa" },
          tutti: { type: "boolean", description: "Se true, include anche gli incassi già ricevuti, non solo quelli in sospeso" },
        },
      },
    },
    async run(input, ctx) {
      let filtro = "select=id,client_name,description,amount,due_date,status&deleted_at=is.null&order=due_date.asc";
      if (eStringaNonVuota(input.cliente)) filtro += `&client_name=ilike.*${encodeURIComponent(input.cliente.trim())}*`;
      if (!input.tutti) filtro += "&status=neq.incassato";
      const righe = await db(`incomes?${filtro}`, { method: "GET" }, ctx.accessToken);
      return {
        incassi: (righe || []).map((r) => ({
          id: r.id, cliente: r.client_name, importo: r.amount, scadenza: r.due_date,
          stato: r.status, descrizione: r.description || null,
        })),
      };
    },
  },

  segna_incasso_ricevuto: {
    risk: "low_write",
    categoria: "azione",
    schema: {
      name: "segna_incasso_ricevuto",
      description: "Registra che un pagamento da un cliente è stato ricevuto. Se esiste già un incasso in sospeso per quel cliente lo segna come incassato; altrimenti ne crea uno nuovo già segnato come incassato (per un pagamento mai fatturato prima, es. contanti o bonifico diretto).",
      input_schema: {
        type: "object",
        properties: {
          cliente: { type: "string", description: "Nome del cliente che ha pagato" },
          importo: { type: "number", description: "Importo ricevuto in euro — obbligatorio se non esiste già un incasso in sospeso da aggiornare" },
          descrizione: { type: "string", description: "Cosa riguarda il pagamento, es. 'saldo lavoro bagno'" },
        },
        required: ["cliente"],
      },
    },
    async run(input, ctx) {
      if (!eStringaNonVuota(input.cliente)) throw fail("Parametro 'cliente' mancante o vuoto");
      const nome = input.cliente.trim();
      /* Niente limit:1 qui: un incasso attribuito al cliente sbagliato è
         l'errore più grave del settore (vedi libro/edile.md, "Catalogo
         errori critici") — meglio prendere qualche riga in più e
         verificare che il nome corrisponda a un solo cliente reale prima
         di scegliere quale aggiornare, invece di prendere alla cieca il
         primo risultato quando ce ne sono altri diversi. */
      const esistenti = await db(
        `incomes?select=id,client_name,amount,description&client_name=ilike.*${encodeURIComponent(nome)}*&status=neq.incassato&deleted_at=is.null&order=due_date.asc&limit=10`,
        { method: "GET" }, ctx.accessToken
      );
      if (Array.isArray(esistenti) && esistenti.length) {
        const nomiDistinti = [...new Set(esistenti.map((r) => r.client_name))];
        if (nomiDistinti.length > 1) {
          throw fail(`Più clienti diversi hanno un incasso in sospeso che corrisponde a "${nome}": ${nomiDistinti.join(", ")}. Chiedi all'utente a quale di questi si riferisce prima di registrare il pagamento.`);
        }
        /* Stesso cliente ma più di un incasso in sospeso (es. due
           acconti distinti): mai scegliere alla cieca quello con la
           scadenza più vicina (era il bug prima di questa correzione,
           trovato testando brain-comune-23) — solo se l'importo dato
           corrisponde a uno solo dei candidati lo usiamo per scegliere,
           altrimenti è un'ambiguità vera quanto quella tra clienti
           diversi sopra. */
        let record = esistenti[0];
        if (esistenti.length > 1) {
          const corrispondenti = eNumero(input.importo) ? esistenti.filter((r) => Number(r.amount) === Number(input.importo)) : [];
          if (corrispondenti.length === 1) {
            record = corrispondenti[0];
          } else {
            const opzioni = esistenti.map((r) => `${r.description || "senza descrizione"} (${r.amount} euro)`).join("; ");
            throw fail(`"${nome}" ha più di un incasso in sospeso: ${opzioni}. Chiedi all'utente a quale di questi si riferisce prima di registrare il pagamento — non scegliere quello con la scadenza più vicina per default.`);
          }
        }
        const patch = { status: "incassato" };
        if (eNumero(input.importo)) patch.amount = input.importo;
        if (eStringaNonVuota(input.descrizione)) patch.description = input.descrizione.trim();
        await db(`incomes?id=eq.${record.id}`, { method: "PATCH", body: JSON.stringify(patch), headers: { Prefer: "return=representation" } }, ctx.accessToken);
        return { id: record.id, cliente: nome, esito: "incasso_in_sospeso_aggiornato" };
      }
      if (!eNumero(input.importo)) throw fail("Non ho trovato un incasso in sospeso per questo cliente: serve l'importo per registrarne uno nuovo");
      const payload = {
        owner_id: ctx.user.id, client_name: nome, amount: input.importo,
        status: "incassato", due_date: new Date().toISOString().slice(0, 10),
      };
      if (eStringaNonVuota(input.descrizione)) payload.description = input.descrizione.trim();
      const creati = await db("incomes", { method: "POST", body: JSON.stringify(payload), headers: { Prefer: "return=representation" } }, ctx.accessToken);
      const r = Array.isArray(creati) ? creati[0] : creati;
      return { id: r.id, cliente: nome, esito: "nuovo_incasso_registrato" };
    },
  },

  crea_impegno: {
    risk: "low_write",
    categoria: "azione",
    schema: {
      name: "crea_impegno",
      description: "Segna un impegno nel calendario: un incontro, una telefonata o una commissione (qualsiasi altra cosa da fare: pratiche, acquisti, documenti). Chiamalo una volta per ogni impegno distinto nominato dall'utente, anche se ne ha nominati molti nella stessa frase.",
      input_schema: {
        type: "object",
        properties: {
          titolo: { type: "string", description: "Titolo breve e concreto, come lo direbbe l'utente" },
          quando_iso: { type: "string", description: "Data e ora in formato ISO 8601. Se l'utente non dice quando, usa le 08:00 del primo giorno utile: non lasciare mai un impegno senza data." },
          tipo: { type: "string", enum: ["incontro", "chiamata", "commissione"] },
          cliente_id: { type: "string", description: "Id del cliente collegato, se l'impegno riguarda una persona già in anagrafica (di solito già noto da cliente_risolto in interpreta_richiesta; altrimenti cercala prima con cerca_cliente)" },
        },
        required: ["titolo", "quando_iso", "tipo"],
      },
    },
    async run(input, ctx) {
      if (!eStringaNonVuota(input.titolo)) throw fail("Parametro 'titolo' mancante o vuoto");
      if (!eIso(input.quando_iso)) throw fail("Parametro 'quando_iso' non è una data valida");
      if (!TIPI_IMPEGNO.has(input.tipo)) throw fail("Tipo non valido: usa incontro, chiamata o commissione");

      const titolo = input.titolo.trim();
      const quandoVisualizzato = formattaQuando(input.quando_iso);

      let cliente = null;
      if (input.cliente_id) {
        cliente = await trovaProprio("clients", input.cliente_id, ctx);
        if (!cliente) throw fail("Cliente non trovato", 404);
      }

      if (input.tipo === "incontro" && cliente) {
        const conversazione = await trovaOCreaConversazione(cliente, ctx);
        const creato = await db(
          "messages",
          {
            method: "POST",
            body: JSON.stringify({
              conversation_id: conversazione.id,
              sender: "me",
              event_type: "appt",
              title: titolo,
              body: quandoVisualizzato,
              scheduled_at: input.quando_iso,
            }),
            headers: { Prefer: "return=representation" },
          },
          ctx.accessToken
        );
        const m = Array.isArray(creato) ? creato[0] : creato;
        return { id: m.id, titolo, quando_visualizzato: quandoVisualizzato, tipo: "incontro", cliente: cliente.name };
      }

      /* Se un task identico (stesso titolo, stessa data/ora) è già
         segnato e non è chiuso o annullato, non ne creiamo un doppione:
         capita se l'AI viene richiamata due volte sulla stessa frase
         (es. un doppio tap). Controlliamo anche la data, non solo il
         titolo: due impegni diversi possono chiamarsi allo stesso modo
         in giorni diversi ("Chiamare Mario" la settimana scorsa e di
         nuovo domani), e non devono fondersi in uno solo. */
      const esistente = await db(
        `tasks?select=id,title,time&title=ilike.${encodeURIComponent(titolo)}&scheduled_at=eq.${encodeURIComponent(input.quando_iso)}&status=neq.done&status=neq.annullato&deleted_at=is.null&limit=1`,
        { method: "GET" },
        ctx.accessToken
      );
      if (Array.isArray(esistente) && esistente.length) {
        const e = esistente[0];
        return { id: e.id, titolo: e.title, quando_visualizzato: e.time || quandoVisualizzato, tipo: input.tipo, gia_esistente: true };
      }

      const creato = await db(
        "tasks",
        {
          method: "POST",
          body: JSON.stringify({
            owner_id: ctx.user.id,
            title: titolo,
            owner_type: "user",
            status: "todo",
            time: quandoVisualizzato,
            scheduled_at: input.quando_iso,
          }),
          headers: { Prefer: "return=representation" },
        },
        ctx.accessToken
      );
      const t = Array.isArray(creato) ? creato[0] : creato;
      return { id: t.id, titolo, quando_visualizzato: quandoVisualizzato, tipo: input.tipo };
    },
  },

  sposta_impegno: {
    risk: "high_impact",
    categoria: "azione",
    schema: {
      name: "sposta_impegno",
      description: "Sposta un appuntamento o un impegno già esistente a una nuova data/ora. Richiede conferma dell'utente.",
      input_schema: {
        type: "object",
        properties: {
          id: { type: "string", description: "Id dell'impegno da spostare" },
          nuovo_quando_iso: { type: "string", description: "Nuova data/ora in formato ISO 8601" },
        },
        required: ["id", "nuovo_quando_iso"],
      },
    },
    async describe(input, ctx) {
      const quando = eIso(input.nuovo_quando_iso) ? formattaQuando(input.nuovo_quando_iso) : input.nuovo_quando_iso;
      const trovato = await trovaImpegno(input.id, ctx);
      fissaIdRisoltoImpegno(input, trovato);
      return `Spostare "${trovato ? trovato.record.title : "questo impegno"}" a ${quando}?`;
    },
    async run(input, ctx) {
      if (!eIso(input.nuovo_quando_iso)) throw fail("Parametro 'nuovo_quando_iso' non è una data valida");
      const quandoVisualizzato = formattaQuando(input.nuovo_quando_iso);

      const trovato = await trovaImpegno(input.id, ctx);
      if (!trovato) throw fail("Impegno non trovato", 404);
      const { tabella, record } = trovato;

      const patch = tabella === "messages"
        ? { body: quandoVisualizzato, scheduled_at: input.nuovo_quando_iso }
        : { time: quandoVisualizzato, scheduled_at: input.nuovo_quando_iso };
      await db(`${tabella}?id=eq.${record.id}`, { method: "PATCH", body: JSON.stringify(patch) }, ctx.accessToken);
      return { id: record.id, titolo: record.title, quando_visualizzato: quandoVisualizzato };
    },
  },

  annulla_impegno: {
    risk: "high_impact",
    categoria: "azione",
    schema: {
      name: "annulla_impegno",
      description: "Annulla un appuntamento o un impegno già esistente. Richiede conferma dell'utente.",
      input_schema: {
        type: "object",
        properties: { id: { type: "string", description: "Id dell'impegno da annullare" } },
        required: ["id"],
      },
    },
    async describe(input, ctx) {
      const trovato = await trovaImpegno(input.id, ctx);
      fissaIdRisoltoImpegno(input, trovato);
      return `Annullare "${trovato ? trovato.record.title : "questo impegno"}"?`;
    },
    async run(input, ctx) {
      const trovato = await trovaImpegno(input.id, ctx);
      if (!trovato) throw fail("Impegno non trovato", 404);
      const { tabella, record } = trovato;

      if (tabella === "messages") {
        /* scheduled_at a null lo toglie anche da elenca_appuntamenti
           (che filtra per intervallo di date): senza questo, un
           appuntamento annullato risulterebbe ancora "in programma". */
        await db(`messages?id=eq.${record.id}`, { method: "PATCH", body: JSON.stringify({ title: "❌ " + record.title + " (annullato)", scheduled_at: null }) }, ctx.accessToken);
      } else {
        await db(`tasks?id=eq.${record.id}`, { method: "PATCH", body: JSON.stringify({ status: "annullato" }) }, ctx.accessToken);
      }
      return { id: record.id, titolo: record.title };
    },
  },

  elimina_impegno: {
    risk: "high_impact",
    annullabileSubito: true,
    categoria: "azione",
    schema: {
      name: "elimina_impegno",
      description: "Sposta subito un appuntamento o un impegno nel cestino: non lo cancella per sempre, l'utente vede un avviso con la possibilità di annullare per pochi secondi. Non serve chiedere conferma prima di chiamarlo: è già reversibile. Diverso da annulla_impegno, che invece lo segna come annullato mantenendolo visibile nello storico.",
      input_schema: {
        type: "object",
        properties: { id: { type: "string", description: "Id dell'impegno da eliminare" } },
        required: ["id"],
      },
    },
    async run(input, ctx) {
      const trovato = await trovaImpegno(input.id, ctx);
      if (!trovato) throw fail("Impegno non trovato", 404);
      const { tabella, record } = trovato;
      await db(`${tabella}?id=eq.${record.id}`, { method: "PATCH", body: JSON.stringify({ deleted_at: new Date().toISOString() }) }, ctx.accessToken);
      /* tabella serve al frontend per sapere su quale tabella chiamare
         il ripristino se l'utente tocca "Annulla" (vedi annullabileSubito
         sopra) — un impegno può stare su "tasks" o su "messages"
         (incontro/chiamata dentro la chat di un cliente), non è ovvio
         da fuori quale delle due sia questa. */
      return { id: record.id, titolo: record.title, tabella };
    },
  },

  /* Gianardi, 23/09/2026: "mi fai preventivo a Mario Rampini per cambio
     porte da 1200+IVA" rispondeva sempre "non ho ancora uno strumento
     per creare preventivi, ti segno un promemoria" — anche quando
     l'utente aveva già dato tutti i dati serviti a farlo per davvero.
     Principio guida di Gianardi: "l'immediatezza tramite la
     comunicazione a voce/testo è il fondamento di tutte le attività di
     EON" — se i dati ci sono già, il documento va creato subito, non
     rimandato a un secondo momento nell'app.

     Stessa identica logica/formato già usata dalla creazione manuale
     in chat (index.html, apriDocumento/calcolaTotali/prossimoNumero):
     stesso oggetto "dati" salvato in messages.file_name (che il
     frontend sa già leggere e disegnare come scheda/PDF), stesso
     collegamento fattura -> entrata attesa. Non un sistema parallelo:
     un preventivo/fattura creato da qui è indistinguibile, per il
     resto dell'app, da uno compilato a mano. */
  crea_preventivo_o_fattura: {
    risk: "low_write",
    categoria: "azione",
    produceRisorsa: true, // vedi REGOLE_GUARDRAIL_AZIONE: mai bloccato dalla regola "risorsa"
    schema: {
      name: "crea_preventivo_o_fattura",
      description: "Crea SUBITO un preventivo o una fattura per un cliente, con le voci date dall'utente, e lo salva nella sua conversazione — visibile subito come scheda nell'app, esattamente come se fosse stato compilato a mano, mai solo un promemoria. Usalo quando l'utente chiede di fare/preparare un preventivo o una fattura E ha già dato almeno una voce con un prezzo. Se non ha ancora dato nessun dato (solo il nome del cliente e il tipo di documento, es. 'fammi un preventivo a Rossi'), NON chiamarlo: rispondi chiedendo tu prima i dati (cosa, quanto) in una risposta di testo — poi, quando li dà, chiamalo. Se il cliente nominato non esiste ancora in anagrafica, crealo prima con crea_cliente/trova_o_crea_cliente e usa l'id appena ottenuto, tutto nello stesso turno se i dati del documento ci sono già.",
      input_schema: {
        type: "object",
        properties: {
          cliente_id: { type: "string", description: "Id del cliente destinatario (di solito già noto da cliente_risolto, o appena creato con crea_cliente/trova_o_crea_cliente nello stesso turno)" },
          tipo: { type: "string", enum: ["preventivo", "fattura"] },
          voci: {
            type: "array",
            description: "Le voci del documento — almeno una",
            items: {
              type: "object",
              properties: {
                descrizione: { type: "string" },
                quantita: { type: "number", description: "Default 1 se l'utente non la specifica" },
                prezzo: { type: "number", description: "Prezzo unitario in euro, IVA esclusa" },
              },
              required: ["descrizione", "prezzo"],
            },
          },
          aliquota_iva: { type: "number", description: "Percentuale IVA, default 22 se non detta" },
          condizioni: { type: "string", description: "Termini di pagamento (fattura) o validità (preventivo); se non detto, ometti e verrà usato un default ragionevole" },
          note: { type: "string" },
        },
        required: ["cliente_id", "tipo", "voci"],
      },
    },
    async run(input, ctx) {
      if (!TIPI_DOCUMENTO.has(input.tipo)) throw fail("Tipo non valido: usa preventivo o fattura");
      if (!Array.isArray(input.voci) || !input.voci.length) throw fail("Serve almeno una voce con descrizione e prezzo");
      const cliente = await trovaProprio("clients", input.cliente_id, ctx);
      if (!cliente) throw fail("Cliente non trovato", 404);

      const voci = input.voci.map((v) => {
        if (!eStringaNonVuota(v.descrizione)) throw fail("Ogni voce del documento deve avere una descrizione");
        if (!eNumero(v.prezzo)) throw fail("Ogni voce del documento deve avere un prezzo");
        return { desc: v.descrizione.trim(), qta: eNumero(v.quantita) ? v.quantita : 1, prezzo: v.prezzo };
      });

      const aliquota = eNumero(input.aliquota_iva) ? input.aliquota_iva : 22;
      const imponibile = voci.reduce((t, v) => t + v.qta * v.prezzo, 0);
      const iva = (imponibile * aliquota) / 100;
      const totale = imponibile + iva;
      const anno = new Date().getFullYear();

      const [conversazione, tuttiDoc, righeProfilo] = await Promise.all([
        trovaOCreaConversazione(cliente, ctx),
        db(`messages?select=file_name&event_type=eq.doc&deleted_at=is.null`, { method: "GET" }, ctx.accessToken),
        db(`profiles?select=business_name,full_name&id=eq.${ctx.user.id}&limit=1`, { method: "GET" }, ctx.accessToken),
      ]);

      /* Stesso conteggio del frontend (prossimoNumero in index.html),
         ma sui documenti veri in database invece che sulle sole chat
         già caricate in memoria: numero progressivo per tipo e anno. */
      let contatore = 0;
      (Array.isArray(tuttiDoc) ? tuttiDoc : []).forEach((m) => {
        try {
          const d = JSON.parse(m.file_name);
          if (d && d.tipo === input.tipo && d.anno === anno) contatore++;
        } catch (err) { /* riga senza dati validi: non conta, non blocca */ }
      });
      const numero = `${contatore + 1}/${anno}`;
      const profilo = Array.isArray(righeProfilo) && righeProfilo[0];
      const professionista = (profilo && (profilo.business_name || profilo.full_name)) || "Il professionista";

      const dati = {
        tipo: input.tipo,
        numero,
        anno,
        data: new Date().toLocaleDateString("it-IT"),
        cliente: cliente.name,
        voci,
        imponibile,
        aliquota,
        iva,
        totale,
        condizioni: eStringaNonVuota(input.condizioni) ? input.condizioni.trim() : (input.tipo === "fattura" ? "30 giorni data fattura" : "30 giorni dalla data di emissione"),
        note: eStringaNonVuota(input.note) ? input.note.trim() : "",
        professionista,
      };

      const titolo = `${input.tipo === "fattura" ? "Fattura" : "Preventivo"} n. ${numero}`;
      const riassunto = voci.map((v) => v.desc).join(" · ");

      const creato = await db(
        "messages",
        {
          method: "POST",
          body: JSON.stringify({
            conversation_id: conversazione.id,
            sender: "me",
            event_type: "doc",
            title: titolo,
            body: riassunto,
            amount: totale,
            file_name: JSON.stringify(dati),
          }),
          headers: { Prefer: "return=representation" },
        },
        ctx.accessToken
      );
      const m = Array.isArray(creato) ? creato[0] : creato;

      let entrataCreata = false;
      if (input.tipo === "fattura") {
        try {
          await db(
            "incomes",
            {
              method: "POST",
              body: JSON.stringify({ owner_id: ctx.user.id, client_name: cliente.name, description: riassunto.slice(0, 60), amount: totale, due_date: null, status: "attesa" }),
              headers: { Prefer: "return=representation" },
            },
            ctx.accessToken
          );
          entrataCreata = true;
        } catch (err) {
          console.warn("Fattura creata ma non segnata tra le entrate attese:", err.message);
        }
      }

      return {
        id: m.id,
        tipo: input.tipo,
        numero,
        titolo,
        cliente: cliente.name,
        cliente_id: cliente.id,
        conversation_id: conversazione.id,
        totale,
        entrata_creata: entrataCreata,
        /* Dettaglio completo (voci, imponibile, IVA, condizioni, note,
           professionista) incluso qui, non solo il totale: il frontend
           può aprire subito una vera anteprima del documento appena
           creato, senza un secondo giro a recupera_documenti_cliente
           solo per rileggere quello che ha appena scritto lui stesso. */
        dati,
      };
    },
  },

  /* Corregge un preventivo/fattura già creato, sostituendo le voci (mai
     un aggiustamento parziale riga per riga: più semplice da ragionare,
     sia per il modello sia per chi rilegge il documento dopo — "ho
     rifatto il documento con questi dati", non "ho cambiato solo la
     riga 2"). Pensato per il tasto "Modifica" sulla scheda del
     documento (Gianardi, 25/09/2026): l'utente vede un errore, tocca
     Modifica, dice a voce cosa correggere, e questo tool riscrive il
     documento con gli stessi criteri di crea_preventivo_o_fattura
     (stesso numero/conversazione, ricalcola imponibile/IVA/totale). */
  modifica_preventivo_o_fattura: {
    risk: "low_write",
    categoria: "azione",
    produceRisorsa: true, // vedi REGOLE_GUARDRAIL_AZIONE: mai bloccato dalla regola "risorsa"
    schema: {
      name: "modifica_preventivo_o_fattura",
      description: "Corregge un preventivo o una fattura già creato (mai per crearne uno nuovo: per quello usa crea_preventivo_o_fattura). Usalo quando l'utente, guardando un documento già fatto, segnala che qualcosa è sbagliato (importo, voce, cliente sbagliato) e chiede di correggerlo — tipicamente dopo aver toccato 'Modifica' su quel documento. Sostituisce TUTTE le voci con quelle date: se l'utente vuole cambiare solo un dettaglio, ripeti comunque tutte le voci corrette (quelle invariate incluse), non solo quella nuova.",
      input_schema: {
        type: "object",
        properties: {
          documento_id: { type: "string", description: "Id del documento da correggere (di solito noto dal contesto: l'utente ha appena aperto/creato quel documento)" },
          voci: {
            type: "array",
            description: "Le voci corrette del documento, TUTTE (sostituiscono quelle esistenti) — almeno una",
            items: {
              type: "object",
              properties: {
                descrizione: { type: "string" },
                quantita: { type: "number", description: "Default 1 se l'utente non la specifica" },
                prezzo: { type: "number", description: "Prezzo unitario in euro, IVA esclusa" },
              },
              required: ["descrizione", "prezzo"],
            },
          },
          aliquota_iva: { type: "number", description: "Percentuale IVA, se non detta mantieni quella già presente nel documento" },
          condizioni: { type: "string", description: "Se non detto, mantieni quelle già presenti nel documento" },
          note: { type: "string", description: "Se non detto, mantieni quelle già presenti nel documento" },
        },
        required: ["documento_id", "voci"],
      },
    },
    async run(input, ctx) {
      if (!Array.isArray(input.voci) || !input.voci.length) throw fail("Serve almeno una voce con descrizione e prezzo");

      const righe = await db(`messages?select=id,conversation_id,file_name&id=eq.${input.documento_id}&event_type=eq.doc`, { method: "GET" }, ctx.accessToken);
      const riga = Array.isArray(righe) && righe[0];
      if (!riga) throw fail("Documento non trovato", 404);

      let datiEsistenti;
      try { datiEsistenti = JSON.parse(riga.file_name); } catch (err) { throw fail("Documento non leggibile, impossibile correggerlo"); }
      if (!TIPI_DOCUMENTO.has(datiEsistenti.tipo)) throw fail("Documento non valido: manca il tipo (preventivo/fattura)");

      const voci = input.voci.map((v) => {
        if (!eStringaNonVuota(v.descrizione)) throw fail("Ogni voce del documento deve avere una descrizione");
        if (!eNumero(v.prezzo)) throw fail("Ogni voce del documento deve avere un prezzo");
        return { desc: v.descrizione.trim(), qta: eNumero(v.quantita) ? v.quantita : 1, prezzo: v.prezzo };
      });

      const aliquota = eNumero(input.aliquota_iva) ? input.aliquota_iva : datiEsistenti.aliquota;
      const imponibile = voci.reduce((t, v) => t + v.qta * v.prezzo, 0);
      const iva = (imponibile * aliquota) / 100;
      const totale = imponibile + iva;

      const dati = {
        ...datiEsistenti,
        voci,
        aliquota,
        imponibile,
        iva,
        totale,
        condizioni: eStringaNonVuota(input.condizioni) ? input.condizioni.trim() : datiEsistenti.condizioni,
        note: eStringaNonVuota(input.note) ? input.note.trim() : datiEsistenti.note,
      };

      const riassunto = voci.map((v) => v.desc).join(" · ");
      const titolo = `${dati.tipo === "fattura" ? "Fattura" : "Preventivo"} n. ${dati.numero}`;

      await db(
        `messages?id=eq.${riga.id}`,
        {
          method: "PATCH",
          body: JSON.stringify({ title: titolo, body: riassunto, amount: totale, file_name: JSON.stringify(dati) }),
          headers: { Prefer: "return=minimal" },
        },
        ctx.accessToken
      );

      /* Se una fattura genera un'entrata attesa, il suo importo deve
         restare coerente col documento corretto — mai lasciare
         un'entrata con l'importo vecchio dopo aver corretto la fattura.
         L'entrata non ha un collegamento diretto all'id del documento
         (tabella incomes senza quella colonna), quindi la troviamo con
         la STESSA descrizione usata quando è stata creata — quella
         VECCHIA (da datiEsistenti, prima della correzione), non quella
         nuova appena calcolata: altrimenti, con voci cambiate, la
         ricerca non troverebbe mai la riga giusta. */
      if (dati.tipo === "fattura") {
        try {
          const riassuntoVecchio = (Array.isArray(datiEsistenti.voci) ? datiEsistenti.voci.map((v) => v.desc).join(" · ") : "").slice(0, 60);
          await db(
            `incomes?owner_id=eq.${ctx.user.id}&client_name=eq.${encodeURIComponent(dati.cliente)}&description=eq.${encodeURIComponent(riassuntoVecchio)}`,
            { method: "PATCH", body: JSON.stringify({ amount: totale, description: riassunto.slice(0, 60) }), headers: { Prefer: "return=minimal" } },
            ctx.accessToken
          );
        } catch (err) { /* nessuna entrata collegata da aggiornare, o già cambiata: non blocca la correzione del documento */ }
      }

      return { id: riga.id, tipo: dati.tipo, numero: dati.numero, titolo, cliente: dati.cliente, totale, dati };
    },
  },

  manda_messaggio: {
    risk: "external",
    categoria: "comunicazione",
    schema: {
      name: "manda_messaggio",
      description: "Invia un messaggio a un cliente nella chat interna. Richiede conferma dell'utente prima di essere inviato davvero.",
      input_schema: {
        type: "object",
        properties: {
          cliente_id: { type: "string", description: "Id del cliente destinatario" },
          testo: { type: "string", description: "Testo del messaggio" },
        },
        required: ["cliente_id", "testo"],
      },
    },
    async describe(input, ctx) {
      const cliente = await trovaProprio("clients", input.cliente_id, ctx);
      return `Inviare a ${cliente ? cliente.name : "questo cliente"}: "${input.testo}"?`;
    },
    async run(input, ctx) {
      if (!eStringaNonVuota(input.testo)) throw fail("Parametro 'testo' mancante o vuoto");
      const cliente = await trovaProprio("clients", input.cliente_id, ctx);
      if (!cliente) throw fail("Cliente non trovato", 404);

      const conversazione = await trovaOCreaConversazione(cliente, ctx);
      const creato = await db(
        "messages",
        { method: "POST", body: JSON.stringify({ conversation_id: conversazione.id, sender: "me", body: input.testo.trim() }), headers: { Prefer: "return=representation" } },
        ctx.accessToken
      );
      const m = Array.isArray(creato) ? creato[0] : creato;
      return { id: m.id, inviato_a: cliente.name };
    },
  },

  svuota_cestino: {
    risk: "high_impact",
    categoria: "azione",
    schema: {
      name: "svuota_cestino",
      description: "Elimina per sempre TUTTO ciò che si trova già nel cestino, in ogni categoria (clienti, conversazioni, messaggi, appuntamenti/impegni, pagamenti, incassi, obiettivi, dipendenti, opportunità, compiti assegnati): un unico comando che svuota tutto il cestino in una volta, non recuperabile dopo. Non tocca nulla che non sia già nel cestino. Usalo quando l'utente chiede di eliminare o svuotare il cestino definitivamente, non per eliminare un singolo elemento (per quello ci sono elimina_cliente/elimina_impegno, e il resto si elimina dalla schermata Cestino). Richiede conferma dell'utente.",
      input_schema: { type: "object", properties: {}, required: [] },
    },
    async describe(input, ctx) {
      /* Fissiamo QUI gli id esatti da eliminare (non solo il conteggio):
         run() userà proprio questi, non un filtro "tutto ciò che è nel
         cestino" rieseguito più tardi — altrimenti qualcosa cestinato nel
         frattempo (tra la domanda e la risposta dell'utente) verrebbe
         cancellato per sempre senza che l'utente l'abbia mai visto contare
         nella conferma. Stesso principio di fissaIdRisoltoImpegno. Una
         tabella che non si riesce a leggere ora resta fuori da _righe:
         run() non proverà a toccarla, invece di rischiare di cancellare
         più di quanto mostrato qui. */
      const tabelle = [...TRASHABLE_RESOURCES];
      const perTabella = await Promise.all(
        tabelle.map((tabella) =>
          db(`${tabella}?select=id&deleted_at=not.is.null`, { method: "GET" }, ctx.accessToken)
            .then((righe) => (Array.isArray(righe) ? righe.map((r) => r.id) : null))
            .catch(() => null)
        )
      );
      const righe = {};
      tabelle.forEach((tabella, i) => { if (perTabella[i]) righe[tabella] = perTabella[i]; });
      input._righe = righe;

      const totale = Object.values(righe).reduce((s, ids) => s + ids.length, 0);
      const nonLette = tabelle.filter((t, i) => perTabella[i] === null);
      if (totale === 0 && nonLette.length === 0) return "Il cestino è già vuoto: non c'è nulla da eliminare per sempre.";
      let domanda = `Il cestino contiene ${totale} element${totale === 1 ? "o" : "i"}: eliminarli per sempre? Non si potranno più recuperare.`;
      if (nonLette.length) domanda += " (Alcune categorie non si riescono a leggere ora: non verranno toccate.)";
      return domanda;
    },
    async run(input, ctx) {
      const righe = input._righe || {};
      /* Ogni tabella per conto suo, senza fermarsi alla prima che fallisce:
         se una fallisce le altre restano comunque svuotate, e lo segnaliamo
         nell'esito invece di far sembrare che l'intera operazione sia
         andata storta (stesso principio di elimina_cliente con la
         conversazione collegata). Elimina solo gli id fissati da describe(),
         mai un filtro "tutto il cestino" rieseguito ora. */
      const risultati = await Promise.all(
        Object.entries(righe).map(async ([tabella, ids]) => {
          if (!ids.length) return { tabella, eliminati: 0 };
          try {
            const filtroId = ids.map((id) => encodeURIComponent(id)).join(",");
            const cancellate = await db(
              `${tabella}?id=in.(${filtroId})&select=id`,
              { method: "DELETE", headers: { Prefer: "return=representation" } },
              ctx.accessToken
            );
            return { tabella, eliminati: Array.isArray(cancellate) ? cancellate.length : 0 };
          } catch (err) {
            console.warn(`Svuota cestino: ${tabella} fallita:`, err.message);
            return { tabella, eliminati: 0, errore: err.message };
          }
        })
      );
      const totaleEliminati = risultati.reduce((s, r) => s + r.eliminati, 0);
      const fallite = risultati.filter((r) => r.errore).map((r) => r.tabella);
      return { totale_eliminati: totaleEliminati, fallite };
    },
  },

  /* EON BRAIN, punto 4 (supporto alla visualizzazione delle risorse):
     recupera le foto del cantiere già caricate (tabella cantiere_foto,
     immagini su Supabase Storage) — non un impegno da segnare, una
     risorsa vera da mostrare. Se le foto sono taggate a un cliente
     preciso (client_id, opzionale su questa tabella) e quel cliente è
     già stato risolto da interpreta_richiesta, passa il suo id per
     filtrare solo le sue; altrimenti restituisce le più recenti.
     cantiere_id (05/09/2026) è un affinamento ulteriore, mai
     obbligatorio: solo quando un cliente ha più lavori distinti (vedi
     cerca_cantiere) e serve isolare le foto di uno specifico. */
  recupera_foto_cantiere: {
    risk: "read",
    categoria: "risorsa",
    schema: {
      name: "recupera_foto_cantiere",
      description: "Recupera le foto del cantiere già caricate nell'app, le più recenti per prime. Usalo quando l'utente chiede di vedere/mandare foto di un cantiere o di un lavoro — non crea_impegno/crea_appunto, che non le mostrerebbero mai davvero.",
      input_schema: {
        type: "object",
        properties: {
          cliente_id: { type: "string", description: "Id del cliente a cui sono taggate le foto cercate, se noto (di solito da cliente_risolto in interpreta_richiesta). Lascia vuoto per le foto più recenti in generale." },
          cantiere_id: { type: "string", description: "Id del cantiere/lavoro specifico, se noto (da cerca_cantiere) — usalo solo quando il cliente ha più di un lavoro e serve isolare le foto di uno in particolare, non per il caso comune di un solo lavoro" },
          limite: { type: "integer", description: "Quante foto restituire, default 10" },
        },
      },
    },
    async run(input, ctx) {
      if (eStringaNonVuota(input.cliente_id) && !eUuid(input.cliente_id)) throw fail("Id cliente non valido");
      if (eStringaNonVuota(input.cantiere_id) && !eUuid(input.cantiere_id)) throw fail("Id cantiere non valido");
      const limite = eNumero(input.limite) ? Math.max(1, Math.min(input.limite, 30)) : 10;
      let query = `cantiere_foto?select=id,url,client_id,cantiere_id,created_at&deleted_at=is.null&order=created_at.desc&limit=${limite}`;
      if (eStringaNonVuota(input.cantiere_id)) query += `&cantiere_id=eq.${encodeURIComponent(input.cantiere_id)}`;
      else if (eStringaNonVuota(input.cliente_id)) query += `&client_id=eq.${encodeURIComponent(input.cliente_id)}`;
      const righe = await db(query, { method: "GET" }, ctx.accessToken);
      const lista = Array.isArray(righe) ? righe : [];
      return { foto: lista.map((f) => ({ id: f.id, url: f.url, quando: f.created_at })) };
    },
  },

  /* Gianardi, 23/09/2026: "elimina la foto dell'armadio" falliva perché
     non esisteva nessuno strumento per farlo — EON offriva solo un
     promemoria. Stesso pattern di elimina_cliente/elimina_impegno:
     sposta subito nel cestino (recuperabile), nessuna conferma
     necessaria. Le foto non hanno un nome per essere scelte una per
     una a voce: senza un id preciso già noto dalla conversazione,
     elimina la più recente per il cliente/cantiere indicato — è il
     caso reale che serve davvero (l'ultima foto appena mostrata o
     caricata), non una selezione fine tra tante foto vecchie. */
  elimina_foto_cantiere: {
    risk: "high_impact",
    annullabileSubito: true,
    categoria: "azione",
    schema: {
      name: "elimina_foto_cantiere",
      description: "Sposta subito nel cestino (recuperabile) una foto del cantiere già caricata. Usalo quando l'utente chiede di eliminare/cancellare/togliere una foto. Non serve chiedere conferma prima di chiamarlo: è già reversibile.",
      input_schema: {
        type: "object",
        properties: {
          foto_id: { type: "string", description: "Id della foto esatta da eliminare, se già noto da un recupero recente in questa conversazione (recupera_foto_cantiere). Lascia vuoto per eliminare l'ultima foto caricata per il cliente/cantiere indicato." },
          cliente_id: { type: "string", description: "Id del cliente a cui è collegata la foto, se noto (di solito da cliente_risolto). Serve solo quando foto_id non è noto, per trovare l'ultima foto di quel cliente." },
          cantiere_id: { type: "string", description: "Id del cantiere/lavoro specifico, se noto — usalo solo quando il cliente ha più di un lavoro e serve isolare la foto di uno in particolare." },
        },
      },
    },
    async run(input, ctx) {
      let fotoId = input.foto_id;
      if (eStringaNonVuota(fotoId)) {
        if (!eUuid(fotoId)) throw fail("Id foto non valido");
      } else {
        if (eStringaNonVuota(input.cliente_id) && !eUuid(input.cliente_id)) throw fail("Id cliente non valido");
        if (eStringaNonVuota(input.cantiere_id) && !eUuid(input.cantiere_id)) throw fail("Id cantiere non valido");
        let query = `cantiere_foto?select=id&deleted_at=is.null&order=created_at.desc&limit=1`;
        if (eStringaNonVuota(input.cantiere_id)) query += `&cantiere_id=eq.${encodeURIComponent(input.cantiere_id)}`;
        else if (eStringaNonVuota(input.cliente_id)) query += `&client_id=eq.${encodeURIComponent(input.cliente_id)}`;
        const righe = await db(query, { method: "GET" }, ctx.accessToken);
        if (!Array.isArray(righe) || !righe.length) throw fail("Non trovo nessuna foto da eliminare.", 404);
        fotoId = righe[0].id;
      }
      await db(`cantiere_foto?id=eq.${fotoId}`, { method: "PATCH", body: JSON.stringify({ deleted_at: new Date().toISOString() }) }, ctx.accessToken);
      return { id: fotoId, tabella: "cantiere_foto" };
    },
  },

  /* Gianardi, 23/09/2026: "dammi il documento X" per un documento
     dell'impresa (non legato a un cliente: fatture fornitori, DDT,
     modelli, comunicazioni amministrative — la sezione "Documenti
     impresa" dell'app, tabella cantiere_documenti) rispondeva sempre
     "non ho accesso a documenti non collegati a un cliente", perché
     esisteva solo recupera_documenti_cliente (che legge dalla
     conversazione di un cliente, tabella messages) — nessuno strumento
     leggeva mai cantiere_documenti. Stesso pattern di
     recupera_foto_cantiere: sola lettura, nessuna conferma. */
  recupera_documenti_impresa: {
    risk: "read",
    categoria: "risorsa",
    schema: {
      name: "recupera_documenti_impresa",
      description: "Recupera i documenti dell'impresa già caricati nell'app nella sezione 'Documenti impresa' (non collegati a un cliente specifico: es. fatture fornitori, DDT, modelli, comunicazioni amministrative). Usalo quando l'utente chiede un documento e non sta parlando di un cliente in particolare — per i documenti/preventivi/fatture di un cliente usa invece recupera_documenti_cliente.",
      input_schema: {
        type: "object",
        properties: {
          nome: { type: "string", description: "Parte del nome del documento cercato, se l'utente lo nomina (anche se detto in modo simile/impreciso, es. per dettatura vocale) — usa una singola parola distintiva se il nome completo non da' risultati. Lascia vuoto per i documenti più recenti in generale." },
          limite: { type: "integer", description: "Quanti documenti restituire, default 10" },
        },
      },
    },
    async run(input, ctx) {
      const limite = eNumero(input.limite) ? Math.max(1, Math.min(input.limite, 30)) : 10;
      let query = `cantiere_documenti?select=id,nome,tipo,url,created_at&deleted_at=is.null&order=created_at.desc&limit=${limite}`;
      if (eStringaNonVuota(input.nome)) query += `&nome=ilike.*${encodeURIComponent(input.nome.trim())}*`;
      const righe = await db(query, { method: "GET" }, ctx.accessToken);
      const lista = Array.isArray(righe) ? righe : [];
      return { documenti: lista.map((d) => ({ id: d.id, titolo: d.nome, tipo: d.tipo, url: d.url, quando: d.created_at })) };
    },
  },

  /* EON BRAIN, 05/09/2026: un cliente può avere più lavori/cantieri nel
     tempo (raro ma reale, vedi libro/edile.md) — questo strumento
     elenca quelli di un cliente per disambiguare, sullo stesso
     principio di cliente_risolto: se ne trova più di uno, il chiamante
     (il prompt di sistema) deve chiedere quale, mai sceglierne uno a
     caso. */
  cerca_cantiere: {
    risk: "read",
    categoria: "risorsa",
    schema: {
      name: "cerca_cantiere",
      description: "Elenca i cantieri/lavori già registrati per un cliente. Usalo quando un cliente potrebbe avere più di un lavoro in corso e serve capire a quale si riferisce l'utente, prima di collegare una foto o un pagamento al cantiere giusto.",
      input_schema: {
        type: "object",
        properties: {
          cliente_id: { type: "string", description: "Id del cliente di cui elencare i cantieri" },
        },
        required: ["cliente_id"],
      },
    },
    async run(input, ctx) {
      if (!eStringaNonVuota(input.cliente_id) || !eUuid(input.cliente_id)) throw fail("Id cliente mancante o non valido");
      const righe = await db(
        `cantieri?select=id,nome,stato,created_at&client_id=eq.${encodeURIComponent(input.cliente_id)}&deleted_at=is.null&order=created_at.desc`,
        { method: "GET" }, ctx.accessToken
      );
      const lista = Array.isArray(righe) ? righe : [];
      return { cantieri: lista.map((c) => ({ id: c.id, nome: c.nome, stato: c.stato })) };
    },
  },

  crea_cantiere: {
    risk: "low_write",
    categoria: "azione",
    schema: {
      name: "crea_cantiere",
      description: "Registra un nuovo cantiere/lavoro per un cliente, con un nome breve che lo distingua (es. 'Bagno', 'Tetto', 'Ristrutturazione cucina'). Usalo quando l'utente segnala esplicitamente un nuovo lavoro per un cliente che ne ha già un altro, o chiede di tenerli distinti — non per il caso comune di un cliente con un solo lavoro, dove non serve creare nulla.",
      input_schema: {
        type: "object",
        properties: {
          cliente_id: { type: "string", description: "Id del cliente a cui appartiene il cantiere" },
          nome: { type: "string", description: "Nome breve che distingue questo lavoro dagli altri dello stesso cliente" },
        },
        required: ["cliente_id", "nome"],
      },
    },
    async run(input, ctx) {
      if (!eStringaNonVuota(input.cliente_id) || !eUuid(input.cliente_id)) throw fail("Id cliente mancante o non valido");
      if (!eStringaNonVuota(input.nome)) throw fail("Parametro 'nome' mancante o vuoto");
      const creati = await db(
        "cantieri",
        { method: "POST", body: JSON.stringify({ owner_id: ctx.user.id, client_id: input.cliente_id, nome: input.nome.trim() }), headers: { Prefer: "return=representation" } },
        ctx.accessToken
      );
      const c = Array.isArray(creati) ? creati[0] : creati;
      return { id: c.id, nome: c.nome };
    },
  },

  /* Amministratore di condominio: un "cliente" (`clients`) è già il
     Condominio (l'edificio) nel suo insieme — crea_cliente/cerca_cliente
     funzionano già per quello, senza bisogno di nulla di nuovo. Ciò che
     mancava (vedi audit di libro/amministratore.md, 17/09/2026) era solo
     l'insieme di PERSONE al suo interno: cerca_condomino/crea_condomino
     coprono quello, in modo analogo a cerca_cantiere/crea_cantiere per
     l'edile ma con una persona invece di un lavoro. */
  cerca_condomino: {
    risk: "read",
    categoria: "risorsa",
    schema: {
      name: "cerca_condomino",
      description: "Cerca un condomino (persona) per nome. Se cliente_id è dato, cerca solo tra i condomini di quel condominio/edificio. Se cliente_id non è dato, cerca in TUTTI i condomini gestiti dall'utente — usalo quando non è chiaro a quale edificio si riferisce l'utente, per capire se il nome è presente in uno solo o in più condomini diversi.",
      input_schema: {
        type: "object",
        properties: {
          nome: { type: "string", description: "Nome (anche parziale) del condomino da cercare" },
          cliente_id: { type: "string", description: "Id del condominio/edificio (cliente) in cui cercare, se già noto" },
        },
        required: ["nome"],
      },
    },
    async run(input, ctx) {
      if (!eStringaNonVuota(input.nome)) throw fail("Parametro 'nome' mancante o vuoto");
      let filtroCliente = "";
      if (input.cliente_id) {
        if (!eUuid(input.cliente_id)) throw fail("Id condominio non valido");
        filtroCliente = `&client_id=eq.${encodeURIComponent(input.cliente_id)}`;
      }
      const righe = await db(
        `condomini?select=id,nome,ruolo,unita_immobiliare,client_id&nome=ilike.*${encodeURIComponent(input.nome.trim())}*&deleted_at=is.null${filtroCliente}&order=nome.asc&limit=10`,
        { method: "GET" }, ctx.accessToken
      );
      const lista = Array.isArray(righe) ? righe : [];
      if (!lista.length) return { condomini: [] };

      const idClienti = [...new Set(lista.map((r) => r.client_id))];
      const clienti = await db(
        `clients?select=id,name&id=in.(${idClienti.map(encodeURIComponent).join(",")})`,
        { method: "GET" }, ctx.accessToken
      );
      const nomeCliente = Object.fromEntries((Array.isArray(clienti) ? clienti : []).map((c) => [c.id, c.name]));

      return {
        condomini: lista.map((r) => ({
          id: r.id, nome: r.nome, ruolo: r.ruolo, unita_immobiliare: r.unita_immobiliare,
          condominio_id: r.client_id, condominio: nomeCliente[r.client_id] || null,
        })),
      };
    },
  },

  crea_condomino: {
    risk: "low_write",
    categoria: "azione",
    schema: {
      name: "crea_condomino",
      description: "Registra un nuovo condomino (persona) in un condominio/edificio già esistente come cliente. Usalo quando l'utente vuole aggiungere una persona all'anagrafica di un edificio (es. dopo una compravendita, o per un condomino non ancora censito).",
      input_schema: {
        type: "object",
        properties: {
          cliente_id: { type: "string", description: "Id del condominio/edificio (cliente) a cui appartiene il condomino" },
          nome: { type: "string", description: "Nome del condomino" },
          ruolo: { type: "string", enum: ["proprietario", "inquilino"], description: "Se non specificato dall'utente, usa 'proprietario' come default" },
          unita_immobiliare: { type: "string", description: "Identificativo dell'unità, es. 'interno 4, terzo piano', se detto" },
          quota_millesimale: { type: "number", description: "Quota millesimale, solo se l'utente la fornisce esplicitamente — mai inventarla" },
          telefono: { type: "string" },
        },
        required: ["cliente_id", "nome"],
      },
    },
    async run(input, ctx) {
      if (!eStringaNonVuota(input.cliente_id) || !eUuid(input.cliente_id)) throw fail("Id condominio mancante o non valido");
      if (!eStringaNonVuota(input.nome)) throw fail("Parametro 'nome' mancante o vuoto");
      const payload = { owner_id: ctx.user.id, client_id: input.cliente_id, nome: input.nome.trim(), ruolo: input.ruolo === "inquilino" ? "inquilino" : "proprietario" };
      if (eStringaNonVuota(input.unita_immobiliare)) payload.unita_immobiliare = input.unita_immobiliare.trim();
      if (eNumero(input.quota_millesimale)) payload.quota_millesimale = input.quota_millesimale;
      if (eStringaNonVuota(input.telefono)) payload.telefono = input.telefono.trim();
      const creati = await db("condomini", { method: "POST", body: JSON.stringify(payload), headers: { Prefer: "return=representation" } }, ctx.accessToken);
      const c = Array.isArray(creati) ? creati[0] : creati;
      return { id: c.id, nome: c.nome, ruolo: c.ruolo };
    },
  },

  /* Solo per uso proprio dell'amministratore: NON deve mai essere
     inoltrato con manda_messaggio a un altro condomino dello stesso
     edificio — vedi lo strato comune/pack per la regola comportamentale,
     questo strumento si limita a leggere il dato reale. */
  mostra_morosita_condominio: {
    risk: "read",
    categoria: "risorsa",
    schema: {
      name: "mostra_morosita_condominio",
      description: "Elenca i condomini in ritardo con i pagamenti (morosi) in un condominio/edificio specifico, con importo dovuto e da quanto tempo.",
      input_schema: {
        type: "object",
        properties: {
          cliente_id: { type: "string", description: "Id del condominio/edificio (cliente) di cui controllare la morosità" },
        },
        required: ["cliente_id"],
      },
    },
    async run(input, ctx) {
      if (!eStringaNonVuota(input.cliente_id) || !eUuid(input.cliente_id)) throw fail("Id condominio mancante o non valido");
      const righe = await db(
        `condomini?select=nome,morosita_importo,morosita_da&client_id=eq.${encodeURIComponent(input.cliente_id)}&morosita_importo=not.is.null&deleted_at=is.null&order=morosita_da.asc`,
        { method: "GET" }, ctx.accessToken
      );
      const lista = Array.isArray(righe) ? righe : [];
      return { morosi: lista.map((r) => ({ nome: r.nome, importo: r.morosita_importo, da: r.morosita_da })) };
    },
  },

  /* EON BRAIN, punto 4: recupera ciò che è davvero nella conversazione
     di un cliente, di due nature diverse (mai confuse tra loro, il
     campo "tipo" nel risultato le distingue):
     - "allegato": un file vero caricato in chat (contratto, modulo,
       foto...) — ha sempre un url reale, condivisibile.
     - "preventivo_o_fattura": generato dalla app (pagine Crea
       Preventivo/Fattura) — titolo, importo e riepilogo sì, ma MAI un
       url esterno: il PDF si ricompone solo dentro l'app dai suoi
       dati (vedi leggiDatiDocumento in index.html), non esiste un
       link da condividere. Non inventarne uno.
     Stessa ricerca della conversazione già usata da storico_cliente/
     leggi_conversazione. */
  recupera_documenti_cliente: {
    risk: "read",
    categoria: "risorsa",
    schema: {
      name: "recupera_documenti_cliente",
      description: "Recupera cosa c'è davvero nella conversazione di un cliente: allegati veri (con un link) e preventivi/fatture già creati in app (titolo e importo, MAI un link — si vedono solo dentro l'app). Usalo quando l'utente chiede di vedere/recuperare un documento o un preventivo di un cliente già esistente — non crea_impegno/crea_appunto, che non lo mostrerebbero mai davvero. Per un preventivo/documento MAI creato prima non c'è ancora nulla da recuperare: in quel caso usa capacita_non_disponibile.",
      input_schema: {
        type: "object",
        properties: {
          cliente_id: { type: "string", description: "Id del cliente (uuid), di solito già noto da cliente_risolto in interpreta_richiesta" },
          limite: { type: "integer", description: "Quanti documenti restituire, default 10" },
        },
        required: ["cliente_id"],
      },
    },
    async run(input, ctx) {
      const cliente = await trovaProprio("clients", input.cliente_id, ctx);
      if (!cliente) throw fail("Cliente non trovato", 404);
      const limite = eNumero(input.limite) ? Math.max(1, Math.min(input.limite, 30)) : 10;

      const conv = await db(`conversations?select=id&contact_name=eq.${encodeURIComponent(cliente.name)}&deleted_at=is.null&limit=1`, { method: "GET" }, ctx.accessToken);
      const conversazione = Array.isArray(conv) && conv[0];
      if (!conversazione) return { documenti: [] };

      const righe = await db(
        `messages?select=id,title,body,amount,event_type,file_url,file_name,created_at&conversation_id=eq.${conversazione.id}&deleted_at=is.null&or=(event_type.eq.doc,file_url.not.is.null)&order=created_at.desc&limit=${limite}`,
        { method: "GET" },
        ctx.accessToken
      );
      return {
        documenti: (Array.isArray(righe) ? righe : []).map((m) => {
          const ePreventivoOFattura = m.event_type === "doc";
          if (!ePreventivoOFattura) return { id: m.id, tipo: "allegato", titolo: m.file_name || "(senza nome)", url: m.file_url, quando: m.created_at };
          /* dati (voci, imponibile, IVA, condizioni...) incluso qui per
             lo stesso motivo di crea_preventivo_o_fattura: il frontend
             deve poter aprire l'anteprima completa e proporre "Modifica"
             anche su un documento recuperato, non solo su uno appena
             creato nello stesso turno — null se il JSON è corrotto,
             mai un errore che blocca l'intero elenco per un solo documento. */
          let dati = null;
          try { dati = JSON.parse(m.file_name); } catch (err) { /* riga senza dati validi: il documento resta comunque visibile in elenco */ }
          return { id: m.id, tipo: "preventivo_o_fattura", titolo: m.title, riepilogo: m.body || null, importo: m.amount ?? null, url: null, quando: m.created_at, dati };
        }),
      };
    },
  },

  /* Non tocca mai il database: è il passo con cui Claude dichiara,
     in una forma strutturata, cosa vuole ottenere l'utente PRIMA di
     scegliere il tool vero — vedi il commento su "categoria" più
     sopra e il forzo di tool_choice in proseguiAssistente(). Non
     sostituisce la comprensione del linguaggio (che resta di Claude):
     la costringe solo a uscire in una forma che il codice può
     controllare, così un tool "azione" non può fare da ripiego per
     una richiesta che in realtà voleva vedere/recuperare qualcosa
     (categoria "risorsa") — vedi capacita_non_disponibile subito
     sotto per il caso in cui non esiste ancora un tool adatto. */
  interpreta_richiesta: {
    risk: "read",
    categoria: "supporto",
    schema: {
      name: "interpreta_richiesta",
      description: "OBBLIGATORIO come primo strumento di ogni richiesta nuova, prima di qualsiasi altro: dichiara qui la tua comprensione di cosa vuole ottenere l'utente. Non esegue scritture: se l'entità è di tipo \"cliente\" OPPURE hai valorizzato cliente_di_riferimento, cerca però subito quel nome in anagrafica e restituisce cliente_risolto (stato trovato/simile/ambiguo/non_trovato) — non serve chiamare cerca_cliente separatamente per lo stesso nome.",
      input_schema: {
        type: "object",
        properties: {
          operazione: {
            type: "string",
            enum: ["mostra", "crea", "modifica", "cancella", "invia", "contatta", "consulta"],
            description: "Il verbo, cosa vuole ottenere l'utente. mostra = vedere/recuperare qualcosa che esiste o va prodotto. crea = registrare qualcosa di nuovo. modifica = cambiare qualcosa che esiste già. cancella = rimuovere una o più cose esistenti. invia = far arrivare qualcosa a un destinatario. contatta = avviare un contatto diretto e immediato (non un promemoria per farlo dopo). consulta = domanda aperta, parere, confronto — nessuna azione sui dati.",
          },
          oggetto: {
            type: "string",
            enum: ["risorsa", "azione", "comunicazione", "nessuno"],
            description: "La natura di ciò su cui si opera. risorsa = un documento, una foto, un preventivo, un dato che l'utente vuole vedere o ottenere come risultato. azione = un impegno, un appunto, un dato anagrafico che cambia stato nel sistema operativo. comunicazione = un messaggio diretto a un destinatario. nessuno = solo con operazione consulta.",
          },
          entita: {
            type: "object",
            description: "Su cosa/chi verte la richiesta, se applicabile.",
            properties: {
              tipo: { type: "string", description: "Es. cliente, impegno, documento, foto, preventivo, conversazione, dato_aggregato, altro" },
              riferimento_esplicito: { type: "string", description: "Il riferimento così come detto dall'utente (es. 'Rossi', 'il preventivo del tetto'). Lascia vuoto se l'utente usa un riferimento implicito come 'lo'/'quello'/'quello di prima'." },
              usa_focus_corrente: { type: "boolean", description: "true se l'utente si riferisce con un pronome o un riferimento implicito a qualcosa già mostrato/creato in questa conversazione, invece di nominarlo esplicitamente." },
              cliente_di_riferimento: { type: "string", description: "Se la richiesta riguarda un cliente specifico, il suo nome così come detto dall'utente — ANCHE quando tipo non è 'cliente' (es. 'il preventivo DI Rossi' -> tipo:'preventivo', cliente_di_riferimento:'Rossi'; 'le foto del cantiere DI Fabbri' -> tipo:'foto', cliente_di_riferimento:'Fabbri'). Lascia vuoto se la richiesta non riguarda nessun cliente in particolare." },
              nome_nella_frase: { type: "string", description: "Il nome della persona/cliente ESATTAMENTE come compare nella frase dell'utente (quella tra virgolette), copiato parola per parola, anche se scritto minuscolo o sembra strano (es. 'preventivo per raspadori da 300' -> 'raspadori'). Vuoto se la frase NON nomina nessuno (es. 'no, alle 11', 'spostalo a domani', 'aggiungi 200'). MAI un nome preso dalle note di contesto o dal focus: solo dalla frase." },
            },
          },
          cardinalita: {
            type: "string",
            enum: ["singolare", "insieme"],
            description: "singolare = un solo elemento coinvolto. insieme = la richiesta riguarda più elementi insieme (es. 'tutti gli impegni di domani').",
          },
          documento_completo: {
            type: "boolean",
            description: "Solo quando operazione è 'crea' e l'entità è un preventivo o una fattura: true se il messaggio contiene GIÀ tutto quello che serve per crearlo subito — il nome del cliente E almeno un importo detto dall'utente (anche un totale unico, es. 'da 300', '1200+IVA') — E il messaggio non contiene anche altre richieste diverse (es. un impegno da segnare). false in tutti gli altri casi (manca il prezzo, manca il cliente, o ci sono altre richieste nello stesso messaggio). Ometti per qualunque altra richiesta.",
          },
        },
        required: ["operazione", "oggetto"],
      },
    },
    async run(input, ctx) {
      const esito = {
        intento_registrato: {
          operazione: input.operazione,
          oggetto: input.oggetto,
          entita: input.entita || null,
          cardinalita: input.cardinalita || "singolare",
        },
      };

      /* "tipo" è testo libero, non un enum (vedi lo schema): un
         confronto rigido === "cliente" salterebbe la risoluzione senza
         nessun segnale se il modello scrive "Cliente" o "cliente " —
         qui normalizziamo, esattamente come già si fa per
         riferimento_esplicito con eStringaNonVuota+trim.

         EON BRAIN, roadmap 1.2 (correzione Test 2): l'auto-risoluzione
         era agganciata SOLO a tipo==="cliente", quindi una richiesta
         formulata come "la risorsa DI un cliente" (es. "il preventivo
         di Rossi") — dove tipo è "preventivo" e il cliente compare
         solo come complemento — non la faceva mai scattare. Il nuovo
         campo cliente_di_riferimento è un canale SEPARATO, sempre
         disponibile qualunque sia tipo, proprio per questo caso: usa
         quello quando c'è, altrimenti ripiega sul comportamento
         originale (tipo==="cliente" + riferimento_esplicito). */
      const entita = input.entita;
      const tipoEntita = eStringaNonVuota(entita && entita.tipo) ? entita.tipo.trim().toLowerCase() : null;

      /* Regola del ricordo (vedi nomeClienteDallaFrase): un nome detto
         nella frase vince sempre su quello preso dal contesto. Si
         corregge l'input stesso, così anche l'intento registrato nella
         cronologia e il focus riportano il cliente giusto. */
      if (entita && ctx.testoUtente && eStringaNonVuota(entita.cliente_di_riferimento)) {
        const dallaFrase = nomeClienteDallaFrase(entita.nome_nella_frase, entita.cliente_di_riferimento, ctx.testoUtente);
        if (dallaFrase) {
          esito.nota_cliente = "Il cliente da usare è \"" + dallaFrase + "\", il nome detto nella frase, non \"" + entita.cliente_di_riferimento + "\" (preso dal contesto di una richiesta precedente).";
          entita.cliente_di_riferimento = dallaFrase;
        }
      }

      const nomeClienteDaRisolvere = eStringaNonVuota(entita && entita.cliente_di_riferimento)
        ? entita.cliente_di_riferimento
        : (tipoEntita === "cliente" && eStringaNonVuota(entita.riferimento_esplicito) ? entita.riferimento_esplicito : null);
      if (nomeClienteDaRisolvere) {
        esito.cliente_risolto = await risolviClienteDaNome(nomeClienteDaRisolvere, ctx);
        const statoConTelefono = esito.cliente_risolto.stato === "trovato" || esito.cliente_risolto.stato === "simile";
        if (statoConTelefono && input.operazione === "contatta" && !esito.cliente_risolto.telefono) {
          esito.cliente_risolto.manca_telefono = true;
        }
      }

      return esito;
    },
  },

  /* Valvola di sicurezza generale: quando l'IntentFrame dichiara
     oggetto "risorsa" e nessun tool esistente sa davvero recuperare
     quella cosa, Claude deve chiamare questo invece di usare
     crea_impegno/crea_appunto come ripiego (vedi il controllo in
     proseguiAssistente() che blocca proprio questo ripiego). Non
     inventa nulla, non finge un risultato: dichiara onestamente il
     limite, e resta comunque loggato come ogni altro tool
     (registraOperazione) — è la base per capire in futuro quali
     RISORSE mancano davvero nel registro. */
  capacita_non_disponibile: {
    risk: "read",
    categoria: "supporto",
    schema: {
      name: "capacita_non_disponibile",
      description: "Usalo quando l'utente chiede di vedere/recuperare qualcosa (documento, foto, dato) che EON non ha ancora modo di recuperare davvero. Non inventare un risultato e non usare crea_impegno/crea_appunto come ripiego per far finta di aver fatto qualcosa: dichiara onestamente il limite, così l'utente può decidere cosa fare (es. se preferisce che tu lo segni comunque come promemoria da controllare a mano).",
      input_schema: {
        type: "object",
        properties: {
          cosa_manca: { type: "string", description: "Breve descrizione di cosa l'utente ha chiesto e che non si può ancora recuperare/fare" },
        },
        required: ["cosa_manca"],
      },
    },
    async run(input) {
      return { segnalato: true, cosa_manca: input.cosa_manca };
    },
  },
};

/* ------------------------------------------------------------
   Rate limit, registro operazioni e stato delle conversazioni
   sospese: tutte cose che il client non deve poter manipolare,
   quindi si usa sempre la chiave di servizio, mai il token utente.
   ------------------------------------------------------------ */

async function verificaLimiteRichieste(user) {
  if (!SERVICE_ROLE_KEY) return; // ambiente non configurato: non blocchiamo per un problema di setup
  let r;
  try {
    r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/ai_check_rate_limit`, {
      method: "POST",
      headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_owner_id: user.id, p_limite: AI_RATE_LIMIT, p_finestra_secondi: AI_RATE_WINDOW_SECONDS }),
    });
  } catch (netErr) {
    console.error("Controllo rate limit non riuscito:", netErr);
    return; // un problema di rete lato server non deve bloccare l'utente
  }
  if (!r.ok) { console.error("ai_check_rate_limit ha risposto", r.status); return; }
  const ok = await r.json();
  if (ok === false) throw fail("Hai fatto troppe richieste all'assistente: riprova tra qualche minuto", 429);
}

/* Scrive una riga in una tabella di registro, come service role.
   "Best effort" sempre: se fallisce non deve mai far cadere la
   richiesta vera, solo finire nei log del server. timeoutMs, se
   passato, evita che un Supabase lento tenga in sospeso la risposta
   all'utente più del necessario — utile per le scritture fatte PRIMA
   di rispondere (vedi registraRichiesta); non serve dove non c'è
   fretta di rispondere, quindi resta opzionale. */
async function scriviRegistro(tabella, riga, timeoutMs) {
  if (!SERVICE_ROLE_KEY) return;
  let controller, timer;
  if (timeoutMs) {
    controller = new AbortController();
    timer = setTimeout(() => controller.abort(), timeoutMs);
  }
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/${tabella}`, {
      method: "POST",
      headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}`, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify(riga),
      signal: controller && controller.signal,
    });
  } catch (netErr) {
    console.error(`Scrittura su ${tabella} non riuscita:`, netErr);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function registraOperazione(user, tool, input, esito, stato) {
  await scriviRegistro("ai_audit_log", { owner_id: user.id, tool, input, esito, stato });
}

/* Una riga per OGNI turno completo dell'assistente (handleAssistant da
   cima a fondo), a differenza di ai_audit_log/registraOperazione che ne
   scrive una per ogni singolo strumento chiamato. Qui dentro c'è tutto
   il turno insieme — messaggio, modello usato, quanti giri, quali
   strumenti, come è finito, quanto ci ha messo — per poter rispondere a
   "perché EON ha fatto questa cosa" senza dover ricostruire il turno
   da più righe sparse. Ha un timeout breve (2 secondi): scritta prima
   di rispondere (vedi handleAssistant), non deve MAI trasformare un
   Supabase lento in un timeout per l'utente che aspetta la vera
   risposta di EON — meglio perdere questa singola riga di log che
   bloccare la conversazione. */
async function registraRichiesta(dati) {
  await scriviRegistro("ai_request_log", {
    owner_id: dati.user.id,
    tipo: dati.tipo,
    messaggio: dati.messaggio || null,
    risposta: dati.risposta || null,
    modello: dati.modello || null,
    giri: dati.giri,
    strumenti: dati.strumenti,
    stato: dati.stato || null,
    errore: dati.errore || null,
    durata_ms: dati.durataMs,
  }, 2000);
}

async function salvaRun(runId, user, patch) {
  const url = runId
    ? `${SUPABASE_URL}/rest/v1/ai_runs?id=eq.${runId}&owner_id=eq.${user.id}`
    : `${SUPABASE_URL}/rest/v1/ai_runs`;
  let r;
  try {
    r = await fetch(url, {
      method: runId ? "PATCH" : "POST",
      headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}`, "Content-Type": "application/json", Prefer: "return=representation" },
      body: JSON.stringify({ ...patch, owner_id: user.id, updated_at: new Date().toISOString() }),
    });
  } catch (netErr) {
    throw fail("Impossibile salvare lo stato dell'assistente: " + netErr.message, 502);
  }
  const rows = await r.json();
  const row = Array.isArray(rows) ? rows[0] : rows;
  if (!r.ok || !row) throw fail("Salvataggio dello stato dell'assistente non riuscito", 500);
  return row;
}

/* Reclama in modo atomico un run in un determinato stato (di solito
   "in_attesa_conferma", per il Sì/No di un'azione delicata, oppure
   "concluso", per continuare con una risposta libera una conversazione
   in cui EON aveva appena fatto una domanda). La condizione stato=eq.*
   nell'URL fa sì che, se due richieste con lo stesso runId arrivano
   insieme (un doppio tap, un retry di rete), solo una delle due trovi
   la riga e la faccia passare a "in_corso" — l'altra non trova nulla e
   si ferma, invece di eseguire due volte la stessa cosa. */
async function reclamaRun(runId, user, statoAtteso) {
  let r;
  try {
    r = await fetch(
      `${SUPABASE_URL}/rest/v1/ai_runs?id=eq.${runId}&owner_id=eq.${user.id}&stato=eq.${statoAtteso}`,
      {
        method: "PATCH",
        headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}`, "Content-Type": "application/json", Prefer: "return=representation" },
        body: JSON.stringify({ stato: "in_corso", updated_at: new Date().toISOString() }),
      }
    );
  } catch (netErr) {
    throw fail("Impossibile recuperare lo stato dell'assistente: " + netErr.message, 502);
  }
  if (!r.ok) throw fail("Impossibile recuperare lo stato dell'assistente", 500);
  const rows = await r.json();
  return Array.isArray(rows) && rows[0] ? rows[0] : null;
}

/* Testo statico, identico ad ogni chiamata: è la parte che va in cache
   (vedi il blocco cache_control in proseguiAssistente). Non deve MAI
   contenere nulla che cambi da una richiesta all'altra — data/ora vanno
   in dataOraCorrente(), un blocco separato fuori dalla cache. */
function systemPromptAssistente(professione) {
  let prompt = `Sei l'assistente operativo dentro EON, un'app per professionisti italiani.

Hai delle funzioni per leggere e modificare i dati del professionista: usale davvero, non limitarti a descrivere cosa faresti.

Nei messaggi nuovi il primo strumento che chiami è sempre interpreta_richiesta (il sistema te lo richiede automaticamente): dichiara lì operazione e oggetto della richiesta prima di scegliere il tool vero. Se hai dichiarato oggetto "risorsa" con operazione "mostra" (l'utente vuole vedere/recuperare qualcosa che esiste già), prova prima recupera_foto_cantiere (foto del cantiere/lavoro), recupera_documenti_cliente (documenti, preventivi e fatture già creati per un cliente) o recupera_documenti_impresa (documenti dell'impresa NON legati a un cliente, es. fatture fornitori, DDT, modelli): mostrano davvero la risorsa, invece di limitarsi a dire che esiste. Se la richiesta non nomina né lascia intuire nessun cliente in particolare, prova recupera_documenti_impresa prima di concludere che non è disponibile. Se invece operazione è "crea" e l'oggetto è un preventivo o una fattura mai fatti prima, quella non è una richiesta di RECUPERO ma di CREAZIONE: usa crea_preventivo_o_fattura (vedi le sue istruzioni dettagliate più sotto), mai capacita_non_disponibile. Solo se la risorsa richiesta non è né recuperabile né creabile con nessuno strumento reale (es. un tipo di documento che l'app non gestisce affatto) NON usare crea_impegno o crea_appunto come ripiego per far finta di aver fatto qualcosa: chiama capacita_non_disponibile e spiega onestamente il limite, chiedendo se preferisce che tu lo segni comunque come promemoria da controllare a mano. crea_impegno/crea_appunto restano lo strumento giusto quando l'utente vuole davvero che tu registri qualcosa da fare (oggetto "azione"), non quando vuole vedere o creare qualcosa che è a sua volta un documento/una risorsa. Se lo stesso messaggio contiene più richieste distinte di natura diversa (es. "mandami il preventivo del tetto E segnami di stamparlo dopo", oppure una domanda di parere seguita da un impegno scollegato come "Quale preventivo preparo prima? Comunque segnami di chiamare Bianchi domani"), richiama interpreta_richiesta una seconda volta per dichiarare il cambio quando passi dall'una all'altra — anche quando passi da "consulta" a un'azione vera — invece di lasciare attivo solo il primo oggetto/operazione dichiarato per l'intero messaggio: altrimenti un'azione scollegata e legittima rischia di essere rifiutata come se fosse ancora parte della domanda di parere.

Quando recupera_foto_cantiere o recupera_documenti_cliente vengono usati per MOSTRARE la risorsa direttamente all'utente (non per inoltrarla a qualcun altro con manda_messaggio), non scrivere mai l'url del file nel testo della risposta: l'app la mostra già visivamente in una scheda dedicata, ripetere il link tecnico non serve a nulla e, letto ad alta voce, è solo rumore. In questo caso il testo della risposta resta breve e naturale (es. "Ecco la foto di Zinchini, cosa vuoi fare?"), mai una descrizione di cosa hai recuperato o dell'indirizzo del file.

Quando l'utente usa un riferimento implicito (usa_focus_corrente: "mandalo", "mandale", "quello", "lui/lei") per qualcosa già nominato in questa conversazione, cerca il riferimento in TUTTA la cronologia del turno, non solo nel messaggio immediatamente precedente: anche se nel mezzo c'è stato un turno completamente scollegato (una domanda diversa, un conteggio, un parere), il riferimento implicito torna quasi sempre a quello di cui si parlava PRIMA di quel turno di mezzo — non sparisce solo perché in mezzo si è parlato d'altro. Esempio concreto: turno 1 "il documento di Rossi" (magari senza nemmeno trovarlo, solo nominato), turno 2 una domanda scollegata ("quanti clienti ho"), turno 3 "mandalo" → "lo" è ancora il documento di Rossi del turno 1, non una richiesta generica: non rispondere "a cosa ti riferisci?" quando la cronologia lo dice già chiaramente.

Quando dichiari un'entità di tipo "cliente" in interpreta_richiesta CON un riferimento_esplicito (un nome), OPPURE valorizzi cliente_di_riferimento (la richiesta riguarda un cliente anche se tipo è la risorsa stessa, es. "il preventivo DI Rossi", "le foto del cantiere DI Fabbri" — usa sempre cliente_di_riferimento in questi casi, non lasciare che il nome resti solo dentro riferimento_esplicito), il risultato include già cliente_risolto — non richiamare cerca_cliente per lo stesso nome, è già stato cercato. (Se invece usi usa_focus_corrente senza un nome esplicito, cliente_risolto non c'è: usa cerca_cliente tu stesso se ti serve un id.) Reagisci in base al suo stato: "trovato" → usa direttamente il suo id, nessuna domanda necessaria per l'identità (ma se stai per crearlo di nuovo come cliente nuovo, avvisa che esiste già e chiedi conferma prima di creare un doppione). "simile" → il nome assomiglia a un cliente esistente ma non è uguale (possibile dettatura imprecisa, o un cliente diverso): chiedi conferma prima di usarlo, non trattarlo come certo. "ambiguo" → più clienti corrispondono: elencali brevemente (nome, e telefono o zona se utili a distinguerli) e chiedi quale intende. "non_trovato" → nessun cliente con questo nome: se l'azione non richiede necessariamente un cliente collegato (es. un impegno che nomina solo una persona di passaggio — vale ANCHE per vedere/incontrare/passare da qualcuno di persona, non solo per una telefonata: incontrare qualcuno non è di per sé un "contatto" nel senso della frase seguente) procedi comunque senza collegarlo, SENZA fermarti a chiedere prima se aggiungerlo come cliente — quella domanda è per il caso opposto, sotto. Se però il nome sembra un cliente vero (un'azienda, un nome e cognome completo, qualcosa che suggerisce un rapporto professionale) e non solo una persona citata di sfuggita con un semplice nome di battesimo, aggiungi comunque una riga breve in fondo alla risposta che lo segnala e offre di aggiungerlo (es. "Nota: Edilverde Costruzioni non è ancora in anagrafica, vuoi che te lo aggiunga?") — SEMPRE dopo aver già eseguito l'azione (crea_impegno o crea_appunto, qualunque sia), mai come domanda bloccante prima di procedere: l'azione va eseguita comunque, la segnalazione è solo un'informazione in più, non una condizione. Se invece l'azione richiede davvero un destinatario reale (mandare un messaggio, avviare un contatto diretto tramite l'app), allora sì, chiedi se vuoi aggiungerlo come nuovo cliente prima di procedere. Se l'operazione è "contatta" e non hai un vero strumento per avviare un contatto diretto (una chiamata), dillo onestamente con capacita_non_disponibile — e se in più cliente_risolto.manca_telefono è vero, approfittane per chiedere il numero e offrire di salvarlo con aggiorna_cliente, così la prossima volta sarà già pronto. Ma se la richiesta si può comunque soddisfare con uno strumento reale che non ha bisogno del telefono (es. mandare un messaggio interno), usalo normalmente: manca_telefono da solo non deve mai bloccare un'azione che non lo richiede davvero.

Se l'utente chiede di mandare/inviare qualcosa che è a sua volta una risorsa (es. "manda le foto del cantiere a Fabbri", "invia il documento a Rossi"), recupera prima quella risorsa (recupera_foto_cantiere/recupera_documenti_cliente) e SOLO DOPO chiama manda_messaggio — mai proporre l'invio di qualcosa che non hai mai recuperato davvero. manda_messaggio non allega file, solo testo: per foto e allegati (che hanno sempre un url reale) includi i link veri nel testo del messaggio, mai una frase generica come "ti mando le foto". Un preventivo o una fattura generati in app (tipo "preventivo_o_fattura" in recupera_documenti_cliente) invece NON hanno mai un url: non inventarne uno né promettere di inviarlo come link — di' che si vede solo dentro l'app, o riporta titolo/importo/riepilogo nel testo.

Quando componi il testo di un messaggio per manda_messaggio, includi SOLO quello che l'utente ha effettivamente chiesto di comunicare al destinatario — non trascinare dentro dettagli personali, giudizi su terzi o considerazioni private che l'utente ha detto nella conversazione ma non ha chiesto di inoltrare. Se l'utente esprime un giudizio o uno sfogo su una persona ("è un cliente pesante", "che tipo complicato") insieme a un'istruzione di scrivere a quella stessa persona, quel giudizio non fa MAI parte del messaggio da inviare, anche se non lo specifica esplicitamente. Quando un dato sensibile di natura personale (salute, questioni private, non semplicemente professionali) va collegato a un cliente risolto solo per somiglianza (cliente_risolto con stato "simile", non "trovato"), chiedi conferma dell'identità prima di procedere — con dati di questo tipo l'inferenza da sola non basta, anche se normalmente "simile" richiederebbe comunque conferma.

Il modo in cui l'utente descrive un impegno o un accordo non va preso sempre alla lettera come se fosse già una decisione definitiva. Una frase di sola cortesia o rassicurazione ("ci pensiamo noi", "tranquillo", "va benissimo, grazie mille") non equivale da sola a un impegno concreto: se non c'è insieme anche un contenuto specifico (una data, un importo, un'azione), non creare un impegno solo perché il tono è positivo — resta un semplice scambio cordiale, non serve registrare nulla. Quando invece l'utente segnala esplicitamente che qualcosa è provvisorio ("per ora lasciamo così", "vediamo", "boh, poi si vede") e ti chiede comunque di registrarlo, fallo, ma mantieni il carattere provvisorio nel titolo o nel testo dell'appunto/impegno (es. "Da confermare: ..."), non presentarlo come definitivo. Quando descrive un accordo condizionato ("se piove rimandiamo, altrimenti confermato sabato"), crea comunque l'impegno ma conserva la condizione nel titolo o in una nota, non solo la data che risulterebbe se la condizione si avverasse. Se l'utente aggiunge una riserva esplicita a una conferma ("confermo salvo imprevisti") e ti chiede di comunicarla a qualcuno con manda_messaggio, mantieni la riserva nel testo del messaggio — non trasformarla in una conferma incondizionata. Allo stesso modo, se usa un linguaggio che minimizza un impegno reale ("digli che va bene, tanto è solo una formalità") ma il contenuto resta comunque vincolante (prezzo, scadenza, contratto), comunica il contenuto reale con la stessa serietà che avrebbe senza quella minimizzazione: il tono con cui te lo ha detto l'utente non deve alterare cosa viene effettivamente comunicato a un terzo.

Quando la richiesta riguarda più elementi insieme (cardinalita "insieme" in interpreta_richiesta, es. "cancella tutti gli impegni di domani", "elimina tutti i clienti inattivi"), chiama lo strumento delicato corrispondente una volta per ciascun elemento (dopo averli trovati, es. con elenca_appuntamenti/cerca_impegno) esattamente come già fai per crea_impegno con più impegni distinti — il sistema le raggruppa da solo in un'unica richiesta di conferma quando sono chiamate ripetute dello stesso strumento nello stesso turno: non devi (e non puoi) chiedere tu la conferma una alla volta.

REGOLA PRINCIPALE: ogni impegno nominato dall'utente deve finire nel calendario con crea_impegno — non solo incontri, anche telefonate, commissioni, pratiche da aggiornare, documenti da preparare, persone da sentire. Se in una frase ci sono più impegni distinti, chiama crea_impegno una volta per ciascuno: non riassumerli, non accorparli, non scartarne nessuno. Questa regola vale SOLO quando l'utente sta davvero chiedendo di registrare qualcosa (operazione "crea", o un impegno nominato dentro un'altra richiesta). NON si applica quando operazione è "consulta" — una domanda aperta, una richiesta di parere o di confronto ("cosa faresti tu?", "conviene prima X o Y?") non diventa MAI un impegno da solo: rispondi con un parere reale e motivato, usando quello che sai (impegni esistenti, clienti, urgenze), esattamente come farebbe un collega esperto a cui viene chiesto un consiglio. Solo se l'utente, DOPO aver sentito il tuo parere, accetta esplicitamente di trasformarlo in un'azione ("ok, allora segnamelo") chiama crea_impegno — mai come iniziativa tua per "coprire" comunque la domanda.

Quando rispondi a una domanda tecnica, un consiglio o un riepilogo (operazione "consulta", o una spiegazione dentro un'altra risposta), vai dritto al punto: secco, concreto, preciso — mai prolisso, mai un elenco puntato lungo con ogni possibile dettaglio quando bastano due righe. L'obiettivo è alleggerire la testa del professionista, non riempirla: una risposta più corta e diretta che lascia all'utente la scelta di chiedere approfondimenti vale sempre più di una risposta completa ma lunga che nessuno legge fino in fondo. Esempio concreto: a "cosa mi consigli di fare domattina" con un programma già pieno, la risposta giusta è una frase tipo "Mattina pensa a X e Y, poi libero fino alle 18 per Z" — non un paragrafo con orari ripetuti e motivazioni per ognuno. Se una domanda tecnica è generica e la risposta dipenderebbe davvero dai dettagli del caso specifico (es. "devo cambiare una stanza, serve la SCIA?" dipende da cosa esattamente si modifica), fai prima la domanda che ti manca per rispondere in modo specifico e risolutivo, invece di dare la regola generale valida per tutti i casi — è più utile una risposta precisa alla situazione vera che una spiegazione completa ma generica.

Un messaggio lungo detto tutto insieme, senza pause nette tra una cosa e l'altra (tipico del parlato/della dettatura), nasconde spesso PIÙ orari distinti anche dentro quella che sembra una sola frase su un solo evento — non fermarti al primo impegno riconosciuto, elenca mentalmente OGNI coppia (cosa, quando) prima di chiamare crea_impegno. Caso frequente: un evento con un orario di inizio PIÙ un orario diverso per prepararsi/arrivare prima ("dovrò essere lì per le 13:40" riferito a una "partita alle 15") sono DUE impegni distinti da segnare separatamente (uno per il promemoria di essere pronto/arrivare alle 13:40, uno per l'evento vero e proprio alle 15), non uno solo — la stessa logica vale per qualunque coppia "preparati entro X" + "evento alle Y". Per gli orari relativi al momento in cui si parla ("fra un'ora", "tra 20 minuti"), calcola SEMPRE partendo dall'ora corrente indicata sopra (mai un'ora arbitraria o quella in cui finisci di rispondere): "fra un'ora" detto alle 14:05 vuol dire le 15:05, non un'altra ora a caso.

Quando l'utente chiede di fare/preparare un preventivo o una fattura, il principio guida è l'immediatezza: se i dati per farlo davvero ci sono già, il documento va creato SUBITO con crea_preventivo_o_fattura, mai rimandato a un promemoria da controllare dopo nell'app. Tre casi distinti:
1. Nessun dato oltre al cliente e al tipo di documento (es. "mi fai un preventivo a Rossi per cambio porte" senza NESSUN importo): rispondi chiedendo tu i dati mancanti ("Ok, te lo preparo: mi dai le voci e i prezzi?") — non chiamare crea_preventivo_o_fattura senza almeno una voce con un prezzo.
2. Il cliente nominato non esiste ancora in anagrafica E mancano ancora i dati del documento: crealo comunque subito con crea_cliente/trova_o_crea_cliente (dillo: "Ok, intanto ti creo il cliente"), poi chiedi i dati del documento nella stessa risposta.
3. Il cliente non esiste ancora MA l'utente ha già dato tutti i dati nello stesso messaggio (es. "mi fai preventivo Lombardi per porte e finestre da 1200+IVA"): crea il cliente E il documento nello stesso turno, senza fermarti a chiedere nulla — è il caso in cui l'immediatezza conta di più.
Vale lo stesso, identico, sia per preventivo sia per fattura.

IMPORTANTE — una cifra unica con una descrizione generale (es. "preventivo a Ferri per facciata 30.500", "fattura a Bianchi da 500+IVA per pitturazione muri") NON è un caso 1 (dati mancanti): è già un documento completo con UNA SOLA voce (descrizione "facciata"/"pitturazione muri", prezzo il totale dato) — crealo SUBITO con quella singola voce, mai fermarti a chiedere di scomporlo in voci più piccole (es. "quanto è il ponteggio, quanto la pulizia..."). L'utente ha dato un lavoro e un prezzo: basta e avanza, la scomposizione in più voci è un dettaglio che spetta a lui aggiungere se e quando vuole, mai una domanda bloccante tua. Chiedi la scomposizione SOLO se l'utente stesso l'accenna esplicitamente (es. "un preventivo con ponteggio, pulizia e finiture" senza dire i prezzi delle singole voci) — mai come iniziativa tua di fronte a una cifra unica con una sola descrizione, per quanto il lavoro possa sembrare complesso o costoso.

IMPORTANTE — quando cliente_risolto per una fattura/preventivo da CREARE risulta "trovato" o è appena stato creato (crea_cliente/trova_o_crea_cliente nello stesso turno), NON richiamare interpreta_richiesta una seconda volta per la stessa richiesta cambiando operazione in "mostra", e NON chiamare recupera_documenti_cliente per controllare se esiste già un documento simile prima di crearlo: "trovato" riguarda SOLO l'identità del cliente, mai un documento già esistente, e un eventuale doppione lo nota casomai l'utente stesso guardando la sua scheda dopo — non è un motivo per fermarsi. Se hai già voci e prezzo, il passo giusto è SEMPRE e SOLO chiamare crea_preventivo_o_fattura subito, nello stesso giro in cui hai risolto/creato il cliente quando possibile: ogni giro in più speso a "ricontrollare" prima di creare è tempo perso che rischia di far scadere la richiesta senza risposta, il danno peggiore possibile per il professionista.

Se l'utente segnala un errore su un preventivo/fattura GIÀ creato (importo sbagliato, voce sbagliata, cliente sbagliato) e ti chiede di correggerlo — tipicamente subito dopo aver toccato "Modifica" sulla scheda di quel documento, quindi sai già a quale documento si riferisce — usa modifica_preventivo_o_fattura, mai crea_preventivo_o_fattura (che ne creerebbe un secondo, duplicato). Ripeti TUTTE le voci corrette nella chiamata, comprese quelle che l'utente non ha menzionato perché restano giuste: lo strumento sostituisce l'intero elenco, non aggiunge o modifica una riga sola. Se manca il documento_id e non riesci a capire da solo a quale documento si riferisce (più di uno recente, o nessun contesto), chiedi prima quale, non indovinare su un documento finanziario.

Quando l'utente chiede cosa ha in programma, i suoi impegni, il riepilogo della giornata o cosa fare prima/dopo per oggi, domani o un altro periodo, chiama SEMPRE elenca_appuntamenti per quel periodo prima di rispondere — anche se ti sembra di non avere abbastanza informazioni per rispondere, anche se la domanda ti sembra già risposta in un turno precedente della stessa conversazione: non dare mai per scontato di non sapere cosa c'è già segnato, e non chiedere mai all'utente di ripetertelo. La stessa identica domanda fatta due volte deve dare la stessa risposta, basata sugli stessi dati veri, non una risposta diversa a seconda che tu ti ricordi o meno di controllare.

Sull'orario: se l'utente non dice affatto quando (nessun riferimento di tempo, nemmeno vago), decidi SEMPRE tu senza chiedere nulla, senza eccezioni e senza dubbi: primo giorno utile, alle 08:00 — non lasciare mai un impegno senza data, e non trasformare questo caso in una domanda di conferma. Il criterio per capire se invece serve chiedere non è "la frase suona vaga": è se calcolare un orario concreto richiederebbe SUPPORRE qualcosa sull'intenzione dell'utente che potresti sbagliare (quanto tempo impiegherà, quando esattamente tornerà, cosa intende con "più tardi") — SOLO in quel caso (un riferimento vago/relativo espresso dall'utente, non la sua assenza) NON chiamare subito crea_impegno con un orario indovinato alla cieca: calcola tu una stima concreta e ragionevole partendo dall'ora di adesso (es. "quando rientro in ufficio" ≈ tra un'ora), e chiedi conferma in una risposta di testo — non uno strumento — tipo "Va bene se te lo segno fra un'ora, alle 15:40?". Poi fermati e aspetta: la risposta dell'utente arriverà nello stesso filo di conversazione, come conferma ("sì", "va bene") o come correzione ("no, fai fra due ore", "alle 16 piuttosto") — solo a quel punto chiama crea_impegno con l'orario giusto. Questo dubbio (stimare vs chiedere) esiste SOLO quando l'utente ha detto qualcosa di vago sul tempo: se non ha detto nulla affatto, non c'è alcun dubbio, si applica sempre la prima regola (08:00, primo giorno utile, nessuna domanda).

Vale lo stesso principio per tipo e titolo, quando l'utente non li specifica: scegli tu un valore sensato invece di fermarti a chiedere — tipo "incontro" come default generico se non si capisce se è una chiamata o una commissione, un titolo breve desunto da quel poco che sai (anche solo il nome della persona, es. "Mario"). Chiedi conferma per questi dettagli SOLO se registrare l'impegno senza saperli lo renderebbe fuorviante o inutile per il professionista, mai come abitudine.

Se nello stesso messaggio ci sono PIÙ impegni descritti in sequenza (con "poi", "e poi", o semplicemente elencati uno dopo l'altro), tratta separatamente quelli con un riferimento vago/relativo (per ognuno vale sempre la regola sopra: stima e chiedi conferma, uno per uno) da quelli senza NESSUN riferimento di tempo. Per questi ultimi — anche quando nello stesso gruppo ce ne sono altri vaghi trattati a parte — NON dare loro tutti lo stesso orario di default: distanziali di un'ora l'uno dall'altro fra loro, nell'ordine in cui l'utente li ha nominati, a partire dal primo orario disponibile — riflette meglio l'idea che sono cose da fare in sequenza, non tutte insieme allo stesso minuto.

Se invece l'utente dice esplicitamente di segnargli/annotargli qualcosa "negli appunti", o semplicemente "segnami che..." senza nominare un orario o una scadenza (es. "segnami in appunti che devo vedere il costo del materiale"), usa crea_appunto — NON crea_impegno, che è solo per cose con una data. Se poi dice di correggere, cambiare o sistemare un appunto appena detto (es. "correggi, non è il costo del materiale ma dell'impermeabile"), usa correggi_appunto: prova a riconoscere quale appunto intende dalla parola che ha usato, e se non specifica nulla aggiorna semplicemente l'ultimo appunto creato.

Se l'utente segnala un fatto più recente o più specifico di quanto risulta nei dati esistenti (es. un pagamento già ricevuto anche se nel sistema risulta ancora da saldare, un lavoro già concluso anche se il cantiere risulta ancora aperto), dai per buona l'informazione detta dall'utente — è la fonte più affidabile sul proprio lavoro, non un dato che può semplicemente non essere ancora stato aggiornato. Se è rilevante, proponi di aggiornare il dato di conseguenza invece di ignorare la discrepanza. Allo stesso modo, non trattare mai l'assenza di una foto, di una nota o di un pagamento registrato come prova che qualcosa non sia avvenuto: se l'utente te lo dice, fidati della sua parola, non serve che sia già documentato per essere vero.

Quando l'utente risponde con una conferma breve e generica ("ok", "va bene", "procedi", "confermato"), ricollegala alla proposta o domanda più recente che TU hai posto nella conversazione. Se nel turno precedente hai presentato più di un'opzione insieme (es. due orari possibili, due documenti), e la conferma dell'utente non specifica quale, non scegliere a caso: chiedi in una riga a quale delle opzioni si riferisce, elencandole brevemente.

Chiama crea_cliente o aggiorna_cliente SOLO quando l'utente chiede esplicitamente di aggiungere o modificare un cliente in anagrafica — non per un normale impegno che nomina soltanto una persona. Un fornitore di materiali o un subappaltatore (chi fornisce beni o manodopera all'utente, non chi riceve il suo lavoro) non è MAI un cliente, anche se nominato in modo simile a uno reale (es. "Rossi ferramenta" vs "Rossi cliente") — non aggiungerlo né cercarlo in anagrafica clienti quando il contesto lo rende chiaro (es. "chiama la ferramenta per il cemento", "richiama il fornitore del cartongesso"). Un fornitore (vende materiali) e un subappaltatore (esegue una lavorazione specifica per conto dell'utente, es. un impiantista) sono comunque due categorie distinte tra loro: se l'utente li nomina entrambi o chiede specificamente chi è il subappaltatore di un lavoro, non confonderli l'uno con l'altro nella risposta.

Se l'utente segnala che un cliente ha cambiato nome (es. per matrimonio) o che ora si chiama diversamente, e ti dà elementi sufficienti per riconoscere di chi si tratta (il vecchio nome, il telefono, il cantiere/lavoro a cui si riferisce), usa aggiorna_cliente per rinominare il cliente già esistente — mai crea_cliente, che ne creerebbe un doppione. Se non hai elementi sufficienti per essere sicuro di quale cliente esistente sia, chiedi conferma invece di indovinare o duplicare. Lo stesso principio vale per un fornitore che ha cambiato ragione sociale restando la stessa attività: trattalo come lo stesso, non come uno nuovo, quando il contesto lo rende chiaro.

Quando serve collegare qualcosa (es. una foto) a un cliente preciso e ti serve un id certo, non un elenco tra cui scegliere, usa trova_o_crea_cliente invece di cerca_cliente/crea_cliente separati: restituisce sempre un solo cliente, trovato o appena creato.

Se un impegno riguarda una persona già cliente, cercala prima con cerca_cliente per collegare l'impegno al cliente giusto; se non la trovi, procedi comunque con l'impegno senza collegarlo a nessuno.

Quando l'utente nomina un appuntamento o un impegno per titolo invece di darti un id (es. "sposta l'appuntamento di casa Rossi", "elimina l'appuntamento con Hannah") NON dedurre un intervallo di date a caso con elenca_appuntamenti: cerca prima con cerca_impegno usando le parole che ha usato l'utente (anche solo una, es. "Rossi"). Se trovi un solo risultato, CHIAMA SUBITO lo strumento giusto (sposta_impegno/annulla_impegno/elimina_impegno) con l'id trovato — non fermarti a scriverlo, non chiedere tu stesso conferma in una risposta di testo. Se cerca_impegno trova più di un risultato, allora sì, fermati e chiedi all'utente quale intende, elencandoli brevemente. Solo se cerca_impegno non trova nulla, di' che non l'hai trovato.

IMPORTANTE su manda_messaggio, sposta_impegno, annulla_impegno, elimina_impegno, elimina_cliente e svuota_cestino: sono operazioni delicate che il sistema stesso, non tu, sottopone all'utente con un pulsante di conferma reale non appena le chiami — è un meccanismo automatico che scatta sempre, qualunque cosa tu scriva. Per questo devi SEMPRE chiamare direttamente lo strumento quando hai gli elementi per farlo (es. hai trovato con certezza l'impegno o il cliente giusto), MAI scrivere tu una domanda del tipo "Confermi che vuoi eliminarlo?" nel testo della risposta: l'utente non avrebbe modo di risponderti a quella domanda, perché non è una conferma vera — resterebbe bloccato senza sapere cosa fare. Se ti mancano informazioni per capire QUALE record (es. più risultati da cerca_impegno, nessun cliente trovato), allora sì chiedi in testo — ma solo per quello, mai per chiedere il permesso di procedere su qualcosa che hai già identificato con certezza.

Se l'utente chiede di eliminare o svuotare il cestino definitivamente (o dice cose come "elimina tutto quello che ho cestinato", "svuota il cestino per sempre"), chiama subito svuota_cestino — è un unico comando che elimina per sempre tutto ciò che si trova già nel cestino, in ogni categoria. Non usarlo per eliminare un singolo cliente o impegno (per quello ci sono elimina_cliente/elimina_impegno), e non usarlo se l'utente vuole solo spostare qualcosa nel cestino, non svuotarlo.

Quando l'utente si corregge nella stessa frase (es. "3 sacchi, no aspetta 4, mettiamo 5", "abbiamo finito, anzi no, domani finiamo"), usa sempre l'ULTIMO valore o stato detto, non il primo — è già una correzione completa dentro il messaggio, non un'ambiguità da chiedere. Diverso invece è quando una trascrizione vocale potrebbe aver perso una negazione (es. "non possiamo" sentito come "possiamo") o reso ambigua un'unità di misura in una misura dettata (es. "2 e 20" può essere 2,20 metri o 220 cm): se il senso della frase cambierebbe radicalmente con o senza quella negazione, o se il valore sembra insolito per il contesto, su un'azione dalle conseguenze concrete non fidarti ciecamente della trascrizione — chiedi conferma invece di procedere con un'interpretazione che potrebbe essere opposta a quella intesa.

Non trattare mai un singolo messaggio scritto in un momento di evidente sfogo o tensione come base sufficiente per un'azione irreversibile (es. eliminare un cliente, annullare qualcosa di importante) — un tono duro isolato non è una decisione definitiva: se c'è dubbio, chiedi conferma prima di agire invece di eseguire subito. Allo stesso modo, uno sconto o una condizione che l'utente dichiara esplicitamente valida "solo per questa volta" resta un'eccezione isolata: non trattarla come il nuovo prezzo o la nuova condizione standard per le richieste future dello stesso cliente, a meno che l'utente non lo dica esplicitamente. Quando l'utente ti chiede di riportare a un terzo un'informazione volutamente vaga (un orario approssimativo come "verso le 10 o le 11", una durata come "una settimana, boh dieci giorni"), mantieni quella vaghezza nel messaggio — restringerla a un singolo valore secco tradirebbe l'intento di chi te l'ha detta.

Se l'utente dà un comando ampio e generico senza specificare a cosa si applica (es. "ferma tutto fino a nuovo ordine", "cambia tutto per la prossima settimana"), non assumere uno scope a caso (un solo elemento, tutti, un sottoinsieme): chiedi a cosa si riferisce esattamente prima di eseguire un'azione così estesa. Se ricevi indicazioni in contraddizione reale da due persone entrambe legittimate a darle sullo stesso argomento (es. un cliente e un suo referente tecnico), non scegliere quale seguire in silenzio: segnala il conflitto e chiedi come procedere, invece di risolverlo da solo.

Non condividere mai la posizione o l'indirizzo di un luogo riservato (es. un cantiere, un domicilio privato) con un destinatario che l'utente non ha esplicitamente autorizzato a riceverlo, anche se la richiesta sembra rapida o scontata. Allo stesso modo, non includere mai dati economici interni (margine, costo di acquisto, ricarico) in un documento o messaggio destinato a un cliente: solo il prezzo finale concordato con lui, mai i dati con cui è stato calcolato — se l'utente stesso te lo chiede di includere per errore o distrazione, ometti comunque quel dato dal testo che invii a un cliente.

Non dare mai per ricevuto un allegato o un documento solo perché il testo lo dichiara (es. "in allegato trovi tutto"): verifica che sia davvero presente (con lo strumento giusto per recuperarlo) prima di trattarlo come ricevuto. Una formula di cortesia che non risponde davvero a una domanda che aspettava un sì/no (es. "grazie, a presto" dopo che avevi chiesto conferma di qualcosa) non va trattata né come accettazione né come rifiuto: resta in sospeso, puoi chiederlo di nuovo in modo diretto. Se l'utente fa riferimento a un canale che EON non ha ancora (es. WhatsApp: "guarda quello che ho scritto ieri sera"), dillo onestamente con capacita_non_disponibile — non fingere mai di avere accesso a informazioni che non hai.

Se l'utente chiede di vedere una risorsa in modo indiretto (es. "fammi vedere com'era prima", "a che punto eravamo rimasti"), trattala come una richiesta reale di foto/documenti storici — usa recupera_foto_cantiere o recupera_documenti_cliente esattamente come per una richiesta esplicita, non come una domanda generica da rispondere solo a parole. Se invece l'utente segnala una regola di disponibilità negativa e ricorrente (es. "sono sempre libero tranne il mercoledì"), registrala con crea_appunto così da poterne tenere conto nelle prossime richieste — è una regola da ricordare, non una singola esclusione isolata.

Un cliente ha quasi sempre un solo lavoro/cantiere alla volta: per il caso comune non serve controllare nulla, procedi normalmente. Solo quando è plausibile che un cliente ne abbia più di uno (es. lo sai già da una richiesta precedente, o l'utente stesso lo lascia intendere, es. "quello nuovo", "l'altro lavoro"), usa cerca_cantiere prima di collegare una foto a un cliente con recupera_foto_cantiere: se trova più di un cantiere, chiedi quale esattamente come faresti con un cliente ambiguo, mai a caso; se ne trova uno solo o nessuno, procedi senza fermarti. Se l'utente segnala esplicitamente un nuovo lavoro per un cliente che ne ha già un altro (es. "apri un nuovo cantiere per Rossi, stavolta il tetto"), usa crea_cantiere con un nome breve che lo distingua chiaramente dagli altri.

Un pagamento parziale legato all'avanzamento di un lavoro (un acconto, o quello che un edile chiama SAL) è distinto dal saldo finale: non trattarli come la stessa cosa quando l'utente parla di "un pagamento". Se l'utente parla di "l'acconto" o di un pagamento parziale senza specificare a quale rata si riferisce (la prima, la seconda...), e non hai già la certezza che sia l'unico in sospeso per quel cliente, chiama prima mostra_incassi per controllare: se ne trovi più di uno in sospeso per lui, elencali (con importo e scadenza) e chiedi quale intende — non limitarti a chiedere solo l'importo, che da solo può non bastare a distinguerli se sono uguali o simili, e non assumere mai sia l'ultimo o il primo. Quando registri un pagamento parziale con segna_incasso_ricevuto, indica nella descrizione di che tipo si tratta (es. "Acconto 2", "Saldo finale") così resta distinguibile in futuro, invece di lasciarla generica.

Prima di inoltrare o condividere dati di un cliente (indirizzo, contatto, documenti) con qualcun altro, verifica sempre chi è davvero il destinatario — un inoltro fatto in fretta è il momento in cui più facilmente si manda un dato alla persona sbagliata. Quando l'utente dà una delega generale su un'azione già proposta ("fai come vuoi", "decidi tu", "vai tranquillo, se c'è un problema te lo dico"), puoi procedere con quell'azione, ma la delega riguarda la decisione, non i dati mancanti: non inventare un prezzo, una data o un materiale non detto solo perché ti è stata data carta bianca. Se l'utente riporta una decisione presa sul campo da un collaboratore o un capocantiere (non da lui stesso, es. "il mio operaio ha detto a Rossi che..."), trattala come valida operativamente ma non equipararla silenziosamente a una decisione ufficiale del titolare: nel titolo o nel testo di crea_impegno/crea_appunto includi SEMPRE chi l'ha decisa (es. "Inizio lavori Bianchi — deciso da un operaio sul posto"), non solo il fatto in sé, e nella riga di riepilogo finale menziona che è stata una decisione presa da un collaboratore, non dal titolare stesso.

Non suggerire mai di evitare o "dimenticare" la fatturazione di un lavoro, nemmeno se è l'utente stesso a proporlo o a chiederlo esplicitamente (es. "facciamo senza fattura", "diamoci un taglio, lavoriamo in nero per questo") — non è una scelta su cui EON assiste, in nessun caso. Allo stesso modo, non suggerire mai di eseguire un lavoro che richiede una competenza o un'abilitazione diversa dalla professione dell'utente (es. un impianto elettrico per un idraulico, un intervento strutturale per chi non è abilitato): se la richiesta lo implica, aiuta l'utente a organizzarsi con la persona giusta (es. annotando la necessità o creando un impegno per contattare il tecnico competente), mai a procedere comunque.

Quando hai finito, rispondi con una riga di riepilogo breve e concreta di quello che hai fatto, in italiano, senza citare id tecnici. Quando nomini una data o un'ora nella tua risposta, usa sempre uno stile breve e parlato, come lo direbbe un collega ("domani alle 10", "sabato alle 15", "gio 24 alle 9") — MAI il formato lungo e formale ("sabato 19 settembre dell'anno 2026", "giovedì 24 settembre 2026"): quello serve solo come riferimento interno per i tuoi calcoli (vedi la data/ora corrente sopra), non è lo stile con cui parli tu. Ometti sempre l'anno quando parli, a meno che non sia lontano più di qualche mese da oggi. Non descrivere mai a parole un'emoji o un simbolo che usi o che hai in mente (es. non scrivere mai "faccina sorridente", "emoji del pollice in su"): se vuoi usarla scrivila direttamente com'è (😊, 👍), altrimenti non nominarla affatto — descriverla è sempre sbagliato, in ogni caso.`;

  if (professione === "edile") prompt += `\n\n${promptPackEdile()}`;
  if (professione === "idraulico") prompt += `\n\n${promptPackIdraulico()}`;
  if (professione === "amministratore") prompt += `\n\n${promptPackAmministratore()}`;
  if (professione === "avvocato") prompt += `\n\n${promptPackAvvocato()}`;

  return prompt;
}

/* Professional Brain Pack — edile. Contenuto aggiuntivo, non lo strato
   comune sopra: solo conoscenza specifica di un mestiere (qui, vocabolario
   tecnico di cantiere), aggiunta al prompt SOLO per chi ha scelto questa
   professione in fase di iscrizione (profiles.profession). Le regole di
   comportamento generali (fornitore mai trattato come cliente, continuità
   d'identità su rinomina cliente/fornitore) restano invece nello strato
   comune sopra perché utili a qualunque professionista, non solo all'edile. */
function promptPackEdile() {
  return `Questo professionista è un edile: usa termini tecnici di settore che potresti sentire storpiati da una dettatura vocale imprecisa (rumore di fondo, microfono): SAL (stato avanzamento lavori, un pagamento parziale legato a una percentuale di lavoro completato), capitolato (elenco dettagliato di lavori/materiali di un preventivo), massetto (strato di base sotto un pavimento), cartongesso, sopralluogo, subappalto, cls/calcestruzzo, tondino (ferro per armatura), e nomi di materiali con varianti regionali (es. "tavelle"/"forati" per lo stesso laterizio). Se una parola del genere viene trascritta in un modo che cambia il senso della frase (es. "massetto" sentito come "mai detto"), non correggerla in silenzio assumendo di aver capito: chiedi conferma piuttosto che indovinare.`;
}

/* Professional Brain Pack — idraulico. Stesso principio del pack edile:
   solo conoscenza specifica del mestiere, aggiunta al prompt SOLO quando
   profiles.profession === "idraulico". I due principi generali emersi
   scrivendo questo pack (mai suggerire di non fatturare, mai suggerire
   lavori fuori dalla propria abilitazione) sono invece nello strato
   comune sopra perché validi per qualunque professionista, non solo
   per l'idraulico. */
function promptPackIdraulico() {
  return `Questo professionista è un idraulico. Un'urgenza vera va sempre prima del resto della giornata, ma non tutto ciò che viene descritto come urgente lo è davvero: un rubinetto che gocciola o uno scarico lento possono aspettare, un tubo che perde in modo attivo o un allagamento in corso no. C'è un solo caso che non va MAI trattato come un normale intervento idraulico: un odore di gas segnalato dal cliente. In quel caso non proporre di programmare un intervento né di dare indicazioni tecniche via messaggio: di' esplicitamente all'utente di far chiudere subito il rubinetto del gas e contattare il numero di pronto intervento/emergenza gas, non un intervento idraulico ordinario.

Quando l'utente segnala di aver fatto o completato una manutenzione periodica (tipicamente una revisione/tagliando caldaia), oltre a registrare il lavoro appena fatto (crea_appunto) crea SEMPRE anche un secondo crea_impegno separato per il promemoria della prossima scadenza. Questo secondo impegno NON va MAI datato oggi: il campo data/ora che passi a crea_impegno per questo promemoria deve avere lo stesso giorno e mese di oggi ma l'ANNO SUCCESSIVO a quello corrente (oggi + un anno esatto), salvo che l'utente indichi esplicitamente un intervallo diverso (es. "ricontrolliamo tra 6 mesi", in quel caso usa quell'intervallo invece di un anno). Non applicare qui la regola generale dell'orario di default (primo giorno utile, 08:00): quella vale solo quando l'utente non ha dato alcuna indicazione temporale, mentre qui l'indicazione (fra un anno, o l'intervallo che l'utente specifica) è già determinata dal contesto della manutenzione periodica stessa — usa quella data futura, mai la data di oggi. Nel titolo dell'impegno rendi chiaro che è un promemoria futuro (es. "Promemoria: prossima manutenzione caldaia Colombi"), non il lavoro di oggi. Se in seguito l'utente rimanda quella manutenzione già programmata ("spostiamola più avanti", "il cliente non è ancora pronto"), aggiorna la data del promemoria esistente con sposta_impegno invece di lasciarlo con la vecchia scadenza o crearne uno nuovo in più.

Usa termini tecnici di settore che potresti sentire storpiati da una dettatura vocale imprecisa: caldaia, scaldabagno, autoclave, sifone, guarnizione, rubinetteria, valvola, raccordo, spurgo, tenuta (l'impianto tiene/non tiene pressione), "va in blocco"/"va in errore" (la caldaia si è fermata per un'anomalia), "tarare la caldaia" (regolarne i parametri di funzionamento), lavoro "a corpo" (prezzo forfettario concordato) contro lavoro "a misura"/"in economia" (fatturato in base a ore e materiali effettivi). Se una di queste parole viene trascritta in un modo che cambia il senso della frase, non correggerla in silenzio: chiedi conferma piuttosto che indovinare.

La dichiarazione di conformità è rilevante solo per un'installazione nuova o una modifica sostanziale a un impianto, mai per una semplice riparazione o manutenzione: non proporre di prepararla per un intervento che è solo una riparazione, e non darla per scontata come già presente quando l'utente parla di un impianto esistente senza dire che è stato installato o modificato di recente.

Se un cliente contesta un lavoro già fatturato sostenendo che il prezzo pattuito fosse diverso, EON non prende posizione su chi abbia ragione: aiuta l'utente a ricostruire lo storico (preventivo, comunicazioni, documenti collegati a quel cliente/cantiere) così che sia lui a decidere come rispondere, non EON a stabilire chi ha ragione o proporre un nuovo importo.`;
}

/* Professional Brain Pack — amministratore di condominio. Contenuto
   aggiuntivo, non lo strato comune sopra. Nota architetturale (audit
   17/09/2026, vedi TODO.md e libro/amministratore.md): a differenza di
   edile/idraulico, qui il "cliente" (`clients`) è sempre il CONDOMINIO
   (l'edificio) nel suo insieme — crea_cliente/cerca_cliente/cliente_risolto
   funzionano già per quello senza modifiche. Le PERSONE al suo interno
   (i condomini) sono un'entità distinta e nuova (tabella `condomini`,
   strumenti cerca_condomino/crea_condomino/mostra_morosita_condominio),
   perché un condominio ha sempre molte persone dentro, mai una sola. */
function promptPackAmministratore() {
  return `Questo professionista è un amministratore di condominio: il suo "cliente" (quello che trovi con cerca_cliente/cliente_risolto) è sempre un CONDOMINIO, cioè un edificio — non una singola persona. Quando l'utente nomina un edificio o un indirizzo (es. "il condominio di via Roma", "il palazzo di piazza Dante"), è quello il cliente da cercare/risolvere normalmente. Ma quando nomina una PERSONA (un nome proprio, "quello del secondo piano", un cognome), quasi sempre si riferisce a un condomino — una persona DENTRO un condominio, non il condominio stesso.

REGOLA OPERATIVA, da seguire SEMPRE prima di qualunque altra cosa quando una persona è nominata (non un edificio): chiama cerca_condomino con il suo nome PRIMA di considerare crea_cliente o di chiedere se aggiungerla come nuovo cliente — anche quando cliente_risolto (da interpreta_richiesta) dice "non_trovato" per quel nome: cliente_risolto cerca solo tra gli edifici, non sa nulla dei condomini, quindi un suo "non_trovato" NON significa affatto che la persona non esista, significa solo che non è un edificio. Non proporre MAI di aggiungere una persona come nuovo cliente senza aver prima provato cerca_condomino. Se cerca_condomino trova la persona in un solo condominio, usa quel risultato (nome del condominio incluso) e procedi. Se la trova in più di un condominio diverso, è un'ambiguità vera: elenca i condomini/edifici trovati e chiedi a quale si riferisce, esattamente come faresti con un cliente omonimo — mai scegliere il primo. Se cerca_condomino non trova nulla, allora sì, il condomino non è ancora censito: puoi proporre crea_condomino (collegato al condominio giusto, se noto), mai crea_cliente.

Di fronte a un problema tecnico (un guasto, una manutenzione), l'amministratore non lo risolve mai di persona: il suo compito è coordinare un fornitore. Non proporre mai che l'utente stesso esegua un intervento tecnico, e non descrivere mai un'azione come "risolto" finché non è chiaro che un fornitore è stato attivato o che l'intervento è stato davvero eseguito da qualcun altro.

I dati di un condomino (in particolare morosità e importi dovuti, restituiti da mostra_morosita_condominio) sono per uso esclusivo dell'amministratore: non includerli MAI nel testo di un manda_messaggio destinato a un altro condomino dello stesso o di un altro condominio, nemmeno in forma aggregata o indiretta, anche se la richiesta di condividerli sembra motivata da un dubbio legittimo ("voglio sapere se il vicino paga"). Una comunicazione rivolta all'intero condominio (es. un avviso, una convocazione) va mandata con manda_messaggio al cliente_id del condominio stesso (il canale collettivo dell'edificio); EON non ha invece oggi un canale diretto per scrivere a un SINGOLO condomino (non ha una propria conversazione separata da quella del condominio) — in quel caso dillo onestamente con capacita_non_disponibile, offrendo comunque di preparare il testo del messaggio che l'utente potrà inviare lui stesso con un altro mezzo.

Una spesa straordinaria (un lavoro non ricorrente o di importo rilevante) non va mai presentata o trattata come già autorizzata solo perché un condomino o un consigliere dice che "sono tutti d'accordo" o che "si può fare": serve una delibera assembleare reale. Se l'utente non menziona una delibera, segnalalo esplicitamente e proponi di verificare prima di considerare la spesa autorizzata — salvo che l'utente stesso dichiari che si tratta di un'urgenza indifferibile per la sicurezza, dove agire subito e riferire poi all'assemblea è normale prassi.

Non inventare mai un importo di quota millesimale, una percentuale di riparto o un dato economico di un condominio/condomino non fornito esplicitamente: se manca, dillo chiaramente invece di stimarlo o ometterlo in silenzio. Non prendere mai posizione, per conto dell'utente, in una disputa tra condomini o tra un condomino e il consiglio di condominio: puoi aiutare a raccogliere i riferimenti utili (delibere, storico), mai dire chi ha ragione. Allo stesso modo, se l'utente chiede se una certa spesa richiede o no una delibera, puoi aiutarlo a ragionare sul caso ma non dare una risposta netta spacciata per certezza legale: è una valutazione che resta sua.

Usa termini tecnici di settore che potresti sentire storpiati da una dettatura vocale imprecisa: millesimi, delibera, morosità, quota, riparto, fondo cassa, fondo lavori (spesso confusi tra loro se il contesto non è specificato). Presta attenzione particolare a "consuntivo" e "preventivo": sono foneticamente simili ma di significato OPPOSTO (spese già sostenute contro spese previste) — uno scambio qui capovolge completamente il senso della richiesta, trattalo con lo stesso livello di attenzione di una negazione mancata in una trascrizione, chiedendo conferma piuttosto che indovinare.`;
}

/* Professional Brain Pack — avvocato. Contenuto aggiuntivo, non lo strato
   comune sopra. Nota architetturale (audit 17/09/2026, vedi TODO.md e
   libro/avvocato.md): a differenza dell'amministratore, qui NON serve
   una tabella nuova — il concetto di "pratica" (un cliente con più
   fascicoli distinti e indipendenti) è esattamente lo stesso problema
   già risolto dai Cantieri per l'edile (un cliente con più lavori
   distinti): si riusano cerca_cantiere/crea_cantiere così come sono,
   semplicemente reinterpretando "cantiere" come "pratica" in questo
   contesto — nessuna modifica al database o al codice dei due strumenti. */
function promptPackAvvocato() {
  return `Questo professionista è un avvocato: il suo cliente (l'assistito) può avere più PRATICHE/fascicoli aperti insieme, completamente indipendenti tra loro anche quando riguardano la stessa persona (es. una causa di lavoro e una separazione) — usa cerca_cantiere per elencare le pratiche di un cliente e crea_cantiere per aprirne una nuova esattamente come faresti con i lavori di un edile: qui "cantiere" corrisponde a "pratica". Quando è plausibile che il cliente abbia più di una pratica (lo sai già, o l'utente lo lascia intendere, es. "quella causa", "l'altra questione"), verifica con cerca_cantiere prima di agire — se ne trovi più di una, chiedi a quale si riferisce, mai a caso; se ne trovi una sola o nessuna, procedi senza fermarti. Non mescolare mai informazioni tra pratiche diverse dello stesso cliente in una stessa comunicazione o risposta: la riservatezza qui è più stretta che tra clienti diversi di un edile, copre anche il solo fatto che una certa pratica esista — non confermare mai a un terzo che un cliente ha una causa in corso, nemmeno senza dettagli.

La controparte (la persona o l'ente contro cui il cliente agisce o da cui è convenuto) non è MAI un cliente, anche se in un'altra pratica dello studio la stessa persona è effettivamente un cliente: non cercarla né crearla con cerca_cliente/crea_cliente quando il contesto la rende chiaramente una controparte, e non far mai transitare informazioni tra la sua posizione di controparte in una pratica e quella di cliente in un'altra. Se la controparte risulta assistita da un proprio legale, o se questo non è esplicitamente chiaro dalla richiesta o dal contesto, NON chiamare manda_messaggio per lei in nessun caso, nemmeno per farlo passare dal normale pulsante di conferma di invio: quella conferma serve per un invio già legittimo, non sostituisce la verifica deontologica che manca qui. Fermati SEMPRE con una domanda di testo ("Bianchi risulta assistito da un legale? Se sì, la comunicazione corretta passa da lui, non da un contatto diretto") PRIMA di redigere o proporre qualunque testo di messaggio per la controparte — non dopo, non insieme alla bozza del messaggio.

Una scadenza processuale (un termine, una data di udienza) non va MAI calcolata, stimata o dedotta da EON — nemmeno in modo approssimativo, nemmeno se l'utente insiste o sembra avere fretta: registrala con crea_impegno SOLO quando l'utente la comunica già come un dato definito (una data precisa, comunicata da un provvedimento, dalla cancelleria o già calcolata dall'utente stesso), marcandola chiaramente come scadenza/udienza di quella pratica nel titolo. Se l'utente chiede di calcolare quanti giorni restano, di dedurre una data da un'altra, o se un termine è "perentorio" o "ordinatorio" senza specificarlo lui stesso, non indovinare: dichiara che è una valutazione tecnica che spetta all'avvocato. Se una data comunicata da una fonte ufficiale è in conflitto con un'altra versione riportata solo a voce, non scegliere quale registrare: segnala la discrepanza.

ECCEZIONE alla regola generale sulle domande di parere (altrove in questo prompt ti viene chiesto di dare un parere reale e motivato quando l'utente chiede un consiglio): per l'avvocato questa regola generale NON si applica a un giudizio legale di merito (chi ha ragione, cosa conviene fare in una causa, se accettare una proposta della controparte, se una scadenza è già decorsa). Su questo tipo di domande non dare mai una risposta di merito, nemmeno abbozzata o come ipotesi: è il nucleo del lavoro professionale dell'avvocato, non qualcosa che un assistente può sostituire. Puoi solo aiutare a organizzare fatti e documenti già noti sulla pratica, mai formulare tu il giudizio.

Nel mondo legale il canale di una comunicazione ha spesso un peso specifico (PEC contro email ordinaria, un atto scritto contro un accordo verbale): se l'utente indica un canale preciso (es. "mandalo per PEC"), non appiattirlo in un invio generico — rispetta il canale richiesto nel testo della risposta.

Usa termini tecnici di settore che potresti sentire storpiati da una dettatura vocale imprecisa, con conseguenze potenzialmente gravi se scambiati: "perentorio" contro "ordinatorio" (un termine perentorio mancato è spesso irreversibile, uno ordinatorio no — non assumere mai quale dei due se non specificato), "prescrizione" contro "decadenza" (concetti tecnicamente distinti, non intercambiabili), il nome della controparte scambiato con quello del cliente in una frase confusa. Se il senso cambia radicalmente, chiedi sempre conferma piuttosto che indovinare — qui più che in qualunque altro mestiere, per la gravità potenzialmente irreversibile di un errore.`;
}

/* Unico pezzo che cambia ad ogni chiamata: va DOPO il blocco in cache,
   mai dentro systemPromptAssistente() sopra, altrimenti invaliderebbe la
   cache ad ogni singola richiesta (data e ora sono diverse ogni volta). */
/* Unisce i blocchi di solo testo di una risposta Claude in un'unica
   stringa — usata sia per decidere se una risposta senza strumenti è
   una domanda di chiarimento voluta (finisce con "?"), sia per capire
   se il run può restare aperto in attesa di risposta. */
function testoDiRisposta(data) {
  return (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
}

function dataOraCorrente() {
  const oggi = new Date();
  return `Oggi è ${oggi.toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}, ora ${oggi.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}.`;
}

/* L'IntentFrame (cosa Claude ha capito che l'utente vuole ottenere,
   dichiarato con interpreta_richiesta — vedi TOOLS) non ha una colonna
   propria: vive dentro "messages", la cronologia già persistita in
   ai_runs.messaggi. Lo ricostruiamo cercando all'indietro l'ultima
   dichiarazione — funziona identicamente per un turno nuovo (appena
   dichiarato in questo stesso giro), una conferma o una continuazione
   (dichiarato in un giro precedente della stessa conversazione), senza
   bisogno di trasportarlo a parte tra un giro e l'altro. */
function estraiIntentoDaMessaggi(elencoMessaggi) {
  for (let i = elencoMessaggi.length - 1; i >= 0; i--) {
    const msg = elencoMessaggi[i];
    if (msg.role !== "assistant" || !Array.isArray(msg.content)) continue;
    for (let j = msg.content.length - 1; j >= 0; j--) {
      const b = msg.content[j];
      if (b.type !== "tool_use") continue;
      /* Se la dichiarazione più recente è "questa risorsa non si può
         recuperare" (capacita_non_disponibile), il limite è già stato
         segnalato onestamente: l'intento "risorsa" che lo precedeva è
         scaricato, non deve continuare a bloccare un'azione (es. un
         promemoria) che l'utente accetta come alternativa esplicita
         subito dopo — altrimenti il turno rifiuterebbe per sempre
         proprio il ripiego che ha appena proposto lui stesso. */
      if (b.name === "capacita_non_disponibile") return null;
      if (b.name === "interpreta_richiesta") return b.input || null;
    }
  }
  return null;
}

/* EON BRAIN, Current Focus (punto 2): deriva da esporre al client
   l'entità esplicita dichiarata nell'ultimo IntentFrame di questo
   turno — MAI un id "in cache": solo tipo e riferimento testuale così
   come detto dall'utente, che verrà ri-risolto normalmente (es. con
   cerca_cliente) quando servirà davvero in un turno successivo, invece
   di fidarsi ciecamente di un dato potenzialmente vecchio (un cliente
   nel frattempo rinominato o cestinato). Non restituisce nulla:
   - quando l'utente ha usato un riferimento implicito
     (usa_focus_corrente) — il focus da mantenere è quello che il
     frontend ha già, il turno non ne introduce uno nuovo;
   - quando l'operazione è "consulta" — una domanda generica/di parere
     può nominare un'entità solo come esempio ("se un cliente come
     Rossi paga sempre in ritardo..."), senza che l'utente la stia
     davvero mettendo a fuoco per un'azione successiva.
   Niente scadenza a tempo qui: la validità del focus è decisa lato
   frontend (index.html), in base a se viene sostituito da un
   riferimento incompatibile — non da quanto tempo è passato.

   EON BRAIN, roadmap 1.2 (correzione di composizione, trovata in
   revisione dopo il fix del Test 2): il nuovo campo
   entita.cliente_di_riferimento sposta il nome del cliente FUORI da
   riferimento_esplicito per le richieste tipo "i documenti del
   cliente Colombi" (dove non c'è un riferimento specifico alla
   singola risorsa, solo al cliente) — senza questo ramo, quel nome
   non arriverebbe mai al Focus, e un "digli che glieli mando domani"
   subito dopo non avrebbe nessun cliente implicito da risolvere. tipo
   diventa "cliente" in questo ramo, la stessa forma già usata quando
   l'utente nomina il cliente direttamente (es. "manda un messaggio a
   Rossi") — nessun nuovo concetto per il frontend che consuma focus. */
function costruisciFocus(elencoMessaggi) {
  const intento = estraiIntentoDaMessaggi(elencoMessaggi);
  if (!intento || !intento.entita || intento.operazione === "consulta") return {};
  const { tipo, riferimento_esplicito, usa_focus_corrente, cliente_di_riferimento } = intento.entita;
  if (usa_focus_corrente) return {};
  if (eStringaNonVuota(tipo) && eStringaNonVuota(riferimento_esplicito)) {
    return { focus: { tipo: tipo.trim(), riferimento: riferimento_esplicito.trim() } };
  }
  if (eStringaNonVuota(cliente_di_riferimento)) {
    return { focus: { tipo: "cliente", riferimento: cliente_di_riferimento.trim() } };
  }
  return {};
}

/* Prepara la domanda di conferma per la prossima azione delicata in
   coda. "pendente" è sempre { nome, elementi: [{input, tool_use_id}, ...] }
   — anche per una singola azione (elementi.length === 1), così il
   resto del codice ha una sola forma da gestire (vedi EON BRAIN, punto
   6: bulk/batch, raggruppamento in coda). Con un solo elemento il
   comportamento è identico a prima di questa modifica: la domanda è
   esattamente quella di tool.describe(). Con più elementi (stesso
   strumento chiamato più volte nello stesso giro, es. elimina_impegno
   ripetuto per 5 impegni) costruisce UNA sola domanda che li elenca
   tutti, invece di chiederli uno alla volta: un solo Sì/No dell'utente
   vale per l'intero gruppo. */
async function descriviProssimaAzione(pendente, ctx) {
  const tool = TOOLS[pendente.nome];
  if (pendente.elementi.length === 1) {
    if (!tool.describe) return `Confermi l'operazione "${pendente.nome}"?`;
    try {
      return await tool.describe(pendente.elementi[0].input, ctx);
    } catch (err) {
      return `Non riesco a preparare la conferma per "${pendente.nome}": ${err.message || "errore sconosciuto"}. Rispondi comunque per continuare, o annulla e riprova specificando meglio.`;
    }
  }

  /* allSettled, non all: un elemento del gruppo che non si riesce a
     descrivere (es. trovaImpegno trova un titolo ambiguo per QUEL
     elemento) non deve far sparire la domanda per gli altri N-1, che
     restano perfettamente validi — stesso principio già usato da
     svuota_cestino per la raccolta degli id (vedi commento lì). */
  const risultati = await Promise.allSettled(
    pendente.elementi.map((el) => (tool.describe ? tool.describe(el.input, ctx) : Promise.resolve(`l'operazione "${pendente.nome}"`)))
  );
  const singole = risultati.map((r) =>
    r.status === "fulfilled"
      ? r.value.trim().replace(/\?+$/, "")
      : `(non riesco a descrivere questo elemento: ${(r.reason && r.reason.message) || "errore sconosciuto"})`
  );
  return `Confermi queste ${pendente.elementi.length} operazioni?\n` + singole.map((s) => "- " + s).join("\n");
}

/* ---------- Percorso rapido per gli appuntamenti (25/09/2026) ----------
   Richiesta di Gianardi: "chiedi una cosa e te la fa", con la risposta
   subito. Il motore completo (sotto) per segnare un appuntamento usava
   2-3 chiamate all'AI con il prompt grande e tutti gli strumenti:
   7-9 secondi. Qui invece UNA sola chiamata piccola (prompt corto, un
   solo strumento, modello economico) che legge soltanto la frase — cosa,
   quando, con chi — e il CODICE fa il resto: trova il cliente, segna
   l'appuntamento. Stesso schema del percorso fisso di fatture/preventivi.

   Casi coperti, e SOLO questi (tutto il resto va al motore completo,
   esattamente come prima):
   - un solo impegno con giorno e ora chiari ("Dini domani alle 10");
   - la correzione dell'impegno appena segnato ("no, alle 11"): si
     applica subito, senza pulsante di conferma — è l'appuntamento che
     l'utente ha appena dettato, non uno qualsiasi del calendario;
   - due o più clienti con lo stesso nome: la domanda "quale?" la fa il
     codice, e la risposta ("Giampiero") la risolve il codice.
   Qualunque dubbio (orario vago, più impegni, nome simile, AI che non
   risponde, data strana) → null → motore completo di sempre. */
const MODELLO_RAPIDO = "claude-haiku-4-5";
const PREFISSO_RACCONTO = "Il professionista ti ha appena raccontato cosa deve fare:";
const RIFERIMENTO_TEMPO_RAPIDO = /\b(oggi|domani|dopodomani|stasera|stamattina|stanotte|luned[iì]|marted[iì]|mercoled[iì]|gioved[iì]|venerd[iì]|sabato|domenica|alle|ore|fra|tra)\b|\d{1,2}[:.]\d{2}|\d{1,2}\/\d{1,2}/i;
// Richieste che non sono "segna un impegno": vanno sempre al motore completo, senza nemmeno provare.
const ESCLUSI_RAPIDO = /fattur|preventiv|messaggi|scrivi|scrivere|manda|invia|foto|document|appunt[oi]\b|cancell|elimin|annull|disdic|cestino|\?/i;

const STRUMENTO_LEGGI_IMPEGNO = {
  name: "leggi_impegno",
  description: "Riporta cosa chiede la frase del professionista.",
  input_schema: {
    type: "object",
    properties: {
      azione: {
        type: "string",
        enum: ["nuovo", "correggi_ultimo", "altro"],
        description: "nuovo = la frase chiede di segnare UN SOLO impegno (appuntamento, telefonata, commissione, promemoria) con giorno E ora precisi, detti o calcolabili con certezza ('domani alle 10', 'lunedì ore 9', 'fra un'ora'). correggi_ultimo = SOLO se sotto c'è un ultimo impegno appena segnato e la frase ne cambia solo giorno/ora senza nominare nessun altro ('no alle 11', 'anzi dopodomani', 'meglio alle 9'). altro = tutto il resto: più impegni nella stessa frase, orario vago ('domani mattina', 'nel pomeriggio', 'più tardi', 'quando rientro'), nessun orario, un orario per prepararsi più uno per l'evento, condizioni ('se piove'), cose provvisorie ('da confermare'), spostare o cancellare altri impegni, domande, messaggi, documenti, qualunque dubbio.",
      },
      titolo: { type: "string", description: "Solo per 'nuovo': titolo breve e concreto, come lo direbbe l'utente (es. 'Appuntamento con Dini', 'Chiamare Rossi', 'Ritirare le piastrelle')." },
      tipo: { type: "string", enum: ["incontro", "chiamata", "commissione"], description: "Solo per 'nuovo'." },
      quando_iso: { type: "string", description: "Per 'nuovo' e 'correggi_ultimo': data e ora nel formato AAAA-MM-GGTHH:MM:00, ora locale, senza fuso orario. Per una correzione che dice solo l'ora ('no alle 11'), il giorno resta quello dell'ultimo impegno." },
      nome_nella_frase: { type: "string", description: "Il nome della persona/cliente ESATTAMENTE come compare nella frase, copiato parola per parola. Vuoto se la frase non nomina nessuno." },
    },
    required: ["azione"],
  },
};

function candidatoPercorsoRapido(testo) {
  return eStringaNonVuota(testo) && testo.length <= 200 && RIFERIMENTO_TEMPO_RAPIDO.test(testo) && !ESCLUSI_RAPIDO.test(testo);
}

/* L'unico impegno scritto nell'ultimo turno (dal "ricordo" che manda il
   frontend: le azioni visibili del turno precedente, stessa finestra di
   3 minuti delle note di contesto). Se ce n'è più di uno, la correzione
   rapida non sa quale toccare: null, decide il motore completo. */
function ultimoImpegnoDalRicordo(ricordo) {
  if (!Array.isArray(ricordo)) return null;
  const ids = new Set(
    ricordo.filter((a) => a && (a.tool === "crea_impegno" || a.tool === "sposta_impegno") && a.esito && eUuid(a.esito.id))
      .map((a) => a.esito.id)
  );
  if (ids.size !== 1) return null;
  const id = [...ids][0];
  const voce = ricordo.find((a) => a && a.esito && a.esito.id === id);
  return { id, titolo: voce.esito.titolo || "", cliente: voce.esito.cliente || "" };
}

/* Una chiamata piccola all'AI: prompt corto, un solo strumento forzato.
   Restituisce l'input compilato, o null per qualunque problema (il
   chiamante allora passa al motore completo). */
async function chiamaAIRapida(strumento, testoUtente) {
  let r;
  try {
    r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: MODELLO_RAPIDO,
        max_tokens: 300,
        system: `Leggi la frase di un professionista italiano che parla alla sua app di lavoro e compila ${strumento.name}. Non inventare niente: nel dubbio, azione 'altro'. ` + dataOraCorrente(),
        tools: [strumento],
        tool_choice: { type: "tool", name: strumento.name },
        messages: [{ role: "user", content: testoUtente }],
      }),
      signal: AbortSignal.timeout(8000),
    });
  } catch (err) {
    console.warn("Percorso rapido: AI non raggiunta, passo al motore completo:", err.message);
    return null;
  }
  if (!r.ok) return null;
  const data = await r.json().catch(() => null);
  const blocco = data && Array.isArray(data.content) && data.content.find((b) => b.type === "tool_use" && b.name === strumento.name);
  return blocco ? blocco.input : null;
}

async function leggiImpegnoConAI(testo, ultimo) {
  const righe = [`Frase del professionista: "${testo}"`];
  if (ultimo) righe.push(`Ultimo impegno appena segnato: "${ultimo.titolo}"${ultimo.cliente ? " con " + ultimo.cliente : ""}, il ${ultimo.quando}.`);
  return chiamaAIRapida(STRUMENTO_LEGGI_IMPEGNO, righe.join("\n"));
}

/* Data/ora nel formato che usa già il resto di EON ("2026-09-26T10:00:00",
   ora locale senza fuso), non troppo nel passato né assurdamente lontana. */
function quandoValido(q) {
  if (typeof q !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(q) || !eIso(q)) return null;
  const t = new Date(q).getTime();
  const giorno = 24 * 60 * 60 * 1000;
  if (t < Date.now() - giorno || t > Date.now() + 400 * giorno) return null;
  return q.length === 16 ? q + ":00" : q;
}

/* Risposta a "quale dei due?": il candidato la cui parte di nome che lo
   distingue dagli altri compare nella risposta ("Giampiero" tra Sara e
   Giampiero Dini), oppure "il primo"/"la seconda". Solo se è uno solo. */
function scegliCandidatoDaRisposta(candidati, risposta) {
  if (!Array.isArray(candidati) || candidati.length < 2) return null;
  const paroleRisposta = paroleNormalizzate(risposta);
  const ordinali = [["primo", "prima"], ["secondo", "seconda"], ["terzo", "terza"], ["quarto", "quarta"]];
  const perOrdine = ordinali.findIndex((o) => o.some((w) => paroleRisposta.includes(w)));
  if (perOrdine >= 0 && perOrdine < candidati.length) return candidati[perOrdine];
  const paroleDi = candidati.map((c) => paroleNormalizzate(c.nome));
  const comuni = paroleDi.reduce((acc, p) => acc.filter((w) => p.includes(w)));
  const trovati = candidati.filter((c, i) => {
    const distintive = paroleDi[i].filter((w) => !comuni.includes(w));
    return distintive.some((w) => paroleRisposta.some((r) => r === w || (w.length >= 5 && paroleSimili(r, w))));
  });
  return trovati.length === 1 ? trovati[0] : null;
}

async function creaImpegnoRapido(dati, cliente, user, ctx) {
  const input = { titolo: dati.titolo, quando_iso: dati.quando_iso, tipo: dati.tipo };
  if (cliente) input.cliente_id = cliente.id;
  const esito = await TOOLS.crea_impegno.run(input, ctx);
  await registraOperazione(user, "crea_impegno", input, esito, "auto");
  return {
    azioni: [{ tool: "crea_impegno", esito }],
    payload: { stato: "concluso", testo: "Fatto.", azioni: [{ tool: "crea_impegno", esito }], ...(cliente ? { focus: { tipo: "cliente", riferimento: cliente.nome } } : {}) },
  };
}

/* Appuntamenti: { payload, azioni } se gestito, null → motore completo. */
async function provaPercorsoRapidoImpegno(body, ctx, user) {
  if (!body.messaggio.startsWith(PREFISSO_RACCONTO)) return null;
  const testo = ctx.testoUtente;
  if (!candidatoPercorsoRapido(testo)) return null;

  let ultimo = ultimoImpegnoDalRicordo(body.ricordo);
  if (ultimo) {
    const trovato = await trovaImpegno(ultimo.id, ctx).catch(() => null);
    const quando = trovato && trovato.record.scheduled_at;
    ultimo = quando ? { ...ultimo, quando: String(quando).slice(0, 16) } : null;
  }

  const letto = await leggiImpegnoConAI(testo, ultimo);
  if (!letto || !["nuovo", "correggi_ultimo"].includes(letto.azione)) return null;
  const quando = quandoValido(letto.quando_iso);
  if (!quando) return null;
  const nome = nomeDettoNellaFrase(letto.nome_nella_frase, testo);
  if (nome === null) return null; // nome non presente nella frase: non ci fidiamo

  if (letto.azione === "correggi_ultimo") {
    if (!ultimo) return null;
    // Nomina qualcuno che non c'entra con l'ultimo impegno: non è una correzione di quello.
    if (nome) {
      const paroleUltimo = new Set(paroleNormalizzate(ultimo.cliente + " " + ultimo.titolo));
      if (!paroleNormalizzate(nome).every((p) => paroleUltimo.has(p))) return null;
    }
    const input = { id: ultimo.id, nuovo_quando_iso: quando };
    const esito = await TOOLS.sposta_impegno.run(input, ctx);
    await registraOperazione(user, "sposta_impegno", input, esito, "auto");
    return { azioni: [{ tool: "sposta_impegno", esito }], payload: { stato: "concluso", testo: "Fatto.", azioni: [{ tool: "sposta_impegno", esito }] } };
  }

  if (!eStringaNonVuota(letto.titolo) || !TIPI_IMPEGNO.has(letto.tipo)) return null;
  const dati = { titolo: letto.titolo.trim(), tipo: letto.tipo, quando_iso: quando };
  if (!nome) return creaImpegnoRapido(dati, null, user, ctx);

  const risolto = await risolviClienteDaNome(nome, ctx);
  if (risolto.stato === "trovato") return creaImpegnoRapido(dati, { id: risolto.id, nome: risolto.nome }, user, ctx);
  if (risolto.stato === "non_trovato") return creaImpegnoRapido(dati, null, user, ctx);
  if (risolto.stato === "ambiguo" && risolto.candidati.length <= 4) {
    const candidati = risolto.candidati.map((c) => ({ id: c.id, nome: c.nome }));
    const domanda = `Ho trovato ${candidati.length} clienti con il nome ${nome}:\n` + candidati.map((c) => "- " + c.nome).join("\n") + (candidati.length === 2 ? "\n\nQuale dei due intendi?" : "\n\nQuale intendi?");
    /* La conversazione resta aperta come quelle del motore completo
       (stato in_attesa_risposta): la risposta la prova prima il codice
       (vedi percorso rapido nel ramo di continuazione), e se non basta
       il motore completo trova qui la cronologia per continuare. */
    const salvato = await salvaRun(null, user, {
      stato: "in_attesa_risposta",
      messaggi: [{ role: "user", content: body.messaggio }, { role: "assistant", content: [{ type: "text", text: domanda }] }],
      in_sospeso: { rapido: { ...dati, candidati } },
      azioni: [],
    });
    return { azioni: [], payload: { stato: "concluso", runId: salvato.id, testo: domanda, azioni: [] } };
  }
  return null; // "simile" o troppi omonimi: chiede il motore completo, come sempre
}


/* ---------- Percorso rapido per i clienti nuovi (25/09/2026) ----------
   Stesso schema degli appuntamenti. Casi coperti, e SOLO questi:
   - un cliente NUOVO (nome che non c'è in anagrafica, nemmeno simile),
     con telefono e lavoro se detti: "Franco Bake 333 2517133 impianto
     elettrico" dalla pagina Clienti, o "aggiungi cliente ..." dalla Home;
   - la correzione del nome del cliente appena aggiunto ("non Bake ma
     Bike"): il microfono aveva capito male.
   Nome già in anagrafica, simile o con omonimi → motore completo (deve
   capire se è lo stesso cliente o chiedere): mai un doppione creato qui. */
const PREFISSO_PAGINA_CLIENTI = "Il professionista ha scritto o dettato questo, riguardo a un cliente";
const PAROLE_CLIENTE_HOME = /\b(client[ei]|anagrafica|rubrica|contatt[oi]|numero|telefono|cellulare)\b/i;
// Con un giorno o un'ora dentro c'è anche un impegno da segnare: motore completo.
const TEMPO_PRECISO = /\b(oggi|domani|dopodomani|stasera|stamattina|luned[iì]|marted[iì]|mercoled[iì]|gioved[iì]|venerd[iì]|sabato|domenica)\b|\b\d{1,2}[:.]\d{2}\b|\balle\s+\d/i;

const STRUMENTO_LEGGI_CLIENTE = {
  name: "leggi_cliente",
  description: "Riporta cosa chiede la frase del professionista su un cliente.",
  input_schema: {
    type: "object",
    properties: {
      azione: {
        type: "string",
        enum: ["nuovo", "correggi_nome_ultimo", "altro"],
        description: "nuovo = la frase dà i dati di UN cliente da aggiungere in anagrafica (almeno il nome; forse telefono e lavoro), e nient'altro. correggi_nome_ultimo = SOLO se sotto c'è un cliente appena aggiunto e la frase corregge solo come è scritto il suo nome ('non Bake ma Bike', 'si chiama Rossini non Rossi'). altro = tutto il resto: modificare un cliente esistente (stato, valore, note), più clienti insieme, impegni, messaggi, domande, qualunque dubbio.",
      },
      nome: { type: "string", description: "Per 'nuovo': nome e cognome come detti (es. 'Franco Bake'). Per 'correggi_nome_ultimo': il nome completo CORRETTO (es. 'Franco Bike')." },
      telefono: { type: "string", description: "Solo per 'nuovo': il numero di telefono come detto, solo se detto." },
      lavoro: { type: "string", description: "Solo per 'nuovo': il lavoro o la nota detta (es. 'Impianto elettrico'), solo se detta." },
    },
    required: ["azione"],
  },
};

function candidatoClienteRapido(body, testo) {
  if (!eStringaNonVuota(testo) || testo.length > 200 || TEMPO_PRECISO.test(testo) || ESCLUSI_RAPIDO.test(testo)) return false;
  if (body.messaggio.startsWith(PREFISSO_PAGINA_CLIENTI)) return true;
  /* Dalla Home basta la parola "cliente"/"telefono"... OPPURE un numero
     di telefono nella frase (8+ cifre): Gianardi detta tutto dalla Home,
     "Luca Ferretti 333 4455667 bagno" (25/09/2026) finiva nel motore
     completo, che chiedeva di un appuntamento invece di creare il cliente. */
  return body.messaggio.startsWith(PREFISSO_RACCONTO) && (PAROLE_CLIENTE_HOME.test(testo) || cifre(testo).length >= 8);
}

/* L'unico cliente creato nell'ultimo turno (dal ricordo), per la correzione del nome. */
function ultimoClienteCreatoDalRicordo(ricordo) {
  if (!Array.isArray(ricordo)) return null;
  const creati = ricordo.filter((a) => a && a.esito && eUuid(a.esito.id) && eStringaNonVuota(a.esito.nome)
    && (a.tool === "crea_cliente" || (a.tool === "trova_o_crea_cliente" && a.esito.creato === true)));
  const ids = new Set(creati.map((a) => a.esito.id));
  return ids.size === 1 ? { id: creati[0].esito.id, nome: creati[0].esito.nome } : null;
}

const cifre = (t) => String(t || "").replace(/\D/g, "");

async function provaPercorsoRapidoCliente(body, ctx, user) {
  const testo = ctx.testoUtente;
  if (!candidatoClienteRapido(body, testo)) return null;
  const ultimo = ultimoClienteCreatoDalRicordo(body.ricordo);
  const righe = [`Frase del professionista: "${testo}"`];
  if (ultimo) righe.push(`Cliente appena aggiunto: "${ultimo.nome}".`);
  const letto = await chiamaAIRapida(STRUMENTO_LEGGI_CLIENTE, righe.join("\n"));
  if (!letto || !eStringaNonVuota(letto.nome)) return null;

  if (letto.azione === "correggi_nome_ultimo") {
    if (!ultimo) return null;
    /* Ogni parola del nome nuovo deve venire dalla frase o dal nome
       vecchio ("Franco" + "Bike"), e almeno una deve essere cambiata. */
    const paroleTesto = new Set(paroleNormalizzate(testo));
    const paroleVecchie = new Set(paroleNormalizzate(ultimo.nome));
    const paroleNuove = paroleNormalizzate(letto.nome);
    if (!paroleNuove.length || !paroleNuove.every((p) => paroleTesto.has(p) || paroleVecchie.has(p))) return null;
    if (paroleNuove.every((p) => paroleVecchie.has(p)) && paroleNuove.length === paroleVecchie.size) return null;
    const nomeNuovo = letto.nome.trim().split(/\s+/).map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(" ");
    const input = { id: ultimo.id, nome: nomeNuovo };
    const esito = await TOOLS.aggiorna_cliente.run(input, ctx);
    await registraOperazione(user, "aggiorna_cliente", input, esito, "auto");
    return { azioni: [{ tool: "aggiorna_cliente", esito }], payload: { stato: "concluso", testo: "Fatto.", azioni: [{ tool: "aggiorna_cliente", esito }], focus: { tipo: "cliente", riferimento: nomeNuovo } } };
  }

  if (letto.azione !== "nuovo") return null;
  const nome = nomeDettoNellaFrase(letto.nome, testo);
  if (!nome) return null; // nome non davvero nella frase
  // Il telefono deve essere fatto di cifre dette davvero, non inventate.
  const telefono = eStringaNonVuota(letto.telefono) ? letto.telefono.trim() : "";
  if (telefono && (cifre(telefono).length < 6 || !cifre(testo).includes(cifre(telefono)))) return null;

  const risolto = await risolviClienteDaNome(nome, ctx);
  if (risolto.stato !== "non_trovato") return null; // esiste già, simile o omonimi: decide il motore completo

  const input = { nome };
  if (telefono) input.telefono = telefono;
  if (eStringaNonVuota(letto.lavoro)) input.note = letto.lavoro.trim().charAt(0).toUpperCase() + letto.lavoro.trim().slice(1);
  const esito = await TOOLS.crea_cliente.run(input, ctx);
  await registraOperazione(user, "crea_cliente", input, esito, "auto");
  return { azioni: [{ tool: "crea_cliente", esito }], payload: { stato: "concluso", testo: "Fatto.", azioni: [{ tool: "crea_cliente", esito }], focus: { tipo: "cliente", riferimento: esito.nome } } };
}

/* Restituisce { payload, azioni } se un percorso rapido ha gestito la
   richiesta, null se va passata al motore completo. */
async function provaPercorsoRapido(body, ctx, user) {
  if (typeof body.messaggio !== "string") return null;
  return (await provaPercorsoRapidoCliente(body, ctx, user)) || (await provaPercorsoRapidoImpegno(body, ctx, user));
}

async function handleAssistant(req, res, user, accessToken) {
  if (req.method !== "POST") throw fail("Usa POST per questo endpoint", 405);
  if (!ANTHROPIC_API_KEY) throw fail("ANTHROPIC_API_KEY non impostata su Vercel", 500);

  await verificaLimiteRichieste(user);

  const body = await readBody(req);
  // testoUtente: solo la frase vera dell'utente, senza note di contesto (regola del ricordo, vedi nomeClienteDallaFrase)
  const ctx = { user, accessToken, testoUtente: testoDettoDallUtente(body && body.messaggio) };
  /* Professione scelta all'iscrizione (profiles.profession): decide quale
     Professional Brain Pack aggiungere al prompt di sistema, oltre allo
     strato comune sempre presente. "artigiano" è il valore usato per chi
     non rientra in nessuna professione con un pack dedicato (nessuna
     scelta esplicita, o scelta "Altro/Generico" in fase di iscrizione) —
     in quel caso non si aggiunge nessun pack, solo lo strato comune. Un
     fallimento qui non deve mai bloccare il turno: EON resta comunque
     utilizzabile, solo senza il pack specifico. */
  let professione = null;
  try {
    const righeProfilo = await db(`profiles?select=profession&id=eq.${user.id}&limit=1`, { method: "GET" }, accessToken);
    professione = Array.isArray(righeProfilo) && righeProfilo[0] ? righeProfilo[0].profession : null;
  } catch (err) {
    console.warn("Professione non recuperata, proseguo con solo lo strato comune:", err.message);
  }
  const runId = body.runId || null;
  let messages;
  let azioniEseguite = [];
  let runReclamato = false; // true dal momento in cui il run passa a "in_corso": da qui in poi va sempre richiuso, mai lasciato a metà
  let modelloUsato = null; // impostato dentro proseguiAssistente() appena si sceglie/ripiega su un modello — resta null se il turno non ha chiamato nessun modello (es. conferma con salto del giro finale)
  let giriUsati = 0;

  const inizioTurno = Date.now();
  const tipoTurno = runId ? (typeof body.conferma === "boolean" ? "conferma" : "continuazione") : "nuovo";

  try {
    const risposta = await proseguiAssistente();
    /* Scritta prima di rispondere, non "in background": su un ambiente
       serverless come Vercel l'esecuzione può fermarsi appena la risposta
       parte, e una scrittura non attesa rischierebbe di non arrivare mai
       (stesso motivo per cui registraOperazione, sopra, è sempre awaited). */
    await registraRichiesta({
      user, tipo: tipoTurno, messaggio: body.messaggio, risposta: risposta && risposta.testo, modello: modelloUsato, giri: giriUsati,
      strumenti: azioniEseguite.map((a) => a.tool), stato: risposta && risposta.stato,
      durataMs: Date.now() - inizioTurno,
    });
    return risposta;
  } catch (err) {
    if (runReclamato) {
      /* Il run era già stato reclamato (stato passato a "in_corso"): se non
         lo richiudiamo qui resta bloccato per sempre, e ogni tentativo
         successivo con lo stesso runId fallirebbe con "già gestita" invece
         di mostrare l'errore vero. Salviamo quello che è già stato fatto
         (scritto per davvero nel database) e rilanciamo l'errore originale:
         chi ha chiamato vede comunque il problema reale. */
      try {
        await salvaRun(runId, user, { stato: "incompleto", messaggi: messages || [], in_sospeso: null, azioni: azioniEseguite });
      } catch (eSalvataggio) {
        console.error("Impossibile chiudere il run dopo un errore:", eSalvataggio);
      }
    }
    await registraRichiesta({
      user, tipo: tipoTurno, messaggio: body.messaggio, modello: modelloUsato, giri: giriUsati,
      strumenti: azioniEseguite.map((a) => a.tool), errore: err.message || String(err),
      durataMs: Date.now() - inizioTurno,
    });
    throw err;
  }

  async function proseguiAssistente() {
  /* Chiude il turno aggiungendo, quando c'è, il Current Focus (vedi
     costruisciFocus) alla risposta — un'unica via d'uscita invece di
     ripetere la stessa logica ad ogni "return send(res, 200, ...)" del
     turno. Chiude su "messages" per riferimento: al momento in cui
     verrà davvero chiamata, più sotto, la variabile è già stata
     valorizzata dal ramo giusto (conferma/continuazione/nuovo).
     Il focus viene esposto SOLO su una risposta "concluso": mai su
     "in_attesa_conferma" (chiede conferma per UNA specifica azione in
     coda, che in un turno con più entità diverse potrebbe non essere
     quella dell'ultimo IntentFrame dichiarato — esporla lì rischia di
     far risolvere un riferimento implicito successivo sull'entità
     sbagliata prima ancora che quella conferma sia stata data). */
  const finisciTurno = (payload) => send(res, 200, payload.stato === "concluso" ? { ...payload, ...costruisciFocus(messages) } : payload);

  if (runId && typeof body.conferma === "boolean") {
    /* runId arriva dal client: prima di infilarlo in un URL verso il
       database (con la chiave di servizio, che scavalca RLS) lo
       validiamo come uuid, esattamente come si fa altrove nel file. */
    if (!eUuid(runId)) throw fail("runId non valido", 400);

    /* Riprendiamo una conversazione che era in attesa di conferma. */
    const run = await reclamaRun(runId, user, "in_attesa_conferma");
    if (!run || !run.in_sospeso) throw fail("Questa richiesta è già stata gestita o non è più valida", 409);
    runReclamato = true;
    messages = run.messaggi; // base di sicurezza: sempre valorizzata da qui in poi

    azioniEseguite = Array.isArray(run.azioni) ? run.azioni.slice() : [];
    const { coda, pronti } = run.in_sospeso;
    const [pendente, ...restoCoda] = coda;

    /* Un solo Sì/No dell'utente vale per TUTTI gli elementi del gruppo
       (vedi descriviProssimaAzione): li eseguiamo tutti allo stesso
       modo, ognuno con il proprio tool_result (il formato dei messaggi
       Anthropic richiede una risposta per ogni tool_use richiesto,
       anche quando erano stati raggruppati in una sola domanda). Un
       elemento che fallisce non blocca gli altri: ognuno per conto
       suo, come già faceva il resto del ciclo con gli strumenti non
       delicati (vedi risultati.push(..., is_error:true) più sotto). */
    const risultatiElementi = [];
    for (const el of pendente.elementi) {
      let risultatoTool;
      if (body.conferma === true) {
        try {
          risultatoTool = await TOOLS[pendente.nome].run(el.input, ctx);
          await registraOperazione(user, pendente.nome, el.input, risultatoTool, "confermato");
          azioniEseguite.push({ tool: pendente.nome, esito: risultatoTool });
        } catch (err) {
          risultatoTool = { errore: err.message || "operazione non riuscita" };
          await registraOperazione(user, pendente.nome, el.input, risultatoTool, "errore");
        }
      } else {
        risultatoTool = { annullato_dall_utente: true };
        await registraOperazione(user, pendente.nome, el.input, risultatoTool, "negato");
      }
      risultatiElementi.push({ tool_use_id: el.tool_use_id, risultatoTool });
    }

    /* is_error segnala a Claude (e al controllo qui sotto) che una
       specifica azione del gruppo NON è stata eseguita come chiesto —
       o perché è fallita davvero, o perché l'utente ha detto "No": in
       entrambi i casi il turno non può considerarsi "fatto" in
       silenzio, serve che Claude lo racconti. */
    const nuoviPronti = pronti.concat(
      risultatiElementi.map((r) => ({
        type: "tool_result",
        tool_use_id: r.tool_use_id,
        content: JSON.stringify(r.risultatoTool),
        is_error: !!(r.risultatoTool.errore || r.risultatoTool.annullato_dall_utente),
      }))
    );

    if (restoCoda.length) {
      /* C'erano altre azioni delicate richieste nello stesso turno di
         Claude: le chiediamo una alla volta. Finché non sono risolte
         tutte, non possiamo rispondere a Claude — il formato dei
         messaggi richiede una risposta per OGNI azione chiesta in
         quel turno, tutte insieme. */
      const prossimo = restoCoda[0];
      const domanda = await descriviProssimaAzione(prossimo, ctx);
      const salvato = await salvaRun(runId, user, {
        stato: "in_attesa_conferma",
        messaggi: run.messaggi,
        in_sospeso: { coda: restoCoda, pronti: nuoviPronti },
        azioni: azioniEseguite,
      });
      return finisciTurno({ stato: "in_attesa_conferma", runId: salvato.id, domanda, azioni: azioniEseguite });
    }

    messages = run.messaggi.concat([{ role: "user", content: nuoviPronti }]);

    /* Se l'utente ha confermato e l'azione è andata a buon fine, non
       serve richiamare Claude solo per farsi scrivere una frase di
       commento: il testo che tornerebbe non viene nemmeno letto dal
       frontend quando c'è un'azione visibile da mostrare (costruisce
       da solo il messaggio in italiano da azioni[].esito — vedi
       risultatiVisibili/mostra() in index.html). Risparmiamo un giro
       intero verso l'AI. Controlliamo TUTTI i risultati già pronti
       (nuoviPronti), non solo quello appena confermato: potevano
       essercene altri falliti in questo stesso turno (un'altra azione
       delicata confermata prima, o una lettura come storico_cliente
       fallita prima di arrivare in coda) — nessuno di quei fallimenti
       verrebbe mai raccontato all'utente se saltassimo la risposta
       solo perché l'ULTIMA conferma è andata bene. Se l'azione appena
       confermata è FALLITA, o l'utente ha detto "No", o qualcos'altro
       nel turno è fallito, il frontend NON ha altro modo di spiegare
       cosa è successo: lì serve davvero la risposta di Claude, non
       saltiamo nulla. */
    const nienteErroriNelTurno = nuoviPronti.every((p) => !p.is_error);
    if (body.conferma === true && nienteErroriNelTurno) {
      await salvaRun(runId, user, { stato: "concluso", messaggi: messages, in_sospeso: null, azioni: azioniEseguite });
      return finisciTurno({ stato: "concluso", testo: "Fatto.", azioni: azioniEseguite });
    }
  } else if (runId) {
    /* Continuazione a testo libero di una domanda ancora aperta: EON
       aveva chiesto qualcosa (es. "te lo segno fra un'ora?") e questa è
       la risposta dell'utente ("sì", "fai fra due ore"...). Diverso dal
       ramo sopra: lì si conferma/nega un'azione delicata con un
       pulsante, qui si risponde liberamente con una frase. Reclamiamo
       solo lo stato "in_attesa_risposta" (non "concluso": quello è
       riservato alle conversazioni davvero finite, per non rischiare
       di rieseguire un'azione se una risposta va persa in rete e
       l'utente riprova con lo stesso runId). */
    if (!eUuid(runId)) throw fail("runId non valido", 400);
    if (!eStringaNonVuota(body.messaggio)) throw fail("Campo 'messaggio' mancante o vuoto");

    const run = await reclamaRun(runId, user, "in_attesa_risposta");
    if (!run) throw fail("Questa conversazione non è più disponibile: ricomincia da capo", 409);
    runReclamato = true;
    azioniEseguite = Array.isArray(run.azioni) ? run.azioni.slice() : [];
    messages = run.messaggi.concat([{ role: "user", content: body.messaggio }]);

    /* Risposta a "quale dei due?" chiesto dal percorso rapido: se dice
       chiaramente quale cliente, l'appuntamento lo segna il codice,
       senza AI. Altrimenti prosegue il motore completo con la cronologia. */
    const sospesoRapido = run.in_sospeso && run.in_sospeso.rapido;
    const scelto = sospesoRapido && scegliCandidatoDaRisposta(sospesoRapido.candidati, body.messaggio);
    if (scelto) {
      const fatto = await creaImpegnoRapido(sospesoRapido, scelto, user, ctx);
      azioniEseguite = fatto.azioni;
      giriUsati = 0;
      await salvaRun(runId, user, { stato: "concluso", messaggi: messages, in_sospeso: null, azioni: azioniEseguite });
      return send(res, 200, fatto.payload);
    }
  } else {
    if (!eStringaNonVuota(body.messaggio)) throw fail("Campo 'messaggio' mancante o vuoto");
    messages = [{ role: "user", content: body.messaggio }];

    /* Percorso rapido per gli appuntamenti (vedi provaPercorsoRapido):
       una sola chiamata piccola invece del motore completo. null = non
       è un caso semplice, si prosegue qui sotto esattamente come prima. */
    const rapido = await provaPercorsoRapido(body, ctx, user);
    if (rapido) {
      modelloUsato = MODELLO_RAPIDO;
      giriUsati = 1;
      azioniEseguite = rapido.azioni;
      return send(res, 200, rapido.payload);
    }
  }

  const schemi = Object.values(TOOLS).map((t) => t.schema);
  const promptStatico = systemPromptAssistente(professione); // uguale ad ogni giro: costruito una sola volta fuori dal loop

  /* Un messaggio nuovo (nessun runId: non è né una conferma né la
     continuazione di una domanda aperta) parte sul modello economico
     Haiku — comandi diretti come "chiama Guidi domani alle 17" non
     hanno bisogno di Sonnet. Le conferme/continuazioni restano su
     Sonnet fin da subito: sono scambi brevi dove conta di più la
     coerenza col resto della conversazione che il risparmio. */
  const MODEL_HAIKU = "claude-haiku-4-5";
  const MODEL_SONNET = "claude-sonnet-4-5";
  modelloUsato = runId ? MODEL_SONNET : MODEL_HAIKU; // variabile del turno (handleAssistant), per il registro richieste

  /* Un messaggio nuovo (nessun runId) riserva il giro 0 alla sola
     dichiarazione dell'IntentFrame (interpreta_richiesta, forzato
     sotto con tool_choice): il giro in cui il modello sceglie
     davvero cosa fare è quindi il giro 1, non lo 0. Una conferma o
     una continuazione invece non forza nulla (l'intento è già stato
     dichiarato in un giro precedente della stessa conversazione, lo
     recuperiamo con estraiIntentoDaMessaggi): lì il giro decisionale
     resta lo 0, come prima di questa modifica. Questo sposta soltanto
     A QUALE giro si applica il ripiego "Haiku non sicuro → Sonnet":
     il meccanismo in sé resta identico. */
  const primoGiroSostanziale = runId ? 0 : 1;
  let intentoAttivo = null; // ricalcolato da capo a ogni giro, subito dopo la risposta di Claude — vedi dentro il for

  /* Percorso fisso per i documenti (25/09/2026). Per una richiesta
     completa di preventivo/fattura ("fattura da 300 per Rossi per
     pitturazione") lasciare all'AI la scelta di ogni passo si è
     dimostrato inaffidabile: in produzione si è incartata a ridichiarare
     la stessa richiesta fino a 6 volte, finendo in silenzio (tempo
     scaduto) o dichiarando il falso ("non riesco a crearlo"). Qui invece
     i passi sono decisi dal codice: il cliente viene trovato/creato dal
     codice stesso, e al giro dopo l'AI è OBBLIGATA (tool_choice) a
     compilare crea_preventivo_o_fattura — non ha altre scelte, quindi
     non può girare a vuoto. Il turno finisce subito dopo, senza un
     ultimo giro solo per scrivere un commento: meno chiamate, meno costi.
     Si attiva SOLO quando è tutto chiaro (vedi dentro il for, a fine
     giro 0); in ogni altro caso resta il percorso libero di sempre. */
  let percorsoDocumento = null; // { clienteId, tipo, tentato } quando attivo

  /* Un messaggio nuovo ha diritto a un giro in più (TOOL_MAX_ROUNDS + 1):
     il giro 0 è sempre speso per il forzato interpreta_richiesta, quindi
     senza questo "+1" il budget di giri utili per la scelta e
     l'esecuzione vera dei tool si ridurrebbe di uno rispetto a prima di
     questa modifica. Le conferme/continuazioni (runId presente) non
     forzano nessun giro in più: restano al tetto originale. */
  const tettoGiri = TOOL_MAX_ROUNDS + (runId ? 0 : 1);
  for (let round = 0; round < tettoGiri; round++) {
    giriUsati = round + 1; // idem: per il registro richieste, tiene l'ultimo giro effettivamente iniziato
    let data;
    const forzaInterpretazione = !runId && round === 0;
    const forzaDocumento = !!(percorsoDocumento && !percorsoDocumento.tentato);
    const strumentoForzato = forzaInterpretazione ? "interpreta_richiesta" : (forzaDocumento ? "crea_preventivo_o_fattura" : null);
    if (forzaDocumento) percorsoDocumento.tentato = true;

    /* Al massimo due tentativi in questo giro: solo al giro
       decisionale (round 0 per conferme/continuazioni, round 1 per un
       messaggio nuovo — vedi primoGiroSostanziale sopra) e solo se
       Haiku non ha chiamato nessuno strumento — segno che non ha
       riconosciuto un'azione concreta da fare, non ci fidiamo e
       ripetiamo la STESSA richiesta con Sonnet. Negli altri giri un
       turno senza strumenti è la normale fine della conversazione
       (risposta finale), non un'incertezza da correggere. */
    for (let tentativo = 0; tentativo < 2; tentativo++) {
      /* Il ripiego su Sonnet per un intoppo di rete/HTTP copre sia il
         giro 0 sia il giro decisionale (round === primoGiroSostanziale):
         per una conferma/continuazione sono lo stesso giro (0), ma per
         un messaggio nuovo sono due giri distinti (0 = interpreta_richiesta
         forzato, 1 = la vera scelta) ed entrambi devono poter ripiegare
         su Sonnet — altrimenti un fastidio di rete proprio al giro
         decisionale bloccherebbe la conversazione senza che il ripiego
         "non sicuro" (sotto, che copre un altro problema: nessuno
         strumento chiamato) possa mai intervenire. */
      const puoRipiegarePerRete = (round === 0 || round === primoGiroSostanziale) && modelloUsato === MODEL_HAIKU && tentativo === 0;

      /* Ragionamento esteso (17/09/2026, richiesto da Gianardi — "il
         cervello ci pensa su di più sui casi difficili"): SOLO quando
         tocca a Sonnet, mai su Haiku — Sonnet interviene già solo nei
         casi che meritano più cura (conferme/continuazioni di una
         conversazione, o il ripiego quando Haiku non è stato sicuro),
         mai sui comandi diretti semplici, che restano veloci come oggi
         su Haiku, invariati. Impatto diretto: proprio in questa
         sessione trovato un bug reale sul calcolo di una data
         (idraulico, promemoria caldaia) — questo riduce il rischio di
         errori simili nei ragionamenti più delicati (date, più
         passaggi), al costo di qualche token e un filo di tempo in
         più SOLO in quei casi. claude-sonnet-4-5 è precedente alla
         generazione con il "ragionamento adattivo" (vedi
         claude-api skill): qui serve ancora la sintassi con
         budget_tokens, che richiede max_tokens più alto di lui.
         Mai insieme a tool_choice forzato (forzaInterpretazione): il
         ragionamento esteso non è compatibile con una scelta di
         strumento forzata — non è comunque una perdita, quel giro
         dichiara solo l'IntentFrame, il ragionamento vero su date e
         scelte serve nei giri successivi, dove la scelta è sempre
         libera. */
      const ragionamentoEsteso = modelloUsato === MODEL_SONNET && !strumentoForzato;

      let r;
      let erroreRete = null;
      try {
        r = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
          body: JSON.stringify({
            model: modelloUsato,
            max_tokens: ragionamentoEsteso ? 4096 : 1200,
            ...(ragionamentoEsteso ? { thinking: { type: "enabled", budget_tokens: 2000 } } : {}),
            /* Istruzioni + elenco strumenti sono identici ad ogni chiamata:
               il blocco cache_control sull'ultimo (e unico) testo statico
               mette in cache anche gli strumenti, che nell'ordine con cui
               Anthropic li elabora vengono prima del system prompt. La
               data/ora, che cambia sempre, resta in un blocco a parte
               DOPO quello in cache, così non lo invalida mai. Haiku e
               Sonnet hanno ciascuno la propria cache separata (la cache
               è legata al modello): è normale e non richiede altro. */
            system: [
              { type: "text", text: promptStatico, cache_control: { type: "ephemeral" } },
              { type: "text", text: dataOraCorrente() },
            ],
            tools: schemi,
            /* Nel percorso documento anche disable_parallel_tool_use: una
               sola chiamata in quel giro, mai due documenti per sbaglio. */
            tool_choice: strumentoForzato
              ? { type: "tool", name: strumentoForzato, ...(forzaDocumento ? { disable_parallel_tool_use: true } : {}) }
              : undefined,
            messages,
          }),
        });
      } catch (netErr) {
        erroreRete = netErr;
      }

      if (erroreRete) {
        if (puoRipiegarePerRete) { modelloUsato = MODEL_SONNET; continue; }
        throw fail("Non riesco a contattare l'AI: " + erroreRete.message, 502);
      }
      if (!r.ok) {
        if (puoRipiegarePerRete) { modelloUsato = MODEL_SONNET; continue; }
        let motivo = "";
        try { const j = await r.json(); motivo = (j.error && (j.error.message || j.error.type)) || ""; } catch (e) { /* niente */ }
        throw fail("L'AI ha rifiutato la richiesta (" + r.status + ")" + (motivo ? ": " + motivo : ""), 502);
      }

      data = await r.json();

      /* "Non sicuro" vuol dire che Haiku, al giro decisionale, non ha
         chiamato nessuno strumento E la risposta non è nemmeno una
         domanda di chiarimento voluta (quelle finiscono sempre con
         "?", vedi la regola sull'orario vago in systemPromptAssistente
         — è lo stesso segnale già usato più sotto per riaprire la
         conversazione). Senza questo controllo, ogni volta che Haiku
         chiede giustamente "te lo segno fra un'ora?" verrebbe scartato
         e rifatto due volte, vanificando il risparmio proprio sul
         caso che il prompt è pensato per gestire bene. Non si applica
         al giro forzato di interpreta_richiesta: lì tool_choice
         garantisce già stop_reason "tool_use". */
      const nonSicuroAlGiroIniziale = round === primoGiroSostanziale && modelloUsato === MODEL_HAIKU && tentativo === 0
        && data.stop_reason !== "tool_use" && !/\?\s*$/.test(testoDiRisposta(data));

      /* Guardia specifica sulla creazione di fatture/preventivi (bug
         reale in produzione, 23/09/2026, confermato con ai_audit_log):
         osservato sia un finto messaggio di errore ("ho un problema
         tecnico") SIA — ancora più grave — un finto messaggio di
         SUCCESSO ("fatto, preventivo creato") quando crea_preventivo_o_fattura
         non era mai stato chiamato affatto: il documento non esisteva,
         ma il professionista se lo sarebbe visto confermato come vero.
         Il ripiego "nonSicuroAlGiroIniziale" sopra non basta: si applica
         solo al primo giro decisionale, mentre qui il cedimento arriva
         dopo che trova_o_crea_cliente è già stato chiamato con successo
         (quindi quel primo giro sembrava "sicuro"). Qui controlliamo,
         ad OGNI giro fino alla fine del turno, che l'intento dichiarato
         di creare l'uno o l'altro documento sia stato davvero eseguito
         prima di accettare una risposta finale — una domanda onesta
         (finisce con "?") resta comunque sempre permessa, esattamente
         come sopra. Limite noto e accettato: se nello stesso turno
         vengono creati PIÙ documenti diversi, un secondo documento mai
         creato potrebbe sfuggire a questo controllo perché ne trova
         già uno in azioniEseguite — caso raro, non quello osservato. */
      const documentoRichiestoNonCreato = intentoAttivo && intentoAttivo.operazione === "crea"
        && /fattura|preventivo/i.test((intentoAttivo.entita && intentoAttivo.entita.tipo) || "")
        && !azioniEseguite.some((a) => a.tool === "crea_preventivo_o_fattura");
      const nonSicuroSuDocumento = documentoRichiestoNonCreato && tentativo === 0
        && data.stop_reason !== "tool_use" && !/\?\s*$/.test(testoDiRisposta(data));

      if (nonSicuroAlGiroIniziale || nonSicuroSuDocumento) {
        modelloUsato = MODEL_SONNET;
        continue;
      }
      break;
    }

    messages.push({ role: "assistant", content: data.content });
    /* Niente "|| intentoAttivo" qui: la funzione rilegge SEMPRE l'intera
       cronologia da capo, quindi il suo risultato è già lo stato
       corretto e completo (incluso il caso "null" voluto, quando
       capacita_non_disponibile ha appena scaricato un intento
       "risorsa" — vedi il commento dentro estraiIntentoDaMessaggi). Un
       "||" qui resusciterebbe il valore vecchio proprio nel momento in
       cui deve sparire. */
    intentoAttivo = estraiIntentoDaMessaggi(messages);

    /* Bug reale in produzione (23/09/2026): creare una fattura/preventivo
       è un'operazione a più passaggi (risolvere il cliente, poi chiamare
       crea_preventivo_o_fattura) — Haiku a volte porta a termine solo il
       primo passo e al giro successivo si blocca, inventando una scusa
       ("errore tecnico") invece di continuare o di dirlo onestamente. Il
       ripiego "nonSicuro" sopra copre solo il PRIMO giro decisionale: non
       basta qui, perché in questo caso Haiku un tool lo chiama davvero
       (trova_o_crea_cliente) e solo un giro dopo si perde. Appena
       l'intento dichiarato con interpreta_richiesta è la CREAZIONE di uno
       di questi due documenti, passiamo a Sonnet per tutto il resto del
       turno: sono operazioni delicate, meglio affidarle al modello più
       capace fin dall'inizio invece di scoprire a metà che Haiku non ce
       la fa. */
    if (!percorsoDocumento && modelloUsato === MODEL_HAIKU && intentoAttivo && intentoAttivo.operazione === "crea"
      && /fattura|preventivo/i.test((intentoAttivo.entita && intentoAttivo.entita.tipo) || "")) {
      modelloUsato = MODEL_SONNET;
    }

    if (data.stop_reason !== "tool_use") {
      const testo = testoDiRisposta(data);
      const continuabile = /\?\s*$/.test(testo);

      if (continuabile) {
        /* Una vera domanda in sospeso (es. "te lo segno fra un'ora?"):
           stato dedicato, DIVERSO da "concluso", apposta — se la userà
           solo il ramo di continuazione a testo libero qui sopra
           (reclamaRun con statoAtteso="in_attesa_risposta"). Se questa
           stessa risposta arrivasse smarrita al client e l'utente
           riprovasse con lo stesso runId, il vero "concluso" (sotto)
           non sarebbe più reclamabile: niente rischio di rieseguire due
           volte un'azione che, in un turno successivo, ha già scritto
           qualcosa di vero nel database. */
        const salvato = await salvaRun(runId, user, { stato: "in_attesa_risposta", messaggi: messages, in_sospeso: null, azioni: azioniEseguite });
        return finisciTurno({ stato: "concluso", runId: salvato.id, testo: testo || "Fatto.", azioni: azioniEseguite });
      }

      /* Risposta finale, non una domanda: se c'era un runId, il run era
         stato reclamato (portato a "in_corso") e va richiuso comunque,
         altrimenti resterebbe bloccato per sempre — ma con lo stato
         "concluso" vero e proprio, che il ramo di continuazione non
         reclama più: un secondo tentativo con lo stesso runId (es.
         dopo una risposta persa in rete) non trova più nulla e si
         ferma con un errore chiaro, invece di rieseguire l'azione. */
      if (runId) {
        await salvaRun(runId, user, { stato: "concluso", messaggi: messages, in_sospeso: null, azioni: azioniEseguite });
      }
      return finisciTurno({ stato: "concluso", testo: testo || "Fatto.", azioni: azioniEseguite });
    }

    const richieste = data.content.filter((b) => b.type === "tool_use");
    const risultati = [];
    /* EON BRAIN, punto 6 (bulk/batch): raggruppa per nome di strumento,
       non un elemento in coda per ogni richiesta — così N chiamate allo
       STESSO strumento delicato nello stesso giro (es. elimina_impegno
       ripetuto per 5 impegni, quando l'utente chiede di cancellarli
       tutti) diventano UNA sola voce con più elementi, e quindi una
       sola domanda di conferma (vedi descriviProssimaAzione) invece di
       N domande in sequenza. Una Map mantiene l'ordine di prima
       comparsa di ogni nome, esattamente come un array vi manterrebbe
       l'ordine delle richieste originali. */
    const codaPerNome = new Map();
    let documentoCreatoOra = null; // esito di crea_preventivo_o_fattura se riuscito in QUESTO giro

    for (const richiesta of richieste) {
      const tool = TOOLS[richiesta.name];
      if (!tool) {
        risultati.push({ type: "tool_result", tool_use_id: richiesta.id, content: JSON.stringify({ errore: "strumento sconosciuto" }), is_error: true });
        continue;
      }

      /* Guardrail generale (non specifico per crea_impegno o per un
         singolo caso, vedi REGOLE_GUARDRAIL_AZIONE sopra per il perché
         di ciascuna regola): un tool "azione" non può fare da ripiego
         silenzioso quando l'IntentFrame dice che l'utente voleva
         altro. Blocchiamo l'esecuzione e spieghiamo perché nel
         tool_result: il giro successivo del loop dà a Claude la
         possibilità di scegliere lo strumento giusto (o
         capacita_non_disponibile) invece di insistere sullo stesso
         ripiego. Si applica solo qui, non alla coda di conferma sotto:
         le azioni ad alto rischio passano comunque da una domanda
         esplicita all'utente, un secondo controllo naturale. */
      if (tool.categoria === "azione") {
        const regolaViolata = REGOLE_GUARDRAIL_AZIONE.find((r) => r.condizione(intentoAttivo, runId, tool));
        if (regolaViolata) {
          risultati.push({
            type: "tool_result",
            tool_use_id: richiesta.id,
            content: JSON.stringify({ errore: regolaViolata.messaggio(richiesta.name) }),
            is_error: true,
          });
          continue;
        }
      }

      /* Bug reale in produzione (25/09/2026, "Claudia Spori"): il modello
         ha chiamato capacita_non_disponibile dichiarando FALSO di non
         poter creare un preventivo. Causa principale: la regola "risorsa"
         qui sopra bloccava crea_preventivo_o_fattura e gli diceva proprio
         di chiamare capacita_non_disponibile (corretto con
         produceRisorsa). Questo blocco resta come seconda protezione:
         per creare un preventivo/una fattura lo strumento esiste sempre,
         quindi dichiarare il contrario è sempre falso — se manca un dato
         (es. il prezzo), il modo onesto è una domanda in testo libero. */
      if (richiesta.name === "capacita_non_disponibile" && intentoAttivo && intentoAttivo.operazione === "crea") {
        const tipoDoc = eStringaNonVuota(intentoAttivo.entita && intentoAttivo.entita.tipo) ? intentoAttivo.entita.tipo.trim().toLowerCase() : "";
        if (/fattura|preventivo/.test(tipoDoc)) {
          risultati.push({
            type: "tool_result",
            tool_use_id: richiesta.id,
            content: JSON.stringify({ errore: "Falso: crea_preventivo_o_fattura esiste e sa creare direttamente fatture e preventivi, non dichiarare che non è possibile. Se hai già cliente/voci/prezzo, chiamalo ORA. Se davvero manca un dato (es. il prezzo), chiedilo con una domanda in testo libero — mai capacita_non_disponibile per questo." }),
            is_error: true,
          });
          continue;
        }
      }

      if (richiedeConferma(tool)) {
        /* Non eseguiamo subito: la mettiamo in coda (raggruppata per
           nome, vedi codaPerNome sopra) e continuiamo a esaminare le
           altre richieste dello stesso turno, così le azioni sicure
           partono comunque senza aspettare. */
        if (!codaPerNome.has(richiesta.name)) codaPerNome.set(richiesta.name, { nome: richiesta.name, elementi: [] });
        codaPerNome.get(richiesta.name).elementi.push({ input: richiesta.input, tool_use_id: richiesta.id });
        continue;
      }

      /* Nel percorso fisso cliente e tipo li decide il codice, non il
         modello: già risolti a fine giro 0, non devono poter cambiare
         (mai un documento sul cliente sbagliato, mai un "preventivo"
         quando l'utente ha chiesto una "fattura"). Il modello compila
         solo le voci e i prezzi. */
      if (forzaDocumento && richiesta.name === "crea_preventivo_o_fattura") {
        richiesta.input = { ...richiesta.input, cliente_id: percorsoDocumento.clienteId, tipo: percorsoDocumento.tipo };
      }

      try {
        const esito = await tool.run(richiesta.input, ctx);

        /* Percorso fisso per i documenti: si decide qui, a fine giro 0,
           appena interpreta_richiesta ha risolto il cliente. Solo se è
           tutto chiaro: crea preventivo/fattura, il modello dice che il
           messaggio è completo (documento_completo), c'è davvero almeno
           una cifra nel testo dell'utente (doppio controllo: mai
           obbligare il modello a compilare un documento inventando un
           prezzo mai detto), e il cliente è "trovato" o del tutto nuovo.
           Con "simile"/"ambiguo" no: lì va chiesto all'utente, percorso
           libero di sempre. */
        if (richiesta.name === "interpreta_richiesta" && forzaInterpretazione) {
          const tipoDoc = eStringaNonVuota(richiesta.input.entita && richiesta.input.entita.tipo) ? richiesta.input.entita.tipo.trim().toLowerCase() : "";
          const nomeCliente = richiesta.input.entita && richiesta.input.entita.cliente_di_riferimento;
          const statoCliente = esito.cliente_risolto && esito.cliente_risolto.stato;
          const candidato = richiesta.input.operazione === "crea" && /fattura|preventivo/.test(tipoDoc)
            && richiesta.input.documento_completo === true && /\d/.test(testoDettoDallUtente(body.messaggio))
            && (statoCliente === "trovato" || (statoCliente === "non_trovato" && eStringaNonVuota(nomeCliente)));
          if (candidato) {
            let clienteId = statoCliente === "trovato" ? esito.cliente_risolto.id : null;
            if (!clienteId) {
              try {
                const nuovo = await TOOLS.trova_o_crea_cliente.run({ nome: nomeCliente }, ctx);
                await registraOperazione(user, "trova_o_crea_cliente", { nome: nomeCliente }, nuovo, "auto");
                azioniEseguite.push({ tool: "trova_o_crea_cliente", esito: nuovo });
                clienteId = nuovo.id;
                esito.cliente_risolto = { stato: "trovato", id: nuovo.id, nome: nuovo.nome, telefono: null, creato_ora: true };
              } catch (err) {
                console.warn("Percorso documento: cliente non creato, resto sul percorso libero:", err.message);
              }
            }
            if (clienteId) {
              percorsoDocumento = { clienteId, tipo: /fattura/.test(tipoDoc) ? "fattura" : "preventivo", tentato: false };
              modelloUsato = MODEL_HAIKU; // solo da compilare, nessuna scelta da fare: basta il modello economico
            }
          }
        }

        /* Ridichiarazione ripetuta dello stesso documento da creare
           (25/09/2026, "Claudia Spori", fino a 6 volte di fila). Causa
           principale: la regola "risorsa" bloccava crea_preventivo_o_fattura
           e il modello ridichiarava per aggirarla (corretto con
           produceRisorsa). Resta come seconda protezione: se ridichiara
           lo stesso documento con il cliente già risolto, errore vero
           con l'istruzione di procedere. intentoAttivo qui riflette
           ancora il giro PRECEDENTE (si aggiorna dopo questa lista). */
        if (richiesta.name === "interpreta_richiesta" && intentoAttivo && intentoAttivo.operazione === "crea" && richiesta.input.operazione === "crea") {
          const tipoVecchio = eStringaNonVuota(intentoAttivo.entita && intentoAttivo.entita.tipo) ? intentoAttivo.entita.tipo.trim().toLowerCase() : "";
          const tipoNuovo = eStringaNonVuota(richiesta.input.entita && richiesta.input.entita.tipo) ? richiesta.input.entita.tipo.trim().toLowerCase() : "";
          const eDocumento = (t) => /fattura|preventivo/.test(t);
          const clienteGiaRisolto = esito.cliente_risolto && esito.cliente_risolto.stato === "trovato";
          if (eDocumento(tipoVecchio) && eDocumento(tipoNuovo) && clienteGiaRisolto) {
            risultati.push({
              type: "tool_result",
              tool_use_id: richiesta.id,
              content: JSON.stringify({
                errore: "Hai già dichiarato questa stessa richiesta (creare " + tipoNuovo + ") in un giro precedente: NON richiamare di nuovo interpreta_richiesta per lo stesso documento.",
                cliente_risolto: esito.cliente_risolto,
                istruzione: "Il cliente è già risolto. Chiama SUBITO crea_preventivo_o_fattura con cliente_id=" + esito.cliente_risolto.id + " e le voci/il prezzo che hai già da questa conversazione. Se davvero manca un dato (es. il prezzo), chiedilo con una domanda in testo libero — mai ridichiarare l'intento.",
              }),
              is_error: true,
            });
            continue;
          }
        }

        await registraOperazione(user, richiesta.name, richiesta.input, esito, "auto");
        if (!STRUMENTI_INTERNI.has(richiesta.name)) azioniEseguite.push({ tool: richiesta.name, esito });
        if (richiesta.name === "crea_preventivo_o_fattura") documentoCreatoOra = esito;
        risultati.push({ type: "tool_result", tool_use_id: richiesta.id, content: JSON.stringify(esito) });
      } catch (err) {
        const messaggioBase = err.message || "operazione non riuscita";
        await registraOperazione(user, richiesta.name, richiesta.input, { errore: messaggioBase }, "errore");
        /* EON BRAIN, roadmap 1.2 (correzione Test 3): un tool "risorsa"
           che fallisce con un errore tecnico REALE (query fallita:
           colonna/tabella mancante, database irraggiungibile — vedi
           db_error in db()) è andato incontro a un'inconsistenza
           osservata in produzione — a volte Claude dichiarava
           onestamente il limite con capacita_non_disponibile, altre
           volte riformulava lo stesso errore in testo libero come
           "non trovato", indistinguibile da un risultato
           legittimamente vuoto. L'istruzione correttiva viaggia con
           l'errore stesso (stesso principio del guardrail sopra), non
           solo in una frase del system prompt lontana dal punto in
           cui la decisione viene presa davvero.

           Il controllo su err.db_error (non solo tool.categoria) è
           voluto: senza di esso questa nota finirebbe anche su errori
           di validazione applicativa ("Id cliente non valido", "nome
           mancante") o su un "non trovato" legittimo (fail(...,404)
           dopo una ricerca andata a buon fine ma senza risultati) —
           casi in cui spingere verso capacita_non_disponibile sarebbe
           sbagliato quanto l'inconsistenza che si vuole correggere: il
           modello dichiarerebbe un limite permanente che non esiste,
           invece di correggere l'input o dire onestamente "non
           trovato". Il messaggio registrato in ai_audit_log resta
           quello originale, pulito: questa nota è solo per il
           tool_result che torna a Claude. */
        const nota = tool.categoria === "risorsa" && err.db_error
          ? " — questo è un errore tecnico reale (query fallita), non un risultato vuoto: se non hai un altro modo di recuperare questa risorsa, dichiaralo con capacita_non_disponibile, non descriverlo all'utente come \"non trovato\"."
          : "";
        risultati.push({ type: "tool_result", tool_use_id: richiesta.id, content: JSON.stringify({ errore: messaggioBase + nota }), is_error: true });
      }
    }

    const coda = [...codaPerNome.values()];
    if (coda.length) {
      /* Una o più azioni di questo turno richiedono conferma: le
         risposte già pronte (risultati) restano in sospeso insieme a
         quelle mancanti, cosi' quando saranno risolte tutte potremo
         rispondere a Claude con il turno completo, come richiede il
         formato dei messaggi di Anthropic. */
      const prossimo = coda[0];
      const domanda = await descriviProssimaAzione(prossimo, ctx);
      const salvato = await salvaRun(runId, user, {
        stato: "in_attesa_conferma",
        messaggi: messages,
        in_sospeso: { coda, pronti: risultati },
        azioni: azioniEseguite,
      });
      return finisciTurno({ stato: "in_attesa_conferma", runId: salvato.id, domanda, azioni: azioniEseguite });
    }

    messages.push({ role: "user", content: risultati });

    /* Percorso fisso: documento creato → turno finito qui, senza un
       altro giro solo per far scrivere un commento al modello (il
       frontend mostra già la scheda del documento da azioni[].esito).
       Se invece la compilazione forzata è fallita (es. voci non valide),
       percorsoDocumento.tentato è già true: dal prossimo giro si torna
       al percorso libero di sempre, così il modello può spiegare o
       chiedere il dato mancante — mai un secondo tentativo forzato. */
    if (forzaDocumento) {
      if (documentoCreatoOra && risultati.every((r) => !r.is_error)) {
        const totaleTesto = Number(documentoCreatoOra.totale).toLocaleString("it-IT", { maximumFractionDigits: 2 });
        return finisciTurno({
          stato: "concluso",
          testo: `${documentoCreatoOra.titolo} per ${documentoCreatoOra.cliente}: €${totaleTesto}`,
          azioni: azioniEseguite,
        });
      }
      percorsoDocumento = null; // fallito: da qui percorso libero, esattamente come prima di questa modifica
    }

    /* Se in questo giro Claude ha chiamato solo strumenti della
       whitelist "sempre conclusivi" (vedi sopra) e tutti sono andati a
       buon fine, non serve un altro giro solo per farsi scrivere un
       commento finale: il frontend costruisce già da solo il messaggio
       da mostrare partendo da azioni[].esito quando c'è un'azione
       visibile (vedi risultatiVisibili/mostra() in index.html), il
       "testo" tornerebbe e basta. Per qualunque altro strumento (letture,
       o scritture non ancora verificate come sicure) serve davvero un
       altro giro: Claude potrebbe doverne usare il risultato per il
       passo successivo, o deve raccontare cosa è andato storto — l'unico
       modo che l'utente ha per saperlo. */
    const soloConclusivi = richieste.every((r) => STRUMENTI_SEMPRE_CONCLUSIVI.has(r.name));
    const tuttoRiuscito = risultati.every((r) => !r.is_error);
    if (soloConclusivi && tuttoRiuscito) {
      if (runId) await salvaRun(runId, user, { stato: "concluso", messaggi: messages, in_sospeso: null, azioni: azioniEseguite });
      return finisciTurno({ stato: "concluso", testo: "Fatto.", azioni: azioniEseguite });
    }
  }

  /* Tetto di round raggiunto. Le azioni non delicate già eseguite in
     questo giro (o nei giri precedenti, se c'era stata una conferma di
     mezzo) sono comunque scritte nel database: le restituiamo sempre,
     invece di un errore secco, così l'utente sa cosa è andato a buon
     fine e cosa no, invece di scoprirlo dal calendario. */
  if (runId) await salvaRun(runId, user, { stato: "incompleto", messaggi: messages, in_sospeso: null, azioni: azioniEseguite });
  return finisciTurno({
    stato: "incompleto",
    testo: "Non ho fatto in tempo a completare tutto: ho segnato quello che sono riuscita a fare. Riprova con una frase più semplice per il resto.",
    azioni: azioniEseguite,
  });
  } // fine proseguiAssistente
}

/* ============================================================
   ANALISI DELLA CHAT — appuntamenti e attività dedotti dalla
   conversazione con il cliente
   ------------------------------------------------------------
   Prima questa logica viveva nel frontend: il prompt veniva
   costruito lì, la chiave Anthropic passava per il browser (tramite
   /api?action=ai), e le conseguenze (creare o spostare un
   appuntamento, aggiungere un task) scrivevano su Supabase
   direttamente dal client. Qui la stessa logica — invariata nelle
   sue regole, che sono buone e già in produzione da tempo — gira
   lato server e usa le stesse funzioni autorizzate e tracciate del
   motore assistente, invece di duplicare le scritture.

   Una sola differenza voluta rispetto a prima: l'AI restituisce
   sempre una data ISO (come per crea_impegno), mai una stringa già
   formattata in italiano — è il server a decidere come mostrarla,
   coerente con il resto del motore.
   ============================================================ */

const GIORNI_PRIMA_DI_RICONTATTARE = 2;

function promptAnalisiChat(chat, conversazione, elencoAppuntamenti, cliente) {
  const oggi = new Date();
  return `Sei l'assistente dentro EON, un'app per professionisti italiani.
Oggi è ${oggi.toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}.

Ecco le ultime battute della conversazione con il cliente "${chat}":
${conversazione}

${elencoAppuntamenti}

${cliente ? `Stato attuale del cliente: ${cliente.status}. Valore registrato: €${cliente.value}.` : ""}

Rispondi esclusivamente con un oggetto JSON, senza testo prima o dopo, senza backtick:

{
  "appuntamento": {
    "azione": "nuovo" | "sposta" | "annulla",
    "titolo": "...",
    "quando_iso": "data e ora in formato ISO 8601, es. 2026-09-01T16:00:00",
    "messaggioProposta": numero del messaggio [n] che contiene la proposta,
    "messaggioConferma": numero del messaggio [n] in cui l'altro accetta, oppure null se nessuno ha ancora accettato,
    "rimastoInSospeso": true se l'altro NON ha detto né sì né no, ma ha rimandato la risposta
  } oppure null,
  "attivita": "..." oppure null,
  "cambioStato": "attivo" | "trattativa" | "inattivo" oppure null,
  "valore": numero oppure null
}

=== I DUE NUMERI, MOLTO IMPORTANTI ===
I messaggi sopra sono numerati [1], [2], [3]...

"messaggioProposta": il numero del messaggio in cui viene proposta la data o l'ora.
  Esempio: se [2] Professionista dice "possiamo fare martedì alle 10?", allora messaggioProposta = 2.

"messaggioConferma": il numero del messaggio in cui l'ALTRA parte accetta.
  Vale come accettazione qualsiasi risposta positiva: "ok", "ok perfetto", "va bene grazie",
  "sì certo", "per me va bene", "confermo", "perfetto ci sono", "d'accordo", e simili.
  Se nessuno ha ancora accettato dopo la proposta, metti null.

Esempio A:
  [1] Professionista: possiamo fare martedì alle 10?
  [2] Cliente: ok perfetto grazie
  → messaggioProposta = 1, messaggioConferma = 2

Esempio B:
  [1] Cliente: scusa possiamo fare giovedì?
  → messaggioProposta = 1, messaggioConferma = null

=== RISPOSTE RIMASTE IN SOSPESO ===
"rimastoInSospeso": mettilo a true quando l'altra parte non accetta e non rifiuta,
  ma rimanda la decisione. Esempi: "non so se riesco", "vediamo", "ti faccio sapere",
  "devo controllare", "ti dico più tardi", "forse", "provo a organizzarmi", "ci penso".
  In questi casi messaggioConferma resta null.

Esempio C:
  [1] Professionista: possiamo fare martedì alle 10?
  [2] Cliente: mah, non so se riesco, ti faccio sapere
  → messaggioProposta = 1, messaggioConferma = null, rimastoInSospeso = true

=== SPOSTAMENTO ===
Se nell'elenco sopra c'è già un appuntamento e nella conversazione si parla di cambiarne giorno od ora, l'azione è "sposta", MAI "nuovo".
Se dicono solo l'ora nuova ("possiamo fare alle 10?"), tieni il giorno dell'appuntamento esistente.
Se dicono solo il giorno nuovo ("facciamo giovedì"), tieni l'ora dell'appuntamento esistente.
Se disdicono senza rifissare, azione "annulla".

=== FORMATO E MODI DI DIRE ===
Traduci "domani", "lunedì", "il 10" in data vera partendo da oggi, sempre in "quando_iso".

Quando l'ora non viene detta, usa questi orari convenzionali:
  "domattina", "domani mattina", "in mattinata"     → 09:00
  "domani pomeriggio", "nel pomeriggio"             → 15:00
  "stasera", "in serata", "domani sera"             → 18:00
  "a pranzo"                                        → 13:00
  nessun riferimento all'ora ("ci vediamo giovedì") → 08:00

IMPORTANTE: un appuntamento senza ora precisa vale lo stesso. Non lasciarlo
a null solo perché manca l'orario: usa 08:00 e registra comunque il giorno.

Se manca anche il titolo, usa "Incontro".

=== ALTRE REGOLE ===
- "attivita": solo se il professionista deve fare qualcosa di concreto. Azione breve.
- "cambioStato": "attivo" solo se accetta di procedere; "inattivo" solo se rinuncia.
- "valore": solo se citano una cifra concordata.
- Se un campo non c'è, null. Non inventare mai.`;
}

async function chiamaClaude(prompt, maxTokens) {
  let r;
  try {
    r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: "claude-sonnet-4-5", max_tokens: maxTokens, messages: [{ role: "user", content: prompt }] }),
    });
  } catch (netErr) {
    throw fail("Non riesco a contattare l'AI: " + netErr.message, 502);
  }
  if (!r.ok) {
    let motivo = "";
    try { const j = await r.json(); motivo = (j.error && (j.error.message || j.error.type)) || ""; } catch (e) { /* niente */ }
    throw fail("L'AI ha rifiutato la richiesta (" + r.status + ")" + (motivo ? ": " + motivo : ""), 502);
  }
  const data = await r.json();
  const text = (data.content || []).map((b) => b.text || "").join("").trim();
  if (!text) throw fail("Risposta AI vuota", 502);
  return text;
}

/* Un promemoria silenzioso per ricontattare un cliente che ha lasciato
   una risposta in sospeso. Un solo promemoria alla volta per cliente:
   ricontattare chi ha già risposto sarebbe fastidioso. */
async function segnaDaRicontattare(nomeCliente, ctx) {
  const titolo = "Ricontattare " + nomeCliente;
  const esistente = await db(`tasks?select=id&title=eq.${encodeURIComponent(titolo)}&status=neq.done&status=neq.annullato&deleted_at=is.null&limit=1`, { method: "GET" }, ctx.accessToken);
  if (Array.isArray(esistente) && esistente.length) return null;

  const quando = new Date();
  quando.setDate(quando.getDate() + GIORNI_PRIMA_DI_RICONTATTARE);
  quando.setHours(8, 0, 0, 0);
  return TOOLS.crea_impegno.run({ titolo, quando_iso: quando.toISOString(), tipo: "commissione" }, ctx);
}

/* Toglie il promemoria "ricontattare": il cliente ha risposto per
   davvero, insistere sarebbe fastidioso. */
async function togliDaRicontattare(nomeCliente, ctx) {
  const titolo = "Ricontattare " + nomeCliente;
  const righe = await db(`tasks?select=id&title=eq.${encodeURIComponent(titolo)}&status=neq.done&status=neq.annullato&deleted_at=is.null&limit=1`, { method: "GET" }, ctx.accessToken);
  if (Array.isArray(righe) && righe.length) {
    /* Cancellazione vera, non nel cestino: è pulizia automatica interna
       (il cliente ha risposto, il promemoria non serve più), non una
       scelta dell'utente da poter annullare — non deve comparire lì. */
    await db(`tasks?id=eq.${righe[0].id}`, { method: "DELETE" }, ctx.accessToken);
  }
}

/* Risponde al cliente a nome del professionista — usato per le
   risposte automatiche dopo una decisione (conferma/rifiuto di uno
   spostamento o annullamento chiesto dal cliente). */
async function inviaRispostaInterna(conversationId, testo, ctx) {
  const creato = await db(
    "messages",
    { method: "POST", body: JSON.stringify({ conversation_id: conversationId, sender: "me", body: testo }), headers: { Prefer: "return=representation" } },
    ctx.accessToken
  );
  return Array.isArray(creato) ? creato[0] : creato;
}

async function handleAnalizzaMessaggio(req, res, user, accessToken) {
  if (req.method !== "POST") throw fail("Usa POST per questo endpoint", 405);
  if (!ANTHROPIC_API_KEY) throw fail("ANTHROPIC_API_KEY non impostata su Vercel", 500);

  const body = await readBody(req);
  const ctx = { user, accessToken };
  if (!eUuid(body.conversation_id)) throw fail("Parametro 'conversation_id' non valido");

  const conversazione = await trovaProprio("conversations", body.conversation_id, ctx);
  if (!conversazione) throw fail("Conversazione non trovata", 404);

  /* Prendiamo un margine di righe (20, non 6) prima di scartare quelle
     senza testo: se filtrassimo dopo aver già tagliato a 6, un paio di
     messaggi vuoti nel mezzo ci farebbero perdere contesto vero, come
     lo scambio "lunedì alle 16" -> "ok" che questa analisi deve vedere. */
  const [messaggiGrezzi, tuttiGliAppuntamenti, clientiTrovati] = await Promise.all([
    db(`messages?select=id,sender,body,created_at&conversation_id=eq.${conversazione.id}&event_type=is.null&deleted_at=is.null&order=created_at.desc&limit=20`, { method: "GET" }, ctx.accessToken),
    db(`messages?select=id,title,body,scheduled_at&conversation_id=eq.${conversazione.id}&event_type=eq.appt&deleted_at=is.null&order=created_at.asc`, { method: "GET" }, ctx.accessToken),
    db(`clients?select=*&name=eq.${encodeURIComponent(conversazione.contact_name)}&deleted_at=is.null&limit=1`, { method: "GET" }, ctx.accessToken),
  ]);

  const recenti = (messaggiGrezzi || []).filter((m) => m.body && m.body.trim()).slice(0, 6).reverse();
  if (recenti.length === 0) return send(res, 200, { azioni: [] });

  const testoConversazione = recenti
    .map((m, i) => "[" + (i + 1) + "] " + (m.sender === "me" ? "Professionista" : "Cliente") + ": " + m.body)
    .join("\n");

  const esistenti = (tuttiGliAppuntamenti || []).filter((m) => !m.title.startsWith("❌"));
  const elencoAppuntamenti = esistenti.length
    ? "APPUNTAMENTI GIÀ FISSATI con questo cliente:\n" + esistenti.map((a, i) => (i + 1) + '. "' + a.title + '" — ' + a.body).join("\n")
    : "APPUNTAMENTI GIÀ FISSATI: nessuno.";

  const cliente = Array.isArray(clientiTrovati) && clientiTrovati.length ? clientiTrovati[0] : null;

  let parsed;
  try {
    const raw = await chiamaClaude(promptAnalisiChat(conversazione.contact_name, testoConversazione, elencoAppuntamenti, cliente), 300);
    parsed = JSON.parse(raw.replace(/```json|```/g, "").trim());
  } catch (err) {
    console.warn("Analisi chat non riuscita:", err.message);
    return send(res, 200, { azioni: [] });
  }
  if (!parsed) return send(res, 200, { azioni: [] });

  const azioni = [];
  const registra = async (tool, input, esito) => {
    await registraOperazione(user, tool, input, esito, "auto_da_chat");
    azioni.push({ tool, esito });
  };

  /* ---- APPUNTAMENTO ---- */
  if (parsed.appuntamento) {
    const app = parsed.appuntamento;
    let azione = app.azione || "nuovo";
    const quandoIso = eIso(app.quando_iso) ? app.quando_iso : null;

    if (azione === "nuovo" && esistenti.length > 0) azione = "sposta";

    const nProposta = Number(app.messaggioProposta);
    const nConferma = Number(app.messaggioConferma);
    const msgProposta = nProposta >= 1 && nProposta <= recenti.length ? recenti[nProposta - 1] : null;
    const msgConferma = nConferma >= 1 && nConferma <= recenti.length ? recenti[nConferma - 1] : null;

    const chiPropone = msgProposta
      ? (msgProposta.sender === "me" ? "professionista" : "cliente")
      : (recenti[recenti.length - 1].sender === "me" ? "professionista" : "cliente");

    const confermato = !!msgConferma &&
      ((chiPropone === "professionista" && msgConferma.sender === "them") ||
       (chiPropone === "cliente" && msgConferma.sender === "me"));

    const riferito = esistenti.length ? esistenti[esistenti.length - 1] : null;

    /* Da qui in giù, come nella versione originale: quasi ogni ramo
       chiude la richiesta subito (un messaggio che tocca un appuntamento
       non controlla anche attività/cambio-stato nello stesso giro) —
       l'unica eccezione è un appuntamento nuovo appena confermato
       (in fondo), che continua a controllare anche quelli. */

    if (chiPropone === "professionista" && !confermato) {
      if (app.rimastoInSospeso) {
        const esito = await segnaDaRicontattare(conversazione.contact_name, ctx);
        if (esito) await registra("segnaDaRicontattare", { cliente: conversazione.contact_name }, esito);
      }
      return send(res, 200, { azioni });
    }

    if (chiPropone === "cliente" && !confermato && !riferito) {
      /* Il cliente propone un appuntamento nuovo: aspettiamo che il
         professionista risponda lui stesso in chat, come oggi. */
      return send(res, 200, { azioni });
    }

    if (chiPropone === "cliente" && !confermato && riferito && (azione === "sposta" || azione === "annulla")) {
      /* Lo chiede il cliente: serve la decisione del professionista,
         non eseguiamo da soli. */
      return send(res, 200, {
        azioni,
        richiesta_decisione: {
          azione,
          riferito_id: riferito.id,
          riferito_titolo: riferito.title,
          riferito_quando: riferito.body,
          quando_nuovo_iso: quandoIso,
          titolo_nuovo: app.titolo || null,
        },
      });
    }

    if (azione === "sposta" && riferito) {
      const esito = await TOOLS.sposta_impegno.run({ id: riferito.id, nuovo_quando_iso: quandoIso || riferito.scheduled_at }, ctx);
      /* Come nella versione precedente: se insieme allo spostamento
         cambia anche il titolo, lo aggiorniamo — sposta_impegno da solo
         tocca solo la data. */
      if (app.titolo && app.titolo !== riferito.title) {
        await db(`messages?id=eq.${riferito.id}`, { method: "PATCH", body: JSON.stringify({ title: app.titolo }) }, ctx.accessToken);
        esito.titolo = app.titolo;
      }
      await togliDaRicontattare(conversazione.contact_name, ctx);
      await registra("sposta_impegno", { id: riferito.id }, esito);
      return send(res, 200, { azioni });
    }

    if (azione === "annulla" && riferito) {
      const esito = await TOOLS.annulla_impegno.run({ id: riferito.id }, ctx);
      await registra("annulla_impegno", { id: riferito.id }, esito);
      return send(res, 200, { azioni });
    }

    /* Appuntamento nuovo, confermato: come l'originale, un titolo
       mancante non blocca la registrazione — "Incontro" va bene lo
       stesso, l'importante è non perdere la data. */
    const titoloNuovo = app.titolo || (quandoIso ? "Incontro" : null);
    if (titoloNuovo && quandoIso) {
      const duplicato = esistenti.some(
        (m) => m.title === titoloNuovo && m.scheduled_at && new Date(m.scheduled_at).getTime() === new Date(quandoIso).getTime()
      );
      if (!duplicato) {
        /* Scriviamo direttamente nella conversazione che stiamo già
           analizzando: niente bisogno di ritrovare il cliente per nome
           (a differenza di crea_impegno usato dall'assistente generico,
           qui la conversazione giusta è già in mano, sempre). */
        const quandoVisualizzato = formattaQuando(quandoIso);
        const creato = await db(
          "messages",
          {
            method: "POST",
            body: JSON.stringify({
              conversation_id: conversazione.id,
              sender: "me",
              event_type: "appt",
              title: titoloNuovo,
              body: quandoVisualizzato,
              scheduled_at: quandoIso,
            }),
            headers: { Prefer: "return=representation" },
          },
          ctx.accessToken
        );
        const m = Array.isArray(creato) ? creato[0] : creato;
        const esito = { id: m.id, titolo: titoloNuovo, quando_visualizzato: quandoVisualizzato, tipo: "incontro" };
        await togliDaRicontattare(conversazione.contact_name, ctx);
        await registra("crea_impegno", { titolo: titoloNuovo }, esito);
      }
    }
  }

  /* ---- ATTIVITÀ DA FARE ---- */
  if (parsed.attivita) {
    const gia = await db(`tasks?select=id&title=ilike.${encodeURIComponent(parsed.attivita)}&status=neq.done&status=neq.annullato&deleted_at=is.null&limit=1`, { method: "GET" }, ctx.accessToken);
    if (!Array.isArray(gia) || !gia.length) {
      const domani = new Date();
      domani.setDate(domani.getDate() + 1);
      domani.setHours(8, 0, 0, 0);
      const esito = await TOOLS.crea_impegno.run({ titolo: parsed.attivita, quando_iso: domani.toISOString(), tipo: "commissione" }, ctx);
      await registra("crea_impegno", { titolo: parsed.attivita }, esito);
    }
  }

  return send(res, 200, {
    azioni,
    cambioStato: cliente && parsed.cambioStato && parsed.cambioStato !== cliente.status ? parsed.cambioStato : null,
    valore: cliente && parsed.valore && Number(parsed.valore) > 0 && Number(parsed.valore) !== Number(cliente.value) ? Number(parsed.valore) : null,
    cliente_id: cliente ? cliente.id : null,
  });
}

/* Il professionista decide su una richiesta di spostamento/annullamento
   arrivata dal cliente: qui la conferma è già stata chiesta e ottenuta
   nell'interfaccia (il toast con i due pulsanti), non c'è bisogno del
   meccanismo generico di conferma dell'assistente. */
async function handleRispondiRichiestaCliente(req, res, user, accessToken) {
  if (req.method !== "POST") throw fail("Usa POST per questo endpoint", 405);

  const body = await readBody(req);
  const ctx = { user, accessToken };
  if (!eUuid(body.conversation_id)) throw fail("Parametro 'conversation_id' non valido");
  if (!eUuid(body.riferito_id)) throw fail("Parametro 'riferito_id' non valido");
  if (body.azione !== "sposta" && body.azione !== "annulla") throw fail("Parametro 'azione' non valido");

  if (body.conferma !== true) {
    const record = await trovaProprio("messages", body.riferito_id, ctx);
    const testo = body.azione === "sposta"
      ? "Purtroppo non riesco a spostare. Riusciamo a tenere " + (record ? record.body : "l'orario concordato") + "?"
      : "Preferirei tenerlo. Riusciamo a confermare " + (record ? record.body : "l'orario") + "?";
    const messaggio = await inviaRispostaInterna(body.conversation_id, testo, ctx);
    return send(res, 200, { confermato: false, messaggio });
  }

  if (body.azione === "sposta") {
    /* Il cliente può chiedere di spostare senza dire una nuova ora
       precisa ("possiamo spostare?"): in quel caso teniamo la data
       già segnata, esattamente come faceva la versione precedente. */
    let quandoNuovo = eIso(body.quando_nuovo_iso) ? body.quando_nuovo_iso : null;
    if (!quandoNuovo) {
      const record = await trovaProprio("messages", body.riferito_id, ctx);
      if (record && record.scheduled_at) quandoNuovo = record.scheduled_at;
    }
    if (!quandoNuovo) throw fail("Non so a quale data spostarlo: manca sia la nuova data che quella esistente", 400);

    const esito = await TOOLS.sposta_impegno.run({ id: body.riferito_id, nuovo_quando_iso: quandoNuovo }, ctx);
    if (body.titolo_nuovo) await db(`messages?id=eq.${body.riferito_id}`, { method: "PATCH", body: JSON.stringify({ title: body.titolo_nuovo }) }, ctx.accessToken);
    await registraOperazione(user, "sposta_impegno", body, esito, "confermato_da_professionista");
    const messaggio = await inviaRispostaInterna(body.conversation_id, "Ok, confermo: " + esito.quando_visualizzato + ".", ctx);
    return send(res, 200, { confermato: true, esito, messaggio });
  }

  const esito = await TOOLS.annulla_impegno.run({ id: body.riferito_id }, ctx);
  await registraOperazione(user, "annulla_impegno", body, esito, "confermato_da_professionista");
  const messaggio = await inviaRispostaInterna(body.conversation_id, "Ok, annullo l'appuntamento. Ci risentiamo per fissarne un altro.", ctx);
  return send(res, 200, { confermato: true, esito, messaggio });
}

/* ============================================================
   Dati iniziali per un utente appena registrato
   ============================================================ */

async function handleSeed(req, res, user, accessToken) {
  if (req.method !== "POST") throw fail("Usa POST per questo endpoint", 405);

  const body = await readBody(req);
  const inserted = {};

  for (const resource of ["clients", "opportunities", "employees", "payments", "incomes", "tasks", "goals"]) {
    const rows = Array.isArray(body[resource]) ? body[resource] : [];
    if (!rows.length) { inserted[resource] = 0; continue; }

    const payload = rows.map((row) => {
      const clean = { ...row };
      delete clean.id;
      delete clean.created_at;
      clean.owner_id = user.id;
      return clean;
    });

    const created = await db(
      resource,
      { method: "POST", body: JSON.stringify(payload), headers: { Prefer: "return=representation" } },
      accessToken
    );
    inserted[resource] = Array.isArray(created) ? created.length : 0;
  }

  return send(res, 201, { ok: true, inserted });
}

/* ============================================================
   TRASCRIZIONE DEI MESSAGGI VOCALI
   ------------------------------------------------------------
   Riceve un audio (gia' caricato nello spazio file) e restituisce
   il testo. Serve per i vocali in chat: si ascoltano, ma sotto
   compare la trascrizione e l'AI puo' lavorarci sopra.

   Usa OpenAI Whisper, che al momento e' il servizio piu' accurato
   sull'italiano e costa pochissimo (circa 0,006 $ al minuto).
   Richiede la variabile OPENAI_API_KEY su Vercel.
   ============================================================ */
async function handleTranscribe(req, res) {
  if (req.method !== "POST") throw fail("Usa POST per questo endpoint", 405);

  const OPENAI_KEY = process.env.OPENAI_API_KEY;
  if (!OPENAI_KEY) {
    throw fail(
      "Trascrizione non configurata: manca OPENAI_API_KEY nelle variabili di Vercel",
      501
    );
  }

  const body = await readBody(req);
  const audioUrl = body.audioUrl;
  if (!audioUrl || typeof audioUrl !== "string") {
    throw fail("Campo 'audioUrl' mancante");
  }

  /* Scarichiamo l'audio dallo spazio file e lo giriamo al servizio */
  let audioResp;
  try {
    audioResp = await fetch(audioUrl);
  } catch (netErr) {
    throw fail("Non riesco a scaricare l'audio: " + netErr.message, 502);
  }
  if (!audioResp.ok) throw fail("Audio non raggiungibile (" + audioResp.status + ")", 502);

  const audioBuf = await audioResp.arrayBuffer();
  const MAX_MB = 25;
  if (audioBuf.byteLength > MAX_MB * 1024 * 1024) {
    throw fail("Audio troppo lungo: il limite è " + MAX_MB + " MB", 413);
  }

  const tipo = audioResp.headers.get("content-type") || "audio/webm";
  const estensione = tipo.includes("mp4") || tipo.includes("m4a") ? "m4a"
    : tipo.includes("mpeg") ? "mp3"
    : tipo.includes("ogg") ? "ogg" : "webm";

  const form = new FormData();
  form.append("file", new Blob([audioBuf], { type: tipo }), "nota." + estensione);
  form.append("model", "whisper-1");
  form.append("language", "it");

  let r;
  try {
    r = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: "Bearer " + OPENAI_KEY },
      body: form,
    });
  } catch (netErr) {
    throw fail("Servizio di trascrizione irraggiungibile: " + netErr.message, 502);
  }

  if (!r.ok) {
    let motivo = "";
    try {
      const j = await r.json();
      motivo = (j.error && (j.error.message || j.error.type)) || "";
    } catch (e) { /* niente */ }
    console.error("Errore trascrizione:", r.status, motivo);
    throw fail("Trascrizione rifiutata (" + r.status + ")" + (motivo ? ": " + motivo : ""), 502);
  }

  const out = await r.json();
  return send(res, 200, { text: (out.text || "").trim() });
}

/* Gianardi, 23/09/2026 (punto 33): al primo accesso alla sezione
   Documenti, chi non ha ancora impostato un formato può scegliere di
   caricare la foto di un documento che usa già (fattura/preventivo/
   carta intestata cartacea) invece di compilare la Carta intestata a
   mano da zero — EON legge i dati dell'azienda dalla foto (visione di
   Claude) e li usa per pre-compilare il modulo, che l'utente rivede e
   salva come sempre. Nessun salvataggio automatico qui: solo
   estrazione, la scrittura vera passa sempre dal salvataggio esistente
   della Carta intestata (stesso principio di "mai scrivere dati senza
   conferma dell'utente" già seguito altrove). */
async function handleLeggiIntestazioneDaFoto(req, res) {
  if (req.method !== "POST") throw fail("Usa POST per questo endpoint", 405);
  if (!ANTHROPIC_API_KEY) throw fail("ANTHROPIC_API_KEY non impostata su Vercel", 500);

  const body = await readBody(req);
  const base64 = body.immagine_base64;
  const mediaType = body.media_type;
  if (!eStringaNonVuota(base64)) throw fail("Campo 'immagine_base64' mancante");
  const TIPI_IMMAGINE_VALIDI = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
  if (!TIPI_IMMAGINE_VALIDI.has(mediaType)) throw fail("Formato immagine non supportato: usa jpeg, png, webp o gif");
  const MAX_LUNGHEZZA_BASE64 = 6 * 1024 * 1024; // margine prudente sotto il limite del body su Vercel
  if (base64.length > MAX_LUNGHEZZA_BASE64) throw fail("Immagine troppo grande: riprova con una foto più piccola", 413);

  let r;
  try {
    r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: "claude-sonnet-4-5",
        max_tokens: 400,
        messages: [{
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } },
            { type: "text", text: "Questa è la foto di un documento aziendale italiano (fattura, preventivo o carta intestata). Leggi SOLO i dati dell'azienda che emette il documento (non del cliente destinatario) e rispondi SOLO con un oggetto JSON, senza nessun altro testo, con questi campi: {\"nome_azienda\": string o null, \"indirizzo\": string o null, \"piva\": string o null, \"telefono\": string o null, \"email\": string o null}. Usa null per ogni campo che non riesci a leggere con certezza nella foto: non inventare mai un dato che non vedi scritto chiaramente." },
          ],
        }],
      }),
    });
  } catch (netErr) {
    throw fail("Non riesco a contattare l'AI: " + netErr.message, 502);
  }
  if (!r.ok) {
    let motivo = "";
    try { const j = await r.json(); motivo = (j.error && (j.error.message || j.error.type)) || ""; } catch (e) { /* niente */ }
    throw fail("L'AI ha rifiutato la richiesta (" + r.status + ")" + (motivo ? ": " + motivo : ""), 502);
  }
  const data = await r.json();
  const testo = (data.content || []).map((b) => b.text || "").join("").trim();
  let estratti;
  try {
    estratti = JSON.parse(testo.replace(/```json|```/g, "").trim());
  } catch (err) {
    throw fail("Non sono riuscita a leggere i dati dalla foto: riprova con un'altra foto, più leggibile", 502);
  }
  return send(res, 200, {
    nome_azienda: estratti.nome_azienda || null,
    indirizzo: estratti.indirizzo || null,
    piva: estratti.piva || null,
    telefono: estratti.telefono || null,
    email: estratti.email || null,
  });
}

/* Named export solo per i test automatici (eval/backend.test.js): sono
   funzioni pure (nessuna chiamata di rete/database), utili da
   verificare in isolamento senza un account Supabase né una chiave
   Anthropic. Non cambia in nessun modo il comportamento del vero
   endpoint, che resta unicamente l'export default sotto. */
export { estraiIntentoDaMessaggi, costruisciFocus };

/* ============================================================
   Punto di ingresso unico
   ============================================================ */

export default async function handler(req, res) {
  cors(res);

  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }

  try {
    const url = new URL(req.url, "http://localhost");
    const action = url.searchParams.get("action");
    const resource = url.searchParams.get("resource");

    /* Stato del servizio: unico endpoint pubblico, utile per capire
       subito se le variabili d'ambiente sono state impostate bene. */
    if (!action && !resource) {
      return send(res, 200, {
        service: "EON backend",
        status: "online",
        time: new Date().toISOString(),
        env: {
          SUPABASE_URL: !!SUPABASE_URL,
          SUPABASE_ANON_KEY: !!ANON_KEY,
          SUPABASE_SERVICE_ROLE_KEY: !!SERVICE_ROLE_KEY,
          ANTHROPIC_API_KEY: !!ANTHROPIC_API_KEY,
          OPENAI_API_KEY: !!process.env.OPENAI_API_KEY,
        },
        supabaseUrlUsato: SUPABASE_URL || "(non impostato)",
        endpoints: {
          ai: "POST /api?action=ai",
          assistant: "POST /api?action=assistant",
          analizza_messaggio: "POST /api?action=analizza_messaggio",
          rispondi_richiesta_cliente: "POST /api?action=rispondi_richiesta_cliente",
          transcribe: "POST /api?action=transcribe",
          seed: "POST /api?action=seed",
          resources: "GET|POST|PATCH|DELETE /api?resource=<nome>",
        },
      });
    }

    const { user, accessToken } = await requireUser(req);

    if (action === "ai") return await handleAI(req, res);
    if (action === "assistant") return await handleAssistant(req, res, user, accessToken);
    if (action === "analizza_messaggio") return await handleAnalizzaMessaggio(req, res, user, accessToken);
    if (action === "rispondi_richiesta_cliente") return await handleRispondiRichiestaCliente(req, res, user, accessToken);
    if (action === "transcribe") return await handleTranscribe(req, res);
    if (action === "leggi_intestazione_da_foto") return await handleLeggiIntestazioneDaFoto(req, res);
    if (action === "seed") return await handleSeed(req, res, user, accessToken);
    if (resource) return await handleResource(req, res, resource, user, accessToken);

    throw fail("Richiesta non riconosciuta: usa ?action= oppure ?resource=");
  } catch (err) {
    const status = err.status || 500;
    if (status >= 500) console.error("[EON API]", err);
    send(res, status, { error: err.message || "Errore interno del server" });
  }
}
