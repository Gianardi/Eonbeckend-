/* Promemoria degli impegni sul telefono (29/09/2026), lato server:
   - la notifica è cifrata come vuole lo standard (RFC 8291, aes128gcm): la
     prova la decifra "dal lato del telefono", con un codice scritto a parte;
   - la firma VAPID (RFC 8292) si verifica con la chiave pubblica;
   - l'orologio (action=invia_promemoria) senza il segreto giusto → 403;
   - manda solo gli impegni con l'ora tra adesso e 35 minuti (non quelli
     fatti, senza ora, lontani, annullati), una volta sola;
   - un telefono che non c'è più (410) viene tolto.
   Gira senza rete: vero handler, database finto, servizio di notifiche finto.
   Uso:  node eval/promemoria.test.mjs */

import { randomUUID, createECDH, createHmac, createDecipheriv, generateKeyPairSync, createPublicKey, verify } from "node:crypto";

process.env.SUPABASE_URL = "https://finto.supabase.co";
process.env.SUPABASE_ANON_KEY = "anon-finta";
process.env.SUPABASE_SERVICE_ROLE_KEY = "service-finta";
process.env.ANTHROPIC_API_KEY = "chiave-finta";

let falliti = 0;
function verifica(descrizione, condizione, dettaglio) {
  console.log(`  ${condizione ? "OK  " : "FAIL"} ${descrizione}${condizione || dettaglio === undefined ? "" : "  — " + dettaglio}`);
  if (!condizione) falliti++;
}

/* ---------- Il telefono: decifra una notifica (scritto a parte, dallo standard) ---------- */
const hmac = (k, d) => createHmac("sha256", k).update(d).digest();
function decifraComeIlTelefono(corpo, telefono, auth) {
  const sale = corpo.subarray(0, 16);
  const rs = corpo.readUInt32BE(16);
  const lunghezzaChiave = corpo[20];
  const pubServer = corpo.subarray(21, 21 + lunghezzaChiave);
  const cifrato = corpo.subarray(21 + lunghezzaChiave);
  const condiviso = telefono.computeSecret(pubServer);
  const prkAuth = hmac(auth, condiviso);
  const ikm = hmac(prkAuth, Buffer.concat([Buffer.from("WebPush: info\0"), telefono.getPublicKey(), pubServer, Buffer.from([1])]));
  const prk = hmac(sale, ikm);
  const chiave = hmac(prk, Buffer.concat([Buffer.from("Content-Encoding: aes128gcm\0"), Buffer.from([1])])).subarray(0, 16);
  const nonce = hmac(prk, Buffer.concat([Buffer.from("Content-Encoding: nonce\0"), Buffer.from([1])])).subarray(0, 12);
  const d = createDecipheriv("aes-128-gcm", chiave, nonce);
  d.setAuthTag(cifrato.subarray(cifrato.length - 16));
  const chiaro = Buffer.concat([d.update(cifrato.subarray(0, cifrato.length - 16)), d.final()]);
  return { rs, lunghezzaChiave, delimitatore: chiaro[chiaro.length - 1], testo: chiaro.subarray(0, chiaro.length - 1).toString() };
}
function nuovoTelefono() {
  const t = createECDH("prime256v1"); t.generateKeys();
  const auth = Buffer.from(randomUUID().replace(/-/g, "").slice(0, 32), "hex");
  return { t, auth, p256dh: t.getPublicKey().toString("base64url"), authB64: auth.toString("base64url") };
}

