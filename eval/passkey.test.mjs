/* Accesso con Face ID (passkey), lato server (27/09/2026): registrazione
   della chiave pubblica e accesso con la firma del telefono, con chiavi e
   firme VERE (P-256, come un iPhone). Controlla anche i tentativi sbagliati:
   origine diversa, sfida finta o scaduta, firma di un'altra chiave, senza
   Face ID, riuso della stessa firma, chiave disattivata.
   Gira senza rete: vero handler, database e Supabase Auth finti.
   Uso:  node eval/passkey.test.mjs */

const ORIGINE = "https://eonbeckend.vercel.app";
const RP_ID = "eonbeckend.vercel.app";
import { randomUUID, generateKeyPairSync, createHash, sign } from "node:crypto";

process.env.SUPABASE_URL = "https://finto.supabase.co";
process.env.SUPABASE_ANON_KEY = "anon-finta";
process.env.SUPABASE_SERVICE_ROLE_KEY = "service-finta";
process.env.ANTHROPIC_API_KEY = "chiave-finta";

const UTENTE = { id: "11111111-1111-4111-8111-111111111111", email: "andrea@esempio.it" };
const linkGenerati = [];
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
  if (metodo === "DELETE") { const via = filtra(tabelle[tabella], params); tabelle[tabella] = tabelle[tabella].filter((r) => !via.includes(r)); return json([]); }
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
    const tok = ((init && init.headers && init.headers.Authorization) || "").replace("Bearer ", "");
    return tok === "t" ? json(UTENTE) : json({ msg: "token non valido" }, 401);
  }
  if (s.startsWith(process.env.SUPABASE_URL + "/auth/v1/admin/users/")) { const id = s.split("/").pop(); return id === UTENTE.id ? json({ id, email: UTENTE.email }) : json({}, 404); }
  if (s.startsWith(process.env.SUPABASE_URL + "/auth/v1/admin/generate_link")) { linkGenerati.push(JSON.parse(init.body)); return json({ hashed_token: "hash-segreto", verification_type: "magiclink" }); }
  if (s.startsWith(process.env.SUPABASE_URL + "/auth/v1/verify")) { const b = JSON.parse(init.body); return b.token_hash === "hash-segreto" && b.type === "magiclink" ? json({ access_token: "acc-nuovo", refresh_token: "ref-nuovo", user: { id: UTENTE.id } }) : json({ msg: "no" }, 400); }
  if (s.startsWith(process.env.SUPABASE_URL + "/rest/v1/")) return postgrest(s, init);
  throw new Error("fetch non prevista: " + s);
};
const { default: handler } = await import("../api/index.js");
async function chiama(body, action, token, origine = ORIGINE) {
  const headers = { origin: origine, "user-agent": "Mozilla/5.0 (iPhone)", "x-forwarded-for": "5.6.7.8" };
  if (token) headers.authorization = "Bearer " + token;
  const req = { method: body === undefined ? "GET" : "POST", url: "/api?action=" + action, headers, body };
  let uscita = ""; const res = { statusCode: 0, setHeader() {}, end(d) { uscita = d || ""; } };
  await handler(req, res);
  return { status: res.statusCode, corpo: uscita ? JSON.parse(uscita) : null };
}

let falliti = 0;
function verifica(descrizione, condizione, dettaglio) {
  console.log(`  ${condizione ? "OK  " : "FAIL"} ${descrizione}${condizione || dettaglio === undefined ? "" : "  — " + dettaglio}`);
  if (!condizione) falliti++;
}
const b64u = (b) => Buffer.from(b).toString("base64url");
const sha = (x) => createHash("sha256").update(x).digest();
function datiAutenticatore(rpId, flags = 0x05, contatore = 0) {
  const c = Buffer.alloc(4); c.writeUInt32BE(contatore);
  return Buffer.concat([sha(rpId), Buffer.from([flags]), c]);
}
const telefono = generateKeyPairSync("ec", { namedCurve: "P-256" });
const altro = generateKeyPairSync("ec", { namedCurve: "P-256" });
const ID_CHIAVE = b64u(Buffer.from("chiave-del-telefono-di-andrea-0001"));

databaseVuoto(); tabelle.passkeys = [];

// --- Registrazione ---
let r = await chiama(undefined, "passkey_opzioni_registrazione", null);
verifica("registrazione senza accesso: 401", r.status === 401);
r = await chiama(undefined, "passkey_opzioni_registrazione", "t");
const opz = r.corpo;
verifica("opzioni di registrazione: sfida, sito, utente, Face ID obbligatorio", r.status === 200 && opz.challenge && opz.rp.id === RP_ID && Buffer.from(opz.user.id, "base64url").toString() === UTENTE.id && opz.authenticatorSelection.userVerification === "required", JSON.stringify(opz));
const datiCreazione = (sfida, origine = ORIGINE, tipo = "webauthn.create") => b64u(JSON.stringify({ type: tipo, challenge: sfida, origin: origine }));
const corpoRegistrazione = (extra = {}) => ({ id: ID_CHIAVE, clientDataJSON: datiCreazione(opz.challenge), publicKey: b64u(telefono.publicKey.export({ type: "spki", format: "der" })), alg: -7, authenticatorData: b64u(datiAutenticatore(RP_ID)), ...extra });

