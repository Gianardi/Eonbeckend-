/* EON BRAIN, punto 5 — parte AUTOMATICA sul BACKEND (nuova, oltre a
   eval/router.test.js che copre solo il frontend deterministico — vedi
   eval/casi.json e eval/README.md per il quadro completo).

   Copre le due funzioni pure introdotte per il nuovo contratto centrale
   (IntentFrame, Current Focus — punti 1 e 2 di TODO.md): niente rete,
   niente database, niente AI vera — solo la logica di estrazione/
   derivazione a partire da una cronologia di messaggi già costruita a
   mano, come la produrrebbe davvero Anthropic. Non testa se Claude
   SCEGLIE di dichiarare un certo IntentFrame per una certa frase (quello
   dipende dal modello vero, è materia di eval/live-check.js) — testa che,
   UNA VOLTA dichiarato in un certo modo, il codice lo interpreti sempre
   nello stesso modo, qualunque sia la frase che lo ha prodotto. È
   esattamente la distinzione richiesta dai criteri di test della gap
   analysis: verificare la capacità generale, non una frase specifica.

   Uso: node eval/backend.test.js */

const path = require("path");

let fallimenti = 0;
let totali = 0;

function verifica(nome, condizione, dettaglio) {
  totali++;
  if (condizione) {
    console.log(`  OK   ${nome}`);
  } else {
    fallimenti++;
    console.log(`  FAIL ${nome}${dettaglio ? " — " + JSON.stringify(dettaglio) : ""}`);
  }
}

/* Costruisce un messaggio "assistant" con uno o più blocchi tool_use,
   nella stessa forma che restituisce davvero l'API Anthropic — così i
   test esercitano esattamente il formato che estraiIntentoDaMessaggi
   riceve in produzione, non una versione semplificata. */
function msgAssistente(...toolUses) {
  return { role: "assistant", content: toolUses.map((t) => ({ type: "tool_use", name: t.name, input: t.input })) };
}
function toolUse(name, input) {
  return { name, input };
}

