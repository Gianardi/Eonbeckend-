/* Avviso automatico degli errori ed EON Admin (27/09/2026), lato server:
   - action=errore_app registra gli errori dell'app (anche senza login), lo
     stesso errore entro un'ora aumenta solo il conteggio, un errore nuovo
     manda la notifica (AVVISO_ERRORI_URL);
   - gli errori 500 del server finiscono nella stessa tabella;
   - admin_stato / admin_riepilogo / admin_errori_visti solo per chi è in
     eon_admin.
   Gira senza rete: vero handler, database finto.
   Uso:  node eval/admin.test.mjs */

import { randomUUID } from "node:crypto";

process.env.SUPABASE_URL = "https://finto.supabase.co";
process.env.SUPABASE_ANON_KEY = "anon-finta";
process.env.SUPABASE_SERVICE_ROLE_KEY = "service-finta";
process.env.ANTHROPIC_API_KEY = "chiave-finta";

const UTENTE = { id: "11111111-1111-4111-8111-111111111111" };
const ADMIN = { id: "22222222-2222-4222-8222-222222222222" };
let authGiu = false;
const avvisi = [], rpcChiamate = [];
process.env.AVVISO_ERRORI_URL = "https://ntfy.test/eon-errori";
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
  if (s.startsWith(process.env.SUPABASE_URL + "/auth/v1/user")) {
    if (authGiu) throw new Error("rete giù");
    const tok = ((init && init.headers && init.headers.Authorization) || "").replace("Bearer ", "");
    return tok === "admin" ? json(ADMIN) : tok === "t" ? json(UTENTE) : json({ msg: "token non valido" }, 401);
  }
  if (s.startsWith("https://ntfy.test/")) { avvisi.push(init.body); return json({}); }
  if (s.startsWith(process.env.SUPABASE_URL + "/rest/v1/rpc/admin_riepilogo")) { rpcChiamate.push(JSON.parse(init.body)); return json({ totali: { errori_nuovi: 1 }, utenti: [] }); }
  if (s.startsWith(process.env.SUPABASE_URL + "/rest/v1/")) return postgrest(s, init);
  throw new Error("fetch non prevista: " + s);
};
const { default: handler } = await import("../api/index.js");
async function chiama(body, action = "assistant", token = "t", metodo = "POST") {
  const headers = { "user-agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)", "x-forwarded-for": "1.2.3.4" };
  if (token) headers.authorization = "Bearer " + token;
  const req = { method: metodo, url: "/api?action=" + action, headers, body };
  let uscita = ""; const res = { statusCode: 0, setHeader() {}, end(d) { uscita = d || ""; } };
  await handler(req, res);
  return { status: res.statusCode, corpo: uscita ? JSON.parse(uscita) : null };
}

let falliti = 0;
function verifica(descrizione, condizione, dettaglio) {
  console.log(`  ${condizione ? "OK  " : "FAIL"} ${descrizione}${condizione || dettaglio === undefined ? "" : "  — " + dettaglio}`);
  if (!condizione) falliti++;
}
databaseVuoto();
tabelle.app_errori = []; tabelle.eon_admin = [];

// 1 — errore dall'app senza login
let r = await chiama({ messaggio: "TypeError: x is undefined", dettaglio: "at renderChatList", pagina: "chat", versione: "v1" }, "errore_app", null);
verifica("errore senza login: registrato", r.status === 200 && tabelle.app_errori.length === 1 && tabelle.app_errori[0].owner_id === null && tabelle.app_errori[0].pagina === "chat" && tabelle.app_errori[0].origine === "app", JSON.stringify(tabelle.app_errori));
verifica("dispositivo dal browser", /iPhone/.test(tabelle.app_errori[0].dispositivo || ""));
verifica("errore nuovo → notifica al telefono", avvisi.length === 1 && /TypeError: x is undefined/.test(avvisi[0]), JSON.stringify(avvisi));

