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
    throw fail("Impossibile contattare il database, riprova tra poco", 503);
  }

  const text = await r.text();
  let parsed = null;
  if (text) { try { parsed = JSON.parse(text); } catch { parsed = text; } }

  if (!r.ok) {
    const msg = parsed && parsed.message ? parsed.message : "Errore database";
    throw fail(msg, r.status);
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
const AI_RATE_LIMIT = 20; // richieste
const AI_RATE_WINDOW_SECONDS = 600; // 10 minuti

const TIPI_IMPEGNO = new Set(["incontro", "chiamata", "commissione"]);
const STATI_CLIENTE = new Set(["attivo", "trattativa", "inattivo"]);

function eStringaNonVuota(v) { return typeof v === "string" && v.trim().length > 0; }
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
    return parole.every((p) => paroleCliente.some((pc) => paroleSimili(p, pc)));
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
  return tool.risk === "high_impact" || tool.risk === "external";
}

/* Tool interni (mai il vero risultato finale per l'utente): non
   finiscono in azioniEseguite/risposta.azioni, per non far credere al
   frontend che sia stata fatta un'azione visibile. Restano comunque
   loggati in ai_audit_log come ogni altro tool, tramite registraOperazione. */
const STRUMENTI_INTERNI = new Set(["interpreta_richiesta", "capacita_non_disponibile"]);

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
            return parole.every((p) => paroleCliente.some((pc) => paroleSimili(p, pc)));
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
      description: "Elenca gli impegni già segnati in un intervallo di date (appuntamenti e task), utile per sapere cosa c'è già prima di aggiungerne altri.",
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
      const q = encodeURIComponent(input.testo.trim());
      const [appuntamenti, impegni] = await Promise.all([
        db(`messages?select=id,title,scheduled_at&event_type=eq.appt&title=ilike.*${q}*&deleted_at=is.null&order=scheduled_at.asc&limit=10`, { method: "GET" }, ctx.accessToken),
        db(`tasks?select=id,title,scheduled_at,status&title=ilike.*${q}*&deleted_at=is.null&order=scheduled_at.asc&limit=10`, { method: "GET" }, ctx.accessToken),
      ]);
      return {
        risultati: [
          ...(appuntamenti || [])
            .filter((m) => !m.title.startsWith("❌"))
            .map((m) => ({ id: m.id, titolo: m.title, quando: m.scheduled_at, tipo: "appuntamento" })),
          ...(impegni || [])
            .filter((t) => t.status !== "done" && t.status !== "annullato")
            .map((t) => ({ id: t.id, titolo: t.title, quando: t.scheduled_at, tipo: "impegno" })),
        ],
      };
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
          return parole.every((p) => paroleCliente.some((pc) => paroleSimili(p, pc)));
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
    categoria: "azione",
    schema: {
      name: "elimina_cliente",
      description: "Sposta un cliente nel cestino: non lo cancella per sempre, si può ripristinare in seguito. Richiede conferma dell'utente.",
      input_schema: {
        type: "object",
        properties: { id: { type: "string", description: "Id del cliente da eliminare, trovato prima con cerca_cliente" } },
        required: ["id"],
      },
    },
    async describe(input, ctx) {
      const cliente = await trovaProprio("clients", input.id, ctx);
      if (!cliente) return "Eliminare questo cliente?";
      const conv = await db(`conversations?select=id&contact_name=eq.${encodeURIComponent(cliente.name)}&deleted_at=is.null&limit=1`, { method: "GET" }, ctx.accessToken);
      const haConversazione = Array.isArray(conv) && conv.length > 0;
      /* La domanda sulla conversazione è dentro la stessa conferma,
         non un secondo giro: una sola risposta dell'utente copre
         entrambe le eliminazioni. */
      return haConversazione
        ? `Spostare ${cliente.name} nel cestino insieme alla sua conversazione? Potrai ripristinare entrambi in seguito.`
        : `Spostare ${cliente.name} nel cestino? Potrai ripristinarlo in seguito.`;
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
      try {
        const conv = await db(`conversations?select=id&contact_name=eq.${encodeURIComponent(cliente.name)}&deleted_at=is.null&limit=1`, { method: "GET" }, ctx.accessToken);
        if (Array.isArray(conv) && conv.length) {
          await db(`conversations?id=eq.${conv[0].id}`, { method: "PATCH", body: JSON.stringify({ deleted_at: new Date().toISOString() }) }, ctx.accessToken);
          conversazioneEliminata = true;
        }
      } catch (err) {
        console.warn("Cliente eliminato ma la conversazione collegata no:", err.message);
      }

      return { id: cliente.id, nome: cliente.name, conversazione_eliminata: conversazioneEliminata };
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
    categoria: "azione",
    schema: {
      name: "elimina_impegno",
      description: "Sposta un appuntamento o un impegno nel cestino: non lo cancella per sempre, si può ripristinare in seguito. Diverso da annulla_impegno, che invece lo segna come annullato mantenendolo visibile nello storico. Richiede conferma dell'utente.",
      input_schema: {
        type: "object",
        properties: { id: { type: "string", description: "Id dell'impegno da eliminare" } },
        required: ["id"],
      },
    },
    async describe(input, ctx) {
      const trovato = await trovaImpegno(input.id, ctx);
      fissaIdRisoltoImpegno(input, trovato);
      return `Spostare "${trovato ? trovato.record.title : "questo impegno"}" nel cestino? Potrai ripristinarlo in seguito.`;
    },
    async run(input, ctx) {
      const trovato = await trovaImpegno(input.id, ctx);
      if (!trovato) throw fail("Impegno non trovato", 404);
      const { tabella, record } = trovato;
      await db(`${tabella}?id=eq.${record.id}`, { method: "PATCH", body: JSON.stringify({ deleted_at: new Date().toISOString() }) }, ctx.accessToken);
      return { id: record.id, titolo: record.title };
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
     filtrare solo le sue; altrimenti restituisce le più recenti. */
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
          limite: { type: "integer", description: "Quante foto restituire, default 10" },
        },
      },
    },
    async run(input, ctx) {
      if (eStringaNonVuota(input.cliente_id) && !eUuid(input.cliente_id)) throw fail("Id cliente non valido");
      const limite = eNumero(input.limite) ? Math.max(1, Math.min(input.limite, 30)) : 10;
      let query = `cantiere_foto?select=id,url,client_id,created_at&deleted_at=is.null&order=created_at.desc&limit=${limite}`;
      if (eStringaNonVuota(input.cliente_id)) query += `&client_id=eq.${encodeURIComponent(input.cliente_id)}`;
      const righe = await db(query, { method: "GET" }, ctx.accessToken);
      const lista = Array.isArray(righe) ? righe : [];
      return { foto: lista.map((f) => ({ id: f.id, url: f.url, quando: f.created_at })) };
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
          return ePreventivoOFattura
            ? { id: m.id, tipo: "preventivo_o_fattura", titolo: m.title, riepilogo: m.body || null, importo: m.amount ?? null, url: null, quando: m.created_at }
            : { id: m.id, tipo: "allegato", titolo: m.file_name || "(senza nome)", url: m.file_url, quando: m.created_at };
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
      description: "OBBLIGATORIO come primo strumento di ogni richiesta nuova, prima di qualsiasi altro: dichiara qui la tua comprensione di cosa vuole ottenere l'utente. Non esegue scritture: se l'entità è di tipo \"cliente\" cerca però subito quel nome in anagrafica e restituisce cliente_risolto (stato trovato/simile/ambiguo/non_trovato) — non serve chiamare cerca_cliente separatamente per lo stesso nome.",
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
            },
          },
          cardinalita: {
            type: "string",
            enum: ["singolare", "insieme"],
            description: "singolare = un solo elemento coinvolto. insieme = la richiesta riguarda più elementi insieme (es. 'tutti gli impegni di domani').",
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
         riferimento_esplicito con eStringaNonVuota+trim. */
      const entita = input.entita;
      const tipoEntita = eStringaNonVuota(entita && entita.tipo) ? entita.tipo.trim().toLowerCase() : null;
      if (tipoEntita === "cliente" && eStringaNonVuota(entita.riferimento_esplicito)) {
        esito.cliente_risolto = await risolviClienteDaNome(entita.riferimento_esplicito, ctx);
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
function systemPromptAssistente() {
  return `Sei l'assistente operativo dentro EON, un'app per professionisti italiani.

Hai delle funzioni per leggere e modificare i dati del professionista: usale davvero, non limitarti a descrivere cosa faresti.

Nei messaggi nuovi il primo strumento che chiami è sempre interpreta_richiesta (il sistema te lo richiede automaticamente): dichiara lì operazione e oggetto della richiesta prima di scegliere il tool vero. Se hai dichiarato oggetto "risorsa" (l'utente vuole vedere/recuperare qualcosa che esiste o dovrebbe esistere: un documento, una foto, un preventivo, un cartello, un dato), prova prima recupera_foto_cantiere (foto del cantiere/lavoro) o recupera_documenti_cliente (documenti, preventivi e fatture già creati per un cliente): mostrano davvero la risorsa, invece di limitarsi a dire che esiste. Solo se nessuno dei due è adatto (es. un preventivo mai creato prima, o qualcosa che non è né una foto né un documento in una conversazione cliente) NON usare crea_impegno o crea_appunto come ripiego per far finta di aver fatto qualcosa: chiama capacita_non_disponibile e spiega onestamente il limite, chiedendo se preferisce che tu lo segni comunque come promemoria da controllare a mano. crea_impegno/crea_appunto restano lo strumento giusto quando l'utente vuole davvero che tu registri qualcosa da fare (oggetto "azione"), non quando vuole vedere qualcosa che già esiste o dovrebbe esistere. Se lo stesso messaggio contiene più richieste distinte di natura diversa (es. "mandami il preventivo del tetto E segnami di stamparlo dopo"), richiama interpreta_richiesta una seconda volta per dichiarare il cambio quando passi dall'una all'altra, invece di lasciare attivo solo il primo oggetto dichiarato per l'intero messaggio.

Quando dichiari un'entità di tipo "cliente" in interpreta_richiesta CON un riferimento_esplicito (un nome), il risultato include già cliente_risolto — non richiamare cerca_cliente per lo stesso nome, è già stato cercato. (Se invece usi usa_focus_corrente senza un nome esplicito, cliente_risolto non c'è: usa cerca_cliente tu stesso se ti serve un id.) Reagisci in base al suo stato: "trovato" → usa direttamente il suo id, nessuna domanda necessaria per l'identità (ma se stai per crearlo di nuovo come cliente nuovo, avvisa che esiste già e chiedi conferma prima di creare un doppione). "simile" → il nome assomiglia a un cliente esistente ma non è uguale (possibile dettatura imprecisa, o un cliente diverso): chiedi conferma prima di usarlo, non trattarlo come certo. "ambiguo" → più clienti corrispondono: elencali brevemente (nome, e telefono o zona se utili a distinguerli) e chiedi quale intende. "non_trovato" → nessun cliente con questo nome: se l'azione non richiede necessariamente un cliente collegato (es. un impegno che nomina solo una persona di passaggio) procedi comunque senza collegarlo; se invece richiede un destinatario reale (mandare un messaggio, un contatto), chiedi se vuoi aggiungerlo come nuovo cliente prima di procedere. Se l'operazione è "contatta" e non hai un vero strumento per avviare un contatto diretto (una chiamata), dillo onestamente con capacita_non_disponibile — e se in più cliente_risolto.manca_telefono è vero, approfittane per chiedere il numero e offrire di salvarlo con aggiorna_cliente, così la prossima volta sarà già pronto. Ma se la richiesta si può comunque soddisfare con uno strumento reale che non ha bisogno del telefono (es. mandare un messaggio interno), usalo normalmente: manca_telefono da solo non deve mai bloccare un'azione che non lo richiede davvero.

Se l'utente chiede di mandare/inviare qualcosa che è a sua volta una risorsa (es. "manda le foto del cantiere a Fabbri", "invia il documento a Rossi"), recupera prima quella risorsa (recupera_foto_cantiere/recupera_documenti_cliente) e SOLO DOPO chiama manda_messaggio — mai proporre l'invio di qualcosa che non hai mai recuperato davvero. manda_messaggio non allega file, solo testo: per foto e allegati (che hanno sempre un url reale) includi i link veri nel testo del messaggio, mai una frase generica come "ti mando le foto". Un preventivo o una fattura generati in app (tipo "preventivo_o_fattura" in recupera_documenti_cliente) invece NON hanno mai un url: non inventarne uno né promettere di inviarlo come link — di' che si vede solo dentro l'app, o riporta titolo/importo/riepilogo nel testo.

REGOLA PRINCIPALE: ogni impegno nominato dall'utente deve finire nel calendario con crea_impegno — non solo incontri, anche telefonate, commissioni, pratiche da aggiornare, documenti da preparare, persone da sentire. Se in una frase ci sono più impegni distinti, chiama crea_impegno una volta per ciascuno: non riassumerli, non accorparli, non scartarne nessuno.

Sull'orario: se l'utente non dice affatto quando (nessun riferimento di tempo, nemmeno vago), decidi tu senza chiedere nulla: primo giorno utile, alle 08:00 — non lasciare mai un impegno senza data. Ma se usa un riferimento VAGO o relativo che potresti interpretare in più modi (es. "quando rientro in ufficio", "più tardi", "appena posso", "stasera" senza un'ora precisa), NON chiamare subito crea_impegno con un orario indovinato alla cieca: calcola tu una stima concreta e ragionevole partendo dall'ora di adesso (es. "quando rientro in ufficio" ≈ tra un'ora), e chiedi conferma in una risposta di testo — non uno strumento — tipo "Va bene se te lo segno fra un'ora, alle 15:40?". Poi fermati e aspetta: la risposta dell'utente arriverà nello stesso filo di conversazione, come conferma ("sì", "va bene") o come correzione ("no, fai fra due ore", "alle 16 piuttosto") — solo a quel punto chiama crea_impegno con l'orario giusto.

Se invece l'utente dice esplicitamente di segnargli/annotargli qualcosa "negli appunti", o semplicemente "segnami che..." senza nominare un orario o una scadenza (es. "segnami in appunti che devo vedere il costo del materiale"), usa crea_appunto — NON crea_impegno, che è solo per cose con una data. Se poi dice di correggere, cambiare o sistemare un appunto appena detto (es. "correggi, non è il costo del materiale ma dell'impermeabile"), usa correggi_appunto: prova a riconoscere quale appunto intende dalla parola che ha usato, e se non specifica nulla aggiorna semplicemente l'ultimo appunto creato.

Chiama crea_cliente o aggiorna_cliente SOLO quando l'utente chiede esplicitamente di aggiungere o modificare un cliente in anagrafica — non per un normale impegno che nomina soltanto una persona.

Quando serve collegare qualcosa (es. una foto) a un cliente preciso e ti serve un id certo, non un elenco tra cui scegliere, usa trova_o_crea_cliente invece di cerca_cliente/crea_cliente separati: restituisce sempre un solo cliente, trovato o appena creato.

Se un impegno riguarda una persona già cliente, cercala prima con cerca_cliente per collegare l'impegno al cliente giusto; se non la trovi, procedi comunque con l'impegno senza collegarlo a nessuno.

Quando l'utente nomina un appuntamento o un impegno per titolo invece di darti un id (es. "sposta l'appuntamento di casa Rossi", "elimina l'appuntamento con Hannah") NON dedurre un intervallo di date a caso con elenca_appuntamenti: cerca prima con cerca_impegno usando le parole che ha usato l'utente (anche solo una, es. "Rossi"). Se trovi un solo risultato, CHIAMA SUBITO lo strumento giusto (sposta_impegno/annulla_impegno/elimina_impegno) con l'id trovato — non fermarti a scriverlo, non chiedere tu stesso conferma in una risposta di testo. Se cerca_impegno trova più di un risultato, allora sì, fermati e chiedi all'utente quale intende, elencandoli brevemente. Solo se cerca_impegno non trova nulla, di' che non l'hai trovato.

IMPORTANTE su manda_messaggio, sposta_impegno, annulla_impegno, elimina_impegno, elimina_cliente e svuota_cestino: sono operazioni delicate che il sistema stesso, non tu, sottopone all'utente con un pulsante di conferma reale non appena le chiami — è un meccanismo automatico che scatta sempre, qualunque cosa tu scriva. Per questo devi SEMPRE chiamare direttamente lo strumento quando hai gli elementi per farlo (es. hai trovato con certezza l'impegno o il cliente giusto), MAI scrivere tu una domanda del tipo "Confermi che vuoi eliminarlo?" nel testo della risposta: l'utente non avrebbe modo di risponderti a quella domanda, perché non è una conferma vera — resterebbe bloccato senza sapere cosa fare. Se ti mancano informazioni per capire QUALE record (es. più risultati da cerca_impegno, nessun cliente trovato), allora sì chiedi in testo — ma solo per quello, mai per chiedere il permesso di procedere su qualcosa che hai già identificato con certezza.

Se l'utente chiede di eliminare o svuotare il cestino definitivamente (o dice cose come "elimina tutto quello che ho cestinato", "svuota il cestino per sempre"), chiama subito svuota_cestino — è un unico comando che elimina per sempre tutto ciò che si trova già nel cestino, in ogni categoria. Non usarlo per eliminare un singolo cliente o impegno (per quello ci sono elimina_cliente/elimina_impegno), e non usarlo se l'utente vuole solo spostare qualcosa nel cestino, non svuotarlo.

Quando hai finito, rispondi con una riga di riepilogo breve e concreta di quello che hai fatto, in italiano, senza citare id tecnici.`;
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
   riferimento incompatibile — non da quanto tempo è passato. */
function costruisciFocus(elencoMessaggi) {
  const intento = estraiIntentoDaMessaggi(elencoMessaggi);
  if (!intento || !intento.entita || intento.operazione === "consulta") return {};
  const { tipo, riferimento_esplicito, usa_focus_corrente } = intento.entita;
  if (usa_focus_corrente || !eStringaNonVuota(tipo) || !eStringaNonVuota(riferimento_esplicito)) return {};
  return { focus: { tipo: tipo.trim(), riferimento: riferimento_esplicito.trim() } };
}

/* Prepara la domanda di conferma per la prossima azione delicata in coda. */
async function descriviProssimaAzione(pendente, ctx) {
  const tool = TOOLS[pendente.nome];
  if (!tool.describe) return `Confermi l'operazione "${pendente.nome}"?`;
  try {
    return await tool.describe(pendente.input, ctx);
  } catch (err) {
    /* Non deve mai far cadere l'intera richiesta: qui prepariamo solo
       la domanda da mostrare, non eseguiamo ancora nulla. Se qualcosa
       va storto (es. un titolo ambiguo trovato da trovaImpegno), lo
       raccontiamo nella domanda stessa — l'esecuzione vera, quando
       l'utente risponderà, ha già il suo try/catch e non perderà le
       azioni già fatte in questo stesso turno. */
    return `Non riesco a preparare la conferma per "${pendente.nome}": ${err.message || "errore sconosciuto"}. Rispondi comunque per continuare, o annulla e riprova specificando meglio.`;
  }
}

async function handleAssistant(req, res, user, accessToken) {
  if (req.method !== "POST") throw fail("Usa POST per questo endpoint", 405);
  if (!ANTHROPIC_API_KEY) throw fail("ANTHROPIC_API_KEY non impostata su Vercel", 500);

  await verificaLimiteRichieste(user);

  const body = await readBody(req);
  const ctx = { user, accessToken };
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
      user, tipo: tipoTurno, messaggio: body.messaggio, modello: modelloUsato, giri: giriUsati,
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

    let risultatoTool;
    if (body.conferma === true) {
      try {
        risultatoTool = await TOOLS[pendente.nome].run(pendente.input, ctx);
        await registraOperazione(user, pendente.nome, pendente.input, risultatoTool, "confermato");
        azioniEseguite.push({ tool: pendente.nome, esito: risultatoTool });
      } catch (err) {
        risultatoTool = { errore: err.message || "operazione non riuscita" };
        await registraOperazione(user, pendente.nome, pendente.input, risultatoTool, "errore");
      }
    } else {
      risultatoTool = { annullato_dall_utente: true };
      await registraOperazione(user, pendente.nome, pendente.input, risultatoTool, "negato");
    }

    /* is_error segnala a Claude (e al controllo qui sotto) che questa
       specifica azione NON è stata eseguita come chiesto — o perché è
       fallita davvero (risultatoTool.errore), o perché l'utente ha
       detto "No" (risultatoTool.annullato_dall_utente): in entrambi i
       casi il turno non può considerarsi "fatto" in silenzio, serve
       che Claude lo racconti. Stesso trattamento che il giro normale
       del ciclo già dà agli strumenti non delicati falliti (vedi
       risultati.push(..., is_error:true) più sotto). */
    const nuoviPronti = pronti.concat([{ type: "tool_result", tool_use_id: pendente.tool_use_id, content: JSON.stringify(risultatoTool), is_error: !!(risultatoTool.errore || risultatoTool.annullato_dall_utente) }]);

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
  } else {
    if (!eStringaNonVuota(body.messaggio)) throw fail("Campo 'messaggio' mancante o vuoto");
    messages = [{ role: "user", content: body.messaggio }];
  }

  const schemi = Object.values(TOOLS).map((t) => t.schema);
  const promptStatico = systemPromptAssistente(); // uguale ad ogni giro: costruito una sola volta fuori dal loop

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

      let r;
      let erroreRete = null;
      try {
        r = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
          body: JSON.stringify({
            model: modelloUsato,
            max_tokens: 1200,
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
            tool_choice: forzaInterpretazione ? { type: "tool", name: "interpreta_richiesta" } : undefined,
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
      const nonSicuro = round === primoGiroSostanziale && modelloUsato === MODEL_HAIKU && tentativo === 0
        && data.stop_reason !== "tool_use" && !/\?\s*$/.test(testoDiRisposta(data));
      if (nonSicuro) {
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
    const coda = [];

    for (const richiesta of richieste) {
      const tool = TOOLS[richiesta.name];
      if (!tool) {
        risultati.push({ type: "tool_result", tool_use_id: richiesta.id, content: JSON.stringify({ errore: "strumento sconosciuto" }), is_error: true });
        continue;
      }

      /* Guardrail generale (non specifico per crea_impegno o per un
         singolo caso): se l'IntentFrame dichiarato con
         interpreta_richiesta ha oggetto "risorsa" — l'utente vuole
         vedere/recuperare qualcosa, non far registrare un'azione — un
         tool di categoria "azione" non può essere il modo con cui il
         turno si considera soddisfatto. Blocchiamo l'esecuzione e
         spieghiamo perché nel tool_result: il giro successivo del loop
         dà a Claude la possibilità di scegliere capacita_non_disponibile
         (o un vero tool "risorsa", quando ne esisterà uno) invece di
         insistere sullo stesso ripiego. Si applica solo qui, non alla
         coda di conferma sotto: le azioni ad alto rischio passano comunque
         da una domanda esplicita all'utente, un secondo controllo naturale. */
      if (intentoAttivo && intentoAttivo.oggetto === "risorsa" && tool.categoria === "azione") {
        risultati.push({
          type: "tool_result",
          tool_use_id: richiesta.id,
          content: JSON.stringify({ errore: `Questa richiesta è stata classificata come "mostra/recupera una risorsa", non come un'azione da registrare: ${richiesta.name} non è lo strumento giusto. Se non hai un tool che recuperi davvero questa risorsa, chiama capacita_non_disponibile invece di creare un impegno o un appunto.` }),
          is_error: true,
        });
        continue;
      }

      if (richiedeConferma(tool)) {
        /* Non eseguiamo subito: la mettiamo in coda e continuiamo a
           esaminare le altre richieste dello stesso turno, così le
           azioni sicure partono comunque senza aspettare. */
        coda.push({ nome: richiesta.name, input: richiesta.input, tool_use_id: richiesta.id });
        continue;
      }
      try {
        const esito = await tool.run(richiesta.input, ctx);
        await registraOperazione(user, richiesta.name, richiesta.input, esito, "auto");
        if (!STRUMENTI_INTERNI.has(richiesta.name)) azioniEseguite.push({ tool: richiesta.name, esito });
        risultati.push({ type: "tool_result", tool_use_id: richiesta.id, content: JSON.stringify(esito) });
      } catch (err) {
        const erroreEsito = { errore: err.message || "operazione non riuscita" };
        await registraOperazione(user, richiesta.name, richiesta.input, erroreEsito, "errore");
        risultati.push({ type: "tool_result", tool_use_id: richiesta.id, content: JSON.stringify(erroreEsito), is_error: true });
      }
    }

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
    if (action === "seed") return await handleSeed(req, res, user, accessToken);
    if (resource) return await handleResource(req, res, resource, user, accessToken);

    throw fail("Richiesta non riconosciuta: usa ?action= oppure ?resource=");
  } catch (err) {
    const status = err.status || 500;
    if (status >= 500) console.error("[EON API]", err);
    send(res, status, { error: err.message || "Errore interno del server" });
  }
}
