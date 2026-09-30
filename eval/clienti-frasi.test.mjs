/* Clienti e frasi col codice (28/09/2026), lato server:
   - "Sentire Machi alle 10:00 e vai da Spruzzo alle 17. Ah e cancella
     appuntamento di domani alle 11:30 con Pierini": divisa e fatta dal
     codice, con un riepilogo; se un pezzo non è chiaro → motore completo;
   - "Devo chiamare Machi" → da fare nella scheda di Machi;
   - nome simile ("Macchi") → "Intendi Alessio Machi?", "sì" lo segna;
   - fino a 8 omonimi → "Quale intendi?" con i nomi;
   - "assemblea in via Roma 12 giovedì alle 21" → assemblea vera (amministratore).
   Gira senza chiavi e senza rete: vero handler, database e AI finti.
   Uso:  node eval/clienti-frasi.test.mjs */

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
      if (v.startsWith("gte.")) { if (!(String(r[k]) >= v.slice(4))) return false; continue; }
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

let chiamateAI = [];
function anthropicFinto(init) {
  const corpo = JSON.parse(init.body);
  chiamateAI.push(corpo);
  return rispostaJson({ id: "msg_finto", type: "message", role: "assistant", model: corpo.model, usage: { input_tokens: 10, output_tokens: 5 }, content: [{ type: "text", text: "Ok." }], stop_reason: "end_turn" });
}
globalThis.fetch = async (url, init) => {
  const s = String(url);
  if (s.startsWith("https://api.anthropic.com/")) return anthropicFinto(init);
  if (s.startsWith(process.env.SUPABASE_URL + "/auth/v1/user")) return rispostaJson(UTENTE);
  if (s.startsWith(process.env.SUPABASE_URL + "/rest/v1/")) return postgrest(s, init);
  throw new Error("fetch non prevista nel test: " + s);
};
const { default: handler } = await import("../api/index.js");
async function chiedi(testo, extra) {
  const req = { method: "POST", url: "/api?action=assistant", headers: { authorization: "Bearer token-finto" },
    body: { messaggio: `Il professionista ti ha appena raccontato cosa deve fare: "${testo}"`, ...(extra || {}) } };
  let uscita = "";
  const res = { statusCode: 0, setHeader() {}, end(d) { uscita = d || ""; } };
  await handler(req, res);
  return { status: res.statusCode, corpo: uscita ? JSON.parse(uscita) : null };
}
async function rispondi(runId, testo) {
  const req = { method: "POST", url: "/api?action=assistant", headers: { authorization: "Bearer token-finto" }, body: { runId, messaggio: testo } };
  let uscita = "";
  const res = { statusCode: 0, setHeader() {}, end(d) { uscita = d || ""; } };
  await handler(req, res);
  return { status: res.statusCode, corpo: uscita ? JSON.parse(uscita) : null };
}
let falliti = 0;
function verifica(descrizione, condizione, dettaglio) {
  console.log(`  ${condizione ? "OK  " : "FAIL"} ${descrizione}${condizione || dettaglio === undefined ? "" : "  — " + dettaglio}`);
  if (!condizione) falliti++;
}
const roma = (d) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
const domani = roma(new Date(Date.now() + 86400000));
const oraAdesso = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Rome", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date());
function preparaDb() {
  databaseVuoto();
  tabelle.tasks = []; tabelle.conversations = []; tabelle.messages = []; tabelle.assemblee = [];
  tabelle.profiles.push({ id: UTENTE.id, profession: "edile" });
  aggiungiCliente("Alessio Machi");
  aggiungiCliente("Spruzzo");
  aggiungiCliente("Mario Pierini");
  tabelle.tasks.push({ id: randomUUID(), owner_id: UTENTE.id, title: "Appuntamento con Pierini", scheduled_at: `${domani}T11:30:00`, status: "todo", deleted_at: null, time: "domani 11:30" });
  chiamateAI = [];
}

console.log("\n=== Più comandi in una frase ===");
preparaDb();
let r = await chiedi("Sentire Machi alle 10:00 e vai da Spruzzo alle 17. Ah e cancella appuntamento di domani alle 11:30 con Pierini");
const azioni = (r.corpo && r.corpo.azioni) || [];
const creati = azioni.filter((a) => a.tool === "crea_impegno").map((a) => a.esito.titolo);
const eliminati = azioni.filter((a) => a.tool === "elimina_impegno").map((a) => a.esito.titolo);
verifica("la frase di Andrea: 2 impegni + 1 cancellazione, zero AI, con riepilogo", r.status === 200 && chiamateAI.length === 0 && creati.length === 2 && eliminati.length === 1 && Array.isArray(r.corpo.riepilogo) && r.corpo.riepilogo.length === 3, JSON.stringify({ creati, eliminati, ai: chiamateAI.length, testo: r.corpo && r.corpo.testo }));
verifica("i nomi dei clienti riconosciuti: \"Chiamare Alessio Machi\", Spruzzo; Pierini cancellato", creati.some((t) => /Alessio Machi/.test(t)) && creati.some((t) => /Spruzzo/.test(t)) && /Pierini/.test(eliminati[0] || ""), JSON.stringify({ creati, eliminati }));
verifica("Pierini è nel cestino", tabelle.tasks.find((t) => /Pierini/.test(t.title)).deleted_at !== null);
const conOra10 = r.corpo.riepilogo.find((x) => /Machi/.test(x)) || "";
verifica("\"alle 10\" senza giorno: oggi, o domani se le 10 sono già passate (e lo dice)", oraAdesso < "10:00" ? !/domani/.test(conOra10) : /domani/.test(conOra10), conOra10 + " (ora " + oraAdesso + ")");