/* ---------- Database finto ---------- */
let tabelle;
const UTENTE = "11111111-1111-4111-8111-111111111111", ALTRO = "22222222-2222-4222-8222-222222222222";
function vale(r, k, v) {
  if (v === "is.null") return r[k] == null;
  if (v.startsWith("eq.")) return String(r[k]) === v.slice(3);
  if (v.startsWith("neq.")) return String(r[k]) !== v.slice(4);
  if (v.startsWith("gt.")) return r[k] != null && String(r[k]) > v.slice(3);
  if (v.startsWith("lte.")) return r[k] != null && String(r[k]) <= v.slice(4);
  if (v.startsWith("in.(")) return v.slice(4, -1).split(",").map((x) => x.replace(/^"|"$/g, "")).includes(String(r[k]));
  return true;
}
function postgrest(url, init) {
  const u = new URL(url);
  const tabella = u.pathname.replace("/rest/v1/", "");
  const metodo = (init && init.method) || "GET";
  const params = [...u.searchParams.entries()].filter(([k]) => !["select", "limit", "order"].includes(k));
  const righe = (tabelle[tabella] || (tabelle[tabella] = []));
  const scelte = righe.filter((r) => params.every(([k, v]) => vale(r, k, v)));
  const risposta = (o, s = 200) => new Response(o == null ? "" : JSON.stringify(o), { status: s, headers: { "content-type": "application/json" } });
  if (metodo === "GET") {
    const conConv = /conversations!inner/.test(u.searchParams.get("select") || "");
    return risposta(scelte.map((r) => (conConv ? { ...r, conversations: (tabelle.conversations || []).find((c) => c.id === r.conversation_id) || null } : r)).filter((r) => !conConv || r.conversations));
  }
  if (metodo === "POST") {
    const corpo = JSON.parse(init.body);
    if (tabella === "promemoria_inviati" && righe.some((r) => r.rif === corpo.rif)) return risposta(null, 201);
    righe.push({ id: randomUUID(), ...corpo });
    return risposta(null, 201);
  }
  if (metodo === "PATCH") { scelte.forEach((r) => Object.assign(r, JSON.parse(init.body))); return risposta(null, 204); }
  if (metodo === "DELETE") { tabelle[tabella] = righe.filter((r) => !scelte.includes(r)); return risposta(null, 204); }
  return risposta([]);
}
let inviiPush = [];
let rispostaPush = () => 201;
globalThis.fetch = async (url, init) => {
  const s = String(url);
  if (s.startsWith(process.env.SUPABASE_URL + "/rest/v1/")) return postgrest(s, init);
  if (s.startsWith("https://push.")) { inviiPush.push({ url: s, init }); return new Response("", { status: rispostaPush(s) }); }
  throw new Error("fetch non prevista nel test: " + s);
};
const { default: handler, cifraWebPush, firmaVapid } = await import("../api/index.js");
async function orologio(segreto) {
  const req = { method: "POST", url: "/api?action=invia_promemoria", headers: segreto ? { "x-eon-cron": segreto } : {}, body: {} };
  let uscita = "";
  const res = { statusCode: 0, setHeader() {}, end(d) { uscita = d || ""; } };
  await handler(req, res);
  return { status: res.statusCode, corpo: uscita ? JSON.parse(uscita) : null };
}

/* ---------- 1. Cifratura e firma ---------- */
console.log("\n=== La notifica: cifrata e firmata come vuole lo standard ===");
const tel = nuovoTelefono();
const corpo = cifraWebPush(JSON.stringify({ title: "Tra 30 minuti", body: "11:00 · Sopralluogo Rossi" }), tel.p256dh, tel.authB64);
let letto;
try { letto = decifraComeIlTelefono(corpo, tel.t, tel.auth); } catch (e) { letto = { errore: e.message }; }
verifica("il telefono la decifra (RFC 8291, aes128gcm) e legge il testo giusto", letto.testo === JSON.stringify({ title: "Tra 30 minuti", body: "11:00 · Sopralluogo Rossi" }), JSON.stringify(letto));
verifica("intestazione giusta: record 4096, chiave di 65 byte, ultimo record (delimitatore 2)", letto.rs === 4096 && letto.lunghezzaChiave === 65 && letto.delimitatore === 2, JSON.stringify(letto));
const altro = nuovoTelefono();
let sbagliato = false;
try { decifraComeIlTelefono(corpo, altro.t, altro.auth); } catch (e) { sbagliato = true; }
verifica("un altro telefono non la può leggere", sbagliato);

const { privateKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
const jwk = privateKey.export({ format: "jwk" });
const jwt = firmaVapid("https://push.example.com/abc/123", jwk);
const [h, p, f] = jwt.split(".");
const pubVapid = createPublicKey({ key: { kty: "EC", crv: "P-256", x: jwk.x, y: jwk.y }, format: "jwk" });
const firmaOk = verify("sha256", Buffer.from(h + "." + p), { key: pubVapid, dsaEncoding: "ieee-p1363" }, Buffer.from(f, "base64url"));
const carico = JSON.parse(Buffer.from(p, "base64url").toString());
verifica("firma VAPID (ES256) valida, per il servizio giusto, scade entro 24 ore", firmaOk && JSON.parse(Buffer.from(h, "base64url")).alg === "ES256" && carico.aud === "https://push.example.com" && carico.exp - Date.now() / 1000 <= 24 * 3600 && /^https:/.test(carico.sub), JSON.stringify(carico));

/* ---------- 2. L'orologio ---------- */
console.log("\n=== L'orologio: quali promemoria partono ===");
function romaComeUtc(msDaAdesso) {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Rome", hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" })
    .formatToParts(new Date(Date.now() + msDaAdesso)).map((x) => [x.type, x.value]));
  return new Date(Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, 0)).toISOString().replace(".000Z", "+00:00");
}
const oraDi = (iso) => iso.slice(11, 16);
const tra = (min) => romaComeUtc(min * 60000);
const telA = nuovoTelefono(), telB = nuovoTelefono(), telAltro = nuovoTelefono();
tabelle = {
  eon_segreti: [{ nome: "cron_promemoria", valore: "segreto-dell-orologio" }, { nome: "vapid_jwk", valore: JSON.stringify(jwk) }],
  push_iscrizioni: [
    { id: "p1", owner_id: UTENTE, endpoint: "https://push.example.com/telefono-a", p256dh: telA.p256dh, auth: telA.authB64, errori: 0 },
    { id: "p2", owner_id: UTENTE, endpoint: "https://push.example.com/telefono-vecchio", p256dh: telB.p256dh, auth: telB.authB64, errori: 0 },
    { id: "p3", owner_id: ALTRO, endpoint: "https://push.example.com/altro", p256dh: telAltro.p256dh, auth: telAltro.authB64, errori: 0 },
  ],
  tasks: [
    { id: "t1", owner_id: UTENTE, title: "Sopralluogo Rossi", time: "mar 29 set, " + oraDi(tra(25)), scheduled_at: tra(25), status: "todo", deleted_at: null },
    { id: "t2", owner_id: UTENTE, title: "Già fatto", time: "mar 29 set, " + oraDi(tra(20)), scheduled_at: tra(20), status: "done", deleted_at: null },
    { id: "t3", owner_id: UTENTE, title: "Tra due ore", time: "mar 29 set, " + oraDi(tra(120)), scheduled_at: tra(120), status: "todo", deleted_at: null },
    { id: "t4", owner_id: UTENTE, title: "Cancellato", time: "mar 29 set, " + oraDi(tra(15)), scheduled_at: tra(15), status: "todo", deleted_at: "2026-09-29T08:00:00Z" },
    { id: "t5", owner_id: UTENTE, title: "Mandare raccomandata", time: "mar 29 set", scheduled_at: tra(10), status: "todo", deleted_at: null }, // senza ora: niente notifica
    { id: "t6", owner_id: ALTRO, title: "Caldaia Baudi", time: "mar 29 set, " + oraDi(tra(30)), scheduled_at: tra(30), status: "todo", deleted_at: null },
  ],
  conversations: [{ id: "c1", owner_id: UTENTE }],
  messages: [
    { id: "m1", conversation_id: "c1", event_type: "appt", title: "Appuntamento con Rita Ambrosini (da confermare)", scheduled_at: tra(12), deleted_at: null },
    { id: "m2", conversation_id: "c1", event_type: "text", title: "Ciao", scheduled_at: tra(12), deleted_at: null },
  ],
  promemoria_inviati: [],
};

let r = await orologio("segreto-sbagliato");
verifica("senza il segreto giusto: 403, niente notifiche", r.status === 403 && inviiPush.length === 0, JSON.stringify(r));
r = await orologio(null);
verifica("senza segreto: 403", r.status === 403);

rispostaPush = (url) => (/telefono-vecchio/.test(url) ? 410 : 201);
r = await orologio("segreto-dell-orologio");
const aTelA = inviiPush.filter((x) => /telefono-a/.test(x.url)).map((x) => JSON.parse(decifraComeIlTelefono(Buffer.from(x.init.body), telA.t, telA.auth).testo));
const titoli = aTelA.map((x) => x.body).sort();
verifica("partono solo i 2 impegni con l'ora nei prossimi 35 minuti (Rossi, Rita)", r.status === 200 && titoli.length === 2 && titoli.some((t) => /Sopralluogo Rossi$/.test(t)) && titoli.some((t) => /Rita Ambrosini/.test(t)), JSON.stringify({ r, titoli }));
const rossi = aTelA.find((x) => /Rossi/.test(x.body));
verifica("il testo: \"Tra 25 minuti\" e \"HH:MM · Sopralluogo Rossi\"", rossi && /^Tra 2[45] minuti$/.test(rossi.title) && rossi.body === oraDi(tra(25)) + " · Sopralluogo Rossi", JSON.stringify(rossi));
const altroUtente = inviiPush.filter((x) => /\/altro$/.test(x.url)).map((x) => JSON.parse(decifraComeIlTelefono(Buffer.from(x.init.body), telAltro.t, telAltro.auth).testo).body);
verifica("ognuno riceve solo i suoi impegni", altroUtente.length === 1 && /Caldaia Baudi/.test(altroUtente[0]), JSON.stringify(altroUtente));
const intest = inviiPush[0].init.headers;
verifica("intestazioni giuste: aes128gcm, TTL, firma VAPID con la chiave", intest["Content-Encoding"] === "aes128gcm" && Number(intest.TTL) > 0 && /^vapid t=.+, k=B[A-Za-z0-9_-]{86}$/.test(intest.Authorization), JSON.stringify(intest));
verifica("il telefono che non c'è più (410) viene tolto", !tabelle.push_iscrizioni.some((x) => x.id === "p2") && tabelle.push_iscrizioni.some((x) => x.id === "p1"), JSON.stringify(tabelle.push_iscrizioni.map((x) => x.id)));

const primaSeconda = inviiPush.length;
r = await orologio("segreto-dell-orologio");
verifica("al giro dopo (5 minuti) non ripete gli stessi promemoria", r.status === 200 && inviiPush.length === primaSeconda && r.corpo.inviati === 0, JSON.stringify({ r, invii: inviiPush.length - primaSeconda }));

console.log(falliti ? `\n${falliti} controlli falliti` : "\nTutti i controlli passati.");
process.exit(falliti ? 1 : 0);
