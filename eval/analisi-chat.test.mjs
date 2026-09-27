/* Analisi della chat (27/09/2026, Gianardi): mandando una foto a Rita
   Ambrosini, EON ha riletto una chat di agosto ("ci vediamo mercoledì ore
   10?" — "Perfetto") e ha spostato da solo l'appuntamento di lunedì.
   Vero handler (api/index.js), database e AI finti:
   - una foto (messaggio senza testo) non fa partire niente, nemmeno l'AI;
   - un messaggio vecchio non fa partire niente;
   - cose dette PRIMA che l'appuntamento fosse fissato non lo spostano;
   - stessa data: niente da spostare;
   - si fa qualcosa solo se il messaggio appena arrivato è la proposta o la
     risposta (un "grazie" di oggi non riporta in vita frasi di agosto);
   - ma uno spostamento vero, proposto e confermato adesso, funziona ancora.
   Uso:  node eval/analisi-chat.test.mjs */

process.env.SUPABASE_URL = "https://finto.supabase.co";
process.env.SUPABASE_ANON_KEY = "anon-finta";
process.env.SUPABASE_SERVICE_ROLE_KEY = "service-finta";
process.env.ANTHROPIC_API_KEY = "chiave-finta";

const IO = "11111111-1111-4111-8111-111111111111";
const CHAT = "33333333-3333-4333-8333-333333333333";
const APPT = "29a870a6-d4e9-49b5-a306-4de10161fbbb";
const ora = Date.now();
const fa = (min) => new Date(ora - min * 60000).toISOString();

let tabelle, scritture, chiamateAI, rispostaAI;
function prepara(messaggi) {
  tabelle = {
    conversations: [{ id: CHAT, owner_id: IO, contact_name: "Rita Ambrosini", deleted_at: null }],
    clients: [{ id: "c1", owner_id: IO, name: "Rita Ambrosini", status: "attivo", value: 0, deleted_at: null }],
    tasks: [],
    messages: [
      { id: APPT, conversation_id: CHAT, sender: "me", event_type: "appt", title: "Appuntamento con Rita Ambrosini", body: "lun 28 set, 11:00", scheduled_at: "2026-09-28T11:00:00", created_at: fa(13 * 60), deleted_at: null },
      ...messaggi.map((m, i) => ({ id: "m" + i, conversation_id: CHAT, event_type: null, title: null, scheduled_at: null, deleted_at: null, ...m })),
    ],
  };
  scritture = []; chiamateAI = 0;
}
const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json" } });
globalThis.fetch = async (url, init = {}) => {
  const u = new URL(String(url));
  const auth = (init.headers && (init.headers.Authorization || init.headers.authorization)) || "";
  if (u.pathname === "/auth/v1/user") return auth === "Bearer tok-io" ? json({ id: IO }) : json({ msg: "no" }, 401);
  if (u.pathname.startsWith("/rest/v1/")) {
    const t = u.pathname.replace("/rest/v1/", "");
    const metodo = init.method || "GET";
    if (metodo !== "GET") { scritture.push({ t, metodo, url: String(url), body: init.body ? JSON.parse(init.body) : null }); return json(metodo === "POST" ? [{ id: "nuovo", ...(init.body ? JSON.parse(init.body) : {}) }] : []); }
    let righe = (tabelle[t] || []).slice();
    let ordine = null, limite = null;
    for (const [k, v] of u.searchParams.entries()) {
      if (k === "select") continue;
      if (k === "order") { ordine = v; continue; }
      if (k === "limit") { limite = Number(v); continue; }
      if (v === "is.null") righe = righe.filter((r) => r[k] == null);
      else if (v.startsWith("eq.")) righe = righe.filter((r) => String(r[k]) === decodeURIComponent(v.slice(3)));
      else if (v.startsWith("neq.")) righe = righe.filter((r) => String(r[k]) !== v.slice(4));
    }
    if (ordine) { const [c, dir] = ordine.split("."); righe.sort((a, b) => (a[c] < b[c] ? -1 : 1) * (dir === "desc" ? -1 : 1)); }
    if (limite) righe = righe.slice(0, limite);
    return json(righe);
  }
  if (String(url).startsWith("https://api.anthropic.com/")) {
    chiamateAI++;
    return json({ id: "m", type: "message", role: "assistant", model: "x", usage: { input_tokens: 1, output_tokens: 1 }, content: [{ type: "text", text: JSON.stringify(rispostaAI) }], stop_reason: "end_turn" });
  }
  throw new Error("fetch non prevista: " + url);
};
const { default: handler } = await import("../api/index.js");
async function analizza() {
  const req = { method: "POST", url: "/api?action=analizza_messaggio", headers: { origin: "https://eonbeckend.vercel.app", authorization: "Bearer tok-io" }, body: { conversation_id: CHAT } };
  let uscita = "", stato = 0;
  await handler(req, { statusCode: 0, setHeader() {}, end(d) { uscita = d || ""; stato = this.statusCode; } });
  return { stato, corpo: uscita ? JSON.parse(uscita) : null };
}
const spostato = () => scritture.some((w) => w.t === "messages" && w.metodo === "PATCH" && w.url.includes(APPT));
let falliti = 0;
function verifica(d, ok, det) { console.log(`  ${ok ? "OK  " : "FAIL"} ${d}${ok || det === undefined ? "" : "  — " + det}`); if (!ok) falliti++; }

