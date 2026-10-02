/* Il lettore unico, lato server (29/09/2026): i "comandi già letti"
   dall'app (lettore.js) li esegue il codice, senza AI.
   - documento per un cliente noto o NUOVO ("fattura da 10.000 a Chilosi
     Mariagrazie per progetto seconda casa") → cliente creato + fattura;
   - messaggio al cliente, anche come domanda con giorno e ora ("scrivi a
     Rita se va bene domani alle 18") → appuntamento da confermare + messaggio;
   - un comando con dati che non tornano → come prima (percorsi/AI).
   Gira senza chiavi e senza rete: vero handler, database e AI finti.
   Uso:  node eval/lettore-server.test.mjs */
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
  tabelle.tasks = []; tabelle.conversations = []; tabelle.messages = [];
  tabelle.profiles.push({ id: UTENTE.id, profession: "edile" });
  chiamateAI = [];
}
const ultimaRiga = () => tabelle.ai_request_log[tabelle.ai_request_log.length - 1] || {};

console.log("\n=== Documento già letto dall'app ===");
preparaDb();
const rita = aggiungiCliente("Rita Ambrosini");
let r = await chiedi("Crea preventivo da 20.000 per ristrutturazione bagno e mandalo a Rita Ambrosini", { comando: { azione: "documento", tipo: "preventivo", cliente_id: rita.id, importo: 20000, lavoro: "Ristrutturazione bagno" } });
let doc = (r.corpo && r.corpo.azioni || []).find((a) => a.tool === "crea_preventivo_o_fattura");
verifica("preventivo per Rita col codice: zero AI, voce giusta", r.status === 200 && chiamateAI.length === 0 && doc && doc.esito.cliente === "Rita Ambrosini" && doc.esito.dati.voci[0].desc === "Ristrutturazione bagno" && doc.esito.dati.voci[0].prezzo === 20000, JSON.stringify({ ai: chiamateAI.length, corpo: r.corpo }).slice(0, 300));
verifica("registro: modello \"codice\", 0 giri", ultimaRiga().modello === "codice" && ultimaRiga().giri === 0, JSON.stringify(ultimaRiga()).slice(0, 200));

preparaDb();
r = await chiedi("Fai fattura da 10.000 a Chilosi mariagrazie per progetto seconda casa in campagna", { comando: { azione: "documento", tipo: "fattura", nuovo_cliente: "Chilosi Mariagrazie", importo: 10000, lavoro: "Progetto seconda casa in campagna" } });
const azioni = (r.corpo && r.corpo.azioni) || [];
doc = azioni.find((a) => a.tool === "crea_preventivo_o_fattura");
const nuovo = azioni.find((a) => a.tool === "trova_o_crea_cliente");
verifica("cliente nuovo creato e fattura fatta, zero AI", chiamateAI.length === 0 && nuovo && nuovo.esito.creato && tabelle.clients.some((c) => c.name === "Chilosi Mariagrazie") && doc && doc.esito.titolo.startsWith("Fattura"), JSON.stringify({ ai: chiamateAI.length, azioni: azioni.map((a) => a.tool), clienti: tabelle.clients.map((c) => c.name) }));
verifica("la fattura finisce anche nelle entrate da incassare", tabelle.incomes.length === 1 && Number(tabelle.incomes[0].amount) > 0, JSON.stringify(tabelle.incomes));
verifica("il testo dice che il cliente è nuovo", /cliente nuovo/.test(r.corpo.testo || ""), r.corpo && r.corpo.testo);

preparaDb();
aggiungiCliente("Chilosi Mariagrazie");
r = await chiedi("fattura Chilosi 500 per porta", { comando: { azione: "documento", tipo: "fattura", nuovo_cliente: "Chilosi Mariagrazie", importo: 500, lavoro: "Porta" } });
verifica("\"cliente nuovo\" che invece c'è già: nessun doppione", tabelle.clients.length === 1 && chiamateAI.length === 0 && ((r.corpo.azioni || []).find((a) => a.tool === "trova_o_crea_cliente") || {}).esito.creato === false, JSON.stringify(tabelle.clients.map((c) => c.name)));