async function main() {
  const { estraiIntentoDaMessaggi, costruisciFocus } = await import(path.join(__dirname, "..", "api", "index.js"));

  console.log("\n--- estraiIntentoDaMessaggi ---");

  verifica(
    "cronologia vuota -> nessun intento",
    estraiIntentoDaMessaggi([]) === null
  );

  verifica(
    "nessuna dichiarazione nella cronologia -> nessun intento",
    estraiIntentoDaMessaggi([
      { role: "user", content: "ciao" },
      msgAssistente(toolUse("cerca_cliente", { nome: "Rossi" })),
    ]) === null
  );

  verifica(
    "una sola dichiarazione -> restituisce quella",
    (() => {
      const intento = estraiIntentoDaMessaggi([
        { role: "user", content: "fammi vedere il documento di Rossi" },
        msgAssistente(toolUse("interpreta_richiesta", { operazione: "mostra", oggetto: "risorsa" })),
      ]);
      return intento && intento.operazione === "mostra" && intento.oggetto === "risorsa";
    })()
  );

  verifica(
    "più dichiarazioni in turni diversi -> vince sempre l'ULTIMA, mai la prima (situazione mai testata prima: 3 dichiarazioni in sequenza, non 2)",
    (() => {
      const messaggi = [
        msgAssistente(toolUse("interpreta_richiesta", { operazione: "mostra", oggetto: "risorsa" })),
        msgAssistente(toolUse("interpreta_richiesta", { operazione: "crea", oggetto: "azione" })),
        msgAssistente(toolUse("interpreta_richiesta", { operazione: "invia", oggetto: "comunicazione" })),
      ];
      const intento = estraiIntentoDaMessaggi(messaggi);
      return intento && intento.operazione === "invia" && intento.oggetto === "comunicazione";
    })()
  );

  verifica(
    "capacita_non_disponibile scarica l'intento risorsa precedente (mai bloccare il ripiego appena proposto)",
    estraiIntentoDaMessaggi([
      msgAssistente(toolUse("interpreta_richiesta", { operazione: "mostra", oggetto: "risorsa" })),
      msgAssistente(toolUse("capacita_non_disponibile", { cosa_manca: "il cartello cantiere" })),
    ]) === null
  );

  verifica(
    "una NUOVA dichiarazione dopo capacita_non_disponibile torna a valere (l'intento non resta scaricato per sempre)",
    (() => {
      const intento = estraiIntentoDaMessaggi([
        msgAssistente(toolUse("interpreta_richiesta", { operazione: "mostra", oggetto: "risorsa" })),
        msgAssistente(toolUse("capacita_non_disponibile", { cosa_manca: "il cartello cantiere" })),
        msgAssistente(toolUse("interpreta_richiesta", { operazione: "crea", oggetto: "azione" })),
      ]);
      return intento && intento.operazione === "crea" && intento.oggetto === "azione";
    })()
  );

  verifica(
    "più blocchi nello STESSO messaggio (mai testato prima): capacita_non_disponibile dopo interpreta_richiesta nello stesso turno scarica comunque",
    estraiIntentoDaMessaggi([
      msgAssistente(
        toolUse("interpreta_richiesta", { operazione: "mostra", oggetto: "risorsa" }),
        toolUse("capacita_non_disponibile", { cosa_manca: "x" })
      ),
    ]) === null
  );

  console.log("\n--- costruisciFocus ---");

  function frame(operazione, oggetto, entita) {
    return [msgAssistente(toolUse("interpreta_richiesta", { operazione, oggetto, entita }))];
  }

  verifica(
    "nessun intento dichiarato -> nessun focus",
    Object.keys(costruisciFocus([])).length === 0
  );

  verifica(
    "entità esplicita con oggetto 'azione' -> diventa focus",
    (() => {
      const r = costruisciFocus(frame("crea", "azione", { tipo: "cliente", riferimento_esplicito: "Bianchi" }));
      return r.focus && r.focus.tipo === "cliente" && r.focus.riferimento === "Bianchi";
    })()
  );

  verifica(
    "entità esplicita con oggetto 'risorsa' -> diventa focus (dominio mai provato prima: tipo 'foto')",
    (() => {
      const r = costruisciFocus(frame("mostra", "risorsa", { tipo: "foto", riferimento_esplicito: "cantiere Trani" }));
      return r.focus && r.focus.tipo === "foto" && r.focus.riferimento === "cantiere Trani";
    })()
  );

  verifica(
    "operazione 'consulta' -> MAI focus, anche con un'entità nominata come esempio",
    Object.keys(costruisciFocus(frame("consulta", "nessuno", { tipo: "cliente", riferimento_esplicito: "Rossi" }))).length === 0
  );

  verifica(
    "riferimento implicito (usa_focus_corrente) -> nessun nuovo focus, si mantiene quello già in mano al frontend",
    Object.keys(costruisciFocus(frame("invia", "comunicazione", { tipo: "cliente", usa_focus_corrente: true }))).length === 0
  );

  verifica(
    "nessuna entità dichiarata -> nessun focus",
    Object.keys(costruisciFocus(frame("crea", "azione", null))).length === 0
  );

  verifica(
    "entità con tipo ma senza riferimento (né esplicito né focus corrente) -> nessun focus",
    Object.keys(costruisciFocus(frame("mostra", "risorsa", { tipo: "documento" }))).length === 0
  );

  verifica(
    "riferimento fatto solo di spazi -> trattato come assente, nessun focus",
    Object.keys(costruisciFocus(frame("mostra", "risorsa", { tipo: "documento", riferimento_esplicito: "   " }))).length === 0
  );

  verifica(
    "cliente_di_riferimento senza riferimento_esplicito (correzione roadmap 1.2, es. 'i documenti del cliente Colombi') -> diventa focus di tipo 'cliente', non nessun focus",
    (() => {
      const r = costruisciFocus(frame("mostra", "risorsa", { tipo: "documento", cliente_di_riferimento: "Colombi" }));
      return r.focus && r.focus.tipo === "cliente" && r.focus.riferimento === "Colombi";
    })()
  );

  verifica(
    "riferimento_esplicito E cliente_di_riferimento insieme -> vince riferimento_esplicito (comportamento originale invariato, il cliente resta solo per la risoluzione)",
    (() => {
      const r = costruisciFocus(frame("mostra", "risorsa", { tipo: "preventivo", riferimento_esplicito: "il preventivo del tetto", cliente_di_riferimento: "Colombi" }));
      return r.focus && r.focus.tipo === "preventivo" && r.focus.riferimento === "il preventivo del tetto";
    })()
  );

  verifica(
    "cliente_di_riferimento fatto solo di spazi -> trattato come assente, nessun focus",
    Object.keys(costruisciFocus(frame("mostra", "risorsa", { tipo: "documento", cliente_di_riferimento: "   " }))).length === 0
  );

  console.log(`\n${totali - fallimenti}/${totali} verifiche passate.`);
  if (fallimenti > 0) process.exitCode = 1;
}

main().catch((err) => { console.error(err); process.exitCode = 1; });
