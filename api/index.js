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

  if (req.method === "GET") {
    const qs = resource === "messages" && url.searchParams.get("conversation_id")
      ? `conversation_id=eq.${url.searchParams.get("conversation_id")}&order=created_at.asc`
      : "order=created_at.asc";
    const rows = await db(`${resource}?select=*&${qs}`, { method: "GET" }, accessToken);
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
    await db(`${resource}?id=eq.${id}`, { method: "DELETE" }, accessToken);
    return send(res, 200, { ok: true });
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
  const righe = await db(`${resource}?id=eq.${id}&select=*`, { method: "GET" }, ctx.accessToken);
  return Array.isArray(righe) && righe.length ? righe[0] : null;
}

async function trovaOCreaConversazione(cliente, ctx) {
  const nome = encodeURIComponent(cliente.name);
  const trovate = await db(`conversations?select=*&contact_name=eq.${nome}&limit=1`, { method: "GET" }, ctx.accessToken);
  if (Array.isArray(trovate) && trovate.length) return trovate[0];

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
      const righe = await db(`clients?select=id,name,phone,value,status&name=ilike.*${q}*&limit=5`, { method: "GET" }, ctx.accessToken);
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
      const filtro = `scheduled_at=gte.${encodeURIComponent(input.da)}&scheduled_at=lte.${encodeURIComponent(input.a)}`;
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

      const conv = await db(`conversations?select=id&contact_name=eq.${encodeURIComponent(cliente.name)}&limit=1`, { method: "GET" }, ctx.accessToken);
      const conversazione = Array.isArray(conv) && conv[0];

      let messaggi = [], documenti = [];
      if (conversazione) {
        [messaggi, documenti] = await Promise.all([
          db(`messages?select=sender,body,title,event_type,created_at&conversation_id=eq.${conversazione.id}&order=created_at.desc&limit=10`, { method: "GET" }, ctx.accessToken),
          db(`messages?select=id,title,created_at&conversation_id=eq.${conversazione.id}&event_type=eq.doc&order=created_at.desc&limit=10`, { method: "GET" }, ctx.accessToken),
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

      const conv = await db(`conversations?select=id&contact_name=eq.${encodeURIComponent(cliente.name)}&limit=1`, { method: "GET" }, ctx.accessToken);
      const conversazione = Array.isArray(conv) && conv[0];
      if (!conversazione) return { messaggi: [] };

      const messaggi = await db(
        `messages?select=sender,body,title,event_type,created_at&conversation_id=eq.${conversazione.id}&order=created_at.desc&limit=${limite}`,
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
      const record = (await trovaProprio("messages", input.id, ctx)) || (await trovaProprio("tasks", input.id, ctx));
      return `Spostare "${record ? record.title : "questo impegno"}" a ${quando}?`;
    },
    async run(input, ctx) {
      if (!eIso(input.nuovo_quando_iso)) throw fail("Parametro 'nuovo_quando_iso' non è una data valida");
      const quandoVisualizzato = formattaQuando(input.nuovo_quando_iso);

      let record = await trovaProprio("messages", input.id, ctx);
      if (record) {
        await db(`messages?id=eq.${record.id}`, { method: "PATCH", body: JSON.stringify({ body: quandoVisualizzato, scheduled_at: input.nuovo_quando_iso }) }, ctx.accessToken);
        return { id: record.id, titolo: record.title, quando_visualizzato: quandoVisualizzato };
      }
      record = await trovaProprio("tasks", input.id, ctx);
      if (record) {
        await db(`tasks?id=eq.${record.id}`, { method: "PATCH", body: JSON.stringify({ time: quandoVisualizzato, scheduled_at: input.nuovo_quando_iso }) }, ctx.accessToken);
        return { id: record.id, titolo: record.title, quando_visualizzato: quandoVisualizzato };
      }
      throw fail("Impegno non trovato", 404);
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
      const record = (await trovaProprio("messages", input.id, ctx)) || (await trovaProprio("tasks", input.id, ctx));
      return `Annullare "${record ? record.title : "questo impegno"}"?`;
    },
    async run(input, ctx) {
      let record = await trovaProprio("messages", input.id, ctx);
      if (record) {
        await db(`messages?id=eq.${record.id}`, { method: "PATCH", body: JSON.stringify({ title: "❌ " + record.title + " (annullato)" }) }, ctx.accessToken);
        return { id: record.id, titolo: record.title };
      }
      record = await trovaProprio("tasks", input.id, ctx);
      if (record) {
        await db(`tasks?id=eq.${record.id}`, { method: "PATCH", body: JSON.stringify({ status: "annullato" }) }, ctx.accessToken);
        return { id: record.id, titolo: record.title };
      }
      throw fail("Impegno non trovato", 404);
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

async function caricaRun(runId, user) {
  let r;
  try {
    r = await fetch(`${SUPABASE_URL}/rest/v1/ai_runs?id=eq.${runId}&owner_id=eq.${user.id}&select=*`, {
      headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}` },
    });
  } catch (netErr) {
    throw fail("Impossibile recuperare lo stato dell'assistente: " + netErr.message, 502);
  }
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

Quando hai finito, rispondi con una riga di riepilogo breve e concreta di quello che hai fatto, in italiano, senza citare id tecnici.`;
}

async function handleAssistant(req, res, user, accessToken) {
  if (req.method !== "POST") throw fail("Usa POST per questo endpoint", 405);
  if (!ANTHROPIC_API_KEY) throw fail("ANTHROPIC_API_KEY non impostata su Vercel", 500);

  await verificaLimiteRichieste(user);

  const body = await readBody(req);
  const ctx = { user, accessToken };
  const azioniEseguite = [];
  let runId = body.runId || null;
  let messages;

  if (runId) {
    /* Riprendiamo una conversazione che era in attesa di conferma */
    const run = await caricaRun(runId, user);
    if (!run) throw fail("Richiesta scaduta o non trovata", 404);
    if (run.stato !== "in_attesa_conferma" || !run.in_sospeso) throw fail("Questa richiesta non è in attesa di conferma");

    const pendente = run.in_sospeso;
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

    messages = run.messaggi.concat([
      { role: "user", content: [{ type: "tool_result", tool_use_id: pendente.tool_use_id, content: JSON.stringify(risultatoTool) }] },
    ]);
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
      return send(res, 200, { stato: "concluso", testo: testo || "Fatto.", azioni: azioniEseguite });
    }

    const richieste = data.content.filter((b) => b.type === "tool_use");
    const risultati = [];
    let sospeso = null;

    for (const richiesta of richieste) {
      const tool = TOOLS[richiesta.name];
      if (!tool) {
        risultati.push({ type: "tool_result", tool_use_id: richiesta.id, content: JSON.stringify({ errore: "strumento sconosciuto" }), is_error: true });
        continue;
      }
      if (tool.sensitive) {
        /* Ci fermiamo qui: eventuali altre richieste di questo stesso
           turno restano senza risposta finché l'utente non decide,
           come richiede il formato dei messaggi di Anthropic. */
        sospeso = { nome: richiesta.name, input: richiesta.input, tool_use_id: richiesta.id };
        break;
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

    if (sospeso) {
      const tool = TOOLS[sospeso.nome];
      const domanda = tool.describe ? await tool.describe(sospeso.input, ctx) : `Confermi l'operazione "${sospeso.nome}"?`;
      const salvato = await salvaRun(runId, user, { stato: "in_attesa_conferma", messaggi: messages, in_sospeso: sospeso });
      return send(res, 200, { stato: "in_attesa_conferma", runId: salvato.id, domanda, azioni: azioniEseguite });
    }

    messages.push({ role: "user", content: risultati });
  }

  throw fail("L'assistente non è riuscito a completare la richiesta in tempo utile: riprova con una frase più semplice", 504);
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
          transcribe: "POST /api?action=transcribe",
          seed: "POST /api?action=seed",
          resources: "GET|POST|PATCH|DELETE /api?resource=<nome>",
        },
      });
    }

    const { user, accessToken } = await requireUser(req);

    if (action === "ai") return await handleAI(req, res);
    if (action === "assistant") return await handleAssistant(req, res, user, accessToken);
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
