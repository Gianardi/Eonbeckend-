/* Un appunto va in una cartella solo se l'utente la nomina (30/09/2026, tester:
   "dopo che registro a volte mi dice «In MD via Roma 37»" — l'AI ci metteva
   appunti che non c'entravano). Se l'AI sceglie una cartella che nella frase non
   c'è, l'appunto resta nella Mente; se la frase la nomina, va nella cartella.
   Uso:  node eval/appunto-cartella.test.mjs */

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
      if (v.startsWith("in.(")) { if (!v.slice(4, -1).split(",").includes(String(r[k]))) return false; continue; }
      if (v.startsWith("gte.")) { if (r[k] == null || String(r[k]) < v.slice(4)) return false; continue; }
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
let cartellaDaAI = null;
globalThis.fetch = async (url, init) => {
  const s = String(url);
  if (s.startsWith("https://api.anthropic.com/")) {
    const corpo = JSON.parse(init.body);
    chiamateAI.push(corpo); if (process.env.DEBUG) console.log("AI", JSON.stringify(corpo.tool_choice), (corpo.tools || []).map((t) => t.name).join(","), corpo.messages.length);
    const nome = corpo.tool_choice && corpo.tool_choice.name;
    const giaFatto = corpo.messages.some((m) => Array.isArray(m.content) && m.content.some((c) => c.type === "tool_result" && c.tool_use_id === "t3"));
    const content = nome === "leggi_impegno" ? [{ type: "tool_use", id: "t1", name: "leggi_impegno", input: { azione: "altro" } }]
      : nome === "interpreta_richiesta" ? [{ type: "tool_use", id: "t2", name: "interpreta_richiesta", input: { operazione: "crea", oggetto: "azione" } }]
      : nome ? [{ type: "text", text: "Ok." }]
      : !giaFatto ? [{ type: "tool_use", id: "t3", name: "crea_appunto", input: { testo: "Il portone del condominio va verniciato", cartella: cartellaDaAI } }]
      : [{ type: "text", text: "Fatto." }];
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
const appunti = () => (tabelle.cantiere_appunti || []);
const conCartella = () => { tabelle.cartelle = [{ id: "k1", owner_id: UTENTE.id, nome: "MD via Roma 37", deleted_at: null }]; };

// 1. L'AI sceglie la cartella, ma la frase non la nomina: resta nella Mente
databaseVuoto(); conCartella(); chiamateAI = []; cartellaDaAI = "MD via Roma 37";
let r = await chiama({ messaggio: "annota che il portone del condominio va verniciato prima dell'inverno perché si sta rovinando" });
let a = appunti()[0] || {};
verifica("frase senza la cartella: l'appunto resta nella Mente (niente \"In MD via Roma 37\")",
  chiamateAI.length >= 1 && appunti().length === 1 && !a.cartella_id && !(r.corpo.azioni || []).some((x) => x.esito && x.esito.cartella), JSON.stringify({ ai: chiamateAI.length, a, az: r.corpo && r.corpo.azioni }));

// 2. La frase nomina la cartella: va nella cartella
databaseVuoto(); conCartella(); chiamateAI = []; cartellaDaAI = "MD via Roma 37";
r = await chiama({ messaggio: "annota in MD via Roma 37 che il portone del condominio va verniciato prima dell'inverno perché si sta rovinando" });
a = appunti()[0] || {};
verifica("frase che nomina la cartella: l'appunto va in \"MD via Roma 37\"", appunti().length === 1 && a.cartella_id === "k1", JSON.stringify({ a, az: r.corpo && r.corpo.azioni }));

// 3. L'AI non sceglie cartelle: come prima
databaseVuoto(); conCartella(); chiamateAI = []; cartellaDaAI = undefined;
await chiama({ messaggio: "annota che il portone del condominio va verniciato prima dell'inverno perché si sta rovinando" });
a = appunti()[0] || {};
verifica("senza cartella: nella Mente come prima", appunti().length === 1 && !a.cartella_id, JSON.stringify(a));

console.log(falliti ? `\n${falliti} controlli falliti.` : "\nTutti i controlli passati.");
if (falliti) process.exitCode = 1;
