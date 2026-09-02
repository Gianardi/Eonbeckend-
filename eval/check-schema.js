/* EON, roadmap operativa punto 1.3 — gate di verifica schema.

   Il codice presuppone che certe tabelle/colonne esistano davvero in
   Supabase (es. cantiere_foto.client_id, l'intera tabella
   ai_request_log). Due volte questa assunzione si è rivelata falsa in
   produzione: uno script SQL scritto in supabase/*.sql ma mai eseguito
   sul database vero — scoperto solo da un utente reale, non da un
   test automatico. Questo script chiude quel buco: verifica lo schema
   REALE (via PostgREST, stesso meccanismo di db() in api/index.js —
   nessuna dipendenza nuova, nessun driver Postgres) contro il
   contratto che il codice presuppone.

   CONTRATTO: quando si aggiunge un tool/una query che presuppone una
   tabella o colonna nuova, aggiungerla qui PRIMA di aprire la PR — è
   la stessa disciplina della checklist di composizione (punto 1.4),
   applicata allo schema invece che al comportamento.

   Uso:
     SUPABASE_URL=https://xxx.supabase.co SUPABASE_SERVICE_ROLE_KEY=... node eval/check-schema.js

   Uscita: 0 se tutto il contratto è soddisfatto, 1 altrimenti (con il
   dettaglio di cosa manca, riga per riga) — pensato per un gate CI,
   non solo per lettura umana. */

const CONTRATTO = {
  profiles: ["id", "full_name", "business_name", "profession", "created_at"],
  clients: ["id", "owner_id", "name", "status", "value", "phone", "deleted_at"],
  tasks: ["id", "owner_id", "title", "owner_type", "status", "time", "scheduled_at", "deleted_at"],
  conversations: ["id", "owner_id", "contact_name", "deleted_at"],
  messages: ["id", "conversation_id", "sender", "event_type", "title", "body", "amount", "file_url", "file_name", "scheduled_at", "deleted_at"],
  documents: ["id", "owner_id", "doc_type", "client_name", "amount", "content"],
  cantiere_foto: ["id", "owner_id", "url", "client_id", "created_at", "deleted_at"],
  cantiere_appunti: ["id", "owner_id", "testo", "created_at", "deleted_at"],
  ai_audit_log: ["id", "owner_id", "tool", "input", "esito", "stato", "created_at"],
  ai_request_log: ["id", "owner_id", "tipo", "messaggio", "modello", "giri", "strumenti", "stato", "errore", "durata_ms", "created_at"],
  ai_runs: ["id", "owner_id", "stato", "messaggi", "in_sospeso", "azioni", "created_at", "updated_at"],
};

function pulisciUrl(url) {
  if (!url) return url;
  return url.trim().replace(/\/(rest|auth|storage|realtime)\/v\d+\/?$/i, "").replace(/\/+$/, "");
}

async function verificaTabella(baseUrl, key, tabella, colonne) {
  const url = `${baseUrl}/rest/v1/${tabella}?select=${colonne.join(",")}&limit=0`;
  let res;
  try {
    res = await fetch(url, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
  } catch (e) {
    return { ok: false, dettaglio: `richiesta fallita: ${e.message}` };
  }
  if (res.ok) return { ok: true };
  const corpo = await res.text().catch(() => "");
  return { ok: false, dettaglio: `HTTP ${res.status} — ${corpo.slice(0, 300)}` };
}

async function main() {
  const baseUrl = pulisciUrl(process.env.SUPABASE_URL);
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!baseUrl || !key) {
    console.error("Mancano SUPABASE_URL e/o una chiave (SUPABASE_SERVICE_ROLE_KEY o SUPABASE_ANON_KEY).");
    process.exit(1);
  }

  const tabelle = Object.keys(CONTRATTO);
  const risultati = await Promise.all(
    tabelle.map(async (t) => ({ tabella: t, ...(await verificaTabella(baseUrl, key, t, CONTRATTO[t])) }))
  );

  const falliti = risultati.filter((r) => !r.ok);
  for (const r of risultati) {
    console.log(`${r.ok ? "OK  " : "FAIL"}  ${r.tabella}${r.ok ? "" : "  — " + r.dettaglio}`);
  }

  console.log("");
  if (falliti.length === 0) {
    console.log(`Schema conforme al contratto: ${tabelle.length}/${tabelle.length} tabelle verificate.`);
    process.exit(0);
  } else {
    console.log(`${falliti.length} tabella/e non conformi al contratto (vedi FAIL sopra). Il deploy non dovrebbe procedere finché non sono risolte o il contratto in questo file non viene aggiornato consapevolmente.`);
    process.exit(1);
  }
}

main();
