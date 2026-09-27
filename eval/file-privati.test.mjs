/* File privati (27/09/2026): il server dà i link a scadenza SOLO a chi ne ha
   diritto. Vero handler (api/index.js), database e storage finti.
   - l'utente: i suoi file (cartella con il suo id) e quelli mandati dai suoi
     clienti nelle sue chat (clienti/<id chat>/…); mai quelli di un altro;
   - la pagina del cliente, con il codice del suo link: solo i file della sua
     chat (caricati da lui o mandati nella chat), mai altri;
   - link di 1 ora nell'app, 7 giorni per condividere;
   - descrivi_foto: all'AI un link firmato di 5 minuti, non l'indirizzo pubblico.
   Uso:  node eval/file-privati.test.mjs */

process.env.SUPABASE_URL = "https://finto.supabase.co";
process.env.SUPABASE_ANON_KEY = "anon-finta";
process.env.SUPABASE_SERVICE_ROLE_KEY = "service-finta";
process.env.ANTHROPIC_API_KEY = "chiave-finta";

const IO = "11111111-1111-4111-8111-111111111111";
const ALTRO = "22222222-2222-4222-8222-222222222222";
const CHAT_MIA = "33333333-3333-4333-8333-333333333333";
const CHAT_ALTRUI = "44444444-4444-4444-8444-444444444444";
const CODICE = "codice-lungo-del-link-1234567890";
const PUB = "https://finto.supabase.co/storage/v1/object/public/eon-files/";

const tabelle = {
  conversations: [
    { id: CHAT_MIA, owner_id: IO, access_code: CODICE, deleted_at: null },
    { id: CHAT_ALTRUI, owner_id: ALTRO, access_code: "altro-codice-lungo-0987654321", deleted_at: null },
  ],
  messages: [
    { conversation_id: CHAT_MIA, file_url: PUB + IO + "/preventivo.pdf", body: "", deleted_at: null },
    { conversation_id: CHAT_MIA, file_url: null, body: "Ti mando la foto: " + PUB + IO + "/cantiere/foto/bagno.jpg", deleted_at: null },
  ],
  cantiere_foto: [{ id: "55555555-5555-4555-8555-555555555555", owner_id: IO, url: PUB + IO + "/cantiere/foto/bagno.jpg", descrizione: null, deleted_at: null }],
};
let firmeChieste = [], aiImmagini = [];
const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json" } });
globalThis.fetch = async (url, init = {}) => {
  const u = new URL(String(url));
  const auth = (init.headers && (init.headers.Authorization || init.headers.authorization)) || "";
  const servizio = auth === "Bearer service-finta";
  if (u.pathname === "/auth/v1/user") return auth === "Bearer tok-io" ? json({ id: IO }) : json({ msg: "no" }, 401);
  if (u.pathname === "/storage/v1/object/sign/eon-files") {
    const b = JSON.parse(init.body);
    firmeChieste.push(b);
    return json(b.paths.map((p) => ({ path: p, signedURL: `/object/sign/eon-files/${p}?token=t${b.expiresIn}`, error: null })));
  }
  if (u.pathname.startsWith("/rest/v1/")) {
    const t = u.pathname.replace("/rest/v1/", "");
    let righe = (tabelle[t] || []).slice();
    if (!servizio && righe.length && "owner_id" in righe[0]) righe = righe.filter((r) => r.owner_id === IO); // RLS
    for (const [k, v] of u.searchParams.entries()) {
      if (["select", "limit", "order"].includes(k)) continue;
      if (v === "is.null") righe = righe.filter((r) => r[k] == null);
      else if (v.startsWith("eq.")) righe = righe.filter((r) => String(r[k]) === v.slice(3));
      else if (v.startsWith("in.(")) { const l = v.slice(4, -1).split(","); righe = righe.filter((r) => l.includes(String(r[k]))); }
    }
    if ((init.method || "GET") === "PATCH") return json([]);
    return json(righe);
  }
  if (String(url).startsWith("https://api.anthropic.com/")) {
    const b = JSON.parse(init.body);
    aiImmagini.push(b.messages[0].content[0].source);
    return json({ id: "m", type: "message", role: "assistant", model: "x", usage: { input_tokens: 1, output_tokens: 1 }, content: [{ type: "text", text: "Lavabo bianco" }], stop_reason: "end_turn" });
  }
  throw new Error("fetch non prevista: " + url);
};
const { default: handler } = await import("../api/index.js");
async function chiama(action, body, token) {
  const headers = { origin: "https://eonbeckend.vercel.app" };
  if (token) headers.authorization = "Bearer " + token;
  const req = { method: "POST", url: "/api?action=" + action, headers, body };
  let uscita = "", stato = 0;
  await handler(req, { statusCode: 0, setHeader() {}, end(d) { uscita = d || ""; stato = this.statusCode; } });
  return { stato, corpo: uscita ? JSON.parse(uscita) : null };
}
let falliti = 0;
function verifica(d, ok, det) { console.log(`  ${ok ? "OK  " : "FAIL"} ${d}${ok || det === undefined ? "" : "  — " + det}`); if (!ok) falliti++; }