r = await chiama(corpoRegistrazione({ clientDataJSON: datiCreazione(opz.challenge, "https://sito-falso.it") }), "passkey_registra", "t");
verifica("registrazione da un altro sito: rifiutata", r.status === 403 && tabelle.passkeys.length === 0, JSON.stringify(r));
r = await chiama(corpoRegistrazione({ clientDataJSON: datiCreazione(b64u(Buffer.alloc(40, 7))) }), "passkey_registra", "t");
verifica("sfida inventata: rifiutata", r.status === 400 && tabelle.passkeys.length === 0);
r = await chiama(corpoRegistrazione(), "passkey_registra", "t");
verifica("registrazione giusta: chiave pubblica salvata", r.status === 200 && tabelle.passkeys.length === 1 && tabelle.passkeys[0].user_id === UTENTE.id && tabelle.passkeys[0].credential_id === ID_CHIAVE && tabelle.passkeys[0].alg === -7, JSON.stringify({ r, p: tabelle.passkeys }));
r = await chiama(undefined, "passkey_stato", "t");
verifica("Impostazioni: 1 chiave attiva", r.corpo.chiavi === 1);

// --- Accesso ---
async function prova(modifica = {}) {
  const o = (await chiama(undefined, "passkey_opzioni_accesso", null)).corpo;
  const cd = Buffer.from(JSON.stringify({ type: "webauthn.get", challenge: modifica.sfida || o.challenge, origin: modifica.origine || ORIGINE }));
  const ad = modifica.authData || datiAutenticatore(modifica.rpId || RP_ID, modifica.flags ?? 0x05, modifica.contatore || 0);
  const firma = sign("sha256", Buffer.concat([ad, sha(cd)]), (modifica.chiave || telefono).privateKey);
  const corpo = { id: modifica.id || ID_CHIAVE, clientDataJSON: b64u(cd), authenticatorData: b64u(ad), signature: b64u(firma) };
  return { r: await chiama(corpo, "passkey_accedi", null), corpo, o };
}
let a = await prova();
verifica("opzioni di accesso senza login: sfida e sito", a.o.challenge && a.o.rpId === RP_ID && a.o.userVerification === "required");
verifica("Face ID giusto: entra, con una sessione vera", a.r.status === 200 && a.r.corpo.access_token === "acc-nuovo" && a.r.corpo.refresh_token === "ref-nuovo", JSON.stringify(a.r));
verifica("sessione creata per la sua email, senza mandare email", linkGenerati.length === 1 && linkGenerati[0].email === UTENTE.email && linkGenerati[0].type === "magiclink");
verifica("registrato l'ultimo uso", !!tabelle.passkeys[0].ultimo_uso && tabelle.passkeys[0].ultima_sfida === a.o.challenge);
const riuso = await chiama(a.corpo, "passkey_accedi", null);
verifica("la stessa firma usata di nuovo: rifiutata", riuso.status === 401, JSON.stringify(riuso));
a = await prova({ chiave: altro });
verifica("firma di un'altra chiave: \"Face ID non riconosciuto\"", a.r.status === 401 && /non riconosciuto/.test(a.r.corpo.error), JSON.stringify(a.r));
a = await prova({ flags: 0x01 });
verifica("senza Face ID (solo presenza): rifiutato", a.r.status === 403, JSON.stringify(a.r));
a = await prova({ rpId: "sito-falso.it" });
verifica("chiave di un altro sito: rifiutata", a.r.status === 403);
a = await prova({ origine: "https://sito-falso.it" });
verifica("richiesta da un altro sito: rifiutata", a.r.status === 403);
a = await prova({ sfida: b64u(Buffer.alloc(40, 1)) });
verifica("sfida inventata: rifiutata", a.r.status === 400);
a = await prova({ id: b64u(Buffer.from("chiave-che-non-esiste-000000")) });
verifica("chiave sconosciuta: rifiutata con un messaggio chiaro", a.r.status === 401 && /non è più attiva/.test(a.r.corpo.error));
verifica("nessuna sessione creata per i tentativi sbagliati", linkGenerati.length === 1, String(linkGenerati.length));

// --- Disattiva ---
r = await chiama({}, "passkey_disattiva", "t");
verifica("Disattiva: chiavi tolte", r.status === 200 && tabelle.passkeys.length === 0);
a = await prova();
verifica("dopo Disattiva, Face ID non fa più entrare", a.r.status === 401);

console.log(falliti ? `\n${falliti} controlli falliti.` : "\nTutti i controlli passati.");
if (falliti) process.exitCode = 1;