// 2 — lo stesso errore di nuovo: niente riga nuova, conteggio 2, niente seconda notifica
await chiama({ messaggio: "TypeError: x is undefined", pagina: "chat" }, "errore_app", null);
verifica("stesso errore: conteggio 2, nessuna riga nuova", tabelle.app_errori.length === 1 && tabelle.app_errori[0].conteggio === 2, JSON.stringify(tabelle.app_errori));
verifica("stesso errore: nessuna seconda notifica", avvisi.length === 1);

// 3 — con login: collegato all'utente
await chiama({ messaggio: "Errore aggiornamento tasks: permission denied", pagina: "calendario" }, "errore_app", "t");
verifica("con login: errore collegato all'utente", tabelle.app_errori.length === 2 && tabelle.app_errori[1].owner_id === UTENTE.id);

// 4 — testi troppo lunghi tagliati, messaggio vuoto rifiutato
await chiama({ messaggio: "x".repeat(1000), dettaglio: "y".repeat(5000) }, "errore_app", null);
const lungo = tabelle.app_errori[2];
verifica("testi tagliati (300 / 2000)", lungo && lungo.messaggio.length === 300 && lungo.dettaglio.length === 2000);
r = await chiama({ messaggio: "  " }, "errore_app", null);
verifica("messaggio vuoto: rifiutato", r.status === 400 && tabelle.app_errori.length === 3, String(r.status));

// 5 — errore del server (Supabase irraggiungibile → 503) finisce nella tabella
authGiu = true;
r = await chiama({ messaggio: "ciao" }, "assistant", "t");
authGiu = false;
const srv = tabelle.app_errori.find((e) => e.origine === "server");
verifica("errore del server (503): registrato come SERVER", r.status === 503 && srv && srv.pagina === "api:assistant" && /Impossibile contattare il database/.test(srv.messaggio), JSON.stringify(srv));

// 6 — pannello: chi non è admin non entra
r = await chiama(undefined, "admin_stato", "t", "GET");
verifica("admin_stato per un utente normale: admin false", r.status === 200 && r.corpo.admin === false, JSON.stringify(r.corpo));
r = await chiama(undefined, "admin_riepilogo", "t", "GET");
verifica("admin_riepilogo per un utente normale: 403, nessun dato", r.status === 403 && rpcChiamate.length === 0, JSON.stringify(r));
r = await chiama(undefined, "admin_riepilogo", null, "GET");
verifica("admin_riepilogo senza login: 401", r.status === 401);

// 7 — l'amministratore
tabelle.eon_admin.push({ user_id: ADMIN.id, errori_visti_fino: new Date(Date.now() - 86400000).toISOString() });
r = await chiama(undefined, "admin_stato", "admin", "GET");
verifica("admin_stato per Andrea: admin true e numero di errori nuovi", r.status === 200 && r.corpo.admin === true && r.corpo.errori_nuovi === tabelle.app_errori.length, JSON.stringify(r.corpo));
r = await chiama(undefined, "admin_riepilogo", "admin", "GET");
verifica("admin_riepilogo per Andrea: i numeri, con il suo id", r.status === 200 && r.corpo.totali && rpcChiamate.length === 1 && rpcChiamate[0].p_admin === ADMIN.id, JSON.stringify({ r, rpcChiamate }));
const primaVisti = tabelle.eon_admin[0].errori_visti_fino;
r = await chiama({}, "admin_errori_visti", "admin", "POST");
verifica("\"Segna come visti\": aggiorna la data", r.status === 200 && tabelle.eon_admin[0].errori_visti_fino > primaVisti, JSON.stringify(tabelle.eon_admin));
r = await chiama({}, "admin_errori_visti", "t", "POST");
verifica("un utente normale non può segnare niente", r.status === 403);

console.log(falliti ? `\n${falliti} controlli falliti.` : "\nTutti i controlli passati.");
if (falliti) process.exitCode = 1;
