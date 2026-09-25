/* Test di "Elimina account" lato server (25/09/2026) — gira SENZA chiavi e
   senza rete: esegue il vero handler di api/index.js con database, storage
   e amministrazione utenti simulati.

   Controlla: senza la parola ELIMINA non si cancella niente; con ELIMINA
   si cancellano i file dell'utente (la sua cartella e quelle delle sue chat
   coi clienti, anche nelle sottocartelle) e poi l'utente; se lo storage non
   risponde l'account si cancella lo stesso; se la cancellazione dell'utente
   fallisce, l'errore arriva all'app.

   Uso:  node eval/elimina-account.test.mjs */

process.env.SUPABASE_URL = "https://finto.supabase.co";
process.env.SUPABASE_ANON_KEY = "anon-finta";
process.env.SUPABASE_SERVICE_ROLE_KEY = "service-finta";
process.env.ANTHROPIC_API_KEY = "chiave-finta";

const UTENTE = { id: "11111111-1111-4111-8111-111111111111", email: "andrea@esempio.it" };
const CHAT = "22222222-2222-4222-8222-222222222222";
const U = process.env.SUPABASE_URL;

let registro, cartelle, storageRotto, adminRotto;
function prepara() {
  registro = [];
  storageRotto = false;
  adminRotto = false;
  cartelle = {
    [UTENTE.id + "/"]: [{ name: "logo.png", id: "f1" }, { name: "cantiere", id: null }],
    [UTENTE.id + "/cantiere/"]: [{ name: "foto", id: null }],
    [UTENTE.id + "/cantiere/foto/"]: [{ name: "porta.jpg", id: "f2" }, { name: "bagno.jpg", id: "f3" }],
    ["clienti/" + CHAT + "/"]: [{ name: "planimetria.pdf", id: "f4" }],
    ["altro-utente/"]: [{ name: "segreto.jpg", id: "f9" }],
  };
}
const json = (o, status = 200) => new Response(o === null ? "" : JSON.stringify(o), { status, headers: { "content-type": "application/json" } });

globalThis.fetch = async (url, init = {}) => {
  const s = String(url);
  if (s.startsWith(U + "/auth/v1/user")) return json(UTENTE);
  if (s.startsWith(U + "/rest/v1/conversations")) return json([{ id: CHAT }]);
  if (s === U + "/storage/v1/object/list/eon-files") {
    if (storageRotto) return json({ message: "storage giù" }, 500);
    const { prefix } = JSON.parse(init.body);
    registro.push({ elenca: prefix });
    return json(cartelle[prefix] || []);
  }
  if (s === U + "/storage/v1/object/eon-files" && init.method === "DELETE") {
    registro.push({ cancellaFile: JSON.parse(init.body).prefixes });
    return json([]);
  }
  if (s.startsWith(U + "/auth/v1/admin/users/") && init.method === "DELETE") {
    registro.push({ cancellaUtente: s.split("/").pop(), chiave: init.headers.Authorization });
    return adminRotto ? json({ msg: "errore" }, 500) : json({});
  }
  throw new Error("fetch non prevista nel test: " + s);
};

const { default: handler } = await import("../api/index.js");
async function chiama(body) {
  const req = { method: "POST", url: "/api?action=elimina_account", headers: { authorization: "Bearer token-finto" }, body };
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

prepara();
let r = await chiama({});
verifica("senza \"ELIMINA\": rifiutato, niente cancellato", r.status === 400 && registro.length === 0, JSON.stringify({ r, registro }));

prepara();
r = await chiama({ conferma: "elimina" });
const cancellati = registro.filter((x) => x.cancellaFile).flatMap((x) => x.cancellaFile).sort();
const utente = registro.find((x) => x.cancellaUtente);
verifica("con ELIMINA: risposta ok", r.status === 200 && r.corpo.eliminato === true, JSON.stringify(r));
verifica("cancellati i suoi file, anche nelle sottocartelle, e quelli delle sue chat", JSON.stringify(cancellati) === JSON.stringify([
  "11111111-1111-4111-8111-111111111111/cantiere/foto/bagno.jpg",
  "11111111-1111-4111-8111-111111111111/cantiere/foto/porta.jpg",
  "11111111-1111-4111-8111-111111111111/logo.png",
  "clienti/" + CHAT + "/planimetria.pdf",
].sort()), JSON.stringify(cancellati));
verifica("mai i file di un altro utente", !cancellati.some((f) => f.startsWith("altro-utente/")));
verifica("poi cancellato l'utente giusto, con la chiave di servizio", utente && utente.cancellaUtente === UTENTE.id && utente.chiave === "Bearer service-finta", JSON.stringify(utente));
verifica("prima i file, poi l'utente", registro.findIndex((x) => x.cancellaUtente) > registro.findIndex((x) => x.cancellaFile));

prepara();
storageRotto = true;
r = await chiama({ conferma: "ELIMINA" });
verifica("storage che non risponde: l'account si cancella lo stesso (e lo dice)", r.status === 200 && r.corpo.file_non_cancellati === true && registro.some((x) => x.cancellaUtente), JSON.stringify(r));

prepara();
adminRotto = true;
r = await chiama({ conferma: "ELIMINA" });
verifica("se l'utente non si cancella: errore chiaro all'app", r.status === 502 && /eliminare l'account/.test(r.corpo.error), JSON.stringify(r));

console.log(falliti ? `\n${falliti} controlli falliti.` : "\nTutti i controlli passati.");
if (falliti) process.exitCode = 1;
