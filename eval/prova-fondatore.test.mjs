/* "Prova come…" del fondatore (28/09/2026), lato server: il mestiere scelto
   per la prova (prova_professione) cambia il prompt dell'AI SOLO se
   l'account è in eon_admin. Per tutti gli altri si ignora: resta il
   mestiere del profilo (Andrea: "solo per me deve valere").
   Gira senza chiavi e senza rete: vero handler, database e AI finti.
   Uso:  node eval/prova-fondatore.test.mjs */

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

/* ---------- AI finta: risponde sempre "Ok." e si segna cosa ha ricevuto ---------- */
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
let falliti = 0;
function verifica(descrizione, condizione, dettaglio) {
  console.log(`  ${condizione ? "OK  " : "FAIL"} ${descrizione}${condizione || dettaglio === undefined ? "" : "  — " + dettaglio}`);
  if (!condizione) falliti++;
}
const testoSystem = (c) => (Array.isArray(c.system) ? c.system.map((b) => b.text || "").join("\n") : String(c.system || ""));
const PACK_IDRAULICO = "Questo professionista è un idraulico";
const FRASE = "come va il lavoro questo mese secondo te";
const conPack = () => chiamateAI.some((c) => testoSystem(c).includes(PACK_IDRAULICO));

console.log("\n=== Prova come… solo per il fondatore ===");
databaseVuoto();
tabelle.profiles.push({ id: UTENTE.id, profession: "artigiano" });

chiamateAI = [];
let r = await chiedi(FRASE);
verifica("cliente normale, senza prova: nessun pack idraulico", r.status === 200 && chiamateAI.length > 0 && !conPack(), JSON.stringify({ status: r.status, n: chiamateAI.length }));

chiamateAI = [];
r = await chiedi(FRASE, { prova_professione: "idraulico" });
verifica("cliente NON fondatore che manda prova_professione: ignorata, resta il suo mestiere", r.status === 200 && chiamateAI.length > 0 && !conPack(), JSON.stringify({ status: r.status }));

tabelle.eon_admin = [{ user_id: UTENTE.id, errori_visti_fino: new Date(0).toISOString() }];
chiamateAI = [];
r = await chiedi(FRASE, { prova_professione: "idraulico" });
verifica("fondatore (eon_admin) in prova come idraulico: l'AI riceve il pack idraulico", r.status === 200 && conPack(), JSON.stringify({ status: r.status, n: chiamateAI.length }));

chiamateAI = [];
r = await chiedi(FRASE, { prova_professione: "avvocato" });
verifica("mestiere di prova non previsto (avvocato): ignorato", r.status === 200 && !chiamateAI.some((c) => testoSystem(c).includes("avvocato")), "");

verifica("il profilo non è mai cambiato", tabelle.profiles[0].profession === "artigiano", tabelle.profiles[0].profession);

console.log(falliti ? `\n${falliti} controlli falliti` : "\nTutto ok");
process.exit(falliti ? 1 : 0);