/* L'AI (finta) sbaglia sempre allo stesso modo: "sposta a giovedì 1 ottobre
   alle 10", proposta al messaggio 1 e confermata al 2 */
const SPOSTA = { appuntamento: { azione: "sposta", quando_iso: "2026-10-01T10:00:00", titolo: null, messaggioProposta: 1, messaggioConferma: 2 } };
const AGOSTO = [
  { sender: "me", body: "Ciao Rita ci vediamo mercoledì ore 10?", created_at: fa(54 * 24 * 60) },
  { sender: "them", body: "Perfetto", created_at: fa(54 * 24 * 60 - 1) },
];

// 1. Il caso di Rita: la foto appena mandata
prepara([...AGOSTO, { sender: "me", body: "", file_url: "x.jpg", created_at: fa(0) }]);
rispostaAI = SPOSTA;
let r = await analizza();
verifica("una foto appena mandata: niente AI, niente spostamento", r.stato === 200 && chiamateAI === 0 && !spostato() && r.corpo.azioni.length === 0, JSON.stringify({ r, chiamateAI, scritture }));

// 2. L'ultimo messaggio è vecchio
prepara(AGOSTO);
r = await analizza();
verifica("l'ultimo messaggio è di agosto: niente AI, niente spostamento", chiamateAI === 0 && !spostato(), JSON.stringify({ chiamateAI, scritture }));

// 3. Un "grazie" di adesso, ma la proposta era di agosto (prima dell'appuntamento)
prepara([...AGOSTO, { sender: "them", body: "Grazie per la foto", created_at: fa(0) }]);
r = await analizza();
verifica("cose dette prima che l'appuntamento fosse fissato non lo spostano", !spostato(), JSON.stringify(scritture));

// 4. Stessa data dell'appuntamento: niente da spostare
prepara([{ sender: "me", body: "Confermiamo lunedì alle 11?", created_at: fa(2) }, { sender: "them", body: "Sì", created_at: fa(0) }]);
rispostaAI = { appuntamento: { azione: "sposta", quando_iso: "2026-09-28T11:00:00", titolo: null, messaggioProposta: 1, messaggioConferma: 2 } };
r = await analizza();
verifica("stessa data e stesso titolo: non si tocca", chiamateAI === 1 && !spostato() && r.corpo.azioni.length === 0, JSON.stringify({ r, scritture }));

// 5. Nessun appuntamento: un "grazie" di adesso non trasforma lo scambio di agosto in un appuntamento
prepara([...AGOSTO, { sender: "them", body: "Grazie mille", created_at: fa(0) }]);
tabelle.messages = tabelle.messages.filter((m) => m.id !== APPT);
rispostaAI = { appuntamento: { azione: "nuovo", quando_iso: "2026-09-30T10:00:00", titolo: "Incontro", messaggioProposta: 1, messaggioConferma: 2 } };
r = await analizza();
verifica("un \"grazie\" di oggi non crea un appuntamento da frasi vecchie", !scritture.some((w) => w.t === "messages" && w.metodo === "POST"), JSON.stringify(scritture));

// 6. Un appuntamento nuovo, proposto e confermato adesso: si crea ancora
prepara([{ sender: "me", body: "Ci vediamo mercoledì alle 10?", created_at: fa(2) }, { sender: "them", body: "Perfetto", created_at: fa(0) }]);
tabelle.messages = tabelle.messages.filter((m) => m.id !== APPT);
r = await analizza();
verifica("appuntamento proposto e confermato adesso: si crea", scritture.some((w) => w.t === "messages" && w.metodo === "POST" && w.body && w.body.event_type === "appt"), JSON.stringify(scritture));

// 7. Uno spostamento vero, adesso: funziona ancora
prepara([...AGOSTO, { sender: "me", body: "Rita, possiamo spostare a giovedì alle 10?", created_at: fa(3) }, { sender: "them", body: "Va benissimo", created_at: fa(0) }]);
rispostaAI = { appuntamento: { azione: "sposta", quando_iso: "2026-10-01T10:00:00", titolo: null, messaggioProposta: 3, messaggioConferma: 4 } };
r = await analizza();
verifica("spostamento proposto e confermato adesso: l'appuntamento si sposta", spostato() && r.corpo.azioni.length === 1 && r.corpo.azioni[0].tool === "sposta_impegno", JSON.stringify({ r, scritture }));

console.log(falliti ? `\n${falliti} controlli falliti.` : "\nTutti i controlli passati.");
if (falliti) process.exitCode = 1;