const MIO = PUB + IO + "/cantiere/foto/bagno.jpg";
const MIO_LOGO = PUB + IO + "/intestazione/logo.png?v=123";
const DAL_CLIENTE = PUB + "clienti/" + CHAT_MIA + "/foto-rubinetto.jpg";
const DI_ALTRI = PUB + ALTRO + "/cantiere/foto/segreta.jpg";
const CHAT_DI_ALTRI = PUB + "clienti/" + CHAT_ALTRUI + "/x.jpg";
const TRUCCO = PUB + IO + "/../" + ALTRO + "/x.jpg";

// 1. L'utente
let r = await chiama("firma_file", { urls: [MIO, MIO_LOGO, DAL_CLIENTE, DI_ALTRI, CHAT_DI_ALTRI, TRUCCO, "https://altro.sito/x.jpg"] }, "tok-io");
const f = r.corpo.firmati || {};
verifica("i miei file e quelli dei miei clienti: link firmati di 1 ora", r.stato === 200 && f[MIO] && f[MIO].includes("/storage/v1/object/sign/eon-files/" + IO + "/cantiere/foto/bagno.jpg?token=t3600") && f[MIO_LOGO] && f[DAL_CLIENTE], JSON.stringify(r));
verifica("mai i file di un altro utente o delle chat di un altro, né indirizzi truccati", !f[DI_ALTRI] && !f[CHAT_DI_ALTRI] && !f[TRUCCO] && !f["https://altro.sito/x.jpg"], JSON.stringify(Object.keys(f)));
verifica("al servizio di firma vanno solo i percorsi consentiti", firmeChieste.length === 1 && firmeChieste[0].paths.length === 3 && !firmeChieste[0].paths.some((p) => p.includes(ALTRO)), JSON.stringify(firmeChieste));
r = await chiama("firma_file", { urls: [MIO], durata: "condivisione" }, "tok-io");
verifica("link da condividere: 7 giorni", (r.corpo.firmati[MIO] || "").includes("token=t604800") && r.corpo.scade_tra === 604800, JSON.stringify(r.corpo));
r = await chiama("firma_file", { urls: [MIO] }, null);
verifica("senza accesso: niente link", r.stato === 401, String(r.stato));

// 2. La pagina del cliente
firmeChieste = [];
r = await chiama("portale_firma_file", { codice: CODICE, urls: [DAL_CLIENTE, PUB + IO + "/preventivo.pdf", MIO, MIO_LOGO, DI_ALTRI, CHAT_DI_ALTRI] });
const p = r.corpo.firmati || {};
verifica("pagina del cliente: i file della sua chat (suoi, preventivo e foto mandati nella chat)", r.stato === 200 && p[DAL_CLIENTE] && p[PUB + IO + "/preventivo.pdf"] && p[MIO], JSON.stringify(r));
verifica("…ma non altri file del professionista né di altre chat", !p[MIO_LOGO] && !p[DI_ALTRI] && !p[CHAT_DI_ALTRI], JSON.stringify(Object.keys(p)));
r = await chiama("portale_firma_file", { codice: "codice-sbagliato-1234567890", urls: [DAL_CLIENTE] });
verifica("codice sbagliato: niente", r.stato === 403, String(r.stato));

// 3. Descrivi foto: all'AI un link firmato di 5 minuti
r = await chiama("descrivi_foto", { foto_id: "55555555-5555-4555-8555-555555555555" }, "tok-io");
verifica("descrivi_foto: all'AI un link firmato di 5 minuti, non l'indirizzo pubblico", r.stato === 200 && aiImmagini.length === 1 && aiImmagini[0].type === "url" && aiImmagini[0].url.includes("/object/sign/") && aiImmagini[0].url.includes("token=t300"), JSON.stringify({ r, aiImmagini }));

console.log(falliti ? `\n${falliti} controlli falliti.` : "\nTutti i controlli passati.");
if (falliti) process.exitCode = 1;