preparaDb();
r = await chiedi("Sentire Machi alle 10:00 e poi porte e finestre per Rossi");
verifica("un pezzo non chiaro: niente fatto dal codice, tutta la frase al motore completo", !(r.corpo.riepilogo) && !tabelle.tasks.some((t) => /Machi/.test(t.title)), JSON.stringify(r.corpo));

console.log("\n=== Clienti ===");
preparaDb();
r = await chiedi("Devo chiamare Machi");
const daFare = tabelle.cantiere_appunti && tabelle.cantiere_appunti[0];
verifica("\"Devo chiamare Machi\" → da fare nella scheda di Alessio Machi, senza AI", chiamateAI.length === 0 && daFare && daFare.da_fare === true && daFare.client_id === tabelle.clients[0].id && daFare.testo === "Chiamare Machi", JSON.stringify({ daFare, ai: chiamateAI.length }));

preparaDb();
r = await chiedi("chiamata Macchi domani alle 10");
verifica("nome simile (\"Macchi\"): \"Intendi Alessio Machi?\" con Sì e No, senza AI", chiamateAI.length === 0 && r.corpo.testo === "Intendi Alessio Machi?" && JSON.stringify(r.corpo.scelte) === '["Sì","No"]' && r.corpo.runId, JSON.stringify(r.corpo));
const run1 = r.corpo.runId;
r = await rispondi(run1, "Sì");
verifica("\"sì\": segnato con Alessio Machi, sempre senza AI", chiamateAI.length === 0 && (r.corpo.azioni || []).some((a) => a.tool === "crea_impegno"), JSON.stringify(r.corpo));

preparaDb();
for (const cognome of ["Rossi", "Bianchi", "Verdi", "Neri", "Gialli"]) aggiungiCliente("Alessio " + cognome);
r = await chiedi("chiamata Alessio domani alle 10");
verifica("6 Alessio: \"Quale intendi?\" con i 6 nomi da toccare, senza AI", chiamateAI.length === 0 && /Quale intendi\?/.test(r.corpo.testo) && (r.corpo.scelte || []).length === 6, JSON.stringify(r.corpo));
r = await rispondi(r.corpo.runId, "Verdi");
verifica("risposta \"Verdi\": segnato con Alessio Verdi", (r.corpo.azioni || []).some((a) => a.tool === "crea_impegno" && /Alessio Verdi/.test(a.esito.titolo)), JSON.stringify(r.corpo));

console.log("\n=== Assemblee ===");
preparaDb();
tabelle.profiles[0].profession = "amministratore";
// il giorno detto non è mai oggi (con "giovedì" detto di giovedì decide l'AI): la prova non dipende dal giorno in cui gira
const oggiRoma = new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Rome", weekday: "short" }).format(new Date());
const giornoAssemblea = oggiRoma === "Thu" ? "venerdì" : "giovedì";
r = await chiedi(`assemblea in via Roma 12 ${giornoAssemblea} alle 21`);
const a = tabelle.assemblee[0];
verifica(`amministratore: "assemblea in via Roma 12 ${giornoAssemblea} alle 21" → assemblea vera, senza AI`, chiamateAI.length === 0 && a && a.condominio === "Via Roma 12" && /T21:00:00$/.test(a.quando) && a.tipo === "ordinaria" && (r.corpo.azioni || [])[0].tool === "crea_assemblea", JSON.stringify({ a, testo: r.corpo.testo }));
preparaDb();
tabelle.profiles[0].profession = "amministratore";
r = await chiedi("assemblea straordinaria condominio Parco Verde domani ore 18");
verifica("straordinaria, \"condominio Parco Verde\"", tabelle.assemblee[0] && tabelle.assemblee[0].tipo === "straordinaria" && tabelle.assemblee[0].condominio === "Parco Verde", JSON.stringify(tabelle.assemblee));
preparaDb();
r = await chiedi("assemblea in via Roma 12 giovedì alle 21");
verifica("un edile che dice \"assemblea…\": niente assemblea", !tabelle.assemblee.length);

console.log(falliti ? `\n${falliti} controlli falliti` : "\nTutto ok");
process.exit(falliti ? 1 : 0);
