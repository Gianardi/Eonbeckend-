/* EON BRAIN, punto 6 — parte MANUALE/DAL VIVO della suite di
   valutazione (vedi eval/casi.json e eval/README.md per il quadro
   completo, eval/router.test.js per la parte automatica che non
   richiede l'AI vera).

   Questo script manda ogni caso di eval/casi.json che richiede l'AI
   vera (tutti tranne quelli con "verifica": "router_locale", già
   coperti da router.test.js) al vero endpoint /api?action=assistant,
   e stampa domanda + risposta vera + cosa ci si aspettava, una sotto
   l'altra. Non decide da solo se un caso è "passato": per i casi con
   "verifica":"automatica" fa un controllo semplice sugli strumenti
   chiamati (quello che si può leggere dalla forma della risposta senza
   capire l'italiano); per i casi "manuale" (la maggior parte — capire
   se una domanda è naturale, se un rifiuto è onesto, ecc. è un
   giudizio che oggi solo una persona può dare) stampa tutto e basta,
   perché lo si legga.

   ATTENZIONE — richiede un ACCOUNT DI PROVA, mai quello vero:
   questo script crea davvero clienti, impegni e appunti (alcuni casi
   lo richiedono esplicitamente, es. i clienti omonimi). Usalo SOLO
   con un utente Supabase creato apposta per i test, mai con
   l'account con i dati reali dei clienti.

   Uso:
     EVAL_API_URL=https://tuo-progetto.vercel.app/api?action=assistant \
     EVAL_ACCESS_TOKEN=<token dell'utente di prova, dal login> \
     node eval/live-check.js

   (EVAL_ACCESS_TOKEN si ottiene facendo login con l'utente di prova
   nell'app vera e leggendo currentSession.access_token dalla console
   del browser, oppure con una chiamata diretta a Supabase Auth.) */

const fs = require("fs");
const path = require("path");

const API_URL = process.env.EVAL_API_URL;
const ACCESS_TOKEN = process.env.EVAL_ACCESS_TOKEN;

if (!API_URL || !ACCESS_TOKEN) {
  console.error("Servono EVAL_API_URL e EVAL_ACCESS_TOKEN (vedi il commento in cima a questo file per come ottenerli).");
  console.error("Questo script NON è mai stato eseguito in questa sessione: l'ambiente di sviluppo non ha accesso a un vero backend Vercel/Supabase né a una chiave Anthropic live.");
  process.exit(1);
}

const catalogo = JSON.parse(fs.readFileSync(path.join(__dirname, "casi.json"), "utf8"));

async function chiediAssistente(messaggio, runId) {
  const r = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${ACCESS_TOKEN}` },
    body: JSON.stringify(runId ? { runId, messaggio } : { messaggio }),
  });
  const json = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(json.error || `errore ${r.status}`);
  return json;
}

/* Restituisce un array di {descrizione, ok} — uno per ogni proprietà
   controllabile dichiarata nel caso — o null se il caso non dichiara
   nessuna proprietà automaticamente verificabile.

   IMPORTANTE su strumenti_attesi: vale solo per strumenti NON sensibili
   (crea_impegno, crea_appunto, ecc.), che finiscono davvero in
   risposta.azioni quando eseguiti. Uno strumento sensibile
   (sposta_impegno, elimina_impegno, manda_messaggio...) non esegue
   subito: il comportamento corretto è che il server si fermi a
   chiedere conferma (stato:"in_attesa_conferma"), quindi NON compare
   ancora in azioni — per quei casi va usato stato_atteso, non
   strumenti_attesi, altrimenti il controllo automatico bocciarebbe un
   comportamento in realtà corretto. */
function controlloAutomatico(caso, risposta) {
  const risultati = [];

  if (caso.atteso.strumenti_attesi !== undefined) {
    const strumentiOttenuti = (risposta.azioni || []).map((a) => a.tool);
    const stessoMultiset = caso.atteso.strumenti_attesi.slice().sort().join(",") === strumentiOttenuti.slice().sort().join(",");
    risultati.push({ descrizione: `strumenti [${caso.atteso.strumenti_attesi.join(", ")}]`, ok: stessoMultiset, dettaglio: `ottenuto [${strumentiOttenuti.join(", ")}]` });
  }

  if (caso.atteso.stato_atteso !== undefined) {
    risultati.push({ descrizione: `stato "${caso.atteso.stato_atteso}"`, ok: risposta.stato === caso.atteso.stato_atteso, dettaglio: `ottenuto "${risposta.stato}"` });
  }

  if (caso.atteso.testo_finisce_con_domanda !== undefined) {
    const testo = (risposta.testo || risposta.domanda || "").trim();
    const finisceConDomanda = /\?\s*$/.test(testo);
    risultati.push({ descrizione: `il testo ${caso.atteso.testo_finisce_con_domanda ? "" : "NON "}finisce con un punto interrogativo`, ok: finisceConDomanda === caso.atteso.testo_finisce_con_domanda, dettaglio: `testo: "${testo}"` });
  }

  return risultati.length ? risultati : null;
}

async function eseguiCaso(caso) {
  console.log(`\n=== ${caso.id} — ${caso.categoria} ===`);
  console.log(`Situazione: ${caso.situazione}`);
  if (caso.precondizione) console.log(`ATTENZIONE — precondizione richiesta: ${caso.precondizione}`);

  const frasi = caso.input_sequenza || [caso.input];
  let runId;
  let ultimaRisposta;
  for (const frase of frasi) {
    console.log(`\n> "${frase}"`);
    try {
      ultimaRisposta = await chiediAssistente(frase, runId);
      runId = ultimaRisposta.runId;
      console.log(JSON.stringify(ultimaRisposta, null, 2));
    } catch (err) {
      console.log(`ERRORE: ${err.message}`);
      return;
    }
  }

  console.log(`\nAtteso: ${JSON.stringify(caso.atteso)}`);
  if (caso.atteso.verifica === "automatica") {
    const risultati = controlloAutomatico(caso, ultimaRisposta);
    if (risultati) {
      for (const r of risultati) console.log(r.ok ? `AUTOMATICO OK: ${r.descrizione}` : `AUTOMATICO FAIL: ${r.descrizione} — ${r.dettaglio}`);
    } else {
      console.log("AUTOMATICO: nessuna proprietà controllabile dichiarata per questo caso, leggi la risposta sopra");
    }
  } else {
    console.log("MANUALE: leggi la risposta sopra e giudica tu in base al controllo indicato.");
  }
}

async function main() {
  const daEseguire = catalogo.casi.filter((c) => c.atteso.tipo !== "router_locale");
  console.log(`${daEseguire.length} casi da eseguire dal vivo (${catalogo.casi.length - daEseguire.length} sono di solo router, già coperti da eval/router.test.js).`);
  for (const caso of daEseguire) {
    await eseguiCaso(caso);
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
