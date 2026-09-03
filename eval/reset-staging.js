/* EON BRAIN — pulizia dei dati creati dai test, prima di una run di
   eval/live-check.js.

   Perché serve: live-check.js non parte mai da un database vuoto — ogni
   run precedente lascia clienti/impegni/appunti creati dai casi con
   verifica "azione". Trovato il 03/09/2026 sulla primissima esecuzione
   mai riuscita della suite: il caso intento-01 ("Domani vedo Mario alle
   9, segnalo") è stato segnalato FAIL non per un bug, ma perché nel
   database c'erano già DUE clienti di nome "Mario" (creati da run
   precedenti) — EON ha correttamente chiesto quale dei due, il controllo
   automatico si aspettava invece un crea_impegno diretto. Questo script
   riporta l'utente di test a uno stato pulito prima di ogni run, così i
   risultati sono ripetibili.

   ATTENZIONE — cancella DAVVERO i dati dell'utente indicato. Pensato SOLO
   per l'utente di prova dell'ambiente di staging (mai per un account con
   dati veri di clienti): per questo richiede sia l'id utente sia una
   conferma esplicita, invece di indovinare "l'utente corrente" da soli.

   Uso:
     SUPABASE_URL=https://tuo-progetto-staging.supabase.co \
     SUPABASE_SERVICE_ROLE_KEY=<service_role dello STAGING> \
     EVAL_OWNER_ID=<id dell'utente di prova> \
     CONFIRM_STAGING=si \
     node eval/reset-staging.js */

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const OWNER_ID = process.env.EVAL_OWNER_ID;
const CONFIRM = process.env.CONFIRM_STAGING;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !OWNER_ID) {
  console.error("Servono SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY e EVAL_OWNER_ID (vedi il commento in cima a questo file).");
  process.exit(1);
}
if (CONFIRM !== "si") {
  console.error(`Questo script cancella TUTTI i dati dell'utente ${OWNER_ID} su ${SUPABASE_URL}.`);
  console.error(`Se è davvero l'utente di prova dello staging (mai un account con dati veri), rilancia aggiungendo CONFIRM_STAGING=si`);
  process.exit(1);
}

async function db(percorso, options) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${percorso}`, {
    ...options,
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(options && options.headers ? options.headers : {}),
    },
  });
  const text = await r.text();
  let parsed = null;
  if (text) { try { parsed = JSON.parse(text); } catch { parsed = text; } }
  if (!r.ok) throw new Error(typeof parsed === "string" ? parsed : JSON.stringify(parsed));
  return parsed;
}

/* Ogni tabella è indipendente dalle altre: se una fallisce (es. non
   esiste ancora su questo progetto) le altre vanno comunque avanti,
   invece di lasciare a metà la pulizia per un solo errore. */
async function svuota(tabella, colonnaOwner = "owner_id") {
  try {
    const cancellati = await db(`${tabella}?${colonnaOwner}=eq.${OWNER_ID}`, { method: "DELETE" });
    console.log(`${tabella}: ${Array.isArray(cancellati) ? cancellati.length : 0} righe cancellate`);
  } catch (err) {
    console.log(`${tabella}: saltata (${err.message})`);
  }
}

async function main() {
  console.log(`Pulizia dati di test per l'utente ${OWNER_ID} su ${SUPABASE_URL}...`);

  /* messages non ha owner_id: si arriva alle proprie righe solo passando
     dalle conversazioni. Le si cancella per prime, poi le conversazioni. */
  try {
    const conversazioni = await db(`conversations?select=id&owner_id=eq.${OWNER_ID}`, { method: "GET" });
    for (const c of conversazioni) {
      await db(`messages?conversation_id=eq.${c.id}`, { method: "DELETE" });
    }
    console.log(`messages: ripulite (${conversazioni.length} conversazioni)`);
  } catch (err) {
    console.log(`messages: saltata (${err.message})`);
  }

  for (const tabella of [
    "conversations", "clients", "opportunities", "employees", "tasks",
    "assigned_tasks", "payments", "incomes", "goals", "documents",
    "cantiere_cliente", "cantiere_foto", "cantiere_documenti", "cantiere_appunti",
    "ai_audit_log", "ai_runs", "ai_rate_limits",
  ]) {
    await svuota(tabella);
  }

  console.log("Fatto. L'utente di prova è di nuovo pulito.");
}

main().catch((err) => { console.error(err); process.exit(1); });