preparaDb();
aggiungiCliente("Rita Ambrosini");
r = await chiedi("fattura Rita", { comando: { azione: "documento", tipo: "fattura", cliente_id: tabelle.clients[0].id, importo: 0, lavoro: "Porta" } });
verifica("importo che non torna: niente dal codice, prosegue come prima (AI)", chiamateAI.length >= 1 && !tabelle.messages.some((m) => m.event_type === "doc"), JSON.stringify({ ai: chiamateAI.length }));

preparaDb();
r = await chiedi("fattura a un cliente di un altro", { comando: { azione: "documento", tipo: "fattura", cliente_id: "22222222-2222-4222-8222-222222222222", importo: 100, lavoro: "Porta" } });
verifica("cliente che non esiste (o non è suo): niente dal codice", !tabelle.messages.some((m) => m.event_type === "doc"), JSON.stringify(tabelle.messages));

console.log("\n=== Messaggio già letto dall'app ===");
preparaDb();
const rita2 = aggiungiCliente("Rita Ambrosini");
r = await chiedi("Scrivi a Rita Ambrosini se va bene domani alle 18:00 in ufficio", { comando: { azione: "messaggio", cliente_id: rita2.id, testo: "Va bene domani alle 18:00 in ufficio?" } });
let msg = (r.corpo.azioni || []).find((a) => a.tool === "manda_messaggio");
let imp = (r.corpo.azioni || []).find((a) => a.tool === "crea_impegno");
verifica("domanda con giorno e ora: appuntamento da confermare domani 18:00 + messaggio, zero AI", chiamateAI.length === 0 && !!imp && /18:00/.test(imp.esito.quando_visualizzato || "") && /da confermare/.test(imp.esito.titolo || ""), JSON.stringify({ ai: chiamateAI.length, imp: imp && imp.esito }).slice(0, 300));
verifica("il messaggio è una domanda naturale", msg && msg.esito.testo === "Ciao Rita, va bene domani alle 18:00 in ufficio?", msg && msg.esito.testo);

preparaDb();
const andrea = aggiungiCliente("andrearinaldo Gianardi");
r = await chiedi("Manda messaggio a Gianardi chiedendo chiarimenti su ultimo report", { comando: { azione: "messaggio", cliente_id: andrea.id, testo: "Ti chiedo chiarimenti sull'ultimo report." } });
msg = (r.corpo.azioni || []).find((a) => a.tool === "manda_messaggio");
verifica("messaggio senza orario: solo il messaggio, zero AI", chiamateAI.length === 0 && msg && msg.esito.testo === "Ciao andrearinaldo, ti chiedo chiarimenti sull'ultimo report." && !(r.corpo.azioni || []).some((a) => a.tool === "crea_impegno"), msg && msg.esito.testo);

preparaDb();
aggiungiCliente("Rita Ambrosini");
// un giorno che non è né oggi né domani (detto di venerdì, "venerdì" è ambiguo: la prova dipendeva dal giorno)
const GIORNO_RITA = ["domenica", "lunedì", "martedì", "mercoledì", "giovedì", "venerdì", "sabato"][(new Date().getDay() + 3) % 7];
r = await chiedi("di a Rita che ci vediamo " + GIORNO_RITA + " ore 18 da lei");
msg = (r.corpo.azioni || []).find((a) => a.tool === "manda_messaggio");
verifica("\"di' a Rita che…\" come prima (percorso rapido)", chiamateAI.length === 0 && msg && new RegExp("^Ciao Rita, ci vediamo " + GIORNO_RITA + " ore 18 da lei \\(.+\\)\\. Mi confermi\\?$").test(msg.esito.testo), msg && msg.esito.testo);

console.log(falliti ? `\n${falliti} controlli falliti` : "\nTutti i controlli passati.");
process.exit(falliti ? 1 : 0);
