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
 *   ai_audit_log (quest'ultimo di sola lettura: GET soltanto)
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
]);

/* Tabelle leggibili ma non scrivibili dal client: il registro delle
   operazioni dell'AI lo scrive solo il backend, mai una richiesta esterna. */
const READ_ONLY_RESOURCES = new Set(["ai_audit_log"]);

/* Tabelle con il cestino: "eliminare" non cancella subito la riga, la
   marca con deleted_at. Da lì si può ripristinare o eliminare per
   sempre. profiles, documents (non usata) e ai_audit_log restano fuori:
   non sono liste di cose che un utente "cestina". */
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

/* Un "impegno" (per sposta_impegno/annulla_impegno) è o un appuntamento
   dentro messages, o un task: si cerca nell'uno, poi nell'altro. Usato
   sia per descrivere la conferma sia per eseguire l'azione, così i due
   posti non possono disallinearsi su dove si trova il record. */
async function trovaImpegno(id, ctx) {
  const messaggio = await trovaProprio("messages", id, ctx);
  if (messaggio) return { tabella: "messages", record: messaggio };
  const task = await trovaProprio("tasks", id, ctx);
  if (task) return { tabella: "tasks", record: task };
  return null;
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

/* ------------------------------------------------------------
   Elenco dei tool. Ognuno ha:
   - schema: la definizione che vede Claude (nome, descrizione, parametri)
   - sensitive: true se serve conferma dell'utente prima di eseguirlo
   - describe: (solo per i sensitive) genera la domanda da mostrare
   - run: la funzione vera, eseguita solo lato server
   ------------------------------------------------------------ */
const TOOLS = {

  cerca_cliente: {
    sensitive: false,
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
      const q = encodeURIComponent(input.nome.trim());
      const righe = await db(`clients?select=id,name,phone,value,status&name=ilike.*${q}*&deleted_at=is.null&limit=5`, { method: "GET" }, ctx.accessToken);
      return {
        risultati: (righe || []).map((r) => ({
          id: r.id, nome: r.name, telefono: r.phone || null, valore: r.value || null, stato: r.status || null,
        })),
      };
    },
  },

  elenca_appuntamenti: {
    sensitive: false,
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
    sensitive: false,
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
    sensitive: false,
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
    sensitive: false,
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

  crea_cliente: {
    sensitive: false,
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
    sensitive: false,
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
    sensitive: true,
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
    sensitive: false,
    schema: {
      name: "crea_impegno",
      description: "Segna un impegno nel calendario: un incontro, una telefonata o una commissione (qualsiasi altra cosa da fare: pratiche, acquisti, documenti). Chiamalo una volta per ogni impegno distinto nominato dall'utente, anche se ne ha nominati molti nella stessa frase.",
      input_schema: {
        type: "object",
        properties: {
          titolo: { type: "string", description: "Titolo breve e concreto, come lo direbbe l'utente" },
          quando_iso: { type: "string", description: "Data e ora in formato ISO 8601. Se l'utente non dice quando, usa le 08:00 del primo giorno utile: non lasciare mai un impegno senza data." },
          tipo: { type: "string", enum: ["incontro", "chiamata", "commissione"] },
          cliente_id: { type: "string", description: "Id del cliente collegato, se l'impegno riguarda una persona già in anagrafica (cercala prima con cerca_cliente)" },
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
    sensitive: true,
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
    sensitive: true,
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
    sensitive: true,
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
    sensitive: true,
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

async function registraOperazione(user, tool, input, esito, stato) {
  if (!SERVICE_ROLE_KEY) return;
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/ai_audit_log`, {
      method: "POST",
      headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}`, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ owner_id: user.id, tool, input, esito, stato }),
    });
  } catch (netErr) {
    console.error("Scrittura registro operazioni non riuscita:", netErr);
  }
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

/* Reclama in modo atomico un run in attesa di conferma: la condizione
   stato=eq.in_attesa_conferma nell'URL fa sì che, se due richieste con lo
   stesso runId arrivano insieme (un doppio tap, un retry di rete), solo
   una delle due trovi la riga e la faccia passare a "in_corso" — l'altra
   non trova nulla e si ferma, invece di eseguire due volte la stessa
   azione delicata (mandare due volte lo stesso messaggio, per esempio). */
async function reclamaRun(runId, user) {
  let r;
  try {
    r = await fetch(
      `${SUPABASE_URL}/rest/v1/ai_runs?id=eq.${runId}&owner_id=eq.${user.id}&stato=eq.in_attesa_conferma`,
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

function systemPromptAssistente() {
  const oggi = new Date();
  return `Sei l'assistente operativo dentro EON, un'app per professionisti italiani.
Oggi è ${oggi.toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}, ora ${oggi.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}.

Hai delle funzioni per leggere e modificare i dati del professionista: usale davvero, non limitarti a descrivere cosa faresti.

REGOLA PRINCIPALE: ogni impegno nominato dall'utente deve finire nel calendario con crea_impegno — non solo incontri, anche telefonate, commissioni, pratiche da aggiornare, documenti da preparare, persone da sentire. Se in una frase ci sono più impegni distinti, chiama crea_impegno una volta per ciascuno: non riassumerli, non accorparli, non scartarne nessuno. Se manca la data o l'ora, decidi tu: primo giorno utile, alle 08:00. Non lasciare mai un impegno senza data.

Chiama crea_cliente o aggiorna_cliente SOLO quando l'utente chiede esplicitamente di aggiungere o modificare un cliente in anagrafica — non per un normale impegno che nomina soltanto una persona.

Se un impegno riguarda una persona già cliente, cercala prima con cerca_cliente per collegare l'impegno al cliente giusto; se non la trovi, procedi comunque con l'impegno senza collegarlo a nessuno.

Quando l'utente nomina un appuntamento o un impegno per titolo invece di darti un id (es. "sposta l'appuntamento di casa Rossi", "elimina l'appuntamento con Hannah") NON dedurre un intervallo di date a caso con elenca_appuntamenti: cerca prima con cerca_impegno usando le parole che ha usato l'utente (anche solo una, es. "Rossi"). Se trovi un solo risultato, procedi con quello. Se ne trovi più di uno, chiedi all'utente quale intende elencandoli brevemente. Solo se cerca_impegno non trova nulla, di' che non l'hai trovato.

Quando hai finito, rispondi con una riga di riepilogo breve e concreta di quello che hai fatto, in italiano, senza citare id tecnici.`;
}

/* Prepara la domanda di conferma per la prossima azione delicata in coda. */
async function descriviProssimaAzione(pendente, ctx) {
  const tool = TOOLS[pendente.nome];
  return tool.describe ? await tool.describe(pendente.input, ctx) : `Confermi l'operazione "${pendente.nome}"?`;
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

  try {
    return await proseguiAssistente();
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
    throw err;
  }

  async function proseguiAssistente() {
  if (runId) {
    /* runId arriva dal client: prima di infilarlo in un URL verso il
       database (con la chiave di servizio, che scavalca RLS) lo
       validiamo come uuid, esattamente come si fa altrove nel file. */
    if (!eUuid(runId)) throw fail("runId non valido", 400);

    /* Riprendiamo una conversazione che era in attesa di conferma. */
    const run = await reclamaRun(runId, user);
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

    const nuoviPronti = pronti.concat([{ type: "tool_result", tool_use_id: pendente.tool_use_id, content: JSON.stringify(risultatoTool) }]);

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
      return send(res, 200, { stato: "in_attesa_conferma", runId: salvato.id, domanda, azioni: azioniEseguite });
    }

    messages = run.messaggi.concat([{ role: "user", content: nuoviPronti }]);
  } else {
    if (!eStringaNonVuota(body.messaggio)) throw fail("Campo 'messaggio' mancante o vuoto");
    messages = [{ role: "user", content: body.messaggio }];
  }

  const schemi = Object.values(TOOLS).map((t) => t.schema);

  for (let round = 0; round < TOOL_MAX_ROUNDS; round++) {
    let r;
    try {
      r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({
          model: "claude-sonnet-4-5",
          max_tokens: 1200,
          system: systemPromptAssistente(),
          tools: schemi,
          messages,
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
    messages.push({ role: "assistant", content: data.content });

    if (data.stop_reason !== "tool_use") {
      const testo = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
      if (runId) await salvaRun(runId, user, { stato: "concluso", messaggi: messages, in_sospeso: null, azioni: azioniEseguite });
      return send(res, 200, { stato: "concluso", testo: testo || "Fatto.", azioni: azioniEseguite });
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
      if (tool.sensitive) {
        /* Non eseguiamo subito: la mettiamo in coda e continuiamo a
           esaminare le altre richieste dello stesso turno, così le
           azioni sicure partono comunque senza aspettare. */
        coda.push({ nome: richiesta.name, input: richiesta.input, tool_use_id: richiesta.id });
        continue;
      }
      try {
        const esito = await tool.run(richiesta.input, ctx);
        await registraOperazione(user, richiesta.name, richiesta.input, esito, "auto");
        azioniEseguite.push({ tool: richiesta.name, esito });
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
      return send(res, 200, { stato: "in_attesa_conferma", runId: salvato.id, domanda, azioni: azioniEseguite });
    }

    messages.push({ role: "user", content: risultati });
  }

  /* Tetto di round raggiunto. Le azioni non delicate già eseguite in
     questo giro (o nei giri precedenti, se c'era stata una conferma di
     mezzo) sono comunque scritte nel database: le restituiamo sempre,
     invece di un errore secco, così l'utente sa cosa è andato a buon
     fine e cosa no, invece di scoprirlo dal calendario. */
  if (runId) await salvaRun(runId, user, { stato: "incompleto", messaggi: messages, in_sospeso: null, azioni: azioniEseguite });
  return send(res, 200, {
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
